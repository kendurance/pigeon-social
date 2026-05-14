// src/pages/MainPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The main bookmark feed page.
//
// Features:
//   • Reads bookmarks and folders from IndexedDB via Dexie's useLiveQuery hook
//     (auto-updates whenever the DB changes — no manual refresh needed)
//   • Applies filter/search from Zustand store
//   • Renders results in a masonry grid using react-masonry-css
//   • Infinite scroll: loads PAGE_SIZE items at a time via IntersectionObserver
//   • Manages ImportModal and FolderModal open states
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Masonry from 'react-masonry-css';
import { Spin, Empty, FloatButton } from 'antd';
import { ImportOutlined, FolderAddOutlined, VerticalAlignTopOutlined } from '@ant-design/icons';
import db from '@/db/database';
import { useAppStore, selectIsFiltered } from '@/store/useAppStore';
import { AppHeader } from '@/components/AppHeader';
import { FilterPanel } from '@/components/FilterPanel';
import { BookmarkCard } from '@/components/BookmarkCard';
import { ImportModal } from '@/components/ImportModal';
import { FolderModal } from '@/components/FolderModal';
import type { Bookmark, BookmarkSource, Session } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** How many bookmarks to render per "page" in the infinite scroll. */
const PAGE_SIZE_MOBILE  = 10;
const PAGE_SIZE_DESKTOP = 20;

