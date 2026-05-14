# PigeonSocial — Copilot Instructions & Project Plan

**Project codename:** PigeonSocial  
**Tagline:** Pigeonhole Your Bookmarks!  
**Type:** Personal-use local web application  
**Status:** Prototype (v0.1 complete, v0.2 in progress)

---

## 1. Problem Statement

Social media platforms handle saved content inconsistently and in isolation.
Twitter/X stores bookmarks in a single flat list with no organizational
structure. Instagram allows folder-based saving. YouTube supports playlists.
There is no cross-platform tool that aggregates saved content from multiple
sources and lets the user organize it freely.

The result: saved content becomes a graveyard. Bookmarks accumulate, become
unsearchable, and lose their utility because the cognitive overhead of finding
anything specific is too high.

PigeonSocial solves this by providing a single, locally-run interface to
import, browse, search, and organize bookmarks from any supported social media
source — unified under one consistent UI and one personal folder system.

---

## 2. Goals

### Primary Goals
- Import saved/bookmarked content from Twitter, Instagram, and YouTube via
  JSON file exports
- Normalize all imported content into a single unified data model regardless
  of source
- Allow the user to create folders and assign bookmarks to them
- Provide filtering by source, folder, and free-text search
- Be fast, local, and require zero external services or accounts beyond the
  app itself

### Secondary Goals
- Mobile-first responsive design that also works well on desktop
- Infinite scroll instead of pagination for a native social-media-like feel
- Masonry card grid layout that accommodates variable content heights naturally
- Per-user accounts for potential multi-user household use

### Non-Goals (v0.1)
- Real-time sync with social media APIs
- Cloud storage or cross-device sync
- Browser extension integration (deferred to a future phase)
- Public deployment or multi-tenant hosting

---

## 3. Target User

**Primary user:** The developer themselves — a power user who actively saves
content across multiple social platforms and wants a personal tool to bring
order to that content.

**Secondary user (future):** Other technically comfortable users who are
willing to run a local web app and perform a manual JSON export from their
social media accounts.

The app is not designed for general public distribution in v0.1. It is a
personal productivity tool built for local use.

---

## 4. Scope

### In Scope (v0.1 — Complete)

| Area | Feature |
|---|---|
| Auth | Username + password login, account creation, 21-day session |
| Import | JSON file drag-and-drop, auto-source detection, bulk IndexedDB write |
| Sources | Twitter (Bookmarks Downloader export), Instagram (DevTools capture), YouTube (Playlist Exporter) |
| Bookmarks | View, delete, move to folder, open original link |
| Folders | Create, color-assign, delete (bookmarks become uncategorized) |
| Filtering | Text search, source toggle, folder selection, clear all |
| Layout | Masonry grid, infinite scroll, responsive (mobile + desktop) |
| Settings | Toggle source visibility, toggle thumbnail previews, theme selection |
| Storage | 100% local: IndexedDB (bookmarks/folders), localStorage (auth/settings) |

### Out of Scope (v0.1)
- Live API connections to any social media platform
- Browser extension companion
- Export / backup of organized bookmarks
- Drag-and-drop card organization
- Bulk selection and actions
- Tags (data model supports them, UI deferred)
- Full dark mode (settings toggle exists, implementation deferred)

---

## 5. Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Bundler / Dev Server | Vite | 6.x | Fast HMR, zero-config SPA setup |
| UI Framework | React | 19.x | Component model, hooks, concurrent features |
| Language | TypeScript | 5.x | Type safety across the full codebase |
| Component Library | Ant Design | 5.x | Comprehensive component set, theme tokens |
| Global State | Zustand | 5.x | Settings (persisted) and filter state (in-memory) |
| Local Database | Dexie | 4.x | IndexedDB wrapper with `useLiveQuery` React hook |
| Routing | React Router | 7.x | Client-side routing for `/` and `/settings` |
| Layout | react-masonry-css | 1.x | CSS-column masonry, no DOM measurement |
| Date Formatting | Day.js | 1.x | Lightweight relative time formatting |
| Unique IDs | uuid | 11.x | Stable IDs for bookmarks and folders at import time |

