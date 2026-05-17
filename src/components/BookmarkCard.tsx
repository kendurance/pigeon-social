// src/components/BookmarkCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The single reusable card component used to display any bookmark, regardless
// of source. Layout spec from the design doc:
//
//   ┌─────────────────────────────┐
//   │  [thumbnail / fallback]     │  ← hidden when showPreviews = false
//   ├─────────────────────────────┤
//   │ [SrcIcon] Title (bold)      │  ← title truncates after 2 lines
//   │           Date added        │  ← smaller muted text
//   └─────────────────────────────┘
//
// The source icon is flush in the bottom-left footer, its height matching
// the combined height of the title + date lines.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Card, Tooltip, Dropdown, Tag } from 'antd';
import type { MenuProps } from 'antd';
import { EllipsisOutlined, FolderAddOutlined, DeleteOutlined, LinkOutlined, PlayCircleFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Bookmark, BookmarkMediaType, Folder } from '@/types';
import { SourceIcon } from './SourceIcon';

dayjs.extend(relativeTime);


// ── Props ─────────────────────────────────────────────────────────────────────

interface BookmarkCardProps {
  bookmark: Bookmark;
  /** All available folders, used to build the "Move to folder" submenu. */
  allFolders: Folder[];
  /** Whether to render the thumbnail image. Controlled by app settings. */
  showPreview: boolean;
  /** Called when the user selects a folder from the dropdown. */
  onMoveToFolder: (bookmarkId: string, folderId: string | null) => void;
  /** Called when the user deletes the bookmark. */
  onDelete: (bookmarkId: string) => void;
}

