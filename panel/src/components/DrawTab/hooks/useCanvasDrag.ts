import { useRef, useCallback, useEffect } from 'react';

const DRAG_THRESHOLD = 5;

interface UseCanvasDragOptions {
  /** Insert mode context: 'replace' or 'place'. */
  insertMode?: 'replace' | 'place';
  /** Called when drag starts (so the caller can update visual state). */
  onDragStart?: () => void;
  /** Called when drag ends (restore visual state). */
  onDragEnd?: () => void;
}

/**
 * Drag hook for the "Draw / Screenshot Canvas" button.
 *
 * On pointerdown + move past threshold, transitions to cross-frame drag
 * by sending DRAG_START with `canvasInsert: true` via postMessage to the
 * overlay. The overlay shows positional indicators and inserts the design
 * canvas on drop.
 *
 * If the pointer is released without crossing the threshold, the event is
 * left unhandled so the button's onClick fires normally (click-to-place).
 */
export function useCanvasDrag({ insertMode, onDragStart, onDragEnd }: UseCanvasDragOptions) {
  const phaseRef = useRef<'idle' | 'pending' | 'dragging'>('idle');
  const startPos = useRef({ x: 0, y: 0 });
  const pointerIdRef = useRef<number | null>(null);
  const captureElRef = useRef<HTMLElement | null>(null);
  /** Set true after a drag occurs; cleared on next pointerdown. Used to suppress onClick. */
  const didDragRef = useRef(false);
  const latestRef = useRef({ insertMode, onDragStart, onDragEnd });
  latestRef.current = { insertMode, onDragStart, onDragEnd };

  const getTarget = useCallback((): Window | null => {
    if (window.opener) return window.opener;
    if (window.parent !== window) return window.parent;
    return null;
  }, []);

  const cleanup = useCallback(() => {
    phaseRef.current = 'idle';
    pointerIdRef.current = null;
    captureElRef.current = null;
  }, []);

  // Cross-frame handlers
  const crossFrameMoveHandler = useCallback((e: PointerEvent) => {
    const target = getTarget();
    if (target) {
      try {
        target.postMessage({
          __vybitDrag: true,
          type: 'DRAG_MOVE',
          screenX: e.screenX,
          screenY: e.screenY,
          clientX: e.clientX,
          clientY: e.clientY,
        }, '*');
      } catch { /* ignore */ }
    }
  }, [getTarget]);

  const crossFrameUpHandler = useCallback((e: PointerEvent) => {
    document.removeEventListener('pointermove', crossFrameMoveHandler);
    document.removeEventListener('pointerup', crossFrameUpHandler);
    const target = getTarget();
    if (target) {
      try {
        target.postMessage({
          __vybitDrag: true,
          type: 'DRAG_END',
          screenX: e.screenX,
          screenY: e.screenY,
          clientX: e.clientX,
          clientY: e.clientY,
          cancelled: false,
        }, '*');
      } catch { /* ignore */ }
    }
    latestRef.current.onDragEnd?.();
    cleanup();
  }, [getTarget, crossFrameMoveHandler, cleanup]);

  // Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (phaseRef.current === 'dragging') {
        document.removeEventListener('pointermove', crossFrameMoveHandler);
        document.removeEventListener('pointerup', crossFrameUpHandler);
        const target = getTarget();
        if (target) {
          try {
            target.postMessage({
              __vybitDrag: true,
              type: 'DRAG_END',
              screenX: 0,
              screenY: 0,
              cancelled: true,
            }, '*');
          } catch { /* ignore */ }
        }
        latestRef.current.onDragEnd?.();
        cleanup();
      } else if (phaseRef.current === 'pending') {
        if (captureElRef.current && pointerIdRef.current !== null) {
          try { captureElRef.current.releasePointerCapture(pointerIdRef.current); } catch { /* ignore */ }
        }
        cleanup();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [crossFrameMoveHandler, crossFrameUpHandler, getTarget, cleanup]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    didDragRef.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    pointerIdRef.current = e.pointerId;
    captureElRef.current = e.currentTarget;
    phaseRef.current = 'pending';
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (pointerIdRef.current === null || phaseRef.current === 'idle') return;

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;

    if (phaseRef.current === 'pending' && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      // Threshold crossed — transition to cross-frame drag
      phaseRef.current = 'dragging';
      didDragRef.current = true;

      // Release pointer capture
      if (captureElRef.current && pointerIdRef.current !== null) {
        try { captureElRef.current.releasePointerCapture(pointerIdRef.current); } catch { /* ignore */ }
      }

      // Send DRAG_START with canvasInsert flag
      const target = getTarget();
      const { insertMode: mode, onDragStart: onStart } = latestRef.current;
      if (target) {
        try {
          target.postMessage({
            __vybitDrag: true,
            type: 'DRAG_START',
            componentName: '__canvas__',
            storyId: '',
            canvasInsert: true,
            canvasInsertMode: mode ?? 'place',
            screenX: e.screenX,
            screenY: e.screenY,
            clientX: e.clientX,
            clientY: e.clientY,
          }, '*');
        } catch { /* ignore */ }
      }
      onStart?.();

      // Listen for further moves and drop
      document.addEventListener('pointermove', crossFrameMoveHandler);
      document.addEventListener('pointerup', crossFrameUpHandler);
    }

    // During 'dragging' phase, forward move to overlay
    if (phaseRef.current === 'dragging') {
      const target = getTarget();
      if (target) {
        try {
          target.postMessage({
            __vybitDrag: true,
            type: 'DRAG_MOVE',
            screenX: e.screenX,
            screenY: e.screenY,
            clientX: e.clientX,
            clientY: e.clientY,
          }, '*');
        } catch { /* ignore */ }
      }
    }
  }, [getTarget, crossFrameMoveHandler, crossFrameUpHandler]);

  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLElement>) => {
    if (pointerIdRef.current === null) return;

    if (phaseRef.current === 'pending') {
      // Below threshold — this is a click, let onClick handle it
      cleanup();
      return;
    }

    // If dragging, the crossFrameUpHandler handles it via document listener
    // (pointer capture was released, so React event may not fire)
  }, [cleanup]);

  return { onPointerDown, onPointerMove, onPointerUp, didDragRef };
}
