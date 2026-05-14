// src/components/FolderModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal for managing (creating / deleting) bookmark folders.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Modal, Input, Button, List, Popconfirm, ColorPicker, Space, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import type { Color } from 'antd/es/color-picker';
import db from '@/db/database';
import type { Folder } from '@/types';

interface FolderModalProps {
  open:      boolean;
  onClose:   () => void;
  folders:   Folder[];
  /** Called after any create or delete so the parent can re-query. */
  onChanged: () => void;
}

export function FolderModal({ open, onClose, folders, onChanged }: FolderModalProps) {
  const [newFolderName,  setNewFolderName]  = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#1677ff');
  const [isCreating,     setIsCreating]     = useState(false);

  async function handleCreateFolder() {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) return;

    setIsCreating(true);

    const newFolder: Folder = {
      id:        uuidv4(),
      name:      trimmedName,
      color:     newFolderColor,
      createdAt: new Date().toISOString(),
    };

    await db.folders.add(newFolder);
    setNewFolderName('');
    setIsCreating(false);
    onChanged();
  }

  async function handleDeleteFolder(folderId: string) {
    // Remove the folder
    await db.folders.delete(folderId);
    // Unassign any bookmarks that were in this folder
    await db.bookmarks
      .where('folderId')
      .equals(folderId)
      .modify({ folderId: null });
    onChanged();
  }

  function handleColorChange(colorValue: Color) {
    setNewFolderColor(colorValue.toHexString());
  }

  return (
    <Modal
      title="Manage Folders"
      open={open}
      onCancel={onClose}
      footer={null}
      width={440}
    >
      {/* Create new folder */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>New folder</p>
        <Space.Compact style={{ width: '100%' }}>
          <ColorPicker
            value={newFolderColor}
            onChange={handleColorChange}
            size="middle"
            showText={false}
          />
          <Input
            placeholder="Folder name (e.g. Fitness, Programming…)"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onPressEnter={handleCreateFolder}
            maxLength={40}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateFolder}
            loading={isCreating}
            disabled={!newFolderName.trim()}
          >
            Create
          </Button>
        </Space.Compact>
      </div>

      {/* Existing folders */}
      {folders.length === 0 ? (
        <Empty description="No folders yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={folders}
          renderItem={(folder) => (
            <List.Item
              key={folder.id}
              actions={[
                <Popconfirm
                  key="delete"
                  title="Delete this folder?"
                  description="Bookmarks inside will become uncategorized."
                  onConfirm={() => handleDeleteFolder(folder.id)}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                  />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <span
                    style={{
                      width:           14,
                      height:          14,
                      borderRadius:    '50%',
                      backgroundColor: folder.color,
                      display:         'inline-block',
                      marginTop:       4,
                    }}
                  />
                }
                title={folder.name}
                description={`Created ${new Date(folder.createdAt).toLocaleDateString()}`}
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
}
