/**
 * Shared auto-scroll utility for edge-proximity scrolling during drag operations.
 * Used by both the overlay (page drag) and the panel (component list drag).
 */

const DEFAULT_EDGE_ZONE = 40;      // px from container edge to trigger scroll
const DEFAULT_MAX_SPEED = 15;      // px per frame at edge

export interface AutoScrollOptions {
  edgeZone?: number;
  maxSpeed?: number;
  /** Extra containers to always check (in addition to ancestors of referenceEl). Can be a static array or a function evaluated on each update. */
  extraContainers?: Element[] | (() => Element[]);
}

export interface AutoScroller {
  /** Call on every pointermove/mousemove with current cursor position and a reference element (for ancestor lookup). */
  update(clientX: number, clientY: number, referenceEl?: Element | null): void;
  /** Stop scrolling and clean up. Call on pointerup/cancel. */
  stop(): void;
}

export function createAutoScroller(options: AutoScrollOptions = {}): AutoScroller {
  const edgeZone = options.edgeZone ?? DEFAULT_EDGE_ZONE;
  const maxSpeed = options.maxSpeed ?? DEFAULT_MAX_SPEED;

  let rafId: number | null = null;
  let target: { container: Element; dx: number; dy: number } | null = null;

  function loop(): void {
    if (!target) {
      stop();
      return;
    }
    target.container.scrollBy(target.dx, target.dy);
    rafId = requestAnimationFrame(loop);
  }

  function stop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    target = null;
  }

  function update(clientX: number, clientY: number, referenceEl?: Element | null): void {
    const scrollables = referenceEl
      ? findScrollableAncestors(referenceEl)
      : [];

    if (options.extraContainers) {
      const extras = typeof options.extraContainers === 'function'
        ? options.extraContainers()
        : options.extraContainers;
      for (const c of extras) {
        if (!scrollables.includes(c)) scrollables.push(c);
      }
    }

    // Find outermost scrollable container where cursor is near the edge
    let bestMatch: { container: Element; dx: number; dy: number } | null = null;
    for (let i = scrollables.length - 1; i >= 0; i--) {
      const container = scrollables[i];
      const edge = computeEdgeProximity(clientX, clientY, container, edgeZone, maxSpeed);
      if (edge.dx !== 0 || edge.dy !== 0) {
        bestMatch = { container, ...edge };
        break;
      }
    }

    if (bestMatch) {
      target = bestMatch;
      if (rafId === null) {
        rafId = requestAnimationFrame(loop);
      }
    } else {
      stop();
    }
  }

  return { update, stop };
}

export function findScrollableAncestors(el: Element): Element[] {
  const result: Element[] = [];
  let current: Element | null = el.parentElement;
  while (current && current !== document.documentElement) {
    if (isScrollable(current)) {
      result.push(current);
    }
    current = current.parentElement;
  }
  return result;
}

export function isScrollable(el: Element): boolean {
  const style = getComputedStyle(el);
  const overflowY = style.overflowY;
  const overflowX = style.overflowX;
  const scrollableOverflow = (v: string) => v === 'auto' || v === 'scroll';
  if (!scrollableOverflow(overflowY) && !scrollableOverflow(overflowX)) return false;
  return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
}

export function computeEdgeProximity(
  clientX: number,
  clientY: number,
  container: Element,
  edgeZone = DEFAULT_EDGE_ZONE,
  maxSpeed = DEFAULT_MAX_SPEED,
): { dx: number; dy: number } {
  const rect = container.getBoundingClientRect();
  let dx = 0;
  let dy = 0;

  // Top edge
  if (clientY >= rect.top && clientY < rect.top + edgeZone && container.scrollTop > 0) {
    const proximity = 1 - (clientY - rect.top) / edgeZone;
    dy = -Math.round(proximity * maxSpeed);
  }
  // Bottom edge
  else if (clientY > rect.bottom - edgeZone && clientY <= rect.bottom &&
           container.scrollTop < container.scrollHeight - container.clientHeight) {
    const proximity = 1 - (rect.bottom - clientY) / edgeZone;
    dy = Math.round(proximity * maxSpeed);
  }

  // Left edge
  if (clientX >= rect.left && clientX < rect.left + edgeZone && container.scrollLeft > 0) {
    const proximity = 1 - (clientX - rect.left) / edgeZone;
    dx = -Math.round(proximity * maxSpeed);
  }
  // Right edge
  else if (clientX > rect.right - edgeZone && clientX <= rect.right &&
           container.scrollLeft < container.scrollWidth - container.clientWidth) {
    const proximity = 1 - (rect.right - clientX) / edgeZone;
    dx = Math.round(proximity * maxSpeed);
  }

  return { dx, dy };
}
