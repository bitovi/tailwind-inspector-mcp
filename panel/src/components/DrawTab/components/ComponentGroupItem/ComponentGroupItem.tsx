import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import type { ComponentGroup } from '../../types';
import { useStoryProbe } from '../../hooks/useStoryProbe';
import { useIframeSlot, useProbeSlot } from '../../hooks/useIframeQueue';
import { buildArgsUrl } from '../../hooks/useArgsUrl';
import { ArgsForm } from '../ArgsForm';
import { ComponentRowThumb } from '../ComponentRowThumb';
import { ShadowGhost } from '../../../ShadowGhost';
import { cardReducer, INITIAL_STATE } from '../../hooks/useComponentCardState';
import { USE_SHARED_EXTRACTOR } from '../../hooks/extractorConfig';
import { useSharedExtraction } from '../../hooks/useSharedExtraction';
import type { AdaptiveIframe } from '../../../../../../overlay/src/adaptive-iframe/adaptive-iframe';
import '../../../../../../overlay/src/adaptive-iframe';

export interface ComponentGroupItemProps {
  group: ComponentGroup;
  isArmed: boolean;
  onArm: (ghostHtml: string, ghostCss: string, args?: Record<string, unknown>) => void;
  onDisarm: () => void;
  cachedGhostHtml?: string;
  cachedGhostCss?: string;
  cachedHostStyles?: Record<string, string>;
  cachedStoryBackground?: string;
  /** Cached arg count from ghost cache — shown before probe completes */
  cachedArgCount?: number;
  onGhostExtracted?: (params: {
    storyId: string;
    args?: Record<string, unknown>;
    ghostHtml: string;
    ghostCss: string;
    hostStyles: Record<string, string>;
    storyBackground?: string;
    componentName: string;
    componentPath?: string;
    argCount?: number;
  }) => void;
  /** Which tab context: 'replace' or 'place' — drives the button label */
  insertMode?: 'replace' | 'place';
  /** Whether a page element is currently selected */
  hasPageSelection?: boolean;
}

