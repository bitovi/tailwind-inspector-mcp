import type { RefObject } from 'react';
import type { CardPhase } from '../../hooks/useComponentCardState';
import type { StoryEntry } from '../../types';
import { ShadowGhost } from '../../../ShadowGhost';
import '../../../../../../overlay/src/adaptive-iframe';

interface ComponentCardPreviewProps {
  phase: CardPhase;
  isArmed: boolean;
  error: string | null;
  /**
   * The ghost HTML to display — either the cached version (from server) or
   * the freshly extracted live version (from ghost-extracted event).
   * Raw HTML with original class names preserved, no inline styles.
   */
  ghostHtml?: string | null;
  /**
   * Collected CSS from the iframe's stylesheets (Tailwind + component CSS).
   * Injected inside a shadow DOM wrapper alongside ghostHtml.
   */
  ghostCss?: string | null;
  liveReady: boolean;
  probing: boolean;
  bestStory: StoryEntry | null;
  storyBackground?: string;
  ghostRef: RefObject<HTMLElement | null>;
}

export function ComponentCardPreview({
  phase,
  isArmed,
  error,
  ghostHtml,
  ghostCss,
  liveReady,
  probing,
  bestStory,
  storyBackground,
  ghostRef,
}: ComponentCardPreviewProps) {
  const isVisible = phase !== 'idle';
  // Show ghost HTML whenever we have it — covers both cached and live-extracted
  const showGhost = isVisible && !error && !!ghostHtml;
  const showLoading = isVisible && !error && !ghostHtml && !liveReady && (probing || !!bestStory);
  // The adaptive-iframe is always rendered (hidden) once we have a bestStory so
  // it can extract/refresh the ghost. It is positioned out-of-flow so it never
  // affects the visible layout.
  const mountIframe = isVisible && !error && !probing && bestStory;
  const showNoStories = isVisible && !error && !probing && !bestStory && !ghostHtml;

  return (
    <div
      className="flex items-center justify-center min-h-14 overflow-hidden"
      style={{
        contain: 'paint',
        ...(storyBackground ? { backgroundColor: storyBackground } : {}),
        // Teal tint layered on top of storyBackground via inset box-shadow so
        // the story background (e.g. white) remains visible when armed.
        ...(isArmed ? { boxShadow: 'inset 0 0 0 9999px rgba(0,132,139,0.06)' } : {}),
      }}
    >
      {!isVisible && (
        <span className="text-[10px] text-bv-muted"> </span>
      )}
      {isVisible && error && (
        <span className="text-[10px] text-bv-orange px-2 py-1 text-center leading-tight">{error}</span>
      )}
      {showLoading && (
        <span className="text-[10px] text-bv-muted">Loading preview…</span>
      )}
      {showGhost && ghostCss && (
        <ShadowGhost ghostHtml={ghostHtml!} ghostCss={ghostCss} />
      )}
      {showGhost && !ghostCss && (
        <div
          className="pointer-events-none"
          dangerouslySetInnerHTML={{ __html: ghostHtml! }}
        />
      )}
      {showNoStories && (
        <span className="text-[10px] text-bv-muted">No stories found.</span>
      )}
      {/* Hidden extraction engine — never visible, drives ghost-extracted events */}
      {mountIframe && (
        // @ts-expect-error — custom element not in JSX.IntrinsicElements
        <adaptive-iframe
          ref={ghostRef}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}
        />
      )}
    </div>
  );
}