---

## 6. Data Model

### `Bookmark`
The normalized shape every source gets converted into at import time. Nothing
outside the mapper layer ever handles raw export data.

```ts
id              string       // UUID v4, generated at import
source          enum         // 'twitter' | 'instagram' | 'youtube'
title           string       // Tweet text, caption, or video title
url             string       // Direct link to the original content
thumbnailUrl    string|null  // Thumbnail or preview image URL
authorName      string       // e.g. "@GymFiesta", "Web Dev Simplified"
authorAvatarUrl string|null  // Profile picture URL if available
dateAdded       string       // ISO 8601 — original save date, or approximated
folderId        string|null  // References Folder.id, or null if uncategorized
tags            string[]     // Freeform tags (stored, UI deferred to v0.2)
rawData         unknown      // Original unmodified import object — never discarded
```

### `Folder`
```ts
id        string   // UUID v4
name      string   // User-defined label, e.g. "Fitness", "Programming"
color     string   // Hex color for UI accent
createdAt string   // ISO 8601
```

### `User` (localStorage)
```ts
id              string   // UUID v4
username        string
passwordEncoded string   // base64 — local-only, not production-safe
createdAt       string   // ISO 8601
```

### `Session` (localStorage)
```ts
userId    string   // References User.id
username  string
expiresAt string   // ISO 8601 — 21 days from login
```

### `AppSettings` (localStorage, persisted via Zustand)
```ts
showTwitter   boolean   // default: true
showInstagram boolean   // default: true
showYoutube   boolean   // default: true
showPreviews  boolean   // default: true
theme         enum      // 'light' | 'dark' | 'system'  default: 'system'
```

### `PigeonExport` (JSON backup file format)
The schema for exported backup files produced by PigeonSocial itself.
These files are distinct from raw social media export files and can be
re-imported to restore state after a database reset.

```ts
version     number     // Schema version for forward-compatibility (currently 1)
exportedAt  string     // ISO 8601 timestamp of when the export was created
folders     Folder[]   // The exported folder records
bookmarks   Bookmark[] // The exported bookmark records, rawData included
```

---

## 7. Source Import Reference

### How to Obtain Each Export File

**Twitter / X**
1. Install [Twitter Bookmarks Downloader](https://chromewebstore.google.com/detail/twitter-bookmarks-downloa/nfkbcnohjlfnclnhhblgjafldimikcdb)
   from the Chrome Web Store
2. Navigate to your Bookmarks on twitter.com
3. Click the extension icon → Export as JSON

*Key fields used:* `Tweet Id`, `Full Text`, `Tweet Url`, `Media URLs`,
`Created At`, `User Name`, `User Screen Name`, `User Avatar Url`

---

**Instagram**
Instagram has no official export tool. Saved posts are captured directly from
the internal API response:
1. Open Instagram in Chrome and navigate to your Saved posts
2. Open DevTools → Network tab
3. Filter requests by: `xdt_api__v1__feed__saved__posts_connection`
4. Click the matching request → Response tab → copy the full JSON

*Note:* This method returns one page (~21 items) at a time. Subsequent pages
require repeating the process as you scroll. Instagram CDN image URLs contain
signed tokens and may expire over time.

*Key fields used:* `data.xdt_api__v1__feed__saved__posts_connection
.edges[].node.media` → `code`, `media_type`, `caption.text`,
`image_versions2.candidates[]`, `user.username`

---

**YouTube**
1. Install [YouTube Playlist Exporter by Sheridan Technologies](https://chromewebstore.google.com/detail/youtube-playlist-exporter/gnopcjdfcdhedkadlfaliehmohgieffa)
2. Open any YouTube playlist (Saved Videos, Watch Later, or custom playlists)
3. Click the extension icon → Export as JSON
4. Repeat for each playlist

*Note:* The YouTube export uses relative age strings ("8 months ago") rather
than timestamps. The mapper approximates an ISO date from this string.

*Key fields used:* `playlist.name`, `items[].title`, `items[].url`,
`items[].channel`, `items[].thumbnail`, `items[].age`

---

## 8. Component Architecture