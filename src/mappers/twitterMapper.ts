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
import type { Bookmark, BookmarkMediaType, RawTwitterBookmark } from '@/types';

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
 * Upgrades the 48px `_normal` avatar URL Twitter exports to the 400px variant
 * so it renders cleanly as a card thumbnail. All size variants (_normal,
 * _bigger, _400x400, _reasonably_small) are auto-generated for every avatar,
 * so _400x400 always exists when _normal does.
 */
function upgradeTwitterAvatar(avatarUrl: string | undefined): string | null {
  if (!avatarUrl) return null;
  return avatarUrl.replace(/_normal\.(jpg|jpeg|png|webp)/i, '_400x400.$1');
}

/**
 * Resolves both `mediaType` and `thumbnailUrl` from a raw tweet's Media Types
 * field. Three branches:
 *   - "video" / "animated_gif" → 'video' + author avatar as the static fallback
 *     (the export only carries an .mp4 URL — no still image — so we use the
 *     avatar as a recognisable placeholder behind a play-icon overlay)
 *   - "photo"                  → 'image' + first image URL from Media URLs
 *   - empty / missing          → 'text'  + null thumbnail (card shows the
 *     grey source-icon placeholder)
 */
function resolveTwitterMedia(rawTweet: RawTwitterBookmark): {
  mediaType: BookmarkMediaType;
  thumbnailUrl: string | null;
} {
  const mediaTypes = (rawTweet['Media Types'] ?? '').toLowerCase();
  if (mediaTypes.includes('video') || mediaTypes.includes('animated_gif')) {
    return {
      mediaType: 'video',
      thumbnailUrl: upgradeTwitterAvatar(rawTweet['User Avatar Url']),
    };
  }
  if (mediaTypes.includes('photo')) {
    return {
      mediaType: 'image',
      thumbnailUrl: findImageInCsv(rawTweet['Media URLs'] ?? ''),
    };
  }
  return { mediaType: 'text', thumbnailUrl: null };
}

/**
 * Converts a single raw Twitter bookmark object into a unified Bookmark.
 */
function mapSingleTwitterBookmark(rawTweet: RawTwitterBookmark): Bookmark {
  const { mediaType, thumbnailUrl } = resolveTwitterMedia(rawTweet);
  return {
    id:              uuidv4(),
    source:          'twitter',
    mediaType,
    title:           rawTweet['Full Text']         ?? '(no text)',
    url:             rawTweet['Tweet Url']          ?? '',
    thumbnailUrl,
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
