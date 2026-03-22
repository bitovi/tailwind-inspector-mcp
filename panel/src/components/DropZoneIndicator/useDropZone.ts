import { useState, useCallback, useRef } from 'react';
import type { DropPosition, DropZoneState } from './types';

/**
 * Returns the layout axis for a container element.
 * flex-direction: row  → 'horizontal'
 * flex-direction: column (or block/grid-auto-flow row) → 'vertical'
 */
function getAxis(parent: Element | null): 'vertical' | 'horizontal' {
  if (!parent) return 'vertical';
  const style = getComputedStyle(parent);
  if (style.display.includes('flex')) {
    return style.flexDirection.startsWith('row') ? 'horizontal' : 'vertical';
  }
  if (style.display.includes('grid')) {
    // grid-auto-flow: column → horizontal; otherwise vertical
    return style.gridAutoFlow.startsWith('column') ? 'horizontal' : 'vertical';
  }
  return 'vertical';
}

/**
 * Given a cursor position, a target element rect, and the layout axis,
 * determine where the drop would land.
 *
 * Four zones along the layout axis:
 *   0–25%  = "before"      (insert as previous sibling)
 *   25–50% = "first-child" (prepend inside target)
 *   50–75% = "last-child"  (append inside target)
 *   75–100%= "after"       (insert as next sibling)
 */
export function computeDropPosition(
  cursor: { x: number; y: number },
  rect: DOMRect,
  axis: 'vertical' | 'horizontal',
): DropPosition {
  const ratio =
    axis === 'horizontal'
      ? (cursor.x - rect.left) / rect.width
      : (cursor.y - rect.top) / rect.height;
  if (ratio < 0.25) return 'before';
  if (ratio < 0.5) return 'first-child';
  if (ratio < 0.75) return 'last-child';
  return 'after';
}

interface UseDropZoneOptions {
  /** The container element whose descendants are potential drop targets */
  containerRef: React.RefObject<HTMLElement | null>;
  /** CSS selector to identify droppable elements (default: all descendant elements) */
  targetSelector?: string;
}

/**
 * Hook that tracks the cursor inside a container and determines which child
 * element is the active drop target, plus the drop position (before/after/inside).
 *
 * Returns state + an `onMouseMove` handler to attach to the container, and
 * an `onMouseLeave` to clear state when the cursor exits.
 */
export function useDropZone({ containerRef, targetSelector }: UseDropZoneOptions) {
  const [state, setState] = useState<DropZoneState>({
    activeTarget: null,
    dropPosition: null,
    axis: 'vertical',
  });

  // Cache axis computation per parent to avoid layout thrashing
  const axisCache = useRef(new WeakMap<Element, 'vertical' | 'horizontal'>());

  const getAxisCached = useCallback((parent: Element | null) => {
    if (!parent) return 'vertical' as const;
    const cached = axisCache.current.get(parent);
    if (cached) return cached;
    const result = getAxis(parent);
    axisCache.current.set(parent, result);
    return result;
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const selector = targetSelector ?? ':not([data-drop-indicator]) *';
      const targets: HTMLElement[] = (Array.from(
        container.querySelectorAll(selector),
      ) as HTMLElement[]).filter(el => !el.closest('[data-drop-indicator]'));

      // Find the deepest (smallest-area) target the cursor is inside
      let hit: HTMLElement | null = null;
      let hitArea = Infinity;
      for (const target of targets) {
        const rect = target.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          const area = rect.width * rect.height;
          if (area < hitArea) {
            hit = target;
            hitArea = area;
          }
        }
      }

      if (!hit) {
        // Find the nearest target by distance to center
        let minDist = Infinity;
        for (const target of targets) {
          const rect = target.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
          if (dist < minDist) {
            minDist = dist;
            hit = target;
          }
        }
      }

      if (!hit) {
        setState({ activeTarget: null, dropPosition: null, axis: 'vertical' });
        return;
      }

      const axis = getAxisCached(hit.parentElement);
      const rect = hit.getBoundingClientRect();
      const position = computeDropPosition(
        { x: e.clientX, y: e.clientY },
        rect,
        axis,
      );

      setState({ activeTarget: hit, dropPosition: position, axis });
    },
    [containerRef, targetSelector, getAxisCached],
  );

  const onMouseLeave = useCallback(() => {
    setState({ activeTarget: null, dropPosition: null, axis: 'vertical' });
  }, []);

  // Compute the target rect relative to the container so the indicator
  // can be positioned absolutely inside it.
  let relativeRect: DOMRect | null = null;
  if (state.activeTarget && containerRef.current) {
    const tRect = state.activeTarget.getBoundingClientRect();
    const cRect = containerRef.current.getBoundingClientRect();
    relativeRect = new DOMRect(
      tRect.left - cRect.left,
      tRect.top - cRect.top,
      tRect.width,
      tRect.height,
    );
  }

  return {
    ...state,
    relativeRect,
    onMouseMove,
    onMouseLeave,
  };
}
