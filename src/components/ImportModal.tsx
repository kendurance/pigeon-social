// src/components/ImportModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal dialog for importing bookmarks from a JSON file.
// Handles:
//   • Drag-and-drop or click-to-browse file selection
//   • JSON parsing with error feedback
//   • Auto-detection of the source (Twitter / Instagram / YouTube)
//   • Optional: pre-create a folder from a YouTube playlist name
//   • Writing the imported bookmarks to IndexedDB
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Modal, Upload, Alert, Button, Space, Checkbox, Input } from 'antd';
import { InboxOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import db from '@/db/database';
import { detectAndMap } from '@/mappers';
import type { Folder } from '@/types';

const { Dragger } = Upload;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ImportModalProps {
  open:      boolean;
  onClose:   () => void;
  /** Called after a successful import so the parent can refresh. */
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

  /** Resets all state back to the initial empty condition. */
  function resetModal() {
    setParsedFileContent(null);
    setParseError(null);
    setImportResult(null);
    setIsImporting(false);
    setCreateFolder(false);
    setFolderNameInput('');
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

  return (
    <Modal
      title="Import Bookmarks"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      {/* Success state */}
      {importResult ? (
        <Space direction="vertical" style={{ width: '100%', textAlign: 'center', padding: '16px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Import complete!</p>
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
              Supports: Twitter Bookmarks Downloader · Instagram saved posts (DevTools) · YouTube Playlist Exporter
            </p>
          </Dragger>

          {/* Parse error */}
          {parseError && (
            <Alert type="error" message={parseError} showIcon />
          )}

          {/* Detection preview */}
          {previewResult && previewResult.detectedSource !== 'unknown' && !importResult && (
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

          {/* Folder creation option */}
          {previewResult && previewResult.detectedSource !== 'unknown' && (
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

          {/* Import button */}
          {parsedFileContent && !parseError && (
            <Button
              type="primary"
              block
              loading={isImporting}
              onClick={handleImport}
              disabled={createFolder && !folderNameInput.trim()}
              style={{ borderRadius: 8, height: 40 }}
            >
              {isImporting ? 'Importing…' : 'Import'}
            </Button>
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
