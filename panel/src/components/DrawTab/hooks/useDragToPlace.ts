import { useRef, useCallback, useEffect } from 'react';
import { useDragContext } from '../context/DragContext';
import { createAutoScroller } from '../../../../../shared/auto-scroll';

const DRAG_THRESHOLD = 5; // px of movement before drag activates

interface DragToPlaceOptions {
  componentName: string;
  storyId: string;
  groupName: string;
  /** Ghost data may not be available at drag start (async extraction). */
  getGhostData: () => { ghostHtml: string | null; ghostCss: string | null };
  componentPath?: string;
  args?: Record<string, unknown>;
  /** Called when drag starts (for visual feedback like dimming the thumbnail). */
  onDragStart?: () => void;
  /** Called when drag ends (restore visual state). */
  onDragEnd?: () => void;
  /** Ref to the scrollable container for auto-scrolling during panel-internal drag */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Two-phase drag hook:
 * - Phase 1 (panel-internal): Uses setPointerCapture for reliable tracking.
 *   Activates DragContext so SlotFields can act as drop targets. Auto-scrolls
 *   the component list when cursor is near edges.
 * - Phase 2 (cross-frame): When cursor leaves panel bounds, sends DRAG_START
 *   to the overlay via postMessage. Existing overlay drag-drop takes over.
 *
 * If pointerup occurs during Phase 1 on a slot field, the slot is filled locally
 * without ever involving the overlay.
 */
export function useDragToPlace({
  componentName,
  storyId,
  groupName,
  getGhostData,
  componentPath,
  args,
  onDragStart,
  onDragEnd,
  scrollContainerRef,
}: DragToPlaceOptions) {
  const dragCtx = useDragContext();

  const phaseRef = useRef<'idle' | 'panel' | 'cross-frame'>('idle');
  const startPos = useRef({ x: 0, y: 0 });
  const pointerIdRef = useRef<number | null>(null);
  const captureElRef = useRef<HTMLElement | null>(null);
  const autoScrollerRef = useRef(createAutoScroller());

  // Store latest values in refs so event handlers always see current data
  const latestRef = useRef({ componentName, storyId, groupName, getGhostData, componentPath, args, onDragStart, onDragEnd, scrollContainerRef });
  latestRef.current = { componentName, storyId, groupName, getGhostData, componentPath, args, onDragStart, onDragEnd, scrollContainerRef };

  const getTarget = useCallback((): Window | null => {
    if (window.opener) return window.opener;
    if (window.parent !== window) return window.parent;
    return null;
  }, []);

  const cleanup = useCallback(() => {
    phaseRef.current = 'idle';
    pointerIdRef.current = null;
    captureElRef.current = null;
    autoScrollerRef.current.stop();
  }, []);

  const transitionToCrossFrame = useCallback((e: PointerEvent) => {
    phaseRef.current = 'cross-frame';
    dragCtx.cancelDrag();
    autoScrollerRef.current.stop();

    // Release pointer capture so overlay can receive events
    if (captureElRef.current && pointerIdRef.current !== null) {
      try { captureElRef.current.releasePointerCapture(pointerIdRef.current); } catch { /* already released */ }
    }

    // Send DRAG_START to overlay
    const { componentName: name, storyId: sid, getGhostData: getGhost, componentPath: cPath, args: cArgs, onDragStart: onStart } = latestRef.current;
    const { ghostHtml, ghostCss } = getGhost();
    const target = getTarget();
    if (target) {
      try {
        target.postMessage({ __vybitDrag: true, type: 'DRAG_START', componentName: name, storyId: sid, ghostHtml: ghostHtml ?? undefined, ghostCss: ghostCss ?? undefined, componentPath: cPath, args: cArgs, screenX: e.screenX, screenY: e.screenY, clientX: e.clientX, clientY: e.clientY }, '*');
      } catch { /* ignore */ }
    }
    onStart?.();

    // Now listen at document level for further moves and final up.
    // MUST use pointermove/pointerup — after setPointerCapture + release,
    // the browser continues routing pointer events to this iframe but
    // stops dispatching companion mouse events.
    document.addEventListener('pointermove', crossFrameMoveHandler);
    document.addEventListener('pointerup', crossFrameUpHandler);
  }, [dragCtx, getTarget]);

  // Cross-frame handlers (Phase 2)
  // Uses pointermove/pointerup because after setPointerCapture + release,
  // the browser routes pointer events to this iframe but NOT mouse events.
  const crossFrameMoveHandler = useCallback((e: PointerEvent) => {
    const target = getTarget();
    if (target) {
      try { target.postMessage({ __vybitDrag: true, type: 'DRAG_MOVE', screenX: e.screenX, screenY: e.screenY, clientX: e.clientX, clientY: e.clientY }, '*'); } catch { /* ignore */ }
    }
  }, [getTarget]);

  const crossFrameUpHandler = useCallback((e: PointerEvent) => {
    document.removeEventListener('pointermove', crossFrameMoveHandler);
    document.removeEventListener('pointerup', crossFrameUpHandler);
    const target = getTarget();
    if (target) {
      try { target.postMessage({ __vybitDrag: true, type: 'DRAG_END', screenX: e.screenX, screenY: e.screenY, clientX: e.clientX, clientY: e.clientY, cancelled: false }, '*'); } catch { /* ignore */ }
    }
    latestRef.current.onDragEnd?.();
    cleanup();
  }, [getTarget, crossFrameMoveHandler, cleanup]);

  // Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (phaseRef.current === 'panel') {
        dragCtx.cancelDrag();
        autoScrollerRef.current.stop();
        if (captureElRef.current && pointerIdRef.current !== null) {
          try { captureElRef.current.releasePointerCapture(pointerIdRef.current); } catch { /* ignore */ }
        }
        latestRef.current.onDragEnd?.();
        cleanup();
      } else if (phaseRef.current === 'cross-frame') {
        document.removeEventListener('pointermove', crossFrameMoveHandler);
        document.removeEventListener('pointerup', crossFrameUpHandler);
        const target = getTarget();
        if (target) {
          try { target.postMessage({ __vybitDrag: true, type: 'DRAG_END', screenX: 0, screenY: 0, cancelled: true }, '*'); } catch { /* ignore */ }
        }
        latestRef.current.onDragEnd?.();
        cleanup();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dragCtx, crossFrameMoveHandler, crossFrameUpHandler, getTarget, cleanup]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    startPos.current = { x: e.clientX, y: e.clientY };
    pointerIdRef.current = e.pointerId;
    captureElRef.current = e.currentTarget;
    phaseRef.current = 'idle';

    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (pointerIdRef.current === null) return;

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;

