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
 * Converts a YouTube "age" string like "8 months ago" into an approximate
 * ISO 8601 date by subtracting from the current time.
 *
 * The YouTube export doesn't provide an actual timestamp — just a relative
 * string — so we do a best-effort approximation.
 */
function approximateDateFromYoutubeAge(ageString: string): string {
  const now = new Date();

  // Match patterns like "3 days ago", "2 months ago", "1 year ago"
  const ageMatch = ageString.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);

  if (!ageMatch) {
    // If we can't parse it (e.g. "Streamed live on..."), just use now
    return now.toISOString();
  }

  const [, amountStr, unit] = ageMatch;
  const amount = parseInt(amountStr, 10);

  // Subtract the appropriate duration from now
  const msMultiplierByUnit: Record<string, number> = {
    second: 1_000,
    minute: 60_000,
    hour:   3_600_000,
    day:    86_400_000,
    week:   604_800_000,
    month:  2_592_000_000,   // ~30 days
    year:   31_536_000_000,  // ~365 days
  };

  const msToSubtract = (msMultiplierByUnit[unit.toLowerCase()] ?? 0) * amount;
  return new Date(now.getTime() - msToSubtract).toISOString();
}

/**
 * Converts a single YouTube playlist item into a unified Bookmark.
 */
function mapSingleYoutubeItem(item: RawYoutubeItem): Bookmark {
  return {
    id:              uuidv4(),
    source:          'youtube',
    title:           item.title         ?? '(untitled video)',
    url:             item.url           ?? '',
    thumbnailUrl:    item.thumbnail     ?? null,
    authorName:      item.channel       ?? 'Unknown Channel',
    authorAvatarUrl: null,   // not included in playlist exports
    dateAdded:       approximateDateFromYoutubeAge(item.age ?? ''),
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
