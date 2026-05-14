// src/components/SourceIcon.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders the appropriate brand icon for a given social media source.
// Uses SVG inline icons (no external font load required).
// The `size` prop controls both width and height.
// ─────────────────────────────────────────────────────────────────────────────

import type { BookmarkSource } from '@/types';

interface SourceIconProps {
  source: BookmarkSource;
  /** Icon size in pixels. Defaults to 20. */
  size?: number;
  /** Optional extra CSS class names. */
  className?: string;
}

/** The brand colour associated with each source, used as the fill colour. */
const SOURCE_BRAND_COLORS: Record<BookmarkSource, string> = {
  twitter:   '#000000',  // X/Twitter black
  instagram: '#E1306C',  // Instagram gradient approximation (pink)
  youtube:   '#FF0000',  // YouTube red
};

/** Inline SVG paths for each source icon. */
function TwitterIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-label="X (Twitter)">
      {/* X logo */}
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-label="Instagram">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function YoutubeIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-label="YouTube">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function UnknownIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-label="Unknown source">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  );
}

export function SourceIcon({ source, size = 20, className }: SourceIconProps) {
  const brandColor = SOURCE_BRAND_COLORS[source];

  return (
    <span
      className={className}
      style={{ color: brandColor, display: 'inline-flex', alignItems: 'center' }}
    >
      {source === 'twitter'   && <TwitterIcon   size={size} />}
      {source === 'instagram' && <InstagramIcon size={size} />}
      {source === 'youtube'   && <YoutubeIcon   size={size} />}
      {source !== 'twitter' && source !== 'instagram' && source !== 'youtube' && (
        <UnknownIcon size={size} />
      )}
    </span>
  );
}