    // Threshold check — activate drag
    if (phaseRef.current === 'idle' && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      phaseRef.current = 'panel';
      const { componentName: name, storyId: sid, getGhostData: getGhost, componentPath: cPath, args: cArgs, groupName: gName, onDragStart: onStart } = latestRef.current;
      const { ghostHtml, ghostCss } = getGhost();
      dragCtx.startDrag(
        { componentName: name, storyId: sid, componentPath: cPath, args: cArgs, ghostHtml: ghostHtml ?? '', ghostCss: ghostCss ?? '' },
        gName,
      );
      onStart?.();
    }

    if (phaseRef.current === 'panel') {
      // Check if cursor has left panel viewport → transition to cross-frame
      const margin = 5; // px tolerance
      if (e.clientX < margin || e.clientY < margin || e.clientX > window.innerWidth - margin || e.clientY > window.innerHeight - margin) {
        transitionToCrossFrame(e.nativeEvent);
        return;
      }

      // Update DragContext for hit-testing
      dragCtx.updateCursor(e.clientX, e.clientY);

      // Auto-scroll the component list
      const container = latestRef.current.scrollContainerRef?.current;
      if (container) {
        autoScrollerRef.current.update(e.clientX, e.clientY, container);
      }
    }
  }, [dragCtx, transitionToCrossFrame]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (pointerIdRef.current === null) return;

    if (phaseRef.current === 'panel') {
      // Try to drop on a hovered slot field
      const dropped = dragCtx.dropOnHovered();
      if (dropped) {
        dragCtx.endDrag();
      } else {
        dragCtx.cancelDrag();
      }
      latestRef.current.onDragEnd?.();
    }

    // If still idle (no threshold crossed), just release
    cleanup();
  }, [dragCtx, cleanup]);

  const onLostPointerCapture = useCallback(() => {
    // If we lose capture unexpectedly during panel phase, cancel
    if (phaseRef.current === 'panel') {
      dragCtx.cancelDrag();
      latestRef.current.onDragEnd?.();
      cleanup();
    }
  }, [dragCtx, cleanup]);

  return { onPointerDown, onPointerMove, onPointerUp, onLostPointerCapture };
}
