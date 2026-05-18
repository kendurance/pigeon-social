// src/components/ImportModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal dialog for importing bookmarks from a JSON file.
// Handles:
//   • Drag-and-drop or click-to-browse file selection
//   • JSON parsing with error feedback
//   • Auto-detection of the source (Twitter / Instagram / YouTube / PigeonExport)
//   • Optional: pre-create a folder from a YouTube playlist name
//   • Writing the imported bookmarks to IndexedDB
//   • Restore from a PigeonExport backup file, with per-folder conflict resolution
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Modal, Upload, Alert, Button, Space, Checkbox, Input,
  Radio, Typography, Divider, Tag, Progress,
} from 'antd';
import { InboxOutlined, CheckCircleOutlined, RestOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import db from '@/db/database';
import { detectAndMap } from '@/mappers';
import { fetchInstagramAvatars } from '@/utils/fetchInstagramAvatars';
import type { Folder } from '@/types';

const { Dragger } = Upload;
const { Text } = Typography;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ImportModalProps {
  open:      boolean;
  onClose:   () => void;
  /** Called after a successful import/restore so the parent can refresh. */
  onImported: (newCount: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImportModal({ open, onClose, onImported }: ImportModalProps) {
  const [parsedFileContent, setParsedFileContent] = useState<unknown>(null);
  const [parseError,        setParseError]        = useState<string | null>(null);
  const [importResult,      setImportResult]      = useState<{
    message: string;
    count: number;
    suggestedFolderName: string | null;
  } | null>(null);
  const [isImporting,       setIsImporting]       = useState(false);
  const [createFolder,      setCreateFolder]      = useState(false);
  const [folderNameInput,   setFolderNameInput]   = useState('');

  // Tracks Instagram avatar-fetch progress so the modal can show a progress
  // bar during the ~14s first-import wait. Null when no IG enrichment is
  // running (initial state, non-IG sources, after completion).
  const [avatarProgress, setAvatarProgress] = useState<{ completed: number; total: number } | null>(null);

  // Map from exportedFolder.id → 'merge' | 'rename' for PigeonExport conflicts.
  // Defaults to 'merge' at read time if the key is absent.
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, 'merge' | 'rename'>>(new Map());

  // Current folders in DB — needed to detect conflicts during restore
  const currentFolders = useLiveQuery(() => db.folders.toArray(), []) ?? [];

  /** Resets all state back to the initial empty condition. */
  function resetModal() {
    setParsedFileContent(null);
    setParseError(null);
    setImportResult(null);
    setIsImporting(false);
    setCreateFolder(false);
    setFolderNameInput('');
    setConflictResolutions(new Map());
    setAvatarProgress(null);
  }

  function handleClose() {
    resetModal();
    onClose();
  }

  /**
   * Called by the Ant Design Dragger before the upload begins.
   * We return false to prevent AntD from actually uploading anywhere —
   * we just want to read the file locally.
   */
  function handleBeforeUpload(file: File): false {
    resetModal();

    const fileReader = new FileReader();

    fileReader.onload = (readerEvent) => {
      const rawText = readerEvent.target?.result as string;

      try {
        const parsed = JSON.parse(rawText);
        setParsedFileContent(parsed);

        // Preview detection result so user can see what was found
        const result = detectAndMap(parsed);
        if (result.suggestedFolderName) {
          setFolderNameInput(result.suggestedFolderName);
          setCreateFolder(true);
        }
      } catch {
        setParseError('Could not parse this file as JSON. Make sure it\'s a valid export file.');
      }
    };

    fileReader.onerror = () => {
      setParseError('Failed to read the file. Please try again.');
    };

    fileReader.readAsText(file);
    return false; // Prevent AntD from doing its own upload
  }

  /** Runs the mapper and writes results to IndexedDB. */
  async function handleImport() {
    if (!parsedFileContent) return;

    setIsImporting(true);
    setParseError(null);

    try {
      const mappingResult = detectAndMap(parsedFileContent);

      // ── PigeonExport restore path ──────────────────────────────────────────
      if (mappingResult.detectedSource === 'pigeon-export') {
        const { folders: exportedFolders, bookmarks: exportedBookmarks } = mappingResult;

        // Build a map: exported folder ID → the DB folder ID to use
        const folderIdMap = new Map<string, string>();

        for (const exportedFolder of exportedFolders) {
          const existing = currentFolders.find((f) => f.name === exportedFolder.name);

          if (existing) {
            const resolution = conflictResolutions.get(exportedFolder.id) ?? 'merge';

            if (resolution === 'merge') {
              folderIdMap.set(exportedFolder.id, existing.id);
            } else {
              // Create a new folder with a disambiguated name
              const newFolder: Folder = {
                id:        uuidv4(),
                name:      `${exportedFolder.name} (restored)`,
                color:     exportedFolder.color,
                createdAt: exportedFolder.createdAt,
              };
              await db.folders.add(newFolder);
              folderIdMap.set(exportedFolder.id, newFolder.id);
            }
          } else {
            // No name conflict — reuse the exported ID if it doesn't collide
            const idTaken = currentFolders.some((f) => f.id === exportedFolder.id);
            const newFolder: Folder = {
              id:        idTaken ? uuidv4() : exportedFolder.id,
              name:      exportedFolder.name,
              color:     exportedFolder.color,
              createdAt: exportedFolder.createdAt,
            };
            await db.folders.add(newFolder);
            folderIdMap.set(exportedFolder.id, newFolder.id);
          }
        }

        // Gather existing URLs for duplicate detection
        const existingUrls = new Set(
          (await db.bookmarks.toArray()).map((b) => b.url)
        );

        let skippedCount = 0;
        const bookmarksToInsert = exportedBookmarks
          .filter((b) => {
            if (existingUrls.has(b.url)) { skippedCount++; return false; }
            return true;
          })
          .map((b) => ({
            ...b,
            folderId: b.folderId ? (folderIdMap.get(b.folderId) ?? null) : null,
          }));

        await db.bookmarks.bulkPut(bookmarksToInsert);

        const skippedNote = skippedCount > 0
          ? ` (${skippedCount} duplicate${skippedCount !== 1 ? 's' : ''} skipped)`
          : '';

        setImportResult({
          message:             `Restored ${bookmarksToInsert.length} bookmark${bookmarksToInsert.length !== 1 ? 's' : ''}${skippedNote}.`,
          count:               bookmarksToInsert.length,
          suggestedFolderName: null,
        });
        onImported(bookmarksToInsert.length);
        return;
      }

      // ── Regular social-media import path ───────────────────────────────────
      if (mappingResult.detectedSource === 'unknown' || mappingResult.bookmarks.length === 0) {
        setParseError(mappingResult.message);
        setIsImporting(false);
        return;
      }

      let targetFolderId: string | null = null;

      // If the user wants to create a folder, add it to IndexedDB first
      if (createFolder && folderNameInput.trim()) {
        const newFolder: Folder = {
          id:        uuidv4(),
          name:      folderNameInput.trim(),
          color:     generateFolderColor(folderNameInput.trim()),
          createdAt: new Date().toISOString(),
        };
        await db.folders.add(newFolder);
        targetFolderId = newFolder.id;
      }

      // Assign folder ID to all imported bookmarks if one was created/selected
      const bookmarksToInsert = mappingResult.bookmarks.map((bookmark) => ({
        ...bookmark,
        folderId: targetFolderId,
      }));

      // Instagram-only: enrich with creator avatars by scraping the public
      // profile page's og:image. The saved-posts API doesn't include
      // profile_pic_url, and the avatar URL outlives the feed-image URL by
      // months — so BookmarkCard can fall through from the (soon-stale)
      // feed image to a durable avatar.
      //
      // We seed fetchInstagramAvatars with avatars already in the DB so that
      // re-imports don't hammer IG for usernames we've resolved before.
      if (mappingResult.detectedSource === 'instagram') {
        const cachedAvatars: Record<string, string> = {};
        const existingIgBookmarks = await db.bookmarks
          .where('source').equals('instagram')
          .toArray();
        for (const existing of existingIgBookmarks) {
          if (existing.authorAvatarUrl) {
            const cachedKey = existing.authorName.replace(/^@/, '');
            cachedAvatars[cachedKey] = existing.authorAvatarUrl;
          }
        }

        const igUsernames = bookmarksToInsert
          .map((b) => b.authorName.replace(/^@/, ''))
          .filter((u) => u && u !== 'instagram');
        const avatarLookup = await fetchInstagramAvatars(
          igUsernames,
          cachedAvatars,
          (completed, total) => setAvatarProgress({ completed, total }),
        );
        setAvatarProgress(null);
        for (const bookmark of bookmarksToInsert) {
          const username  = bookmark.authorName.replace(/^@/, '');
          const avatarUrl = avatarLookup[username];
          if (avatarUrl) bookmark.authorAvatarUrl = avatarUrl;
        }
      }

      // Bulk insert into IndexedDB (much faster than inserting one at a time)
      await db.bookmarks.bulkPut(bookmarksToInsert);

      setImportResult({
        message:             mappingResult.message,
        count:               bookmarksToInsert.length,
        suggestedFolderName: mappingResult.suggestedFolderName,
      });

      onImported(bookmarksToInsert.length);
    } catch (err) {
      setParseError(`Import failed: ${String(err)}`);
    } finally {
      setIsImporting(false);
    }
  }

  // Preview what was detected (before actual import)
  const previewResult = parsedFileContent ? detectAndMap(parsedFileContent) : null;

  // Folders in the backup whose name already exists in the DB
  const conflictingFolders = useMemo(() => {
    if (previewResult?.detectedSource !== 'pigeon-export') return [];
    return previewResult.folders.filter((ef) =>
      currentFolders.some((cf) => cf.name === ef.name)
    );
  }, [previewResult, currentFolders]);

  const isPigeonExport = previewResult?.detectedSource === 'pigeon-export';

  return (
    <Modal
      title="Import Bookmarks"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      {/* ── Success state ──────────────────────────────────────────────────── */}
      {importResult ? (
        <Space direction="vertical" style={{ width: '100%', textAlign: 'center', padding: '16px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            {isPigeonExport ? 'Restore complete!' : 'Import complete!'}
          </p>
          <p style={{ color: '#666', margin: 0 }}>{importResult.message}</p>
          <Button type="primary" onClick={handleClose} style={{ marginTop: 8 }}>
            Done
          </Button>
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* File drop zone */}
          <Dragger
            accept=".json"
            multiple={false}
            showUploadList={false}
            beforeUpload={handleBeforeUpload}
            style={{ borderRadius: 8 }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#0066CC' }} />
            </p>
            <p className="ant-upload-text">Click or drag your export JSON here</p>
            <p className="ant-upload-hint" style={{ fontSize: 12 }}>
              Supports: Twitter · Instagram · YouTube · PigeonSocial backup
            </p>
          </Dragger>

          {/* Parse error */}
          {parseError && (
            <Alert type="error" message={parseError} showIcon />
          )}

          {/* ── PigeonExport restore UI ─────────────────────────────────── */}
          {isPigeonExport && previewResult !== null && (
            <>
              <Alert
                type="info"
                showIcon
                icon={<RestOutlined />}
                message={
                  <span>
                    PigeonSocial backup detected &mdash;{' '}
                    <strong>{previewResult.bookmarks.length}</strong> bookmark{previewResult.bookmarks.length !== 1 ? 's' : ''},{' '}
                    <strong>{previewResult.folders.length}</strong> folder{previewResult.folders.length !== 1 ? 's' : ''}.
                    Duplicate URLs will be skipped automatically.
                  </span>
                }
              />

              {conflictingFolders.length > 0 && (
                <div
                  style={{
                    border:       '1px solid #faad14',
                    borderRadius: 8,
                    padding:      '12px 14px',
                    backgroundColor: '#fffbe6',
                  }}
                >
                  <Text strong style={{ fontSize: 13 }}>
                    {conflictingFolders.length} folder name conflict{conflictingFolders.length !== 1 ? 's' : ''}
                  </Text>
                  <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 10 }}>
                    These folder names already exist. Choose how to handle each one.
                  </Text>

                  <Space direction="vertical" style={{ width: '100%' }} size={10}>
                    {conflictingFolders.map((folder) => (
                      <div key={folder.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            width:           10,
                            height:          10,
                            borderRadius:    '50%',
                            backgroundColor: folder.color,
                            flexShrink:      0,
                          }}
                        />
                        <Tag style={{ margin: 0 }}>{folder.name}</Tag>
                        <Radio.Group
                          size="small"
                          optionType="button"
                          buttonStyle="solid"
                          value={conflictResolutions.get(folder.id) ?? 'merge'}
                          onChange={(e) =>
                            setConflictResolutions((prev) => {
                              const next = new Map(prev);
                              next.set(folder.id, e.target.value as 'merge' | 'rename');
                              return next;
                            })
                          }
                          options={[
                            { label: 'Merge', value: 'merge' },
                            { label: 'Create new', value: 'rename' },
                          ]}
                        />
                      </div>
                    ))}
                  </Space>

                  <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 10 }}>
                    <strong>Merge</strong> — adds restored bookmarks into the existing folder.{' '}
                    <strong>Create new</strong> — creates a folder named "… (restored)".
                  </Text>
                </div>
              )}
            </>
          )}

          {/* ── Regular import detection preview ────────────────────────── */}
          {previewResult !== null &&
            previewResult.detectedSource !== 'unknown' &&
            !isPigeonExport &&
            !importResult && (
              <Alert
                type="info"
                showIcon
                message={
                  <span>
                    Detected <strong>{previewResult.detectedSource}</strong> export —{' '}
                    <strong>{previewResult.bookmarks.length}</strong> item
                    {previewResult.bookmarks.length !== 1 ? 's' : ''} found.
                  </span>
                }
              />
            )}

          {/* Folder creation option — only for regular imports, not restore */}
          {previewResult !== null &&
            previewResult.detectedSource !== 'unknown' &&
            !isPigeonExport && (
              <div>
                <Checkbox
                  checked={createFolder}
                  onChange={(e) => setCreateFolder(e.target.checked)}
                  style={{ marginBottom: createFolder ? 8 : 0 }}
                >
                  Also create a new folder for these imports
                </Checkbox>

                {createFolder && (
                  <Input
                    placeholder="Folder name"
                    value={folderNameInput}
                    onChange={(e) => setFolderNameInput(e.target.value)}
                    style={{ borderRadius: 8 }}
                    maxLength={40}
                  />
                )}
              </div>
            )}

          {/* Instagram avatar-fetch progress — visible during the serial
              web_profile_info loop, which can take ~14s on a first import */}
          {avatarProgress !== null && avatarProgress.total > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                Fetching Instagram creator avatars — {avatarProgress.completed} / {avatarProgress.total}
              </Text>
              <Progress
                percent={Math.round((avatarProgress.completed / avatarProgress.total) * 100)}
                size="small"
                strokeColor="#E1306C"
                showInfo={false}
              />
            </div>
          )}

          {/* Import / Restore button */}
          {parsedFileContent !== null && !parseError && (
            <>
              {isPigeonExport && <Divider style={{ margin: '4px 0' }} />}
              <Button
                type="primary"
                block
                loading={isImporting}
                onClick={handleImport}
                disabled={!isPigeonExport && createFolder && !folderNameInput.trim()}
                style={{ borderRadius: 8, height: 40 }}
              >
                {isImporting
                  ? isPigeonExport ? 'Restoring…' : 'Importing…'
                  : isPigeonExport ? 'Restore' : 'Import'}
              </Button>
            </>
          )}
        </Space>
      )}
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Deterministically picks a pleasant folder colour from the name's char codes. */
function generateFolderColor(folderName: string): string {
  const pleasantColors = [
    '#1677ff', '#52c41a', '#fa8c16', '#eb2f96',
    '#722ed1', '#13c2c2', '#f5222d', '#faad14',
  ];
  const nameCharSum = folderName
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return pleasantColors[nameCharSum % pleasantColors.length];
}
