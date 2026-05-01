import { useRef, useCallback, useEffect } from 'react';

const DRAG_THRESHOLD = 5; // px of movement before drag activates

interface DragToPlaceOptions {
  componentName: string;
  storyId: string;
  /** Ghost data may not be available at drag start (async extraction). */
  getGhostData: () => { ghostHtml: string | null; ghostCss: string | null };
  componentPath?: string;
  args?: Record<string, unknown>;
  /** Called when drag starts (for visual feedback like dimming the thumbnail). */
  onDragStart?: () => void;
  /** Called when drag ends (restore visual state). */
  onDragEnd?: () => void;
}

/**
 * Hook that detects mousedown + drag on a ref'd element and sends
 * postMessage to the parent window (iframe) or opener (popup) to
 * initiate the cross-frame drag-drop flow.
 *
 * Uses refs for event handlers to avoid the React re-render cleanup
 * problem: when onDragStart triggers a state update (e.g. setIsDragActive),
 * the component re-renders, useCallback produces new function identities,
 * and the useEffect cleanup would remove the old document listeners —
 * killing the drag mid-flight.
 */
export function useDragToPlace({
  componentName,
  storyId,
  getGhostData,
  componentPath,
  args,
  onDragStart,
  onDragEnd,
}: DragToPlaceOptions) {
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  // Store latest values in refs so the event handlers always see current data
  // without needing to be recreated (which would break document listeners).
  const latestRef = useRef({ componentName, storyId, getGhostData, componentPath, args, onDragStart, onDragEnd });
  latestRef.current = { componentName, storyId, getGhostData, componentPath, args, onDragStart, onDragEnd };

  const getTarget = useCallback((): Window | null => {
    if (window.opener) return window.opener;
    if (window.parent !== window) return window.parent;
    return null;
  }, []);

  const sendDrag = useCallback((data: object) => {
    const target = getTarget();
    if (target) {
      try {
        target.postMessage({ __vybitDrag: true, ...data }, '*');
      } catch {
        // Cross-origin or closed window — silently ignore
      }
    }
  }, [getTarget]);

  // Stable refs for the document event handlers — never change identity
  const handleMouseMoveRef = useRef<(e: MouseEvent) => void>();
  const handleMouseUpRef = useRef<(e: MouseEvent) => void>();

  if (!handleMouseMoveRef.current) {
    handleMouseMoveRef.current = (e: MouseEvent) => {
      const { componentName: name, storyId: sid, getGhostData: getGhost, componentPath: cPath, args: cArgs, onDragStart: onStart } = latestRef.current;
      const dx = e.screenX - startPos.current.x;
      const dy = e.screenY - startPos.current.y;

      if (!isDragging.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        isDragging.current = true;
        const { ghostHtml, ghostCss } = getGhost();
        const target = getTarget();
        if (target) {
          try {
            target.postMessage({ __vybitDrag: true, type: 'DRAG_START', componentName: name, storyId: sid, ghostHtml: ghostHtml ?? undefined, ghostCss: ghostCss ?? undefined, componentPath: cPath, args: cArgs, screenX: e.screenX, screenY: e.screenY }, '*');
          } catch { /* ignore */ }
        }
        onStart?.();
      }

      if (isDragging.current) {
        const target = getTarget();
        if (target) {
          try {
            target.postMessage({ __vybitDrag: true, type: 'DRAG_MOVE', screenX: e.screenX, screenY: e.screenY }, '*');
          } catch { /* ignore */ }
        }
      }
    };
  }

  if (!handleMouseUpRef.current) {
    handleMouseUpRef.current = (e: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMoveRef.current!);
      document.removeEventListener('mouseup', handleMouseUpRef.current!);

      if (isDragging.current) {
        isDragging.current = false;
        const target = getTarget();
        if (target) {
          try {
            target.postMessage({ __vybitDrag: true, type: 'DRAG_END', screenX: e.screenX, screenY: e.screenY, cancelled: false }, '*');
          } catch { /* ignore */ }
        }
        latestRef.current.onDragEnd?.();
      }
    };
  }

  // Cleanup on unmount — but only if not mid-drag.
  // If a drag is active, the mouseup handler will self-clean.
  // This prevents the re-render-induced unmount/remount cycle
  // (e.g. DESELECT_ELEMENT clearing selection) from killing
  // active document listeners mid-drag.
  useEffect(() => {
    return () => {
      if (!isDragging.current) {
        document.removeEventListener('mousemove', handleMouseMoveRef.current!);
        document.removeEventListener('mouseup', handleMouseUpRef.current!);
      }
    };
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    startPos.current = { x: e.nativeEvent.screenX, y: e.nativeEvent.screenY };
    isDragging.current = false;

    document.addEventListener('mousemove', handleMouseMoveRef.current!);
    document.addEventListener('mouseup', handleMouseUpRef.current!);
  }, []);

  return { onMouseDown };
}
