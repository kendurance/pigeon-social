// src/utils/extractEmbedIds.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pulls the embeddable media identifier out of a source URL. Used by
// BookmarkEmbedModal to build the per-source iframe `src`.
//
// Twitter has no extraction here — its widgets.js takes the raw URL.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the Instagram post code from any of the canonical IG URL shapes:
 *   • https://www.instagram.com/p/{code}/
 *   • https://www.instagram.com/reel/{code}/
 *   • https://www.instagram.com/tv/{code}/
 * The trailing slash and any query string are tolerated.
 *
 * Returns null if the URL doesn't match — caller should show the fallback.
 */
export function extractInstagramPostCode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

/**
 * Extracts the YouTube video ID from the URL shapes the YouTube playlist
 * exporter produces, plus the common share variants:
 *   • https://www.youtube.com/watch?v={id}
 *   • https://youtu.be/{id}
 *   • https://www.youtube.com/shorts/{id}
 *   • https://www.youtube.com/embed/{id}
 *
 * Extra query params (timestamps, playlist context, etc.) are ignored.
 */
export function extractYoutubeVideoId(url: string): string | null {
  // youtu.be short link
  const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // /shorts/{id} or /embed/{id}
  const pathMatch = url.match(/youtube\.com\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})/);
  if (pathMatch) return pathMatch[1];

  // /watch?v={id}
  const watchMatch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  return null;
}
