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
```
App
├── LoginPage
│
└── [authenticated]
├── AppHeader
│   ├── Logo + wordmark
│   ├── Mobile: hamburger → Drawer (Import, Folders, Settings, Sign out)
│   └── Desktop: action row (Import, Folders, Hi username, Settings, Sign out)
│
├── MainPage
│   ├── FilterPanel (sticky, collapsible)
│   │   ├── Text search input
│   │   ├── Source toggle buttons (Twitter / Instagram / YouTube + counts)
│   │   └── Folder selector buttons
│   │
│   ├── Masonry Grid
│   │   └── BookmarkCard (× N)
│   │       ├── Thumbnail (conditional on settings.showPreviews) → click opens BookmarkEmbedModal
│   │       ├── Source badge (overlaid on thumbnail)
│   │       ├── Folder tag
│   │       ├── Context menu (Open, Move to folder, Delete)
│   │       ├── SourceIcon
│   │       ├── Title (2-line clamp + tooltip on hover)
│   │       └── Author · relative date
│   │
│   ├── Infinite scroll sentinel (IntersectionObserver)
│   ├── ImportModal
│   ├── ExportModal
│   ├── FolderModal
│   └── BookmarkEmbedModal (click-through inline preview)
│       ├── Instagram → iframe to /p/{code}/embed/captioned
│       ├── YouTube   → iframe to /embed/{id} (16:9)
│       └── Twitter   → widgets.js-rendered blockquote
│
└── SettingsPage
├── Source visibility toggles
├── Show previews toggle
└── Theme radio (Light / Dark / System)
```

---

## 9. Roadmap

### Phase 1 — Foundation ✅ Complete

- [x] Project scaffolding (Vite + React 19 + TypeScript)
- [x] Dexie IndexedDB schema (bookmarks + folders)
- [x] Unified `Bookmark` type and mapper layer (Twitter, Instagram, YouTube)
- [x] Auto-detection of source from uploaded JSON
- [x] Local auth (login, create account, 21-day session)
- [x] Masonry grid with infinite scroll
- [x] Folder CRUD (create, color, delete, unassign)
- [x] Filter panel (search, source, folder)
- [x] Settings page (source toggles, preview toggle, theme selector)
- [x] Responsive layout (mobile-first, desktop two-row header)

---

### Phase 2a — Backup & Restore ✅ Complete

The export format uses the `PigeonExport` schema defined in section 6. It is
distinct from raw social media export files and is the only file format
PigeonSocial itself produces.

- [x] **Export selected folders** — user selects one or more folders from a
  modal; downloads a `pigeon-export-{date}.json` file containing the selected
  `Folder` records and all `Bookmark` records whose `folderId` matches
- [x] **Export all** — convenience option to export every folder and every
  bookmark (including uncategorized) in one file
- [x] **Restore from export** — the ImportModal's auto-detection logic learns
  to recognize the `PigeonExport` schema (keyed on `version` + `exportedAt`
  fields) and re-imports folders and bookmarks, restoring `folderId`
  relationships; duplicate URLs are skipped by default with a count reported
  to the user
- [x] **Conflict handling** — if a folder with the same name already exists
  during restore, prompt the user to merge into the existing folder or create
  a new one with a disambiguated name

---

### Phase 2b — Import Improvements

- [ ] **Multi-file import** — allow selecting multiple JSON files in one; recognize differing sources within the same import
  session rather than repeating the import flow
