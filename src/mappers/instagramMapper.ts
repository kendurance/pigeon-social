// src/mappers/instagramMapper.ts
// ─────────────────────────────────────────────────────────────────────────────
// Converts an Instagram saved posts network response (captured via DevTools)
// into unified Bookmark objects.
//
// How to get this JSON:
//   1. Open Instagram in Chrome and log in
//   2. Open DevTools → Network tab
//   3. Navigate to your Saved posts page (Profile → Saved)
//   4. Filter network requests by "xdt_api__v1__feed__saved"
//   5. Copy the response JSON and save as a .json file
// ─────────────────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import type { Bookmark, RawInstagramExport, RawInstagramMedia } from '@/types';

/** Maps Instagram media_type number to a human-readable label. */
const INSTAGRAM_MEDIA_TYPE_LABEL: Record<number, string> = {
  1: 'photo',
  2: 'video',
  8: 'carousel',
};

/**
 * Picks the best (highest-resolution) thumbnail from image_versions2.
 * Instagram provides multiple sizes; we take the first candidate which tends
 * to be the largest. For carousel posts the top-level image_versions2 is
 * often absent, so we fall back to the first slide's images.
 */
function extractInstagramThumbnail(media: RawInstagramMedia): string | null {
  // The candidates array is sorted largest → smallest; first entry is best
  const topLevel = media.image_versions2?.candidates?.[0]?.url;
  if (topLevel) return topLevel;

  const firstCarouselImage = media.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url;
  return firstCarouselImage ?? null;
}

/**
 * Builds the public Instagram post URL from the media's short code.
 * Example: code "DVXQiyEgDBE" → "https://www.instagram.com/p/DVXQiyEgDBE/"
 */
function buildInstagramPostUrl(mediaCode: string): string {
  return `https://www.instagram.com/p/${mediaCode}/`;
}

/**
 * Extracts the best available title/caption text from an Instagram media item.
 * Falls back to the accessibility caption, then the media type label.
 */
function extractInstagramTitle(media: RawInstagramMedia): string {
  const captionText        = media.caption?.text?.trim();
  const accessibilityText  = media.accessibility_caption?.trim();
  const mediaTypeLabel     = INSTAGRAM_MEDIA_TYPE_LABEL[media.media_type] ?? 'post';

  return captionText || accessibilityText || `Instagram ${mediaTypeLabel}`;
}

/**
 * Converts a single Instagram media object into a unified Bookmark.
 */
function mapSingleInstagramMedia(media: RawInstagramMedia): Bookmark {
  return {
    id:              uuidv4(),
    source:          'instagram',
    mediaType:       media.media_type === 2 ? 'video' : 'image',
    title:           extractInstagramTitle(media),
    url:             buildInstagramPostUrl(media.code),
    thumbnailUrl:    extractInstagramThumbnail(media),
    authorName:      media.user?.username ? `@${media.user.username}` : '@instagram',
    authorAvatarUrl: null,   // not included in saved posts API response
    dateAdded:       new Date().toISOString(),  // IG export doesn't include save date
    folderId:        null,
    tags:            [],
    rawData:         media,
  };
}

/**
 * Maps an entire Instagram saved posts export to Bookmarks.
 * The export is a nested object — this function drills down to the edges array.
 */
export function mapInstagramExport(parsedJson: unknown): Bookmark[] {
  // Type-check the top-level structure
  if (typeof parsedJson !== 'object' || parsedJson === null) {
    console.warn('[instagramMapper] Expected an object, got:', typeof parsedJson);
    return [];
  }

  let edges: { node: { media: RawInstagramMedia } }[] | undefined;

  try {
    const typedExport = parsedJson as RawInstagramExport;
    edges = typedExport.data?.xdt_api__v1__feed__saved__posts_connection?.edges;
  } catch {
    console.warn('[instagramMapper] Unexpected JSON structure');
    return [];
  }

  if (!Array.isArray(edges)) {
    console.warn('[instagramMapper] Could not find edges array in JSON');
    return [];
  }

  return edges
    .filter((edge) => edge?.node?.media != null)
    .map((edge) => mapSingleInstagramMedia(edge.node.media));
}
