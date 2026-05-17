// src/types/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types for the entire PigeonSocial app.
// All three data mappers (Twitter, Instagram, YouTube) produce `Bookmark`
// objects so the rest of the app never has to care which source data came from.
// ─────────────────────────────────────────────────────────────────────────────

// ── Source identifiers ────────────────────────────────────────────────────────

/** The social media platforms PigeonSocial currently supports. */
export type BookmarkSource = 'twitter' | 'instagram' | 'youtube';

/**
 * What kind of content this card represents — drives card chrome.
 * 'video' adds a play-icon overlay; 'text' forces the grey placeholder
 * even when thumbnailUrl is null; 'image' is the default render path.
 */
export type BookmarkMediaType = 'image' | 'video' | 'text';

// ── Core domain models ────────────────────────────────────────────────────────

/**
 * A single saved/bookmarked piece of content, normalised from any source.
 * This is the shape stored in IndexedDB and rendered by BookmarkCard.
 */
export interface Bookmark {
  /** Unique ID generated at import time (uuid v4). */
  id: string;

  /** Which platform this came from. */
  source: BookmarkSource;

  /**
   * What kind of content this is. Drives card chrome (play-icon for 'video',
   * grey placeholder for 'text'). Defaults to 'image' for legacy backups
   * imported before this field existed.
   */
  mediaType: BookmarkMediaType;

  /** Display title — tweet text, caption text, or video title. */
  title: string;

  /** Direct URL back to the original post / video. */
  url: string;

  /**
   * URL of the preview thumbnail image.
   * `null` if the source provides no image (e.g. text-only tweet).
   */
  thumbnailUrl: string | null;

  /** Display name of the author / channel (e.g. "@GymFiesta", "Web Dev Simplified"). */
  authorName: string;

  /** URL to the author's profile picture, if available. */
  authorAvatarUrl: string | null;

  /**
   * ISO 8601 date string representing when this was bookmarked / saved.
   * Falls back to import time if the source doesn't provide a date.
   */
  dateAdded: string;

  /** ID of the folder this bookmark belongs to, or `null` if uncategorized. */
  folderId: string | null;

  /** User-defined tags (currently unused in UI but stored for future use). */
  tags: string[];

  /**
   * The untouched original object from the JSON import.
   * Stored so we never lose data, even if our normalisation is lossy.
   */
  rawData: unknown;
}

/**
 * A user-created folder for organising bookmarks.
 */
export interface Folder {
  /** Unique ID (uuid v4). */
  id: string;

  /** Human-readable folder name (e.g. "Fitness", "Programming"). */
  name: string;

  /** Hex color used as the folder's accent color in the UI. */
  color: string;

  /** ISO 8601 timestamp of when the folder was created. */
  createdAt: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * A registered user account.
 * Stored in localStorage under the `pigeon_users` key.
 * Note: for a personal local app, passwords are stored as base64 (not truly
 * hashed). Do NOT use this auth model for anything internet-facing.
 */
export interface User {
  id: string;
  username: string;
  /** base64-encoded password (sufficient for local-only use). */
  passwordEncoded: string;
  createdAt: string;
}

/**
 * The active session stored in localStorage.
 * The session persists for `SESSION_TTL_DAYS` days (default 21).
 */
export interface Session {
  userId: string;
  username: string;
  /** ISO 8601 expiry datetime. */
  expiresAt: string;
}

// ── Settings ──────────────────────────────────────────────────────────────────

/**
 * App-level settings controlled by the admin on the Settings page.
 * Stored in localStorage under the `pigeon_settings` key.
 */
export interface AppSettings {
  /** Whether to show Twitter/X bookmarks in the feed. */
  showTwitter: boolean;

  /** Whether to show Instagram saved posts. */
  showInstagram: boolean;

  /** Whether to show YouTube saved videos. */
  showYoutube: boolean;

  /** Whether to render thumbnail images on cards. */
  showPreviews: boolean;

  /** UI colour theme. 'system' follows the OS preference. */
  theme: 'light' | 'dark' | 'system';
}

// ── Mapper input types (raw JSON shapes) ─────────────────────────────────────
// These represent the exact shapes of the JSON export files we support.
// Keeping them separate from Bookmark means the mapper functions are the
// only place that knows about platform-specific field names.

/** One item from the Twitter Bookmarks Downloader extension export. */
export interface RawTwitterBookmark {
  'Tweet Id': string;
  'Full Text': string;
  'Tweet Url': string;
  'Media URLs': string;         // comma-separated if multiple
  'Media Types': string;        // "video", "photo", etc.
  'Media Count': string;
  'Created At': string;         // "Thu May 07 16:33:34 +0000 2026"
  'User Name': string;
  'User Screen Name': string;   // without the @
  'User Avatar Url': string;
  'Scraped At'?: string;
  [key: string]: unknown;
}

/** The top-level shape of the Instagram saved posts network response. */
export interface RawInstagramExport {
  data: {
    xdt_api__v1__feed__saved__posts_connection: {
      edges: RawInstagramEdge[];
      page_info: {
        has_next_page: boolean;
        end_cursor: string;
      };
    };
  };
}

export interface RawInstagramEdge {
  node: {
    media: RawInstagramMedia;
    __typename: string;
  };
  cursor: string;
}

export interface RawInstagramMedia {
  pk: string;
  id: string;
  /** 1 = photo, 2 = video/reel, 8 = carousel album */
  media_type: 1 | 2 | 8;
  code: string;           // used to build the post URL: instagram.com/p/{code}
  caption?: { text: string } | null;
  accessibility_caption?: string | null;
  image_versions2?: {
    candidates: { url: string; width: number; height: number }[];
  };
  /**
   * Present on carousel posts (media_type=8). Each slide has its own
   * image_versions2; the top-level image_versions2 is often absent for these.
   */
  carousel_media?: {
    image_versions2?: {
      candidates: { url: string; width: number; height: number }[];
    };
  }[];
  user?: {
    username: string;
    pk: string;
  };
  like_count?: number;
  view_count?: number;
}

/** The top-level shape of the YouTube Playlist Exporter export. */
export interface RawYoutubeExport {
  playlist: {
    name: string;
    url: string;
  };
  items: RawYoutubeItem[];
}

export interface RawYoutubeItem {
  title: string;
  url: string;
  channel: string;
  duration: string;     // "2:07"
  thumbnail: string;    // CDN URL
  views: string;        // "157K views"
  age: string;          // "8 months ago"
}

// ── PigeonSocial backup / restore format ─────────────────────────────────────

/**
 * The schema for backup files produced by PigeonSocial itself.
 * Distinct from raw social-media export files — this is the only format
 * PigeonSocial writes. Keyed on `version` + `exportedAt` for auto-detection.
 */
export interface PigeonExport {
  /** Schema version (currently 1) for forward-compatibility. */
  version: number;
  /** ISO 8601 timestamp of when this file was created. */
  exportedAt: string;
  /** Folder records included in this backup. */
  folders: Folder[];
  /** Bookmark records included in this backup. */
  bookmarks: Bookmark[];
}

// ── Filter state ──────────────────────────────────────────────────────────────

/**
 * The current state of the filter panel.
 * Used by the filter panel component and applied in MainPage to slice bookmarks.
 */
export interface FilterState {
  /** Text search applied to bookmark titles. Empty string = no filter. */
  searchQuery: string;

  /** Which sources to include. Empty array = show all. */
  activeSources: BookmarkSource[];

  /** Which folder to show. `null` = show all folders. `'uncategorized'` = no folder only. */
  activeFolderId: string | null | 'uncategorized';
}
