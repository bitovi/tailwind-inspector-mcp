// Shared drop-position geometry used by both overlay and panel.
// Pure functions — no DOM side effects, no framework dependencies.

export type DropPosition = 'before' | 'after' | 'first-child' | 'last-child';

/**
 * Returns the layout axis for a container element.
 * flex-direction: row  → 'horizontal'
 * flex-direction: column (or block/grid-auto-flow row) → 'vertical'
 */
export function getAxis(el: Element): 'vertical' | 'horizontal' {
  const style = getComputedStyle(el);
  if (style.display.includes('flex')) {
    return style.flexDirection.startsWith('row') ? 'horizontal' : 'vertical';
  }
  if (style.display.includes('grid')) {
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

/**
 * When the cursor is in the "before" zone of the first child or the "after"
 * zone of the last child, there is no sibling to insert between — so convert
 * the position to "first-child" / "last-child" of the parent instead.
 *
 * Returns an adjusted { target, position } that the caller should use for
 * both rendering the indicator and recording the drop position.
 */
export function adjustForEdgeChild(
  target: HTMLElement,
  position: DropPosition,
): { target: HTMLElement; position: DropPosition } {
  if (position === 'before' && !target.previousElementSibling && target.parentElement) {
    return { target: target.parentElement as HTMLElement, position: 'first-child' };
  }
  if (position === 'after' && !target.nextElementSibling && target.parentElement) {
    return { target: target.parentElement as HTMLElement, position: 'last-child' };
  }
  return { target, position };
}
