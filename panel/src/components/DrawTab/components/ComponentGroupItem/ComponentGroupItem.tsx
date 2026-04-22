import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import type { ComponentGroup, ArmedComponentData } from '../../types';
import { useStoryProbe } from '../../hooks/useStoryProbe';
import { useIframeSlot, useProbeSlot } from '../../hooks/useIframeQueue';
import { buildArgsUrl } from '../../hooks/useArgsUrl';
import { STORYBOOK_BASE } from '../../hooks/storybookBase';
import { ArgsForm } from '../ArgsForm';
import { ComponentRowThumb } from '../ComponentRowThumb';
import { ShadowGhost } from '../../../ShadowGhost';
import { cardReducer, INITIAL_STATE } from '../../hooks/useComponentCardState';
import { useResolveChildGhosts } from '../../hooks/useResolveChildGhosts';
import { USE_SHARED_EXTRACTOR } from '../../hooks/extractorConfig';
import { useSharedExtraction } from '../../hooks/useSharedExtraction';
import { useSelectionAutoPopulate } from '../../hooks/useSelectionAutoPopulate';
import { argsToStorybookArgs, stitchGhostSlots, hasComponentSlots } from '../../utils/stitch-ghost-slots';
import { getStitchedGhost } from '../../utils/getStitchedGhost';
import { buildGhostCacheEntry } from '../../utils/buildGhostCacheEntry';
import type { GhostCacheEntry } from '../../utils/buildGhostCacheEntry';
import { createStoryExtractor, type StoryExtractor } from '../../../../../../overlay/src/story-extractor';

export interface CachedGhostData {
  ghostHtml?: string;
  ghostCss?: string;
  storyBackground?: string;
  argCount?: number;
}

export interface SelectionContext {
  matched?: boolean;
  props?: Record<string, unknown>;
  /** When the selected element is a ghost, the patch ID of the component-drop that created it */
  ghostPatchId?: string;
  resolveComponentGhost?: (componentName: string) => { storyId: string; ghostHtml?: string; ghostCss?: string; componentPath?: string } | null;
}

export interface ComponentGroupItemProps {
  group: ComponentGroup;
  isArmed: boolean;
  onArm: (ghostHtml: string, ghostCss: string, args?: Record<string, unknown>) => void;
  onDisarm: () => void;
  cached?: CachedGhostData;
  onGhostExtracted?: (params: GhostCacheEntry) => void;
  /** Which tab context: 'replace' or 'place' — drives the button label */
  insertMode?: 'replace' | 'place';
  /** Whether a page element is currently selected */
  hasPageSelection?: boolean;
  /** Which ReactNode field is receptive (teal target) across all components */
  receptiveField?: { groupName: string; propName: string } | null;
  selection?: SelectionContext;
  /** Arm a ReactNode field as the receptive target */
  onArmField?: (groupName: string, propName: string, callback: (data: ArmedComponentData) => void) => void;
  /** Called when "Set Prop" is clicked — routes component data to the receptive field */
  onSetProp?: (data: ArmedComponentData) => void;
  /** Clear the receptive field */
  onClearReceptive?: () => void;
}

