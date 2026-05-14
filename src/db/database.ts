// src/db/database.ts
// ─────────────────────────────────────────────────────────────────────────────
// Dexie (IndexedDB wrapper) setup.
//
// Why IndexedDB instead of localStorage?
//   localStorage is synchronous and limited to ~5MB of string data.
//   IndexedDB is async, supports structured data, and can hold hundreds of MB.
//   Dexie makes IndexedDB feel like a simple typed key-value store.
//
// The database has two tables:
//   • bookmarks  – the imported & normalised bookmark records
//   • folders    – user-created organisational folders
// ─────────────────────────────────────────────────────────────────────────────

import Dexie, { type EntityTable } from 'dexie';
import type { Bookmark, Folder } from '@/types';

/** The shape of our IndexedDB database. Dexie uses this for type inference. */
interface PigeonDatabase extends Dexie {
  bookmarks: EntityTable<Bookmark, 'id'>;
  folders:   EntityTable<Folder,   'id'>;
}

/**
 * Singleton database instance shared across the whole app.
 * Import this anywhere you need DB access.
 */
const db = new Dexie('PigeonSocialDB') as PigeonDatabase;

// Schema version 1.
// The string value lists which fields are **indexed** (searchable/sortable).
// Fields not listed here are still stored — they just can't be queried by index.
db.version(1).stores({
  // '++id' = auto-incrementing primary key (we use uuid instead, so just 'id')
  // '&id' = unique index  |  'source, folderId, dateAdded' = regular indexes
  bookmarks: '&id, source, folderId, dateAdded',
  folders:   '&id, name, createdAt',
});

export default db;
