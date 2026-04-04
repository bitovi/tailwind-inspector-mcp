import { useRef, useState, useEffect } from 'react';
import type { CardPhase } from '../../hooks/useComponentCardState';
import { ShadowGhost } from '../../../ShadowGhost';

const THUMB_W = 56;
const THUMB_H = 40;
const MIN_SCALE = 0.15;

interface ComponentRowThumbProps {
  phase: CardPhase;
  ghostHtml?: string | null;
  ghostCss?: string | null;
  naturalWidth: number;
  naturalHeight: number;
  storyBackground?: string;
  onClick?: () => void;
}

export function ComponentRowThumb({
  phase,
  ghostHtml,
  ghostCss,
  naturalWidth,
  naturalHeight,
  storyBackground,
  onClick,
}: ComponentRowThumbProps) {
  const isVisible = phase !== 'idle';
  const hasGhost = isVisible && !!ghostHtml;
  const isLoading = isVisible && !hasGhost && phase !== 'error';
  const innerRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);

  // Measure the ghost content's intrinsic dimensions after the ShadowGhost
  // renders its shadow DOM.  This covers cached ghosts (which don't go
  // through the adaptive-iframe and therefore have naturalWidth=0).
  useEffect(() => {
    if (!hasGhost || !innerRef.current) return;
    // If we already have iframe-measured dimensions, skip
    if (naturalWidth > 0 && naturalHeight > 0) return;

    // Find the ShadowGhost host div (first child of the inner container)
    const host = innerRef.current.firstElementChild as HTMLElement | null;
    const shadow = host?.shadowRoot;
    const contentDiv = shadow?.querySelector('div') as HTMLElement | null;
    if (!contentDiv) return;

    // Temporarily shrink-wrap the content to get intrinsic dimensions
    const prevWidth = contentDiv.style.width;
    contentDiv.style.width = 'max-content';
    const w = contentDiv.scrollWidth;
    const h = contentDiv.scrollHeight;
    contentDiv.style.width = prevWidth;

    if (w > 0 && h > 0) {
      setMeasured({ w, h });
    }
  }, [hasGhost, ghostHtml, naturalWidth, naturalHeight]);

  // Placeholder (not loaded yet)
  if (!isVisible || phase === 'idle') {
    return (
      <div
        className="w-14 h-10 rounded bg-bv-surface border border-dashed border-bv-border flex items-center justify-center text-[9px] font-mono text-bv-muted cursor-pointer shrink-0 hover:border-bv-teal hover:text-bv-teal transition-colors"
        onClick={onClick}
      >
        preview
      </div>
    );
  }

  // Loading spinner
  if (isLoading) {
    return (
      <div className="w-14 h-10 rounded bg-bv-surface flex items-center justify-center shrink-0">
        <div className="w-3.5 h-3.5 border-2 border-bv-border border-t-bv-teal rounded-full animate-spin" />
      </div>
    );
  }

  // Error
  if (phase === 'error') {
    return (
      <div className="w-14 h-10 rounded bg-bv-surface flex items-center justify-center shrink-0">
        <span className="text-[9px] text-bv-orange">err</span>
      </div>
    );
  }

  // Use iframe-measured dimensions first; fall back to self-measured.
  const contentW = naturalWidth > 0 ? naturalWidth : (measured?.w ?? 0);
  const contentH = naturalHeight > 0 ? naturalHeight : (measured?.h ?? 0);

  const rawScale = contentW > 0 && contentH > 0
    ? Math.min(THUMB_W / contentW, THUMB_H / contentH, 1.0)
    : 1.0;
  const scale = Math.max(rawScale, MIN_SCALE);

  return (
    <div
      className="w-14 h-10 rounded bg-bv-surface overflow-hidden relative cursor-pointer shrink-0"
      style={storyBackground ? { backgroundColor: storyBackground } : undefined}
      onClick={onClick}
    >
      <div
        ref={innerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          width: scale < 1 ? `${THUMB_W / scale}px` : `${THUMB_W}px`,
          height: scale < 1 ? `${THUMB_H / scale}px` : `${THUMB_H}px`,
          display: 'flex',
          alignItems: scale >= 0.8 ? 'center' : 'flex-start',
          justifyContent: scale >= 0.8 ? 'center' : 'flex-start',
          padding: scale < 0.8 ? '4px' : '2px',
          pointerEvents: 'none',
        }}
      >
        {ghostCss ? (
          <ShadowGhost ghostHtml={ghostHtml!} ghostCss={ghostCss} />
        ) : (
          <div
            className="pointer-events-none"
            dangerouslySetInnerHTML={{ __html: ghostHtml! }}
          />
        )}
      </div>
    </div>
  );
}