export function ComponentGroupItem({ group, isArmed, onArm, onDisarm, cached, onGhostExtracted, insertMode, hasPageSelection, selection, receptiveField, onArmField, onSetProp, onClearReceptive }: ComponentGroupItemProps) {
  const { ghostHtml: cachedGhostHtml, ghostCss: cachedGhostCss, storyBackground: cachedStoryBackground, argCount: cachedArgCount } = cached ?? {};
  const { matched: matchedBySelection, props: selectionProps, ghostPatchId: selectionGhostPatchId, resolveComponentGhost } = selection ?? {};
  const [state, dispatch] = useReducer(cardReducer, {
    ...INITIAL_STATE,
    storyBackground: cachedStoryBackground,
  });
  const cardRef = useRef<HTMLLIElement>(null);
  const extractorRef = useRef<StoryExtractor | null>(null);
  const initialLoadDone = useRef(false);
  const [expanded, setExpanded] = useState(false);
  // When the user clicks Replace/Place but the ghost is stale (component slots
  // haven't been re-extracted yet), we defer arming and set this flag. Once
  // the ghost catches up (ghostArgsVersion === argsVersion), we auto-arm.
  const pendingArmRef = useRef<'insert' | 'setProp' | null>(null);
  // Keep a ref to the latest args so the ghost-extracted handler can access them
  // without needing to re-subscribe to the event on every args change.
  const argsRef = useRef<Record<string, unknown>>(state.args);
  argsRef.current = state.args;

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
    !(state.phase === 'probe-done' || state.phase === 'loading' || state.phase === 'ready' || state.phase === 'error');

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
    (state.phase === 'probe-done' || state.phase === 'loading' || (state.phase === 'ready' && state.loadLiveRequested && !state.liveReady)) &&
    !!state.bestStory &&
    (!cachedGhostHtml || state.loadLiveRequested);

  const { canLoad, releaseSlot } = useIframeSlot(perComponentQueueEnabled);

  // Bridge: slot acquired → reducer
  useEffect(() => {
    if (canLoad && (state.phase === 'probe-done' || (state.phase === 'ready' && state.loadLiveRequested && !state.liveReady))) {
      dispatch({ type: 'SLOT_ACQUIRED' });
    }
  }, [canLoad, state.phase, state.loadLiveRequested, state.liveReady]);

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
      onGhostExtracted?.(buildGhostCacheEntry({
        storyId: state.bestStory.id,
        args: {},
        ghostHtml: sharedGhostData.ghostHtml,
        ghostCss: sharedGhostData.ghostCss,
        storyBackground: sharedGhostData.storyBackground,
        componentName: group.name,
        componentPath: group.componentPath,
        argTypes: state.argTypes,
      }));
    }
  }, [sharedGhostData]);

  // ── Phase 4: Iframe src assignment ─────────────────────────────────────

  // ── Phase 4+5: Create StoryExtractor, load URL, handle callbacks ─────

  // Refs so callbacks always see the latest values without re-running the effect
  const pendingArgsRef = useRef(state.pendingArgs);
  pendingArgsRef.current = state.pendingArgs;
  const bestStoryRef = useRef(state.bestStory);
  bestStoryRef.current = state.bestStory;
  const onGhostExtractedRef = useRef(onGhostExtracted);
  onGhostExtractedRef.current = onGhostExtracted;
  const argTypesRef = useRef(state.argTypes);
  argTypesRef.current = state.argTypes;
  const releaseSlotRef = useRef(releaseSlot);
  releaseSlotRef.current = releaseSlot;
  const liveReadyRef = useRef(state.liveReady);
  liveReadyRef.current = state.liveReady;

  // Teardown extractor on unmount only — not on phase changes
  useEffect(() => {
    return () => {
      extractorRef.current?.teardown();
      extractorRef.current = null;
    };
  }, []);

  // Trigger load when phase reaches 'loading'
  useEffect(() => {
    if (state.phase !== 'loading' || !state.bestStory || initialLoadDone.current) return;
    initialLoadDone.current = true;

    const storyId = state.bestStory.id;
    if (!extractorRef.current) {
      extractorRef.current = createStoryExtractor({ width: 800, height: 600 });
    }
    const extractor = extractorRef.current;

    extractor.load(buildArgsUrl(storyId, {}), {
      onLoaded: () => {
        console.log('[CGI] onLoaded fired for', storyId);
        dispatch({ type: 'IFRAME_LOADED' });
        releaseSlotRef.current();
        // Apply any args that were queued before the iframe was ready
        const pa = pendingArgsRef.current;
        const bs = bestStoryRef.current;
        if (pa && bs) {
          console.log('[CGI] applying pending args on load', { storyId: bs.id, pendingArgs: pa });
          extractor.updateArgs(bs.id, argsToStorybookArgs(pa));
          dispatch({ type: 'CLEAR_PENDING_ARGS' });
        }
      },
      onExtracted: (data) => {
        console.log('[CGI] onExtracted fired', { ghostHtmlLen: data.ghostHtml?.length, ghostCssLen: data.ghostCss?.length, ghostHtmlPreview: data.ghostHtml?.substring(0, 200) });
        const { ghostHtml, ghostCss } = stitchGhostSlots(data.ghostHtml, data.ghostCss, argsRef.current);
        const bg = data.storyBackground;

        if (bg || ghostHtml) dispatch({ type: 'GHOST_EXTRACTED', ghostHtml, ghostCss, storyBackground: bg, naturalWidth: data.naturalWidth, naturalHeight: data.naturalHeight });

        const bs = bestStoryRef.current;
        if (bs) {
          onGhostExtractedRef.current?.(buildGhostCacheEntry({
            storyId: bs.id,
            args: {},
            ghostHtml,
            ghostCss,
            storyBackground: bg,
            componentName: group.name,
            componentPath: group.componentPath,
            argTypes: argTypesRef.current,
          }));
        }
      },
      onError: (msg) => {
        dispatch({ type: 'IFRAME_ERROR', message: msg });
        releaseSlotRef.current();
      },
    });
  }, [state.phase, state.bestStory, state.loadLiveRequested, group.name, group.componentPath]);

  // ── Args changes ───────────────────────────────────────────────────────

  const handleArgsChange = useCallback((newArgs: Record<string, unknown>) => {
    const isLiveReady = liveReadyRef.current;
    const bs = bestStoryRef.current;
    console.log('[CGI] handleArgsChange called', { newArgs, liveReady: isLiveReady, hasExtractor: !!extractorRef.current, bestStory: bs?.id, phase: state.phase });
    dispatch({ type: 'ARGS_CHANGED', args: newArgs });
    // Update argsRef immediately so ghost-extracted fires with the correct args
    // even if React hasn't re-rendered yet before the iframe posts back.
    argsRef.current = newArgs;

    if (!isLiveReady || !extractorRef.current || !bs) {
      // Iframe not ready — queue args and request live load
      console.log('[CGI] iframe not ready, requesting live refresh', { liveReady: isLiveReady, hasExtractor: !!extractorRef.current, hasBestStory: !!bs });
      dispatch({ type: 'REQUEST_LIVE_REFRESH' });
      return;
    }

    const ext = extractorRef.current;
    if (ext && bs) {
      const sbArgs = argsToStorybookArgs(newArgs);
      console.log('[CGI] calling ext.updateArgs', { storyId: bs.id, sbArgs });
      ext.updateArgs(bs.id, sbArgs);
    }
  }, [state.phase]);

  // ── Resolve child component ghosts (async extraction) ──────────────────
  // When args contain ReactNodeArgValues with a storyId but no ghostHtml,
  // trigger extraction via the shared extractor with the child's specific props.
  useResolveChildGhosts(state.args, handleArgsChange);

  // ── Arm / disarm ───────────────────────────────────────────────────────

  const handleInsertClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isArmed) {
      onDisarm();
      return;
    }

    // If we have component-slot args but the ghost hasn't been re-extracted
    // with slot markers yet (argsVersion > ghostArgsVersion), trigger a live
    // refresh and wait — auto-arm once the ghost catches up.
    if (hasComponentSlots(state.args) && state.argsVersion > state.ghostArgsVersion) {
      pendingArmRef.current = 'insert';
      dispatch({ type: 'REQUEST_LIVE_REFRESH' });
      return;
    }

    const { ghostHtml, ghostCss } = getStitchedGhost(state.liveGhostHtml, state.liveGhostCss, cachedGhostHtml, cachedGhostCss, state.args);
    onArm(ghostHtml, ghostCss, state.args);

    dispatch({ type: 'REQUEST_LIVE_REFRESH' });

    if (onGhostExtracted && ghostHtml && state.bestStory) {
      onGhostExtracted(buildGhostCacheEntry({
        storyId: state.bestStory.id,
        args: state.args,
        ghostHtml,
        ghostCss,
        storyBackground: state.storyBackground,
        componentName: group.name,
        componentPath: group.componentPath,
        argTypes: state.argTypes,
      }));
    }
  }, [isArmed, onArm, onDisarm, state.args, state.argsVersion, state.ghostArgsVersion, state.bestStory, state.storyBackground, state.liveGhostHtml, state.liveGhostCss, cachedGhostHtml, cachedGhostCss, group.name, group.componentPath, onGhostExtracted]);

  // ── Set Prop (Flow E) ──────────────────────────────────────────────────

  const handleSetPropClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSetProp) return;
    // Wait for fresh ghost if component slots haven't been re-extracted yet
    if (hasComponentSlots(state.args) && state.argsVersion > state.ghostArgsVersion) {
      pendingArmRef.current = 'setProp';
      dispatch({ type: 'REQUEST_LIVE_REFRESH' });
      return;
    }
    const { ghostHtml, ghostCss } = getStitchedGhost(state.liveGhostHtml, state.liveGhostCss, cachedGhostHtml, cachedGhostCss, state.args);
    onSetProp({
      componentName: group.name,
      storyId: state.bestStory?.id ?? '',
      componentPath: group.componentPath,
      args: state.args,
      ghostHtml,
      ghostCss,
    });
  }, [onSetProp, state.liveGhostHtml, state.liveGhostCss, state.args, state.argsVersion, state.ghostArgsVersion, state.bestStory, cachedGhostHtml, cachedGhostCss, group.name, group.componentPath]);

  // ── Auto-arm: when a deferred Replace/SetProp catches up ─────────────
  useEffect(() => {
    if (!pendingArmRef.current) return;
    if (state.argsVersion > state.ghostArgsVersion) return; // still stale
    const action = pendingArmRef.current;
    pendingArmRef.current = null;

    const { ghostHtml, ghostCss } = getStitchedGhost(state.liveGhostHtml, state.liveGhostCss, cachedGhostHtml, cachedGhostCss, state.args);
    if (action === 'insert') {
      onArm(ghostHtml, ghostCss, state.args);
      dispatch({ type: 'REQUEST_LIVE_REFRESH' });
      if (onGhostExtracted && ghostHtml && state.bestStory) {
        onGhostExtracted(buildGhostCacheEntry({
          storyId: state.bestStory.id,
          args: state.args,
          ghostHtml,
          ghostCss,
          storyBackground: state.storyBackground,
          componentName: group.name,
          componentPath: group.componentPath,
          argTypes: state.argTypes,
        }));
      }
    } else if (action === 'setProp' && onSetProp) {
      onSetProp({
        componentName: group.name,
        storyId: state.bestStory?.id ?? '',
        componentPath: group.componentPath,
        args: state.args,
        ghostHtml,
        ghostCss,
      });
    }
  }, [state.ghostArgsVersion]);

  // ── Customize / expand toggle ──────────────────────────────────────────

  const handleCustomizeClick = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  // ── Auto-expand + populate when matched by selection ───────────────────
  // This effect must run AFTER effectiveArgTypes is computed (depends on
  // state.argTypes which arrives via PROBE_COMPLETE).  It re-fires when
  // argTypes change so that selection props are applied after probing
  // completes — PROBE_COMPLETE resets args to defaultArgs, and we need to
  // overlay the fiber props on top afterwards.

  // ── Auto-expand + populate when matched by selection ───────────────────
  useSelectionAutoPopulate({
    matchedBySelection: !!matchedBySelection,
    selectionProps,
    effectiveArgTypes,
    groupName: group.name,
    liveReady: state.liveReady,
    loadLiveRequested: state.loadLiveRequested,
    args: state.args,
    resolveComponentGhost: resolveComponentGhost ?? undefined,
    propsAreStoryArgs: !!selectionGhostPatchId,
    onExpand: () => setExpanded(true),
    onRequestLiveRefresh: () => dispatch({ type: 'REQUEST_LIVE_REFRESH' }),
    onArgsChange: handleArgsChange,
    onScrollIntoView: () => cardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }),
  });

  // Button label matches the tab context — or "Set Prop" when a field is receptive
  const isSetPropMode = !!receptiveField;
  const insertLabel = isSetPropMode ? 'Set Prop' : (insertMode === 'replace' ? 'Replace' : 'Place');
  const armingLabel = insertMode === 'replace' ? 'Replacing' : 'Placing';

  // The per-component StoryExtractor is created once we have a bestStory.
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
    : isSetPropMode
      ? 'border-bv-orange text-bv-orange bg-bv-orange/10 hover:bg-bv-orange/20 hover:text-white'
      : hasPageSelection
        ? 'border-bv-teal text-bv-teal bg-bv-teal/10 hover:bg-bv-teal/20 hover:text-white'
        : 'border-bv-border text-bv-text-mid bg-bv-surface hover:border-[#555] hover:text-bv-text hover:bg-bv-surface-hi';

  return (
    <li ref={cardRef} className={`flex flex-col ${matchedBySelection ? 'ring-1 ring-bv-teal rounded-md' : ''}`}>
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
              href={`${STORYBOOK_BASE}/?path=/story/${group.stories[0].id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-bv-text hover:text-bv-orange hover:underline transition-colors leading-tight inline"
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
            onClick={isSetPropMode ? handleSetPropClick : handleInsertClick}
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
              backgroundColor: state.storyBackground && state.storyBackground !== 'rgba(0, 0, 0, 0)'
                ? state.storyBackground
                : '#ffffff',
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
                receptivePropName={receptiveField?.groupName === group.name ? receptiveField.propName : null}
                onArmField={onArmField ? (propName: string) => {
                  // Register a callback that sets the value on this component's args
                  onArmField(group.name, propName, (data) => {
                    console.log('[CGI] onArmField callback fired', { propName, componentName: data.componentName, storyId: data.storyId, ghostHtml: data.ghostHtml?.substring(0, 100) });
                    handleArgsChange({
                      ...state.args,
                      [propName]: {
                        type: 'component',
                        componentName: data.componentName,
                        storyId: data.storyId,
                        componentPath: data.componentPath,
                        args: data.args,
                        ghostHtml: data.ghostHtml,
                        ghostCss: data.ghostCss,
                      },
                    });
                  });
                } : undefined}
                onClearReceptive={onClearReceptive}
              />
            </div>
          )}
        </div>
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
