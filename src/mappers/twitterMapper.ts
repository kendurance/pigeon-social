// src/mappers/twitterMapper.ts
// ─────────────────────────────────────────────────────────────────────────────
// Converts a Twitter Bookmarks Downloader JSON export into unified Bookmark
// objects. Each function in this file knows the Twitter-specific field names
// so nothing else in the app has to.
//
// Expected JSON format: an array of flat objects, one per tweet.
// Export tool: https://chromewebstore.google.com/detail/twitter-bookmarks-downloa/nfkbcnohjlfnclnhhblgjafldimikcdb
// ─────────────────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import type { Bookmark, RawTwitterBookmark } from '@/types';

/**
 * Parses the Twitter-style date string returned by the API into an ISO string.
 * Input example:  "Thu May 07 16:33:34 +0000 2026"
 * Output example: "2026-05-07T16:33:34.000Z"
 */
function parseTweetDate(rawDateString: string): string {
  const parsedDate = new Date(rawDateString);
  // If the Date constructor couldn't parse it, fall back to right now
  return isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
}

/** True if the URL looks like an image an <img> tag can render. */
function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i.test(url);
}

/** Picks the first image-looking URL from a comma-separated list. */
function findImageInCsv(csv: string): string | null {
  if (!csv) return null;
  return csv
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
    .find(isImageUrl) ?? null;
}

/**
 * Scans any string field whose name hints at a thumbnail/preview/poster/card
 * image (e.g. "Card Image Url", "Preview Image Url"). The Twitter Bookmarks
 * Downloader extension may include these fields for video tweets even though
 * they're not in the documented `RawTwitterBookmark` shape.
 */
function findImageInPreviewFields(rawTweet: RawTwitterBookmark): string | null {
  for (const [key, value] of Object.entries(rawTweet)) {
    if (typeof value !== 'string') continue;
    const lowerKey = key.toLowerCase();
    const looksLikePreviewField =
      lowerKey.includes('thumb') ||
      lowerKey.includes('preview') ||
      lowerKey.includes('poster') ||
      lowerKey.includes('card');
    if (!looksLikePreviewField) continue;
    const image = findImageInCsv(value) ?? (isImageUrl(value) ? value : null);
    if (image) return image;
  }
  return null;
}

/**
 * Picks the best available thumbnail URL for a tweet.
 * Order of preference:
 *   1. First image-looking URL in `Media URLs` (skips .mp4 video files that
 *      <img> can't render — those land in this field for video tweets).
 *   2. Any preview/poster/card-image field the export may include.
 *   3. null — text-only tweet (or video tweet with no still available),
 *      so the card falls through to its source-icon placeholder.
 */
function extractThumbnailUrl(rawTweet: RawTwitterBookmark): string | null {
  return (
    findImageInCsv(rawTweet['Media URLs'] ?? '') ??
    findImageInPreviewFields(rawTweet)
  );
}

/**
 * Converts a single raw Twitter bookmark object into a unified Bookmark.
 */
function mapSingleTwitterBookmark(rawTweet: RawTwitterBookmark): Bookmark {
  return {
    id:              uuidv4(),
    source:          'twitter',
    title:           rawTweet['Full Text']         ?? '(no text)',
    url:             rawTweet['Tweet Url']          ?? '',
    thumbnailUrl:    extractThumbnailUrl(rawTweet),
    authorName:      `@${rawTweet['User Screen Name'] ?? rawTweet['User Name'] ?? 'unknown'}`,
    authorAvatarUrl: rawTweet['User Avatar Url']   ?? null,
    dateAdded:       parseTweetDate(rawTweet['Created At'] ?? ''),
    folderId:        null,   // all imported bookmarks start uncategorized
    tags:            [],
    rawData:         rawTweet,
  };
}

/**
 * Maps an entire Twitter export (array of raw tweet objects) to Bookmarks.
 * Returns an empty array and logs a warning if the file format is unexpected.
 */
export function mapTwitterExport(parsedJson: unknown): Bookmark[] {
  // Validate that the file is the expected array format
  if (!Array.isArray(parsedJson)) {
    console.warn('[twitterMapper] Expected an array, got:', typeof parsedJson);
    return [];
  }

  return parsedJson
    .filter((item): item is RawTwitterBookmark => {
      // Skip any items that don't look like tweets
      return typeof item === 'object' && item !== null && 'Tweet Id' in item;
    })
    .map(mapSingleTwitterBookmark);
}
