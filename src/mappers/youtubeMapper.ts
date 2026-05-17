// src/mappers/youtubeMapper.ts
// ─────────────────────────────────────────────────────────────────────────────
// Converts a YouTube Playlist Exporter JSON export into unified Bookmark
// objects. The export wraps playlist metadata + an items array.
//
// How to get this JSON:
//   1. Install "YouTube Playlist Exporter by Sheridan Technologies" from the
//      Chrome Web Store
//   2. Open any YouTube playlist (e.g. Saved Videos, or a custom playlist)
//   3. Click the extension icon and export as JSON
// ─────────────────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import type { Bookmark, RawYoutubeExport, RawYoutubeItem } from '@/types';

/**
 * Extracts the 11-character video ID from any common YouTube URL form:
 *   https://www.youtube.com/watch?v={ID}
 *   https://youtu.be/{ID}
 *   https://www.youtube.com/shorts/{ID}
 *   https://www.youtube.com/embed/{ID}
 * Returns null if no ID can be recovered.
 */
function extractYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Builds the canonical YouTube thumbnail URL. hqdefault.jpg is generated for
 * every public video — unlike maxresdefault, which only exists for HD uploads.
 */
function buildYoutubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Converts a single YouTube playlist item into a unified Bookmark.
 * The extension-captured `item.thumbnail` is unreliable (lazy-loaded videos
 * yield base64 placeholders), so we derive the canonical URL from the video
 * ID and only fall back to the captured value if the URL is unparseable.
 */
function mapSingleYoutubeItem(item: RawYoutubeItem): Bookmark {
  const videoId          = extractYoutubeVideoId(item.url ?? '');
  const derivedThumbnail = videoId ? buildYoutubeThumbnailUrl(videoId) : null;

  return {
    id:              uuidv4(),
    source:          'youtube',
    title:           item.title         ?? '(untitled video)',
    url:             item.url           ?? '',
    thumbnailUrl:    derivedThumbnail ?? item.thumbnail ?? null,
    authorName:      item.channel       ?? 'Unknown Channel',
    authorAvatarUrl: null,   // not included in playlist exports
    dateAdded:       new Date().toISOString(),
    folderId:        null,
    tags:            [],
    rawData:         item,
  };
}

/**
 * Maps an entire YouTube playlist export to Bookmarks.
 * If the export contains a playlist name, it's passed back so the caller can
 * optionally pre-create a matching folder.
 */
export function mapYoutubeExport(parsedJson: unknown): {
  bookmarks: Bookmark[];
  suggestedFolderName: string | null;
} {
  if (typeof parsedJson !== 'object' || parsedJson === null || Array.isArray(parsedJson)) {
    console.warn('[youtubeMapper] Expected an object with playlist + items keys');
    return { bookmarks: [], suggestedFolderName: null };
  }

  const typedExport = parsedJson as RawYoutubeExport;
  const items            = typedExport.items;
  const playlistName     = typedExport.playlist?.name ?? null;

  if (!Array.isArray(items)) {
    console.warn('[youtubeMapper] Could not find items array in JSON');
    return { bookmarks: [], suggestedFolderName: null };
  }

  const bookmarks = items
    .filter((item) => typeof item === 'object' && item !== null && 'url' in item)
    .map(mapSingleYoutubeItem);

  return {
    bookmarks,
    suggestedFolderName: playlistName,
  };
}
