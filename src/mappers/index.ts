// src/mappers/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Barrel file for all mappers.
// The `detectAndMap` function is the single entry point used by the ImportModal.
// It auto-detects which source a JSON file came from by probing its structure,
// then delegates to the correct mapper.
// ─────────────────────────────────────────────────────────────────────────────

import type { Bookmark } from '@/types';
import { mapTwitterExport }   from './twitterMapper';
import { mapInstagramExport } from './instagramMapper';
import { mapYoutubeExport }   from './youtubeMapper';

export { mapTwitterExport, mapInstagramExport, mapYoutubeExport };

/**
 * Result from `detectAndMap`. Includes the mapped bookmarks plus optional
 * metadata the caller can use (e.g. to pre-create a folder from a playlist).
 */
export interface DetectAndMapResult {
  bookmarks:            Bookmark[];
  detectedSource:       'twitter' | 'instagram' | 'youtube' | 'unknown';
  suggestedFolderName:  string | null;
  /** Human-readable message for the ImportModal success/error notice. */
  message:              string;
}

/**
 * Detects the source of a parsed JSON file and maps it to Bookmarks.
 *
 * Detection heuristics:
 *  - Twitter  → top-level array where first item has a "Tweet Id" key
 *  - Instagram → object with `data.xdt_api__v1__feed__saved__posts_connection`
 *  - YouTube  → object with `playlist` + `items` keys
 */
export function detectAndMap(parsedJson: unknown): DetectAndMapResult {
  // ── Twitter detection ──────────────────────────────────────────────────────
  if (
    Array.isArray(parsedJson) &&
    parsedJson.length > 0 &&
    typeof parsedJson[0] === 'object' &&
    parsedJson[0] !== null &&
    'Tweet Id' in parsedJson[0]
  ) {
    const bookmarks = mapTwitterExport(parsedJson);
    return {
      bookmarks,
      detectedSource:      'twitter',
      suggestedFolderName: null,
      message:             `Imported ${bookmarks.length} Twitter bookmarks.`,
    };
  }

  // ── Instagram detection ────────────────────────────────────────────────────
  if (
    typeof parsedJson === 'object' &&
    parsedJson !== null &&
    'data' in parsedJson &&
    typeof (parsedJson as Record<string, unknown>).data === 'object' &&
    (parsedJson as Record<string, unknown>).data !== null &&
    'xdt_api__v1__feed__saved__posts_connection' in
      ((parsedJson as Record<string, unknown>).data as object)
  ) {
    const bookmarks = mapInstagramExport(parsedJson);
    return {
      bookmarks,
      detectedSource:      'instagram',
      suggestedFolderName: null,
      message:             `Imported ${bookmarks.length} Instagram saved posts.`,
    };
  }

  // ── YouTube detection ──────────────────────────────────────────────────────
  if (
    typeof parsedJson === 'object' &&
    parsedJson !== null &&
    'playlist' in parsedJson &&
    'items' in parsedJson
  ) {
    const { bookmarks, suggestedFolderName } = mapYoutubeExport(parsedJson);
    return {
      bookmarks,
      detectedSource:      'youtube',
      suggestedFolderName,
      message: suggestedFolderName
        ? `Imported ${bookmarks.length} YouTube videos from playlist "${suggestedFolderName}".`
        : `Imported ${bookmarks.length} YouTube videos.`,
    };
  }

  // ── Unknown format ─────────────────────────────────────────────────────────
  return {
    bookmarks:            [],
    detectedSource:       'unknown',
    suggestedFolderName:  null,
    message:              'Could not detect the source. Make sure the file is a valid Twitter, Instagram, or YouTube export.',
  };
}