- [ ] **Duplicate detection** — update bookmarks whose source URL already exists
  in the database (based on that source's ID); report the skipped count to the user after import
- [ ] **Instagram pagination** — accept additional page captures and merge
  them into the existing Instagram bookmark set
- [ ] **Import history** — log of previous import sessions showing source,
  item count, and timestamp; this will be on a different page, like system settings

---

### Phase 2c — Bookmark Enhancements

- [x] **Click-through embed preview modal** — clicking a card's thumbnail or
  placeholder opens [BookmarkEmbedModal](../src/components/BookmarkEmbedModal.tsx),
  which renders the original post inline using each source's own embed:
  Instagram (`/p/{code}/embed/captioned` iframe), YouTube (`/embed/{id}`
  iframe in a 16:9 container), Twitter (`platform.twitter.com/widgets.js`
  blockquote render). Title and ⋯ menu are unchanged. URL parsing helpers
  live in [extractEmbedIds.ts](../src/utils/extractEmbedIds.ts); Twitter's
  widgets.js is lazy-loaded once on first use. No proxy needed — these are
  all CORS-friendly cross-origin embeds
- [ ] **Tags UI** — chip input on each card to add/remove tags; the `tags`
  field already exists in the data model and DB schema
- [ ] **Tag filter** — add tag filtering to the filter panel alongside source
  and folder filters
- [ ] **Bulk selection** — checkbox mode; bulk move to folder, bulk delete,
  bulk export
- [ ] **Sort options** — by date added (desc/asc), by source, by title (A–Z)

---

### Phase 2d — Folder Improvements

- [ ] **Folder rename** — inline edit in FolderModal
- [ ] **Folder reorder** — drag handles in FolderModal to set display order
- [ ] **Bookmark count badge** — show item count per folder in the filter panel
  and FolderModal

---

### Phase 2e — UI Polish

- [ ] **Replace emoji favicon** with the Flaticon pigeon PNG
  (https://www.flaticon.com/free-icon/pigeon_3338238); add attribution to
  README per Flaticon free license terms
- [ ] **Dark mode** — wire `settings.theme` into AntD's `ConfigProvider`
  `algorithm` prop (`theme.darkAlgorithm`)
- [ ] **Card skeleton loaders** — placeholder shimmer cards during initial
  DB hydration on page load
- [ ] **Toast notifications** — success/error feedback on import, export,
  delete, and folder operations
- [ ] **Drag-and-drop to folders** — drag a card onto a folder chip in the
  filter panel to move it; consider `@dnd-kit/core`

---

### Phase 3 — Extended Sources

Each new source requires:
1. A new mapper file at `src/mappers/{source}Mapper.ts`
2. A detection heuristic and dispatch case in `src/mappers/index.ts`
3. A new value added to the `BookmarkSource` union in `src/types/index.ts`
4. A new `SourceIcon` variant in `src/components/SourceIcon.tsx`
5. A new settings toggle in `SettingsPage` and `AppSettings`

No other files need to change.

**Planned sources:**

- [ ] **Reddit** — saved posts via Reddit Data Request (GDPR export) or the
  Reddit API (`/user/{username}/saved`); evaluate JSON structure at
  implementation time
- [ ] **TikTok** — liked/saved videos via TikTok Data Export (Settings →
  Privacy → Download your data); JSON format contains a `Activity` →
  `Like List` section
- [ ] **Generic URL** — manually paste any URL; fetch OpenGraph metadata
  (title, description, thumbnail) to populate the bookmark; likely requires
  a lightweight backend proxy to avoid CORS restrictions, making this a
  natural bridge to Phase 4

---

### Phase 4 — Browser Extension Companion

A lightweight Manifest V3 Chrome extension that adds a **"Save to
PigeonSocial"** button directly on Twitter, Instagram, and YouTube pages.

Architecture requires a local backend (Express or similar) running alongside
the web app. The extension POSTs content metadata to `localhost:{port}/api
/bookmark`; the backend writes to the database; the web app reads from it.

This phase represents the architecture inflection point from a pure SPA to a
local full-stack app, at which point:
- IndexedDB is replaced by SQLite (via Prisma or better-sqlite3)
- The auth system is upgraded (bcrypt password hashing)
- The Generic URL source from Phase 3 becomes straightforward
- **Instagram HD avatars become reachable.** The browser-only pipeline is
  stuck on the 100×100 og:image because `/api/v1/users/web_profile_info/`
  hard-throttles to ~1 successful call per IP per several minutes for
  unauthenticated callers (see §10 "Instagram avatars are 100×100"). A
  backend can hold a persistent IG session (csrftoken, mid, ig_did
  cookies) and call `web_profile_info` at normal request rates,
  unlocking the 320×320 `profile_pic_url_hd` for every creator. This is
  the cleanest place to revisit the JSON-endpoint code we removed.

---

### Phase 5 — Multi-Device Sync (Long-Term)

Optional cloud sync once a backend exists from Phase 4:
- Replace localStorage auth with JWT + bcrypt
- Migrate SQLite to PostgreSQL via Prisma
- Deploy to a private server or VPS (not public-facing without full auth
  hardening)
- Sync bookmarks and folders across devices for the same user account

---

## 10. Known Limitations & Technical Debt

| Item | Notes |
|---|---|
| Auth security | Passwords are base64-encoded, not hashed. Acceptable for local-only use; must be replaced before any networked deployment |
| Instagram export is manual | No official API; DevTools capture is a workaround. One page at a time (~21 items) |
| YouTube `age` field is approximate | "8 months ago" is converted to an estimated timestamp; exact publish dates are not available from the playlist export format |
| No duplicate prevention | Importing the same file twice creates duplicate records. Deduplication by source URL is a Phase 2b item |
| Instagram CDN URLs expire | Instagram image URLs contain signed tokens that expire; thumbnails on older bookmarks may break |
| Instagram avatars are 100×100 (pixelated) | The saved-posts API doesn't include a profile_pic_url, so `fetchInstagramAvatars.ts` scrapes `<meta og:image>` from each public profile page through the Vite dev proxy. That tag only carries the 100×100 thumbnail variant. The proper HD source (`/api/v1/users/web_profile_info/?username=X`, which returns `profile_pic_url_hd` at 320×320) was implemented but ripped out — IG hard-rate-limits it per-IP to ~1 successful call per several minutes regardless of headers (verified across six combinations of App ID, X-ASBD-ID, X-IG-WWW-Claim, browser UA, etc.). In a 20-user import we got 1 HD avatar and 19 fallbacks — too inconsistent to ship. **Resolved properly only in Phase 4**, where a real backend can hold persistent IG session cookies and avoid the unauthenticated throttle. |
| Tags stored but not surfaced | The `tags` field exists in the data model and DB schema; the UI is deferred to Phase 2c |
| Dark mode toggle is wired but incomplete | The settings value persists correctly; the AntD `darkAlgorithm` swap is not yet applied |
| No export / backup | Organized data exists only in the browser's IndexedDB; a browser data clear destroys it. Addressed in Phase 2a |

---

## 11. Conventions

- **Components:** PascalCase, one component per file (`BookmarkCard.tsx`)
- **Hooks:** camelCase prefixed with `use` (`useAuth.ts`)
- **Mappers:** camelCase suffixed with `Mapper` (`twitterMapper.ts`)
- **Pages:** PascalCase suffixed with `Page` (`MainPage.tsx`)
- **Store:** camelCase prefixed with `use`, suffixed with `Store`
  (`useAppStore.ts`)
- **Types:** all in `src/types/index.ts`, interfaces in PascalCase
- **CSS classes:** kebab-case prefixed with `pigeon-` for app-specific
  overrides (`pigeon-masonry-grid`, `pigeon-bookmark-card`)
- **Comments:** every file has a header comment block explaining its role;
  every non-obvious function has a JSDoc comment; inline comments explain
  *why*, not *what*

---

## 12. Local Development

```bash
npm run dev          # Vite dev server at localhost:5173 with HMR
npm run build        # TypeScript compile + Vite production bundle → dist/
npm run preview      # Serve dist/ locally to test the production build
npm run type-check   # tsc --noEmit — surface type errors without emitting files
```

**First run:** Navigate to `localhost:5173`, click **Create Account**. No
environment variables or configuration files are required.

**Resetting all data:**
- Bookmarks + folders: DevTools → Application → IndexedDB → delete
  `PigeonSocialDB`
- Auth + settings: DevTools → Application → Local Storage → delete all keys
  prefixed with `pigeon_`