// src/components/BookmarkEmbedModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Click-through preview modal. Opens when the user clicks a card's
// thumbnail/placeholder area and renders the source's official embed inline:
//
//   • Instagram → /p/{code}/embed/captioned iframe (no auth required)
//   • YouTube   → /embed/{id} iframe in a 16:9 container
//   • Twitter   → official `widgets.js` blockquote render, with loading
//                 spinner and a graceful fallback if the tweet never renders
//                 (deleted, protected, or blocked by an extension)
//
// A constant "Open on {source}" footer button is always visible as an escape
// hatch — useful when IG itself reports "this photo or video may be broken"
// inside the iframe, or when a user just prefers the native experience.
//
// If embed-ID extraction fails (malformed URL, unknown shape), the modal
// shows a centered fallback message + button.
//
// No Vite proxy involvement — embed targets all allow direct cross-origin
// iframe loading, and Twitter's widgets.js is served with permissive CORS.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Typography, Spin } from 'antd';
import { LinkOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Bookmark, BookmarkSource } from '@/types';
import { extractInstagramPostCode, extractYoutubeVideoId } from '@/utils/extractEmbedIds';

const { Text } = Typography;

// ── Twitter widgets.js loader ────────────────────────────────────────────────

const TWITTER_WIDGETS_SRC = 'https://platform.twitter.com/widgets.js';

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load: (element?: Element | null) => void;
      };
    };
  }
}

/**
 * Lazily injects Twitter's widgets.js once per page lifetime. Subsequent
 * callers reuse the already-loaded script. Resolves when `window.twttr` is
 * ready to render blockquotes.
 */
function ensureTwitterWidgetsLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (window.twttr?.widgets?.load) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TWITTER_WIDGETS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src   = TWITTER_WIDGETS_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    document.body.appendChild(script);
  });
}

// ── Component ────────────────────────────────────────────────────────────────

interface BookmarkEmbedModalProps {
  /** The bookmark to preview. Null means modal is closed. */
  bookmark: Bookmark | null;
  onClose:  () => void;
}

export function BookmarkEmbedModal({ bookmark, onClose }: BookmarkEmbedModalProps) {
  // Bumped by the footer's Retry button to force a fresh mount of the embed.
  // Used in the EmbedBody `key` together with bookmark.id so switching to a
  // different card also remounts (without the previous bookmark's retry
  // count leaking across).
  const [retryCount, setRetryCount] = useState(0);

  return (
    <Modal
      open={bookmark !== null}
      onCancel={onClose}
      footer={bookmark && [
        <Button
          key="retry"
          icon={<ReloadOutlined />}
          onClick={() => setRetryCount((n) => n + 1)}
        >
          Retry
        </Button>,
        <Button
          key="open"
          type="primary"
          icon={<LinkOutlined />}
          onClick={() => window.open(bookmark.url, '_blank', 'noopener,noreferrer')}
        >
          Open on {sourceDisplayName(bookmark.source)}
        </Button>,
      ]}
      width={600}
      centered
      destroyOnClose
      styles={{ body: { padding: 0 } }}
    >
      {bookmark && (
        <EmbedBody key={`${bookmark.id}-${retryCount}`} bookmark={bookmark} />
      )}
    </Modal>
  );
}

function sourceDisplayName(source: BookmarkSource): string {
  switch (source) {
    case 'instagram': return 'Instagram';
    case 'youtube':   return 'YouTube';
    case 'twitter':   return 'Twitter / X';
    default:          return 'original site';
  }
}

// ── Per-source embed body ────────────────────────────────────────────────────

function EmbedBody({ bookmark }: { bookmark: Bookmark }) {
  if (bookmark.source === 'instagram') {
    const code = extractInstagramPostCode(bookmark.url);
    if (!code) return <Fallback />;
    return (
      <iframe
        src={`https://www.instagram.com/p/${code}/embed/captioned`}
        title={bookmark.title}
        loading="lazy"
        scrolling="no"
        allowTransparency
        style={{
          display:   'block',
          width:     '100%',
          maxWidth:  540,
          height:    'min(720px, calc(100vh - 200px))',
          margin:    '0 auto',
          border:    0,
          background: '#fff',
        }}
      />
    );
  }

  if (bookmark.source === 'youtube') {
    const id = extractYoutubeVideoId(bookmark.url);
    if (!id) return <Fallback />;
    return (
      // 16:9 aspect ratio container — width fills modal, height tracks it.
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, background: '#000' }}>
        <iframe
          src={`https://www.youtube.com/embed/${id}`}
          title={bookmark.title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            border: 0,
          }}
        />
      </div>
    );
  }

  if (bookmark.source === 'twitter') {
    return <TwitterEmbed bookmark={bookmark} />;
  }

  return <Fallback />;
}

// ── Twitter embed (with render detection) ────────────────────────────────────

/**
 * Renders a tweet via Twitter's widgets.js. Polls the container for the
 * rendered `<iframe>` (which widgets.js injects when it successfully fetches
 * the tweet) and switches state accordingly:
 *
 *   loading  → spinner overlay sits on top of the seed blockquote
 *   rendered → spinner gone, the rendered tweet is visible
 *   failed   → seed blockquote is hidden and a "couldn't embed" message +
 *              fallback button replace it. Triggered when no iframe shows up
 *              within ~5s (tweet deleted/protected, widgets.js blocked, etc.)
 */
function TwitterEmbed({ bookmark }: { bookmark: Bookmark }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'rendered' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    let attempts  = 0;
    const MAX_ATTEMPTS    = 10;   // 10 × 500ms = 5 seconds total
    const POLL_INTERVAL_MS = 500;

    function checkRendered() {
      if (cancelled) return;
      attempts += 1;
      const container = containerRef.current;
      if (!container) return;
      // widgets.js injects an <iframe> when the tweet successfully renders.
      const renderedFrame = container.querySelector('iframe');
      if (renderedFrame) {
        setStatus('rendered');
      } else if (attempts >= MAX_ATTEMPTS) {
        setStatus('failed');
      } else {
        window.setTimeout(checkRendered, POLL_INTERVAL_MS);
      }
    }

    ensureTwitterWidgetsLoaded().then(() => {
      if (cancelled) return;
      window.twttr?.widgets?.load(containerRef.current);
      window.setTimeout(checkRendered, POLL_INTERVAL_MS);
    });

    return () => { cancelled = true; };
  }, [bookmark.url]);

  if (status === 'failed') {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: '#fff' }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          This tweet couldn't be embedded. It may be deleted, from a
          protected account, or blocked by a browser extension.
        </Text>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ padding: 16, background: '#fff', minHeight: 200, position: 'relative' }}
    >
      <blockquote className="twitter-tweet" data-dnt="true">
        <a href={bookmark.url}>{bookmark.title}</a>
      </blockquote>

      {status === 'loading' && (
        <div
          style={{
            position:       'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            background:     'rgba(255,255,255,0.92)',
          }}
        >
          <Spin />
        </div>
      )}
    </div>
  );
}

// ── Fallback shown when URL parsing fails ────────────────────────────────────
// (Generic "broken" / "post removed" failures from the source itself are
// surfaced inside the source's own embed UI — the always-visible footer
// "Open on {source}" button is the user's escape hatch there.)

function Fallback() {
  return (
    <div style={{ padding: 32, textAlign: 'center', background: '#fff' }}>
      <Text type="secondary">
        Couldn't generate an inline preview for this post. Use the "Open on…"
        button below to view the original.
      </Text>
    </div>
  );
}
