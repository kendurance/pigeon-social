# 🐦 PigeonSocial — Pigeonhole Your Bookmarks!

A personal bookmark organizer for social media content. Import your Twitter bookmarks, Instagram saved posts, and YouTube playlists into one place, then organize them into folders.

**Stack:** Vite + React 19 + TypeScript + Ant Design + Zustand + Dexie (IndexedDB)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation & Running](#installation--running)
3. [How to Export Your Bookmarks](#how-to-export-your-bookmarks)
4. [Project Structure](#project-structure)
5. [Architecture & Key Concepts](#architecture--key-concepts)
6. [Tech Stack Decisions](#tech-stack-decisions)
7. [What to Build Next](#what-to-build-next)

---

## Prerequisites

You need **Node.js v20+**. Check your version:

```bash
node -v   # should print v20.x.x or higher
```

If you don't have Node:
- **macOS**: `brew install node` (or download from [nodejs.org](https://nodejs.org))
- **Windows/Linux**: Download the LTS installer from [nodejs.org](https://nodejs.org)

---

## Installation & Running

```bash
# 1. Navigate into the project folder
cd pigeon-social

# 2. Install all dependencies (only needed once, or after adding new packages)
npm install

# 3. Start the development server
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

The first screen you see is the **Login page**. Since there are no users yet, click **Create Account**, enter any username and password, and you'll be logged in immediately.

Your session will stay active for **21 days** before requiring you to log back in.

### Other scripts

```bash
npm run build      # Compile TypeScript + bundle for production (outputs to dist/)
npm run preview    # Preview the production build locally
npm run type-check # Run the TypeScript compiler to check for type errors (no output files)
```

---

## How to Export Your Bookmarks

### Twitter / X

1. Install **[Twitter Bookmarks Downloader](https://chromewebstore.google.com/detail/twitter-bookmarks-downloa/nfkbcnohjlfnclnhhblgjafldimikcdb)** from the Chrome Web Store
2. Log in to [twitter.com](https://twitter.com) and go to your Bookmarks
3. Click the extension icon → export as **JSON**
4. Save the file (it will be named something like `TwitterBookmarks_2026-05-09_100.json`)

### Instagram

Instagram doesn't have an official export, but you can capture the API response directly:

1. Open [instagram.com](https://instagram.com) in Chrome and log in
2. Open **DevTools** (`F12` or `Cmd+Option+I`) → **Network** tab
3. Navigate to your **Saved posts** page (Profile → ☰ → Saved)
4. In the DevTools Network filter box, type: `xdt_api__v1__feed__saved`
5. Click the matching request → **Response** tab → right-click → **Copy response**
6. Paste into a text editor and save as `instagram-saved.json`

### YouTube

1. Install **[YouTube Playlist Exporter by Sheridan Technologies](https://chromewebstore.google.com/detail/youtube-playlist-exporter/gnopcjdfcdhedkadlfaliehmohgieffa)** from the Chrome Web Store
2. Open any YouTube playlist (e.g. `Library → Saved Videos`, or any playlist you've created)
3. Click the extension icon → **Export as JSON**
4. Repeat for each playlist you want to import

---

## Project Structure

```
pigeon-social/
├── public/
│   └── pigeon.svg              ← Favicon (replace with the Flaticon pigeon PNG)
├── src/
│   ├── types/
│   │   └── index.ts            ← All TypeScript interfaces (Bookmark, Folder, User, etc.)
│   ├── db/
│   │   └── database.ts         ← Dexie IndexedDB setup (bookmarks + folders tables)
│   ├── store/
│   │   └── useAppStore.ts      ← Zustand global state (settings + filter state)
│   ├── hooks/
│   │   └── useAuth.ts          ← Login / create account / logout / session logic
│   ├── mappers/
│   │   ├── twitterMapper.ts    ← Converts Twitter export → Bookmark[]
│   │   ├── instagramMapper.ts  ← Converts Instagram export → Bookmark[]
│   │   ├── youtubeMapper.ts    ← Converts YouTube export → Bookmark[]
│   │   └── index.ts            ← Auto-detect source + dispatch to correct mapper
│   ├── components/
│   │   ├── AppHeader.tsx          ← Top navigation bar (mobile + desktop layouts)
│   │   ├── BookmarkCard.tsx       ← The reusable card component for any bookmark
│   │   ├── BookmarkEmbedModal.tsx ← Click-through preview modal (IG/YT iframes, Twitter widgets.js)
│   │   ├── ExportModal.tsx        ← Per-folder backup export (PigeonExport JSON)
│   │   ├── FilterPanel.tsx        ← Collapsible filter card (source/folder/search)
│   │   ├── FolderModal.tsx        ← Create and delete folders
│   │   ├── ImportModal.tsx        ← File upload + auto-detect + import / restore from backup
│   │   └── SourceIcon.tsx         ← Inline SVG icons for Twitter, Instagram, YouTube
│   ├── utils/
│   │   ├── extractEmbedIds.ts        ← URL parsers for IG post code + YT video id (used by embed modal)
│   │   └── fetchInstagramAvatars.ts  ← Scrapes IG profile `og:image` through the Vite proxy at import time
│   ├── pages/
│   │   ├── LoginPage.tsx       ← Login / create account screen
│   │   ├── MainPage.tsx        ← The bookmark feed (masonry grid + infinite scroll)
│   │   └── SettingsPage.tsx    ← Toggle sources, previews, theme
│   ├── App.tsx                 ← Auth gate + React Router route definitions
│   ├── main.tsx                ← Vite entry point
│   └── index.css               ← Global styles (masonry layout, responsive header)
├── index.html                  ← Root HTML file
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Architecture & Key Concepts

### Why Vite instead of Next.js?

PigeonSocial is a **pure client-side app** — all data lives in the browser (IndexedDB + localStorage). There's no server, no API routes, and no server-side rendering needed. Vite is the right tool: it's faster to start, simpler to configure, and doesn't add concepts you don't need.

Next.js would add value if you added a backend (e.g. syncing bookmarks across devices), but for a local-only prototype, it's unnecessary complexity.

### Data flow

```
JSON file upload
      ↓
  ImportModal
      ↓
detectAndMap() (auto-detects source)
      ↓
  mapper function (twitterMapper, instagramMapper, youtubeMapper)
      ↓
  Bookmark[] (normalised, unified shape)
      ↓
  Dexie db.bookmarks.bulkPut()
      ↓
  IndexedDB (persists in browser)
      ↓
  useLiveQuery() (auto-updates UI whenever DB changes)
      ↓
  MainPage → Masonry grid → BookmarkCard
```

### Local auth

The login system uses `localStorage` to store users and sessions. This is intentionally simple — it's a personal, local-only tool. Key characteristics:

- Passwords are base64-encoded (not cryptographically hashed)
- Sessions last 21 days, stored in `localStorage` as `pigeon_session`
- There's no "forgot password" — if you lose access, clear `pigeon_users` from localStorage and start over


### Zustand store

There are two slices in the store:

1. **`settings`** — persisted to `localStorage` via the `persist` middleware. Controls source visibility, preview toggle, and theme.
2. **`filter`** — in-memory only. Reset on page refresh. Controls the active search query, source filter, and folder filter.

### useLiveQuery (Dexie)

`useLiveQuery` from `dexie-react-hooks` is like `useState` but for your IndexedDB database. Whenever the DB changes (e.g. you import bookmarks or move one to a folder), the component automatically re-renders with the new data. No manual refresh, no polling.

```tsx
// This re-renders whenever bookmarks in the DB change
const allBookmarks = useLiveQuery(() =>
  db.bookmarks.orderBy('dateAdded').reverse().toArray()
);
```

### Masonry grid

`react-masonry-css` renders a CSS multi-column layout. It places cards into columns, and each card takes its natural height (unlike a CSS grid where rows have fixed heights). This means tall cards with long captions and short cards with no thumbnail sit side-by-side naturally.

The column count responds to viewport width via the `MASONRY_BREAKPOINTS` config in `MainPage.tsx`:

| Viewport     | Columns |
|-------------|---------|
| ≥ 1200px    | 4       |
| 900–1199px  | 3       |
| 600–899px   | 2       |
| < 600px     | 1       |

### Infinite scroll

Instead of pagination buttons, `MainPage` uses an `IntersectionObserver` to watch a 1px sentinel `<div>` at the bottom of the list. When it scrolls into view, `visibleCount` increases by `PAGE_SIZE`, loading the next batch of cards from the already-filtered array. This is pure client-side windowing — no network calls.

### Data mapper pattern

Each source's JSON export has a completely different shape. The mapper layer isolates that complexity:

- `twitterMapper.ts` knows about `"Tweet Id"`, `"Media URLs"`, etc.
- `instagramMapper.ts` knows about `xdt_api__v1__feed__saved__posts_connection`, `image_versions2`, etc.
- `youtubeMapper.ts` knows about `playlist.name`, `items[].age`, etc.

Everything else in the app works with the clean `Bookmark` type. If Instagram changes their API shape tomorrow, only `instagramMapper.ts` needs to change.

### Click-through preview modal

Clicking a card's thumbnail opens `BookmarkEmbedModal`, which renders the original post inline using each source's official embed:

- **Instagram** → iframe to `/p/{code}/embed/captioned` (post code parsed by `extractInstagramPostCode` in `utils/extractEmbedIds.ts`)
- **YouTube** → iframe to `/embed/{id}` in a 16:9 container (`extractYoutubeVideoId` handles `watch?v=`, `youtu.be`, `shorts`, `embed`)
- **Twitter** → lazy-loads `platform.twitter.com/widgets.js` once per page lifetime, then renders a `<blockquote class="twitter-tweet">`

All three are CORS-friendly cross-origin embeds — no Vite proxy involved. If URL parsing fails (deleted post, weird share link), the modal falls back to a centered "Open original" button. Title and ⋯ menu on the card are unchanged; the click target is just the thumbnail/placeholder area.

### Instagram avatar enrichment (and its 100×100 ceiling)

IG's saved-posts API response has no profile-pic field, so at import time `utils/fetchInstagramAvatars.ts` scrapes each creator's public profile page through a dev-only Vite proxy (`/ig-public-profile/{username}/` → `instagram.com/{username}/`) and parses `<meta og:image>`. That tag only carries the 100×100 thumbnail. The proper HD source (`/api/v1/users/web_profile_info/`) hard-rate-limits unauthenticated callers to ~1 successful call per IP per several minutes regardless of headers, so the JSON path was tried, instrumented, and ripped out. A real backend with persistent IG session cookies (Phase 4) is the only practical fix — see `.github/copilot-instructions.md` §10.

---

## Tech Stack Decisions

| Technology | Role | Why |
|---|---|---|
| **Vite** | Dev server + bundler | Fast HMR, zero config for SPAs |
| **React 19** | UI framework | Modern hooks, concurrent features |
| **TypeScript** | Type safety | Catches bugs at compile time |
| **Ant Design 5** | UI component library | Rich component set, good defaults |
| **Zustand** | Global state | Minimal API, no boilerplate |
| **Dexie** | IndexedDB wrapper | Clean async API, `useLiveQuery` hook |
| **react-masonry-css** | Masonry layout | Simple, CSS-column based, no DOM measuring |
| **React Router v7** | Client routing | For the `/settings` route |
| **dayjs** | Date formatting | Lightweight `moment.js` replacement |

---

## What to Build Next

Once you're comfortable with the basics, some good next steps:

- **Logo**: Replace the emoji favicon with the Flaticon pigeon PNG from https://www.flaticon.com/free-icon/pigeon_3338238
- **Drag-and-drop to folders**: Drag a card onto a folder in the sidebar to move it
- **Bulk actions**: Checkbox-select multiple cards → move/delete all at once
- **Tags**: Add freeform tags to bookmarks (the `tags: string[]` field is already there in the type)
- **Multiple pages of Instagram**: The IG export only returns one page (21 items). Add a "Load more" button that accepts the next page's JSON
- **Dark mode**: The settings toggle is wired up; implement the actual theme switch using AntD's `ConfigProvider` `algorithm` prop
- **Browser extension companion**: A small Manifest V3 extension that adds a "Save to PigeonSocial" button on Twitter/IG/YouTube, POSTing to a local Express server. This is also the unlock for full-resolution Instagram avatars — see `.github/copilot-instructions.md` §10 for why a backend session is the only practical fix for the 100×100 ceiling.

> For the full, prioritised roadmap (Phases 2a–5) and known limitations, see [`.github/copilot-instructions.md`](.github/copilot-instructions.md).
