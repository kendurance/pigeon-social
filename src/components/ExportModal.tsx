// src/components/ExportModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal for exporting (backing up) bookmarks to a PigeonExport JSON file.
//
// Features:
//   • Per-folder checkboxes + "Include uncategorized" toggle
//   • "Export everything" shortcut to select all at once
//   • Writes a pigeon-export-{date}.json file to the user's downloads
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { Modal, Checkbox, Button, Space, Divider, Empty, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import db from '@/db/database';
import type { Folder, PigeonExport } from '@/types';

const { Text } = Typography;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExportModalProps {
  open:     boolean;
  onClose:  () => void;
  folders:  Folder[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExportModal({ open, onClose, folders }: ExportModalProps) {
  const [selectedFolderIds,    setSelectedFolderIds]    = useState<Set<string>>(new Set());
  const [includeUncategorized, setIncludeUncategorized] = useState(false);
  const [isExporting,          setIsExporting]          = useState(false);

  const nothingSelected = selectedFolderIds.size === 0 && !includeUncategorized;

  const allSelected = useMemo(
    () => selectedFolderIds.size === folders.length && includeUncategorized,
    [selectedFolderIds, includeUncategorized, folders.length]
  );

  function handleClose() {
    setSelectedFolderIds(new Set());
    setIncludeUncategorized(false);
    setIsExporting(false);
    onClose();
  }

  function toggleFolder(folderId: string) {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function selectAll() {
    setSelectedFolderIds(new Set(folders.map((f) => f.id)));
    setIncludeUncategorized(true);
  }

  function deselectAll() {
    setSelectedFolderIds(new Set());
    setIncludeUncategorized(false);
  }

  async function handleExport() {
    setIsExporting(true);

    try {
      const selectedFolders = folders.filter((f) => selectedFolderIds.has(f.id));
      const bookmarksToExport = [];

      // Fetch bookmarks for each selected folder
      if (selectedFolderIds.size > 0) {
        const folderBookmarks = await db.bookmarks
          .where('folderId')
          .anyOf([...selectedFolderIds])
          .toArray();
        bookmarksToExport.push(...folderBookmarks);
      }

      // Fetch uncategorized bookmarks if requested
      if (includeUncategorized) {
        const uncategorized = await db.bookmarks
          .filter((b) => b.folderId === null)
          .toArray();
        bookmarksToExport.push(...uncategorized);
      }

      const pigeonExport: PigeonExport = {
        version:    1,
        exportedAt: new Date().toISOString(),
        folders:    selectedFolders,
        bookmarks:  bookmarksToExport,
      };

      const dateStr = new Date().toISOString().split('T')[0];
      triggerDownload(
        JSON.stringify(pigeonExport, null, 2),
        `pigeon-export-${dateStr}.json`
      );

      handleClose();
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Modal
      title="Export Bookmarks"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={460}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Select all / deselect all shortcut */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Choose what to include in the backup file.
          </Text>
          <Button
            type="link"
            size="small"
            onClick={allSelected ? deselectAll : selectAll}
            style={{ padding: 0 }}
          >
            {allSelected ? 'Deselect all' : 'Export everything'}
          </Button>
        </div>

        {/* Folder list */}
        {folders.length === 0 ? (
          <Empty
            description="No folders yet"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ margin: '8px 0' }}
          />
        ) : (
          <div
            style={{
              border:       '1px solid #f0f0f0',
              borderRadius: 8,
              overflow:     'hidden',
            }}
          >
            {folders.map((folder, idx) => (
              <div
                key={folder.id}
                onClick={() => toggleFolder(folder.id)}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  gap:             10,
                  padding:         '10px 14px',
                  cursor:          'pointer',
                  borderBottom:    idx < folders.length - 1 ? '1px solid #f5f5f5' : 'none',
                  backgroundColor: selectedFolderIds.has(folder.id) ? '#f0f7ff' : 'transparent',
                  transition:      'background-color 0.15s',
                }}
              >
                <Checkbox
                  checked={selectedFolderIds.has(folder.id)}
                  onChange={() => toggleFolder(folder.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span
                  style={{
                    width:           10,
                    height:          10,
                    borderRadius:    '50%',
                    backgroundColor: folder.color,
                    flexShrink:      0,
                  }}
                />
                <span style={{ fontSize: 14 }}>{folder.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Uncategorized option */}
        <Divider style={{ margin: '0' }} />
        <Checkbox
          checked={includeUncategorized}
          onChange={(e) => setIncludeUncategorized(e.target.checked)}
        >
          Include uncategorized bookmarks
        </Checkbox>

        {/* Export button */}
        <Button
          type="primary"
          block
          icon={<DownloadOutlined />}
          loading={isExporting}
          disabled={nothingSelected}
          onClick={handleExport}
          style={{ borderRadius: 8, height: 40 }}
        >
          {isExporting ? 'Exporting…' : 'Download backup'}
        </Button>
      </Space>
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
