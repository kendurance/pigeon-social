// src/components/ImportModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal dialog for importing bookmarks from one or more JSON files.
// Handles:
//   • Multi-file drag-and-drop or click-to-browse (mixed sources in one batch)
//   • JSON parsing with per-file error feedback
//   • Auto-detection of each file's source (Twitter / Instagram / YouTube / PigeonExport)
//   • Duplicate detection: bookmarks whose URL already exists are updated in-place,
//     preserving the user's folder assignment, tags, and dateAdded
//   • Optional: pre-create a folder per YouTube playlist
//   • PigeonExport restore with per-folder conflict resolution (merge / rename)
//   • Writing results to IndexedDB with ImportSession history records
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Modal, Upload, Button, Space, Checkbox, Input,
  Radio, Typography, Divider, Tag, Progress, Spin, Tooltip,
} from 'antd';
import {
  InboxOutlined, CheckCircleOutlined, RestOutlined,
  WarningOutlined, CloseCircleOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import db from '@/db/database';
import { detectAndMap } from '@/mappers';
import type { DetectAndMapResult } from '@/mappers';
import { fetchInstagramAvatars } from '@/utils/fetchInstagramAvatars';
import { SourceIcon } from '@/components/SourceIcon';
import type { Bookmark, BookmarkSource, Folder } from '@/types';

const { Dragger } = Upload;
const { Text } = Typography;

// ── Types ─────────────────────────────────────────────────────────────────────

type FileState =
  | { status: 'parsing';   file: File }
  | { status: 'parsed';    file: File; parsed: unknown; preview: DetectAndMapResult }
  | { status: 'parseError'; file: File; error: string }
  | { status: 'importing'; file: File; preview: DetectAndMapResult; avatarProgress?: { completed: number; total: number } }
  | { status: 'imported';  file: File; preview: DetectAndMapResult; added: number; updated: number }
  | { status: 'failed';    file: File; preview: DetectAndMapResult | null; error: string };

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ImportModalProps {
  open:      boolean;
  onClose:   () => void;
  /** Called after the user clicks Done so the parent can close the modal. */
  onImported: (newCount: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImportModal({ open, onClose, onImported }: ImportModalProps) {
  const [files, setFiles]             = useState<Map<string, FileState>>(new Map());
  const [sessionGroupId]              = useState(() => uuidv4());
  const [isImporting, setIsImporting] = useState(false);
  const [allDone, setAllDone]         = useState(false);

  // PigeonExport folder-conflict resolutions: exportedFolder.id → 'merge' | 'rename'
  const [conflictResolutions, setConflictResolutions] =
    useState<Map<string, 'merge' | 'rename'>>(new Map());

  // Per-YouTube-file folder creation opts: fileKey → { create, name }
  const [youtubeFolderOpts, setYoutubeFolderOpts] =
    useState<Map<string, { create: boolean; name: string }>>(new Map());

  // Live folder list needed to detect PigeonExport folder-name conflicts
  const currentFolders = useLiveQuery(() => db.folders.toArray(), []) ?? [];

  // ── Derived state ─────────────────────────────────────────────────────────

  const fileEntries = [...files.entries()];

  const pigeonExportEntry = fileEntries.find(
    ([, s]) => (s.status === 'parsed' || s.status === 'importing' || s.status === 'imported')
      && (s as { preview: DetectAndMapResult }).preview?.detectedSource === 'pigeon-export',
  );

  const conflictingFolders = useMemo(() => {
    if (!pigeonExportEntry) return [];
    const preview = (pigeonExportEntry[1] as { preview: DetectAndMapResult }).preview;
    return preview.folders.filter((ef) =>
      currentFolders.some((cf) => cf.name === ef.name),
    );
  }, [pigeonExportEntry, currentFolders]);

  const importableEntries = fileEntries.filter(([, s]) => s.status === 'parsed');
  const totalImportableItems = importableEntries.reduce((sum, [, s]) => {
    const preview = (s as { preview: DetectAndMapResult }).preview;
    return sum + (preview?.bookmarks.length ?? 0);
  }, 0);

  const doneEntries    = fileEntries.filter(([, s]) => s.status === 'imported' || s.status === 'failed');
  const successEntries = fileEntries.filter(([, s]) => s.status === 'imported');
  const totalAdded     = successEntries.reduce((sum, [, s]) => sum + (s as { added: number }).added, 0);
  const totalUpdated   = successEntries.reduce((sum, [, s]) => sum + (s as { updated: number }).updated, 0);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function resetModal() {
    setFiles(new Map());
    setIsImporting(false);
    setAllDone(false);
    setConflictResolutions(new Map());
    setYoutubeFolderOpts(new Map());
  }

  function handleClose() {
    resetModal();
    onClose();
  }

  function handleDone() {
    const finalAdded = [...files.values()]
      .filter((s): s is Extract<FileState, { status: 'imported' }> => s.status === 'imported')
      .reduce((sum, s) => sum + s.added, 0);
    resetModal();
    onImported(finalAdded);
  }

  /**
   * Called by AntD Dragger once per file dropped/selected.
   * Returns false to prevent AntD from doing its own upload.
   */
  function handleBeforeUpload(file: File): false {
    const key = fileKey(file);
    setFiles((prev) => new Map(prev).set(key, { status: 'parsing', file }));

    const reader = new FileReader();

    reader.onload = (e) => {
      const rawText = e.target?.result as string;
      try {
        const parsed = JSON.parse(rawText);
        const preview = detectAndMap(parsed);

        setFiles((prev) => {
          // Enforce at-most-one PigeonExport per batch
          if (preview.detectedSource === 'pigeon-export') {
            const hasPigeon = [...prev.values()].some(
              (s) =>
                s.status !== 'parseError' &&
                (s as { preview?: DetectAndMapResult }).preview?.detectedSource === 'pigeon-export',
            );
            if (hasPigeon) {
              return new Map(prev).set(key, {
                status: 'parseError',
                file,
                error: 'Only one backup file per import session.',
              });
            }
          }

          // Initialise YouTube folder opt (default: create a folder)
          if (preview.detectedSource === 'youtube' && preview.suggestedFolderName) {
            setYoutubeFolderOpts((ytPrev) => {
              if (ytPrev.has(key)) return ytPrev;
              const next = new Map(ytPrev);
              next.set(key, { create: true, name: preview.suggestedFolderName! });
              return next;
            });
          }

          return new Map(prev).set(key, { status: 'parsed', file, parsed, preview });
        });
      } catch {
        setFiles((prev) =>
          new Map(prev).set(key, {
            status: 'parseError',
            file,
            error: "Couldn't parse as JSON. Make sure it's a valid export file.",
          }),
        );
      }
    };

    reader.onerror = () => {
      setFiles((prev) =>
        new Map(prev).set(key, {
          status: 'parseError',
          file,
          error: 'Failed to read file. Please try again.',
        }),
      );
    };

    reader.readAsText(file);
    return false;
  }

  function handleRemoveFile(key: string) {
    setFiles((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    setYoutubeFolderOpts((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  async function handleImportAll() {
    setIsImporting(true);

    // Seed IG avatar cache once from DB so we don't re-fetch known creators
    const sessionAvatarCache: Record<string, string> = {};
    const existingIg = await db.bookmarks.where('source').equals('instagram').toArray();
    for (const b of existingIg) {
      if (b.authorAvatarUrl) {
        sessionAvatarCache[b.authorName.replace(/^@/, '')] = b.authorAvatarUrl;
      }
    }

    // Snapshot current files in insertion order (only 'parsed' rows are processed)
    const snapshot = [...files.entries()];

    for (const [key, fileState] of snapshot) {
      if (fileState.status !== 'parsed') continue;

      const { file, preview } = fileState;

      setFiles((prev) => new Map(prev).set(key, { status: 'importing', file, preview }));

      try {
        let added   = 0;
        let updated = 0;

        if (preview.detectedSource === 'pigeon-export') {
          ({ added, updated } = await importPigeonExport(preview));
        } else if (preview.detectedSource !== 'unknown') {
          ({ added, updated } = await importSocialMedia(key, preview, sessionAvatarCache));
        } else {
          throw new Error('Unknown export format — cannot import.');
        }

        await db.importSessions.add({
          id:             uuidv4(),
          importedAt:     new Date().toISOString(),
          fileName:       file.name,
          detectedSource: preview.detectedSource,
          addedCount:     added,
          updatedCount:   updated,
          skippedCount:   0,
          status:         'success',
          errorMessage:   null,
          sessionGroupId,
        });

        setFiles((prev) => new Map(prev).set(key, { status: 'imported', file, preview, added, updated }));
      } catch (err) {
        await db.importSessions.add({
          id:             uuidv4(),
          importedAt:     new Date().toISOString(),
          fileName:       file.name,
          detectedSource: preview.detectedSource,
          addedCount:     0,
          updatedCount:   0,
          skippedCount:   0,
          status:         'failed',
          errorMessage:   String(err),
          sessionGroupId,
        });

        setFiles((prev) => new Map(prev).set(key, { status: 'failed', file, preview, error: String(err) }));
      }
    }

    setIsImporting(false);
    setAllDone(true);
  }

  // ── Import helpers ────────────────────────────────────────────────────────

  /**
   * Processes a social-media file (Twitter / Instagram / YouTube).
   * Writes the avatar cache in-place for cross-file IG dedup.
   */
  async function importSocialMedia(
    key: string,
    preview: DetectAndMapResult,
    avatarCache: Record<string, string>,
  ): Promise<{ added: number; updated: number }> {
    const mapped = preview.bookmarks.filter((b) => b.url !== '');
    const urls   = mapped.map((b) => b.url);

    // Bulk dedup lookup via the url index (Phase 2b — v2 schema)
    const existingMatches = await db.bookmarks.where('url').anyOf(urls).toArray();
    const existingByUrl   = new Map(existingMatches.map((b) => [b.url, b]));

    // Create YouTube folder if the user opted in
    let targetFolderId: string | null = null;
    if (preview.detectedSource === 'youtube') {
      const ytOpts = youtubeFolderOpts.get(key);
      if (ytOpts?.create && ytOpts.name.trim()) {
        const newFolder: Folder = {
          id:        uuidv4(),
          name:      ytOpts.name.trim(),
          color:     generateFolderColor(ytOpts.name.trim()),
          createdAt: new Date().toISOString(),
        };
        await db.folders.add(newFolder);
        targetFolderId = newFolder.id;
      }
    }

    // Build the write array: new bookmarks insert, existing bookmarks update
    const writes: Bookmark[] = mapped.map((nb) => {
      const ex = existingByUrl.get(nb.url);
      if (!ex) {
        // New — assign the YouTube folder if one was created; otherwise uncategorized
        return { ...nb, folderId: targetFolderId };
      }
      // Update — overwrite metadata, preserve user-curated fields
      return {
        id:             ex.id,
        folderId:       ex.folderId,
        tags:           ex.tags,
        dateAdded:      ex.dateAdded,
        source:         ex.source, // never change source on a metadata refresh
        title:          nb.title,
        url:            nb.url,
        thumbnailUrl:   nb.thumbnailUrl,
        authorName:     nb.authorName,
        // Don't clobber a known avatar with null (IG re-imports come in with null)
        authorAvatarUrl: nb.authorAvatarUrl ?? ex.authorAvatarUrl,
        mediaType:      nb.mediaType,
        rawData:        nb.rawData,
      };
    });

    // Instagram avatar enrichment — serial, rate-limited, cross-file cached
    if (preview.detectedSource === 'instagram') {
      const igUsernames = writes
        .map((b) => b.authorName.replace(/^@/, ''))
        .filter((u) => u && u !== 'instagram');

      const avatarLookup = await fetchInstagramAvatars(
        igUsernames,
        avatarCache,
        (completed, total) => {
          setFiles((prev) => {
            const current = prev.get(key);
            if (current?.status === 'importing') {
              return new Map(prev).set(key, { ...current, avatarProgress: { completed, total } });
            }
            return prev;
          });
        },
      );

      // Merge resolved entries back into the session cache
      for (const [username, url] of Object.entries(avatarLookup)) {
        if (url) avatarCache[username] = url;
      }

      for (const bookmark of writes) {
        const username = bookmark.authorName.replace(/^@/, '');
        const url = avatarLookup[username];
        if (url) bookmark.authorAvatarUrl = url;
      }
    }

    // Single bulkPut — insert-or-replace by primary key in one transaction
    await db.bookmarks.bulkPut(writes);

    return {
      added:   writes.filter((b) => !existingByUrl.has(b.url)).length,
      updated: writes.filter((b) =>  existingByUrl.has(b.url)).length,
    };
  }

  /**
   * Processes a PigeonExport backup file.
   * Resolves folder conflicts, remaps folderId fields, then runs the same
   * update-on-duplicate dedup logic used by social-media imports.
   */
  async function importPigeonExport(
    preview: DetectAndMapResult,
  ): Promise<{ added: number; updated: number }> {
    const { folders: exportedFolders, bookmarks: exportedBookmarks } = preview;
    const snapshot = await db.folders.toArray();

    // Build exported folder ID → target DB folder ID map
    const folderIdMap = new Map<string, string>();
    for (const ef of exportedFolders) {
      const existing = snapshot.find((f) => f.name === ef.name);
      if (existing) {
        const resolution = conflictResolutions.get(ef.id) ?? 'merge';
        if (resolution === 'merge') {
          folderIdMap.set(ef.id, existing.id);
        } else {
          const newFolder: Folder = {
            id:        uuidv4(),
            name:      `${ef.name} (restored)`,
            color:     ef.color,
            createdAt: ef.createdAt,
          };
          await db.folders.add(newFolder);
          folderIdMap.set(ef.id, newFolder.id);
        }
      } else {
        const idTaken = snapshot.some((f) => f.id === ef.id);
        const newFolder: Folder = {
          id:        idTaken ? uuidv4() : ef.id,
          name:      ef.name,
          color:     ef.color,
          createdAt: ef.createdAt,
        };
        await db.folders.add(newFolder);
        folderIdMap.set(ef.id, newFolder.id);
      }
    }

    // Remap folderId on exported bookmarks to the resolved DB folder IDs
    const remapped = exportedBookmarks
      .filter((b) => b.url !== '')
      .map((b) => ({
        ...b,
        folderId: b.folderId ? (folderIdMap.get(b.folderId) ?? null) : null,
      }));

    // Bulk dedup lookup
    const urls          = remapped.map((b) => b.url);
    const existingMatch = await db.bookmarks.where('url').anyOf(urls).toArray();
    const existingByUrl = new Map(existingMatch.map((b) => [b.url, b]));

    const writes: Bookmark[] = remapped.map((nb) => {
      const ex = existingByUrl.get(nb.url);
      if (!ex) return nb;
      // Update on duplicate — preserve current DB organization, overwrite metadata
      return {
        id:             ex.id,
        folderId:       ex.folderId,   // keep current folder (user may have reorganized)
        tags:           ex.tags,
        dateAdded:      ex.dateAdded,
        source:         ex.source,
        title:          nb.title,
        url:            nb.url,
        thumbnailUrl:   nb.thumbnailUrl,
        authorName:     nb.authorName,
        authorAvatarUrl: nb.authorAvatarUrl ?? ex.authorAvatarUrl,
        mediaType:      nb.mediaType,
        rawData:        nb.rawData,
      };
    });

    await db.bookmarks.bulkPut(writes);

    return {
      added:   writes.filter((b) => !existingByUrl.has(b.url)).length,
      updated: writes.filter((b) =>  existingByUrl.has(b.url)).length,
    };
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      title="Import Bookmarks"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={540}
      destroyOnClose
    >
      {allDone ? (
        /* ── Summary panel ────────────────────────────────────────────────── */
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a' }} />
            <p style={{ fontSize: 16, fontWeight: 600, margin: '8px 0 0' }}>
              {successEntries.length === fileEntries.length ? 'Import complete!' : `${successEntries.length} of ${fileEntries.length} files imported`}
            </p>
            {(totalAdded > 0 || totalUpdated > 0) && (
              <p style={{ color: '#666', margin: '4px 0 0', fontSize: 13 }}>
                {totalAdded > 0 && <><strong>{totalAdded}</strong> new bookmark{totalAdded !== 1 ? 's' : ''}</>}
                {totalAdded > 0 && totalUpdated > 0 && <>, </>}
                {totalUpdated > 0 && <><strong>{totalUpdated}</strong> updated</>}
                {doneEntries.length > 0 && (
                  <> · <Link to="/import-history" onClick={handleClose}>View history</Link></>
                )}
              </p>
            )}
          </div>

          {/* Per-file results list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fileEntries.map(([key, state]) => (
              <FileRow key={key} fileState={state} ytOpts={youtubeFolderOpts.get(key)} />
            ))}
          </div>

          <Button type="primary" block onClick={handleDone} style={{ borderRadius: 8, height: 40 }}>
            Done
          </Button>
        </Space>
      ) : (
        /* ── Main import UI ───────────────────────────────────────────────── */
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* Drop zone — always visible when not done */}
          {!isImporting && (
            <Dragger
              accept=".json"
              multiple
              showUploadList={false}
              beforeUpload={handleBeforeUpload}
              style={{ borderRadius: 8 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#0066CC' }} />
              </p>
              <p className="ant-upload-text">
                {files.size > 0 ? 'Drop more files or click to add' : 'Click or drag your export JSON here'}
              </p>
              <p className="ant-upload-hint" style={{ fontSize: 12 }}>
                Supports: Twitter · Instagram · YouTube · PigeonSocial backup
              </p>
            </Dragger>
          )}

          {/* Per-file row list */}
          {files.size > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fileEntries.map(([key, state]) => (
                <FileRow
                  key={key}
                  fileState={state}
                  ytOpts={youtubeFolderOpts.get(key)}
                  onRemove={state.status !== 'importing' && !isImporting ? () => handleRemoveFile(key) : undefined}
                  onYtOptsChange={(opts) => setYoutubeFolderOpts((prev) => new Map(prev).set(key, opts))}
                />
              ))}
            </div>
          )}

          {/* PigeonExport folder-conflict section */}
          {pigeonExportEntry && conflictingFolders.length > 0 && (
            <div
              style={{
                border:          '1px solid #faad14',
                borderRadius:    8,
                padding:         '12px 14px',
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
                        width: 10, height: 10,
                        borderRadius: '50%',
                        backgroundColor: folder.color,
                        flexShrink: 0,
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

          {/* Import button */}
          {importableEntries.length > 0 && (
            <>
              <Divider style={{ margin: '4px 0' }} />
              <Button
                type="primary"
                block
                loading={isImporting}
                onClick={handleImportAll}
                style={{ borderRadius: 8, height: 40 }}
              >
                {isImporting
                  ? 'Importing…'
                  : `Import${importableEntries.length > 1 ? ` all (${importableEntries.length} files` : ''}${importableEntries.length > 1 && totalImportableItems > 0 ? `, ${totalImportableItems} items)` : importableEntries.length > 1 ? ')' : ''}`}
              </Button>
            </>
          )}
        </Space>
      )}
    </Modal>
  );
}

// ── FileRow sub-component ─────────────────────────────────────────────────────

interface FileRowProps {
  fileState:      FileState;
  ytOpts?:        { create: boolean; name: string };
  onRemove?:      () => void;
  onYtOptsChange?: (opts: { create: boolean; name: string }) => void;
}

function FileRow({ fileState, ytOpts, onRemove, onYtOptsChange }: FileRowProps) {
  const { file } = fileState;
  const name = file.name.length > 30 ? `…${file.name.slice(-28)}` : file.name;

  function renderSourceBadge(detectedSource: DetectAndMapResult['detectedSource']) {
    const socialSources: BookmarkSource[] = ['twitter', 'instagram', 'youtube'];
    if (socialSources.includes(detectedSource as BookmarkSource)) {
      return <SourceIcon source={detectedSource as BookmarkSource} size={16} />;
    }
    if (detectedSource === 'pigeon-export') return <RestOutlined style={{ fontSize: 14, color: '#003087' }} />;
    return <WarningOutlined style={{ fontSize: 14, color: '#faad14' }} />;
  }

  function renderStatus() {
    switch (fileState.status) {
      case 'parsing':
        return <Spin size="small" />;

      case 'parsed': {
        const { preview } = fileState;
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {preview.bookmarks.length} item{preview.bookmarks.length !== 1 ? 's' : ''}
          </Text>
        );
      }

      case 'parseError':
        return (
          <Tooltip title={fileState.error}>
            <WarningOutlined style={{ color: '#faad14', fontSize: 16 }} />
          </Tooltip>
        );

      case 'importing': {
        const ap = fileState.avatarProgress;
        if (ap && ap.total > 0) {
          return (
            <div style={{ minWidth: 120 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Avatars {ap.completed}/{ap.total}
              </Text>
              <Progress
                percent={Math.round((ap.completed / ap.total) * 100)}
                size="small"
                strokeColor="#E1306C"
                showInfo={false}
              />
            </div>
          );
        }
        return <Spin size="small" />;
      }

      case 'imported': {
        const { added, updated } = fileState;
        return (
          <Text style={{ fontSize: 12, color: '#52c41a' }}>
            <CheckCircleOutlined /> {added > 0 && `${added} new`}{added > 0 && updated > 0 && ' · '}{updated > 0 && `${updated} updated`}
            {added === 0 && updated === 0 && 'No changes'}
          </Text>
        );
      }

      case 'failed':
        return (
          <Tooltip title={fileState.error}>
            <CloseCircleOutlined style={{ color: '#f5222d', fontSize: 16 }} />
          </Tooltip>
        );
    }
  }

  const preview = (fileState as { preview?: DetectAndMapResult }).preview;
  const isYoutube = preview?.detectedSource === 'youtube' && fileState.status === 'parsed';

  return (
    <div>
      <div
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             8,
          padding:         '7px 10px',
          borderRadius:    8,
          backgroundColor: '#f8f8f8',
          border:          '1px solid #ececec',
        }}
      >
        {preview && renderSourceBadge(preview.detectedSource)}
        {fileState.status === 'parsing' && <WarningOutlined style={{ fontSize: 14, color: '#d9d9d9' }} />}

        <Text ellipsis style={{ flex: 1, fontSize: 13 }} title={file.name}>
          {name}
        </Text>

        {renderStatus()}

        {onRemove && (
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={onRemove}
            style={{ color: '#bbb', flexShrink: 0 }}
          />
        )}
      </div>

      {/* YouTube folder creation inline — only for 'parsed' YouTube rows */}
      {isYoutube && ytOpts && onYtOptsChange && (
        <div style={{ padding: '6px 10px 2px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Checkbox
            checked={ytOpts.create}
            onChange={(e) => onYtOptsChange({ ...ytOpts, create: e.target.checked })}
            style={{ fontSize: 12 }}
          >
            Create folder for this playlist
          </Checkbox>
          {ytOpts.create && (
            <Input
              size="small"
              placeholder="Folder name"
              value={ytOpts.name}
              onChange={(e) => onYtOptsChange({ ...ytOpts, name: e.target.value })}
              style={{ borderRadius: 6, maxWidth: 260 }}
              maxLength={40}
            />
          )}
        </div>
      )}
    </div>
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
