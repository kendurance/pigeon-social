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

/**
 * Picks the best available thumbnail URL from a tweet's Media URLs field.
 * The field is a comma-separated list, so we take the first entry.
 * Returns null if there are no media URLs.
 */
function extractThumbnailUrl(mediaUrlsString: string): string | null {
  if (!mediaUrlsString || mediaUrlsString.trim() === '') return null;

  const firstMediaUrl = mediaUrlsString.split(',')[0].trim();
  return firstMediaUrl || null;
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
    thumbnailUrl:    extractThumbnailUrl(rawTweet['Media URLs'] ?? ''),
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
