// src/mappers/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Barrel file for all mappers.
// The `detectAndMap` function is the single entry point used by the ImportModal.
// It auto-detects which source a JSON file came from by probing its structure,
// then delegates to the correct mapper.
// ─────────────────────────────────────────────────────────────────────────────

import type { Bookmark, Folder, PigeonExport } from '@/types';
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
  /** Folders extracted from a PigeonExport backup; empty for all other sources. */
  folders:              Folder[];
  detectedSource:       'twitter' | 'instagram' | 'youtube' | 'pigeon-export' | 'unknown';
  suggestedFolderName:  string | null;
  /** Human-readable message for the ImportModal success/error notice. */
  message:              string;
}

/**
 * Detects the source of a parsed JSON file and maps it to Bookmarks.
 *
 * Detection heuristics (checked in this order):
 *  - PigeonExport → object with `version` (number) + `exportedAt` + `bookmarks` + `folders`
 *  - Twitter      → top-level array where first item has a "Tweet Id" key
 *  - Instagram    → object with `data.xdt_api__v1__feed__saved__posts_connection`
 *  - YouTube      → object with `playlist` + `items` keys
 */
export function detectAndMap(parsedJson: unknown): DetectAndMapResult {
  // ── PigeonExport detection (checked first to avoid false positives) ─────────
  if (
    typeof parsedJson === 'object' &&
    parsedJson !== null &&
    'version' in parsedJson &&
    'exportedAt' in parsedJson &&
    'bookmarks' in parsedJson &&
    'folders' in parsedJson &&
    typeof (parsedJson as Record<string, unknown>).version === 'number' &&
    Array.isArray((parsedJson as Record<string, unknown>).bookmarks) &&
    Array.isArray((parsedJson as Record<string, unknown>).folders)
  ) {
    const pigeonExport = parsedJson as PigeonExport;
    // Legacy backups (pre-mediaType) need the field defaulted so the card
    // render path doesn't see undefined.
    const bookmarks = pigeonExport.bookmarks.map((b) => ({
      ...b,
      mediaType: b.mediaType ?? 'image',
    }));
    return {
      bookmarks,
      folders:              pigeonExport.folders,
      detectedSource:       'pigeon-export',
      suggestedFolderName:  null,
      message: `PigeonSocial backup: ${bookmarks.length} bookmark${bookmarks.length !== 1 ? 's' : ''} across ${pigeonExport.folders.length} folder${pigeonExport.folders.length !== 1 ? 's' : ''}.`,
    };
  }

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
      folders:             [],
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
      folders:             [],
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
      folders:             [],
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
    folders:              [],
    detectedSource:       'unknown',
    suggestedFolderName:  null,
    message:              'Could not detect the source. Make sure the file is a valid Twitter, Instagram, YouTube, or PigeonSocial export.',
  };
}
