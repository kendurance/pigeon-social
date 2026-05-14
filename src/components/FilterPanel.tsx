// src/components/FilterPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The collapsible filter card that lives just below the app header.
// On mobile: a collapsed strip that expands downward.
// On desktop: same behaviour, anchored to the top-left.
//
// Filter options:
//   • Text search (debounced)
//   • Source toggles (Twitter / Instagram / YouTube)
//   • Folder selector
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { Input, Button, Space, Collapse, Badge } from 'antd';
import { FilterOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { Folder } from '@/types';
import type { BookmarkSource, FilterState } from '@/types';
import { SourceIcon } from './SourceIcon';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_SOURCES: BookmarkSource[] = ['twitter', 'instagram', 'youtube'];
const SOURCE_LABEL: Record<BookmarkSource, string> = {
  twitter:   'Twitter',
  instagram: 'Instagram',
  youtube:   'YouTube',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface FilterPanelProps {
  filter:            FilterState;
  allFolders:        Folder[];
  bookmarkCountBySrc: Record<BookmarkSource, number>;
  onSearchChange:    (query: string) => void;
  onToggleSource:    (source: BookmarkSource) => void;
  onFolderChange:    (folderId: string | null | 'uncategorized') => void;
  onClearAll:        () => void;
  isFiltered:        boolean;
}

export function FilterPanel({
  filter,
  allFolders,
  bookmarkCountBySrc,
  onSearchChange,
  onToggleSource,
  onFolderChange,
  onClearAll,
  isFiltered,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  /** Count how many filter dimensions are active (for the badge). */
  const activeFilterCount =
    (filter.searchQuery ? 1 : 0) +
    filter.activeSources.length +
    (filter.activeFolderId !== null ? 1 : 0);

  const handleSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value);
    },
    [onSearchChange]
  );

  return (
    <div
      className="pigeon-filter-panel"
      style={{
        backgroundColor: '#ffffff',
        borderRadius:    12,
        boxShadow:       '0 2px 8px rgba(0,0,0,0.08)',
        overflow:        'hidden',
      }}
    >
      {/* ── Panel header (always visible) ─────────────────────────────────── */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         8,
          padding:     '10px 14px',
          cursor:      'pointer',
          userSelect:  'none',
        }}
      >
        <Badge count={activeFilterCount} size="small" offset={[2, -2]}>
          <FilterOutlined style={{ fontSize: 16, color: '#0066CC' }} />
        </Badge>

        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>
          Filters
        </span>

        {isFiltered && (
          <Button
            type="link"
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={(e) => { e.stopPropagation(); onClearAll(); }}
            style={{ padding: 0, height: 'auto', fontSize: 12 }}
          >
            Clear
          </Button>
        )}

        <span style={{ color: '#8c8c8c', fontSize: 12 }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {/* ── Expandable filter body ─────────────────────────────────────────── */}
      {isExpanded && (
        <div
          style={{
            padding:    '0 14px 14px',
            borderTop:  '1px solid #f0f0f0',
          }}
        >
          {/* Search input */}
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#555' }}>
              Search
            </p>
            <Input
              placeholder="Search bookmarks…"
              allowClear
              value={filter.searchQuery}
              onChange={handleSearchInput}
              style={{ borderRadius: 8 }}
            />
          </div>

          {/* Source toggles */}
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#555' }}>
              Source
            </p>
            <Space wrap>
              {ALL_SOURCES.map((source) => {
                const isActive = filter.activeSources.includes(source);
                const count    = bookmarkCountBySrc[source] ?? 0;

                return (
                  <Button
                    key={source}
                    size="small"
                    type={isActive ? 'primary' : 'default'}
                    onClick={() => onToggleSource(source)}
                    icon={<SourceIcon source={source} size={12} />}
                    style={{
                      borderRadius:    20,
                      display:         'inline-flex',
                      alignItems:      'center',
                      gap:             4,
                      opacity:         count === 0 ? 0.45 : 1,
                    }}
                    disabled={count === 0}
                  >
                    {SOURCE_LABEL[source]} ({count})
                  </Button>
                );
              })}
            </Space>
          </div>

          {/* Folder selector */}
          {allFolders.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#555' }}>
                Folder
              </p>
              <Space wrap>
                <Button
                  key="all"
                  size="small"
                  type={filter.activeFolderId === null ? 'primary' : 'default'}
                  onClick={() => onFolderChange(null)}
                  style={{ borderRadius: 20 }}
                >
                  All
                </Button>

                <Button
                  key="uncategorized"
                  size="small"
                  type={filter.activeFolderId === 'uncategorized' ? 'primary' : 'default'}
                  onClick={() => onFolderChange('uncategorized')}
                  style={{ borderRadius: 20 }}
                >
                  Uncategorized
                </Button>

                {allFolders.map((folder) => (
                  <Button
                    key={folder.id}
                    size="small"
                    type={filter.activeFolderId === folder.id ? 'primary' : 'default'}
                    onClick={() => onFolderChange(folder.id)}
                    style={{
                      borderRadius: 20,
                      borderColor:  filter.activeFolderId === folder.id ? undefined : folder.color,
                    }}
                  >
                    <span
                      style={{
                        display:         'inline-block',
                        width:           8,
                        height:          8,
                        borderRadius:    '50%',
                        backgroundColor: folder.color,
                        marginRight:     5,
                      }}
                    />
                    {folder.name}
                  </Button>
                ))}
              </Space>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
