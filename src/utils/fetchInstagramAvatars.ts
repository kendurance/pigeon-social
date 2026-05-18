// src/utils/fetchInstagramAvatars.ts
// ─────────────────────────────────────────────────────────────────────────────
// Resolves Instagram creator avatar URLs by scraping the public (logged-out)
// HTML of each user's profile page through the Vite dev-server proxy. IG's
// saved-posts API response carries no profile_pic_url, so this is the only
// non-manual path to per-creator avatars in a browser-only app.
//
// Why HTML scrape and not the JSON `web_profile_info` API:
//   We tried `/api/v1/users/web_profile_info/?username=X` (which returns
//   `profile_pic_url_hd` at 320×320, ~10× the pixel count of the og:image)
//   but IG hard-rate-limits that endpoint per-IP after a *single* successful
//   call, regardless of headers. Six header combinations all returned 401
//   ("Please wait a few minutes…") and the limit didn't refill even after
//   30s. So in a 20-user import, we'd get 1 HD avatar and 19 fallbacks —
//   inconsistent enough that we ripped it out. Phase 4's backend will hold
//   real IG session cookies and can properly use that endpoint. See the
//   "Known Limitations" entry in copilot-instructions.md.
//
// HTML scrape source: the `<meta property="og:image" content="...">` tag in
// the rendered profile page. That URL is 100×100 (the small thumbnail shown
// in IG's "See full profile in the app" modal) but is served reliably with
// no per-IP throttle. Avatar URLs (`t51.2885-19/...`) carry signed `oe=`
// tokens that last ~months, so one fetch per import is durable.
//
// Failures (login wall, network down, parse miss) resolve to `null` for
// that username — the caller's fallback chain handles the gap. This helper
// never throws.
// ─────────────────────────────────────────────────────────────────────────────

/** Milliseconds to wait between sequential IG requests. Keeps us politely
 *  paced and well clear of any anti-scraping heuristics on the HTML pages. */
const DELAY_BETWEEN_FETCHES_MS = 200;

/**
 * Maps usernames → avatar CDN URL (or null on failure). The returned object
 * is keyed by the same strings passed in, deduped.
 *
 * `existingAvatars` lets the caller pass a username → cached-URL map
 * (typically pulled from prior IG bookmarks in the DB). Cached entries skip
 * the network entirely, making re-imports near-instant.
 *
 * `onProgress` is called once with (0, total) before the loop starts, and
 * once after each username resolves (cached or fetched). Drives the import
 * modal's progress bar so the user can see the wait moving.
 */
export async function fetchInstagramAvatars(
  usernames: string[],
  existingAvatars: Record<string, string | null | undefined> = {},
  onProgress?: (completed: number, total: number) => void,
): Promise<Record<string, string | null>> {
  const uniqueUsernames = Array.from(new Set(usernames.filter(Boolean)));
  const result: Record<string, string | null> = {};
  const total = uniqueUsernames.length;
  let completed = 0;

  onProgress?.(completed, total);

  // Serial fetch with a small delay between requests. Politer pacing keeps
  // us below the threshold that triggers IG's login-wall heuristics on the
  // public profile pages.
  for (const username of uniqueUsernames) {
    const cached = existingAvatars[username];
    if (cached) {
      result[username] = cached;
    } else {
      result[username] = await fetchAvatarFromProfileHtml(username);
      await sleep(DELAY_BETWEEN_FETCHES_MS);
    }

    completed += 1;
    onProgress?.(completed, total);
  }

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches the proxied profile HTML and pulls the avatar URL out of the
 * `<meta property="og:image">` tag. That URL is 100×100 — small, but the
 * only resolution available without an authenticated session.
 */
async function fetchAvatarFromProfileHtml(username: string): Promise<string | null> {
  try {
    const response = await fetch(
      `/ig-public-profile/${encodeURIComponent(username)}/`,
      { credentials: 'omit', redirect: 'follow' },
    );
    if (!response.ok) return null;

    const html    = await response.text();
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    return ogMatch?.[1] ? decodeHtmlEntities(ogMatch[1]) : null;
  } catch {
    return null;
  }
}

/** Decodes the small set of HTML entities IG might emit inside meta content. */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g,  '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>');
}
