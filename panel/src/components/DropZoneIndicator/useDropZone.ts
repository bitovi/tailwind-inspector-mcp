import { useState, useCallback, useRef } from 'react';
import type { DropPosition, DropZoneState } from './types';
import { getAxis, computeDropPosition, adjustForEdgeChild } from '../../../../shared/drop-geometry';
export { computeDropPosition, adjustForEdgeChild };

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
      const rawPosition = computeDropPosition(
        { x: e.clientX, y: e.clientY },
        rect,
        axis,
      );
      const adjusted = adjustForEdgeChild(hit, rawPosition);

      setState({ activeTarget: adjusted.target, dropPosition: adjusted.position, axis: getAxisCached(adjusted.target.parentElement) });
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