export function ComponentGroupItem({ group, isArmed, onArm, onDisarm, cachedGhostHtml, cachedGhostCss, cachedHostStyles, cachedStoryBackground, cachedArgCount, onGhostExtracted, insertMode, hasPageSelection }: ComponentGroupItemProps) {
  const [state, dispatch] = useReducer(cardReducer, {
    ...INITIAL_STATE,
    storyBackground: cachedStoryBackground,
  });
  const cardRef = useRef<HTMLLIElement>(null);
  const ghostRef = useRef<HTMLElement>(null);
  const initialLoadDone = useRef(false);
  const [expanded, setExpanded] = useState(false);

  // ── Phase 1: Visibility detection ──────────────────────────────────────

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          dispatch({ type: 'BECOME_VISIBLE', hasCachedGhost: !!cachedGhostHtml });
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cachedGhostHtml]);

  // ── Phase 2: Story probing ─────────────────────────────────────────────

  // Skip probing cached components until the user requests props (gear click)
  // or arms the component (loadLiveRequested).
  const wantsProbe =
    state.phase !== 'idle' &&
    (state.phase === 'probing' || !cachedGhostHtml || expanded || state.loadLiveRequested) &&
    !(state.phase === 'probe-done' || state.phase === 'loading' || state.phase === 'ready' || state.phase === 'loaded' || state.phase === 'error');

  const { canProbe, releaseProbeSlot } = useProbeSlot(wantsProbe);
  const probeEnabled = wantsProbe && canProbe;

  const { bestStory: bestStoryFromProbe, probing, argTypes, defaultArgs } = useStoryProbe(group.stories, probeEnabled);

  // Bridge: probe results → reducer
  useEffect(() => {
    if (!probing && bestStoryFromProbe && (state.phase === 'probing' || state.phase === 'cached')) {
      releaseProbeSlot();
      if (Object.keys(argTypes).length > 0) {
        dispatch({ type: 'PROBE_COMPLETE', bestStory: bestStoryFromProbe, argTypes, defaultArgs });
      } else {
        dispatch({ type: 'PROBE_FALLBACK', bestStory: bestStoryFromProbe });
      }
    }
  }, [probing, bestStoryFromProbe, argTypes, defaultArgs, state.phase]);

  // ── Phase 3: Iframe queue (per-component) ────────────────────────────
  // When using the shared extractor, the per-component queue is only needed
  // for live args editing (loadLiveRequested).

  const perComponentQueueEnabled =
    (!USE_SHARED_EXTRACTOR || state.loadLiveRequested) &&
    (state.phase === 'probe-done' || state.phase === 'loading') &&
    !!state.bestStory &&
    (!cachedGhostHtml || state.loadLiveRequested);

  const { canLoad, releaseSlot } = useIframeSlot(perComponentQueueEnabled);

  // Bridge: slot acquired → reducer
  useEffect(() => {
    if (canLoad && state.phase === 'probe-done') {
      dispatch({ type: 'SLOT_ACQUIRED' });
    }
  }, [canLoad, state.phase]);

  // ── Phase 3b: Shared extraction (single-iframe) ────────────────────
  // When enabled, the shared extractor handles initial ghost extraction
  // for all components via a single reused iframe.

  const sharedExtractionEnabled =
    USE_SHARED_EXTRACTOR &&
    state.phase === 'probe-done' &&
    !!state.bestStory &&
    !state.loadLiveRequested &&
    (!cachedGhostHtml);

  const { ghostData: sharedGhostData } = useSharedExtraction(
    state.bestStory?.id ?? null,
    sharedExtractionEnabled,
  );

  // Bridge: shared extraction result → reducer + cache
  useEffect(() => {
    if (!sharedGhostData || !USE_SHARED_EXTRACTOR) return;

    dispatch({
      type: 'GHOST_EXTRACTED',
      ghostHtml: sharedGhostData.ghostHtml,
      ghostCss: sharedGhostData.ghostCss,
      storyBackground: sharedGhostData.storyBackground,
      naturalWidth: sharedGhostData.naturalWidth,
      naturalHeight: sharedGhostData.naturalHeight,
    });

    if (state.bestStory) {
      onGhostExtracted?.({
        storyId: state.bestStory.id,
        args: {},
        ghostHtml: sharedGhostData.ghostHtml,
        ghostCss: sharedGhostData.ghostCss,
        hostStyles: sharedGhostData.hostStyles,
        storyBackground: sharedGhostData.storyBackground,
        componentName: group.name,
        componentPath: group.componentPath,
        argCount: Object.keys(state.argTypes).length || undefined,
      });
    }
  }, [sharedGhostData]);

  // ── Phase 4: Iframe src assignment ─────────────────────────────────────

  useEffect(() => {
    if (state.phase !== 'loading' || !state.bestStory || !ghostRef.current || initialLoadDone.current) return;
    initialLoadDone.current = true;
    const url = buildArgsUrl(state.bestStory.id, {});
    ghostRef.current.setAttribute('src', buildArgsUrl(state.bestStory.id, {}));
  }, [state.phase, state.bestStory]);

  // ── Phase 5: Iframe events (loaded / error / ghost-extracted) ──────────

  useEffect(() => {
    const el = ghostRef.current as unknown as AdaptiveIframe | null;
    if (!el?.addEventListener) return;

    const handleLoaded = () => {
      dispatch({ type: 'IFRAME_LOADED' });
      releaseSlot();
      // Apply any args that were queued before the iframe was ready
      if (state.pendingArgs && state.bestStory) {
        if (typeof el.updateArgs === 'function') {
          el.updateArgs(state.bestStory.id, state.pendingArgs);
        }
        dispatch({ type: 'CLEAR_PENDING_ARGS' });
      }
    };
    const handleError = (e: Event) => {
      const msg = (e as CustomEvent<{ message: string }>).detail.message;
      dispatch({ type: 'IFRAME_ERROR', message: msg });
      releaseSlot();
    };
    const handleExtracted = (e: Event) => {
      const { ghostHtml, ghostCss, hostStyles, storyBackground: bg, naturalWidth, naturalHeight } = (e as CustomEvent<{
        ghostHtml: string;
        ghostCss: string;
        hostStyles: Record<string, string>;
        storyBackground?: string;
        naturalWidth?: number;
        naturalHeight?: number;
      }>).detail;

      if (bg || ghostHtml) dispatch({ type: 'GHOST_EXTRACTED', ghostHtml, ghostCss: ghostCss ?? '', storyBackground: bg, naturalWidth, naturalHeight });

      if (state.bestStory) {
        onGhostExtracted?.({
          storyId: state.bestStory.id,
          args: {},
          ghostHtml,
          ghostCss: ghostCss ?? '',
          hostStyles,
          storyBackground: bg,
          componentName: group.name,
          componentPath: group.componentPath,
          argCount: Object.keys(state.argTypes).length || undefined,
        });
      }
    };

    el.addEventListener('iframe-loaded', handleLoaded);
    el.addEventListener('iframe-error', handleError as EventListener);
    el.addEventListener('ghost-extracted', handleExtracted as EventListener);
    return () => {
      el.removeEventListener('iframe-loaded', handleLoaded);
      el.removeEventListener('iframe-error', handleError as EventListener);
      el.removeEventListener('ghost-extracted', handleExtracted as EventListener);
    };
  }, [state.bestStory, state.pendingArgs, releaseSlot, group.name, group.componentPath, onGhostExtracted]);

  // ── Args changes ───────────────────────────────────────────────────────

  const handleArgsChange = useCallback((newArgs: Record<string, unknown>) => {
    dispatch({ type: 'ARGS_CHANGED', args: newArgs });

    if (!state.liveReady || !ghostRef.current || !state.bestStory) {
      // Iframe not ready — queue args and request live load
      dispatch({ type: 'REQUEST_LIVE_REFRESH' });
      return;
    }

    const el = ghostRef.current as unknown as AdaptiveIframe;
    if (typeof el.updateArgs === 'function') {
      el.updateArgs(state.bestStory.id, newArgs);
    }
  }, [state.bestStory, state.liveReady]);

  // ── Arm / disarm ───────────────────────────────────────────────────────

  const handleInsertClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isArmed) {
      onDisarm();
      return;
    }
    const el = ghostRef.current as unknown as AdaptiveIframe;
    const ghostHtml = el?.getComponentHtml?.() ?? state.liveGhostHtml ?? cachedGhostHtml ?? '';
    const ghostCss = el?.getComponentCss?.() ?? state.liveGhostCss ?? cachedGhostCss ?? '';
    onArm(ghostHtml, ghostCss, state.args);

    dispatch({ type: 'REQUEST_LIVE_REFRESH' });

    if (onGhostExtracted && ghostHtml && state.bestStory) {
      onGhostExtracted({
        storyId: state.bestStory.id,
        args: state.args,
        ghostHtml,
        ghostCss,
        hostStyles: cachedHostStyles ?? {},
        storyBackground: state.storyBackground,
        componentName: group.name,
        componentPath: group.componentPath,
        argCount: Object.keys(state.argTypes).length || undefined,
      });
    }
  }, [isArmed, onArm, onDisarm, state.args, state.bestStory, state.storyBackground, cachedGhostHtml, cachedGhostCss, cachedHostStyles, group.name, group.componentPath, onGhostExtracted]);

  // ── Customize / expand toggle ──────────────────────────────────────────

  const handleCustomizeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => !prev);
    // Trigger live load if not yet loaded
    if (!state.liveReady && !state.loadLiveRequested) {
      dispatch({ type: 'REQUEST_LIVE_REFRESH' });
    }
  }, [state.liveReady, state.loadLiveRequested]);

  // ── Derived values ─────────────────────────────────────────────────────

  const effectiveArgTypes = Object.keys(state.argTypes).length > 0
    ? state.argTypes
    : (group.argTypes ?? {});
  const hasArgs = Object.keys(effectiveArgTypes).length > 0 || !!cachedGhostHtml;
  const argCount = Object.keys(effectiveArgTypes).length || cachedArgCount || 0;

  const ghostHtml = state.liveGhostHtml ?? cachedGhostHtml;
  const ghostCss = state.liveGhostCss ?? cachedGhostCss;

  // Button label matches the tab context
  const insertLabel = insertMode === 'replace' ? 'Replace' : 'Place';
  const armingLabel = insertMode === 'replace' ? 'Replacing' : 'Placing';

  // The adaptive-iframe is always rendered (hidden) once we have a bestStory.
  // With shared extractor, only mount per-component iframe for live args editing.
  const isVisible = state.phase !== 'idle';
  const bestStory = state.bestStory ?? bestStoryFromProbe;
  const mountIframe = USE_SHARED_EXTRACTOR
    ? isVisible && !state.error && bestStory && state.loadLiveRequested
    : isVisible && !state.error && !probing && bestStory;

  // ── Render ─────────────────────────────────────────────────────────────

  // Button state classes
  const selectBtnClass = isArmed
    ? 'border-bv-orange text-white bg-bv-orange hover:bg-[#d94425]'
    : hasPageSelection
      ? 'border-bv-teal text-bv-teal bg-bv-teal/10 hover:bg-bv-teal/20 hover:text-white'
      : 'border-bv-border text-bv-text-mid bg-bv-surface hover:border-[#555] hover:text-bv-text hover:bg-bv-surface-hi';

  return (
    <li ref={cardRef} className="flex flex-col">
      {/* ── Compact row ── */}
      <div
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-all ${
          isArmed
            ? 'bg-bv-orange/10 border border-bv-orange'
            : expanded
              ? 'bg-bv-surface border border-bv-border rounded-b-none'
              : 'border border-transparent hover:bg-bv-surface hover:border-bv-border'
        }`}
        onClick={handleCustomizeClick}
      >
        {/* Thumbnail */}
        <ComponentRowThumb
          phase={state.phase}
          ghostHtml={ghostHtml}
          ghostCss={ghostCss}
          naturalWidth={state.naturalWidth}
          naturalHeight={state.naturalHeight}
          storyBackground={state.storyBackground}
          onClick={handleCustomizeClick}
        />

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          {group.stories[0] ? (
            <a
              href={`/storybook/?path=/story/${group.stories[0].id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-bv-text hover:text-bv-orange hover:underline transition-colors leading-tight truncate block"
              onClick={(e) => e.stopPropagation()}
            >
              <ComponentTitle fullTitle={group.fullTitle} />
            </a>
          ) : (
            <div className="text-[12px] text-bv-text leading-tight truncate">
              <ComponentTitle fullTitle={group.fullTitle} />
            </div>
          )}
          <div className="text-[10px] text-bv-muted mt-0.5">
            {state.phase === 'loading' && !ghostHtml ? (
              <span className="text-bv-teal">Loading preview…</span>
            ) : argCount > 0 ? (
              `${argCount} props`
            ) : null}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className={`h-5.5 rounded px-2 text-[10px] font-medium border transition-all cursor-pointer ${
              expanded
                ? 'border-[#555] text-bv-text bg-bv-surface-hi'
                : 'border-bv-border text-bv-text-mid bg-bv-surface hover:border-[#555] hover:text-bv-text hover:bg-bv-surface-hi'
            }`}
            onClick={handleCustomizeClick}
          >
            {expanded ? '▲ Collapse' : 'Customize'}
          </button>
          <button
            type="button"
            className={`h-5.5 rounded px-2 text-[10px] font-medium border transition-all cursor-pointer ${selectBtnClass}`}
            onClick={handleInsertClick}
          >
            {isArmed ? armingLabel : insertLabel}
          </button>
        </div>
      </div>

      {/* ── Expand drawer: full-size preview + props ── */}
      {expanded && (
        <div className="border border-t-0 border-bv-border rounded-b-md bg-bv-surface overflow-hidden">
          {/* Full-size ghost preview */}
          <div
            className="flex items-center justify-center min-h-20 p-4 border-b border-bv-border overflow-hidden"
            style={{
              contain: 'paint',
              ...(state.storyBackground ? { backgroundColor: state.storyBackground } : {}),
            }}
          >
            {ghostHtml && ghostCss ? (
              <ShadowGhost ghostHtml={ghostHtml} ghostCss={ghostCss} />
            ) : ghostHtml ? (
              <div className="pointer-events-none" dangerouslySetInnerHTML={{ __html: ghostHtml }} />
            ) : (
              <span className="text-[10px] text-bv-muted">Loading preview…</span>
            )}
          </div>

          {/* Props editor */}
          {hasArgs && (
            <div className="px-2.5 py-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-bv-muted">Props</span>
                <span className="text-[9px] text-bv-muted">Changes re-render live</span>
              </div>
              <ArgsForm
                argTypes={effectiveArgTypes}
                args={state.args}
                onArgsChange={handleArgsChange}
              />
            </div>
          )}
        </div>
      )}

      {/* Hidden extraction engine — never visible, drives ghost-extracted events.
          Uses ref callback to set !important styles because applyStylesToHost()
          inside the adaptive-iframe overwrites normal inline styles with the
          component's own computed styles (position, width, height, etc.). */}
      {mountIframe && (
        // @ts-expect-error — custom element not in JSX.IntrinsicElements
        <adaptive-iframe
          ref={(el: HTMLElement | null) => {
            (ghostRef as React.MutableRefObject<HTMLElement | null>).current = el;
            if (el) {
              el.style.setProperty('position', 'absolute', 'important');
              el.style.setProperty('width', '0', 'important');
              el.style.setProperty('height', '0', 'important');
              el.style.setProperty('opacity', '0', 'important');
              el.style.setProperty('pointer-events', 'none', 'important');
              el.style.setProperty('overflow', 'hidden', 'important');
            }
          }}
        />
      )}
    </li>
  );
}

function ComponentTitle({ fullTitle }: { fullTitle: string }) {
  const segments = fullTitle.split('/');
  if (segments.length === 1) {
    return <span className="font-semibold">{segments[0]}</span>;
  }
  const path = segments.slice(0, -1);
  const name = segments.at(-1);
  return (
    <>
      <span className="text-bv-muted font-normal">{path.join(' / ')}</span>
      <span className="text-bv-muted font-normal"> / </span>
      <span className="font-semibold">{name}</span>
    </>
  );
}