export function BookmarkCard({
  bookmark,
  allFolders,
  showPreview,
  onMoveToFolder,
  onDelete,
}: BookmarkCardProps) {
  /** Controls whether the thumbnail failed to load (shows fallback instead). */
  const [thumbnailLoadFailed, setThumbnailLoadFailed] = useState(false);

  // Default for legacy bookmarks imported before mediaType existed.
  const effectiveMediaType: BookmarkMediaType = bookmark.mediaType ?? 'image';
  const isTextOnly = effectiveMediaType === 'text';
  const isVideo    = effectiveMediaType === 'video';

  // Reject obviously-broken URLs up front: empty strings and data: URIs (which
  // can sneak in as lazy-load placeholders) succeed in <img> without firing
  // onError, leaving a broken-icon glyph in the layout.
  const hasUsableThumbnailUrl =
    bookmark.thumbnailUrl !== null &&
    bookmark.thumbnailUrl.trim() !== '' &&
    !bookmark.thumbnailUrl.startsWith('data:');

  const shouldShowThumbnail =
    showPreview &&
    !isTextOnly &&
    hasUsableThumbnailUrl &&
    !thumbnailLoadFailed;

  // Show the grey source-icon placeholder when:
  //  - mediaType is 'text' (no image was ever expected)
  //  - or a thumbnail URL existed but failed to load (expired IG token, etc.)
  // Legacy bookmarks (mediaType defaulted to 'image') with null thumbnailUrl
  // still collapse to text-only — preserving their previous render.
  const shouldShowPlaceholder =
    showPreview &&
    !shouldShowThumbnail &&
    (isTextOnly || (hasUsableThumbnailUrl && thumbnailLoadFailed));

  // Build the folder submenu items for the "Move to folder" option
  const folderMenuItems: MenuProps['items'] = [
    // Option to remove from any folder (uncategorize)
    {
      key:   'uncategorized',
      label: '— No folder (uncategorized)',
      onClick: () => onMoveToFolder(bookmark.id, null),
    },
    // Divider
    { type: 'divider' },
    // One item per existing folder
    ...allFolders.map((folder) => ({
      key:   folder.id,
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: folder.color,
              flexShrink: 0,
            }}
          />
          {folder.name}
        </span>
      ),
      onClick: () => onMoveToFolder(bookmark.id, folder.id),
    })),
    ...(allFolders.length === 0
      ? [{ key: 'no-folders', label: 'No folders yet — create one first', disabled: true }]
      : []),
  ];

  // The "⋯" context menu shown in the card's top-right corner
  const contextMenuItems: MenuProps['items'] = [
    {
      key:     'open',
      icon:    <LinkOutlined />,
      label:   'Open original',
      onClick: () => window.open(bookmark.url, '_blank', 'noopener,noreferrer'),
    },
    {
      key:      'move',
      icon:     <FolderAddOutlined />,
      label:    'Move to folder',
      children: folderMenuItems,
    },
    { type: 'divider' },
    {
      key:     'delete',
      icon:    <DeleteOutlined />,
      label:   'Delete bookmark',
      danger:  true,
      onClick: () => onDelete(bookmark.id),
    },
  ];

  // The folder this bookmark currently belongs to (for the badge)
  const currentFolder = allFolders.find((f) => f.id === bookmark.folderId);

  // Formatted date — relative for recent, absolute for older
  const dateLabel = dayjs(bookmark.dateAdded).fromNow();

  return (
    <Card
      hoverable
      className="pigeon-bookmark-card"
      styles={{
        body: { padding: 0 },
      }}
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '2px 4px 12px rgba(0,0,0,0.10)',
        marginBottom: 0,  // masonry handles spacing
      }}
    >
      {/* ── Thumbnail area ─────────────────────────────────────────────────── */}
      {shouldShowThumbnail && (
        <div
          style={{
            position:        'relative',
            width:           '100%',
            paddingTop:      '56.25%',  // 16:9 aspect ratio box
            backgroundColor: '#f0f0f0',
            overflow:        'hidden',
          }}
        >
          <img
            src={bookmark.thumbnailUrl!}
            alt={bookmark.title}
            onError={() => setThumbnailLoadFailed(true)}
            style={{
              position:   'absolute',
              top:        0,
              left:       0,
              width:      '100%',
              height:     '100%',
              objectFit:  'cover',
            }}
          />

          {/* Source badge overlaid on thumbnail */}
          <div
            style={{
              position:        'absolute',
              top:             8,
              left:            8,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderRadius:    6,
              padding:         '2px 5px',
              display:         'flex',
              alignItems:      'center',
              gap:             4,
            }}
          >
            <SourceIcon source={bookmark.source} size={14} />
          </div>

          {isVideo && <VideoPlayOverlay />}
        </div>
      )}

      {/* ── Placeholder (text-only post, or thumbnail URL that failed to load) ── */}
      {shouldShowPlaceholder && (
        <div
          style={{
            position:        'relative',
            width:           '100%',
            paddingTop:      '56.25%',
            backgroundColor: '#f5f5f5',
            overflow:        'hidden',
          }}
        >
          <div
            style={{
              position:       'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              opacity:        0.15,
            }}
          >
            <SourceIcon source={bookmark.source} size={48} />
          </div>

          {isVideo && <VideoPlayOverlay />}
        </div>
      )}

      {/* ── Card body / footer ──────────────────────────────────────────────── */}
      <div style={{ padding: '10px 12px' }}>

        {/* Folder tag + context menu row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          {currentFolder ? (
            <Tag color={currentFolder.color} style={{ fontSize: 11, margin: 0, borderRadius: 4 }}>
              {currentFolder.name}
            </Tag>
          ) : (
            <span /> // spacer keeps the layout consistent
          )}

          <Dropdown menu={{ items: contextMenuItems }} trigger={['click']} placement="bottomRight">
            <EllipsisOutlined
              style={{ cursor: 'pointer', fontSize: 16, color: '#8c8c8c', padding: '2px 4px' }}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </div>

        {/* Main content row: source icon + title + date */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {/* Source icon — flush left, vertically centred with title+date */}
          <div style={{ flexShrink: 0, marginTop: 2 }}>
            <SourceIcon source={bookmark.source} size={18} />
          </div>

          {/* Title and date */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <Tooltip
              title={bookmark.title}
              mouseEnterDelay={0.5}
              placement="topLeft"
            >
              <p
                style={{
                  fontWeight:   600,
                  fontSize:     13,
                  lineHeight:   1.4,
                  margin:       0,
                  // Clamp to 2 lines then ellipsis
                  display:             '-webkit-box',
                  WebkitLineClamp:     2,
                  WebkitBoxOrient:     'vertical',
                  overflow:            'hidden',
                  textOverflow:        'ellipsis',
                  wordBreak:           'break-word',
                }}
              >
                {bookmark.title}
              </p>
            </Tooltip>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                {bookmark.authorName}
              </span>
              <span style={{ color: '#d9d9d9' }}>·</span>
              <span style={{ fontSize: 11, color: '#b0b0b0' }} title={bookmark.dateAdded}>
                {dateLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Centered play-icon overlay drawn on top of the thumbnail/placeholder block
 * for video posts. Pointer-events: none so it never intercepts card clicks.
 */
function VideoPlayOverlay() {
  return (
    <div
      style={{
        position:       'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        pointerEvents:  'none',
      }}
    >
      <PlayCircleFilled style={{ fontSize: 56, color: 'rgba(255,255,255,0.92)', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))' }} />
    </div>
  );
}