/** Breakpoint definitions for the masonry column count. */
const MASONRY_BREAKPOINTS = {
  default: 4,   // ≥ 1200px
  1199:    3,
  899:     2,
  599:     1,
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface MainPageProps {
  session:  Session;
  onLogout: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MainPage({ session, onLogout }: MainPageProps) {
  // ── Modal visibility state ─────────────────────────────────────────────────
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);

  // ── Infinite scroll: how many items are currently rendered ─────────────────
  const isMobile     = window.innerWidth < 600;
  const pageSize     = isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  /** Sentinel div at the bottom of the list — observed for intersection. */
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Global store: filters + settings ──────────────────────────────────────
  const settings       = useAppStore((s) => s.settings);
  const filter         = useAppStore((s) => s.filter);
  const isFiltered     = useAppStore(selectIsFiltered);
  const setSearch      = useAppStore((s) => s.setSearchQuery);
  const toggleSource   = useAppStore((s) => s.toggleSourceFilter);
  const setFolder      = useAppStore((s) => s.setActiveFolderId);
  const clearFilters   = useAppStore((s) => s.clearAllFilters);

  // ── Live DB queries (auto-update on DB changes) ────────────────────────────
  const allBookmarks = useLiveQuery(() =>
    db.bookmarks.orderBy('dateAdded').reverse().toArray()
  , []);

  const allFolders = useLiveQuery(() =>
    db.folders.orderBy('createdAt').toArray()
  , []);

  // ── Derived: which sources are actually enabled in settings ────────────────
  const enabledSources = useMemo<BookmarkSource[]>(() => {
    const sources: BookmarkSource[] = [];
    if (settings.showTwitter)   sources.push('twitter');
    if (settings.showInstagram) sources.push('instagram');
    if (settings.showYoutube)   sources.push('youtube');
    return sources;
  }, [settings.showTwitter, settings.showInstagram, settings.showYoutube]);

  // ── Derived: apply all filters to get the visible bookmark list ────────────
  const filteredBookmarks = useMemo<Bookmark[]>(() => {
    if (!allBookmarks) return [];

    return allBookmarks.filter((bookmark) => {
      // 1. Source must be enabled in settings
      if (!enabledSources.includes(bookmark.source)) return false;

      // 2. Source must pass the active source filter (if any)
      if (
        filter.activeSources.length > 0 &&
        !filter.activeSources.includes(bookmark.source)
      ) return false;

      // 3. Folder filter
      if (filter.activeFolderId === 'uncategorized' && bookmark.folderId !== null)  return false;
      if (filter.activeFolderId && filter.activeFolderId !== 'uncategorized' && bookmark.folderId !== filter.activeFolderId) return false;

      // 4. Text search — case-insensitive match against title or author
      if (filter.searchQuery) {
        const query      = filter.searchQuery.toLowerCase();
        const titleMatch  = bookmark.title.toLowerCase().includes(query);
        const authorMatch = bookmark.authorName.toLowerCase().includes(query);
        if (!titleMatch && !authorMatch) return false;
      }

      return true;
    });
  }, [allBookmarks, enabledSources, filter]);

  // ── Slice the filtered list to the current page ───────────────────────────
  const visibleBookmarks = useMemo(
    () => filteredBookmarks.slice(0, visibleCount),
    [filteredBookmarks, visibleCount]
  );

  const hasMore = visibleCount < filteredBookmarks.length;

  // ── Infinite scroll via IntersectionObserver ──────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // When the sentinel scrolls into view, load the next page
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => prev + pageSize);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, pageSize]);

  // Reset visible count when filters change (so we start from the top)
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [filter, pageSize]);

  // ── Bookmark mutation handlers ─────────────────────────────────────────────

  const handleMoveToFolder = useCallback(
    async (bookmarkId: string, newFolderId: string | null) => {
      await db.bookmarks.update(bookmarkId, { folderId: newFolderId });
    },
    []
  );

  const handleDeleteBookmark = useCallback(
    async (bookmarkId: string) => {
      await db.bookmarks.delete(bookmarkId);
    },
    []
  );

  // ── Counts per source for the filter panel badges ─────────────────────────
  const bookmarkCountBySource = useMemo(() => {
    const counts: Record<BookmarkSource, number> = {
      twitter: 0, instagram: 0, youtube: 0,
    };
    filteredBookmarks.forEach((b) => counts[b.source]++);
    return counts;
  }, [filteredBookmarks]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (allBookmarks === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <AppHeader
        session={session}
        onLogout={onLogout}
        onImportClick={() => setImportModalOpen(true)}
        onManageFolders={() => setFolderModalOpen(true)}
      />

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: '#EEF3FA',  // light blue-grey background
          minHeight:       'calc(100vh - 52px)',
          padding:         '14px 12px 40px',
        }}
      >
        {/* Sticky filter panel — sticks below the header */}
        <div
          style={{
            position:   'sticky',
            top:        52,           // header height
            zIndex:     90,
            marginBottom: 14,
          }}
        >
          <FilterPanel
            filter={filter}
            allFolders={allFolders ?? []}
            bookmarkCountBySrc={bookmarkCountBySource}
            onSearchChange={setSearch}
            onToggleSource={toggleSource}
            onFolderChange={setFolder}
            onClearAll={clearFilters}
            isFiltered={isFiltered}
          />
        </div>

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {filteredBookmarks.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              isFiltered
                ? 'No bookmarks match your filters.'
                : 'No bookmarks yet. Click Import to add some!'
            }
            style={{ paddingTop: 60 }}
          >
            {!isFiltered && (
              <button
                onClick={() => setImportModalOpen(true)}
                style={{
                  backgroundColor: '#003087',
                  color:           '#fff',
                  border:          'none',
                  borderRadius:    20,
                  padding:         '8px 20px',
                  cursor:          'pointer',
                  fontWeight:      600,
                }}
              >
                Import bookmarks
              </button>
            )}
          </Empty>
        )}

        {/* ── Masonry grid ─────────────────────────────────────────────────── */}
        {visibleBookmarks.length > 0 && (
          <Masonry
            breakpointCols={MASONRY_BREAKPOINTS}
            className="pigeon-masonry-grid"
            columnClassName="pigeon-masonry-column"
          >
            {visibleBookmarks.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                allFolders={allFolders ?? []}
                showPreview={settings.showPreviews}
                onMoveToFolder={handleMoveToFolder}
                onDelete={handleDeleteBookmark}
              />
            ))}
          </Masonry>
        )}

        {/* Infinite scroll sentinel + loading indicator */}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {hasMore && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Spin />
          </div>
        )}

        {/* End of results hint */}
        {!hasMore && filteredBookmarks.length > 0 && (
          <p style={{ textAlign: 'center', color: '#b0b0b0', fontSize: 12, marginTop: 20 }}>
            {filteredBookmarks.length} bookmark{filteredBookmarks.length !== 1 ? 's' : ''} total
            {isFiltered ? ' (filtered)' : ''}
          </p>
        )}
      </div>

      {/* ── Scroll-to-top button ─────────────────────────────────────────────── */}
      <FloatButton.BackTop
        visibilityHeight={300}
        style={{ bottom: 24, right: 24 }}
        tooltip="Back to top"
      />

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <ImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={() => setImportModalOpen(false)}
      />

      <FolderModal
        open={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        folders={allFolders ?? []}
        onChanged={() => {}}
      />
    </>
  );
}
