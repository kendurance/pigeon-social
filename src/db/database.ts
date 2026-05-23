// src/db/database.ts
// ─────────────────────────────────────────────────────────────────────────────
// Dexie (IndexedDB wrapper) setup.
//
// Why IndexedDB instead of localStorage?
//   localStorage is synchronous and limited to ~5MB of string data.
//   IndexedDB is async, supports structured data, and can hold hundreds of MB.
//   Dexie makes IndexedDB feel like a simple typed key-value store.
//
// Tables:
//   • bookmarks      – the imported & normalised bookmark records
//   • folders        – user-created organisational folders
//   • importSessions – one row per file imported (Phase 2b history log)
// ─────────────────────────────────────────────────────────────────────────────

import Dexie, { type EntityTable } from 'dexie';
import type { Bookmark, Folder, ImportSession } from '@/types';

/** The shape of our IndexedDB database. Dexie uses this for type inference. */
interface PigeonDatabase extends Dexie {
  bookmarks:      EntityTable<Bookmark,      'id'>;
  folders:        EntityTable<Folder,        'id'>;
  importSessions: EntityTable<ImportSession, 'id'>;
}

/**
 * Singleton database instance shared across the whole app.
 * Import this anywhere you need DB access.
 */
const db = new Dexie('PigeonSocialDB') as PigeonDatabase;

// Schema version 1 (original).
// Kept here so Dexie can run upgrades for existing users.
db.version(1).stores({
  bookmarks: '&id, source, folderId, dateAdded',
  folders:   '&id, name, createdAt',
});

// Schema version 2 (Phase 2b).
// Changes:
//   • Adds `url` index on bookmarks — used for O(N) dedup lookups via .anyOf()
//     Non-unique (&url would fail for any DBs that already have duplicate URLs
//     from pre-2b re-imports; uniqueness is enforced at write time instead).
//   • Adds importSessions table for the import history page.
// No .upgrade() callback needed — Dexie 4 auto-populates new indexes from
// existing rows and new tables start empty.
db.version(2).stores({
  bookmarks:      '&id, source, folderId, dateAdded, url',
  folders:        '&id, name, createdAt',
  importSessions: '&id, importedAt, sessionGroupId',
});

export default db;
