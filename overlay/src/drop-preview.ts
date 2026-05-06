// Drop preview: temporarily inserts ghost HTML (or moves a source element) into
// the DOM after the cursor has been idle for PREVIEW_DELAY ms, giving the user a
// real-layout preview of where the element will land.  Reverts instantly when the
// cursor moves to a different target.
//
// Two factory functions:
// - createDropPreview()  — for component drag / click-to-place (clones ghost HTML)
// - createMovePreview()  — for drag-to-move (moves an existing element)

import { injectGhostCss, type DropPosition } from './drop-zone';
import { TEAL } from './styles';

// ── Constants ────────────────────────────────────────────────────────────

const PREVIEW_DELAY = 500; // ms before preview activates

/** If the cursor moves more than this many px from where the preview activated,
 *  break the lockedRect lock so hit-testing resumes.  Prevents freezing when
 *  the preview target covers the entire viewport (e.g. <body>). */
const LOCK_ESCAPE_THRESHOLD = 30;

const PREVIEW_STYLE =
  `opacity:0.6;outline:2px dashed ${TEAL};outline-offset:-2px;pointer-events:none;` +
  'transition:opacity 150ms ease;';

// ── Shared types ─────────────────────────────────────────────────────────

export interface FinalizeResult {
  element: HTMLElement;
  target: HTMLElement;
  position: DropPosition | 'replace';
}

export interface DropPreviewHandle {
  /** Call on every position update.  Resets the hover timer if target/position changed. */
  update(target: HTMLElement, position: DropPosition | 'replace', ghostHtml: string, ghostCss: string | null, cursorX?: number, cursorY?: number): void;
  /** Cancel timer and revert any active preview. */
  clear(): void;
  /** True when the preview element is live in the DOM. */
  isActive(): boolean;
  /** True if cursor (x, y) is inside the saved pre-reflow bounding rect. */
  isInsideLockedRect(x: number, y: number): boolean;
  /** Graduate the preview element — remove preview styling and return it.  Caller takes ownership; no revert occurs. */
  finalize(): FinalizeResult | null;
  /** Full teardown (same as clear, for symmetry). */
  destroy(): void;
}

export interface MovePreviewHandle {
  /** Call on every position update.  Resets the hover timer if target/position changed. */
  update(target: HTMLElement, position: DropPosition, cursorX?: number, cursorY?: number): void;
  /** Cancel timer and revert any active preview. */
  clear(): void;
  /** True when the source element has been moved to the preview position. */
  isActive(): boolean;
  /** True if cursor (x, y) is inside the saved pre-reflow bounding rect. */
  isInsideLockedRect(x: number, y: number): boolean;
  /** Graduate the move — return the source element in its new position.  No revert. */
  finalize(): FinalizeResult | null;
  /** Full teardown (same as clear). */
  destroy(): void;
}

// ── createDropPreview (component drag / click-to-place) ──────────────────

interface DropPreviewState {
  timer: ReturnType<typeof setTimeout> | null;
  previewEl: HTMLElement | null;
  /** Target element that was hidden (replace mode) — restore display on revert. */
  hiddenTarget: HTMLElement | null;
  hiddenTargetDisplay: string;
  currentTarget: HTMLElement | null;
  currentPosition: DropPosition | 'replace' | null;
  lockedRect: DOMRect | null;
  /** Cursor position when preview activated — used with LOCK_ESCAPE_THRESHOLD. */
  lockOriginX: number;
  lockOriginY: number;
  /** Component name used for injected ghost CSS (for cleanup). */
  injectedCssName: string | null;
}

export function createDropPreview(onActivate?: () => void): DropPreviewHandle {
  const s: DropPreviewState = {
    timer: null,
    previewEl: null,
    hiddenTarget: null,
    hiddenTargetDisplay: '',
    currentTarget: null,
    currentPosition: null,
    lockedRect: null,
    lockOriginX: 0,
    lockOriginY: 0,
    injectedCssName: null,
  };

  function activate(target: HTMLElement, position: DropPosition | 'replace', ghostHtml: string, ghostCss: string | null, cursorX: number, cursorY: number): void {
    // Save the target's bounding rect BEFORE any DOM mutation (reflow-stability).
    s.lockedRect = target.getBoundingClientRect();
    s.lockOriginX = cursorX;
    s.lockOriginY = cursorY;

    // Create the preview element from ghost HTML.
    const template = document.createElement('template');
    template.innerHTML = ghostHtml.trim();
    const el = template.content.firstElementChild as HTMLElement | null;
    if (!el) return;

    el.style.cssText += PREVIEW_STYLE;
    el.dataset.twDropPreview = '1';

    // Insert into the DOM.
    if (position === 'replace') {
      s.hiddenTargetDisplay = target.style.display;
      target.insertAdjacentElement('beforebegin', el);
      target.style.display = 'none';
      s.hiddenTarget = target;
    } else {
      switch (position) {
        case 'before':      target.insertAdjacentElement('beforebegin', el); break;
        case 'after':       target.insertAdjacentElement('afterend', el); break;
        case 'first-child': target.insertAdjacentElement('afterbegin', el); break;
        case 'last-child':  target.appendChild(el); break;
      }
    }

    // Inject ghost CSS so the preview element's Tailwind classes resolve.
    if (ghostCss) {
      // Use a preview-specific name to avoid colliding with committed ghost CSS.
      const cssName = `__preview__${Date.now()}`;
      injectGhostCss(cssName, ghostCss);
      s.injectedCssName = cssName;
    }

    s.previewEl = el;
    onActivate?.();
  }

  function revert(): void {
    if (s.previewEl) {
      s.previewEl.remove();
      s.previewEl = null;
    }
    if (s.hiddenTarget) {
      s.hiddenTarget.style.display = s.hiddenTargetDisplay;
      s.hiddenTarget = null;
      s.hiddenTargetDisplay = '';
    }
    if (s.injectedCssName) {
      const styleEl = document.getElementById(`vybit-ghost-css-${s.injectedCssName}`);
      if (styleEl) styleEl.remove();
      s.injectedCssName = null;
    }
    s.lockedRect = null;
  }

  function cancelTimer(): void {
    if (s.timer !== null) {
      clearTimeout(s.timer);
      s.timer = null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────

  function update(target: HTMLElement, position: DropPosition | 'replace', ghostHtml: string, ghostCss: string | null, cursorX?: number, cursorY?: number): void {
    if (target !== s.currentTarget || position !== s.currentPosition) {
      // Different target/position — revert any active preview.
      clear();
      s.currentTarget = target;
      s.currentPosition = position;
    } else if (s.previewEl) {
      // Same target + position and preview already active — keep it.
      return;
    }

    // Reset the timer on every mouse move so the preview only activates
    // after the cursor has been idle for PREVIEW_DELAY ms.
    cancelTimer();
    const cx = cursorX ?? 0;
    const cy = cursorY ?? 0;
    s.timer = setTimeout(() => {
      s.timer = null;
      activate(target, position, ghostHtml, ghostCss, cx, cy);
    }, PREVIEW_DELAY);
  }

  function clear(): void {
    cancelTimer();
    revert();
    s.currentTarget = null;
    s.currentPosition = null;
  }

  function isActive(): boolean {
    return s.previewEl !== null;
  }

  function isInsideLockedRect(x: number, y: number): boolean {
    if (!s.lockedRect || !s.previewEl) return false;
    // If the cursor has moved far from the activation point, break the lock.
    const dx = x - s.lockOriginX;
    const dy = y - s.lockOriginY;
    if (dx * dx + dy * dy > LOCK_ESCAPE_THRESHOLD * LOCK_ESCAPE_THRESHOLD) return false;
    const r = s.lockedRect;
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function finalize(): FinalizeResult | null {
    cancelTimer();
    const el = s.previewEl;
    const target = s.currentTarget;
    const position = s.currentPosition;
    if (!el || !target || !position) {
      // Nothing to finalize — revert and bail.
      clear();
      return null;
    }
    // Remove preview styling — the element is being committed.
    el.style.removeProperty('opacity');
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    el.style.removeProperty('pointer-events');
    el.style.removeProperty('transition');
    delete el.dataset.twDropPreview;
    // Don't revert — caller takes ownership.  Null out state.
    s.previewEl = null;
    s.hiddenTarget = null;
    s.hiddenTargetDisplay = '';
    s.lockedRect = null;
    // Leave injected CSS in place — drop will re-inject under the real name.
    if (s.injectedCssName) {
      const styleEl = document.getElementById(`vybit-ghost-css-${s.injectedCssName}`);
      if (styleEl) styleEl.remove();
      s.injectedCssName = null;
    }
    s.currentTarget = null;
    s.currentPosition = null;
    return { element: el, target, position };
  }

  function destroy(): void {
    clear();
  }

  return { update, clear, isActive, isInsideLockedRect, finalize, destroy };
}

// ── createMovePreview (drag-to-move) ─────────────────────────────────────

interface MovePreviewState {
  timer: ReturnType<typeof setTimeout> | null;
  sourceEl: HTMLElement | null;
  /** Original parent + sibling for reverting the move. */
  originalParent: HTMLElement | null;
  originalNextSibling: Node | null;
  moved: boolean;
  currentTarget: HTMLElement | null;
  currentPosition: DropPosition | null;
  lockedRect: DOMRect | null;
  /** Cursor position when preview activated — used with LOCK_ESCAPE_THRESHOLD. */
  lockOriginX: number;
  lockOriginY: number;
}

export function createMovePreview(sourceEl: HTMLElement, onActivate?: () => void): MovePreviewHandle {
  const s: MovePreviewState = {
    timer: null,
    sourceEl,
    originalParent: sourceEl.parentElement,
    originalNextSibling: sourceEl.nextSibling,
    moved: false,
    currentTarget: null,
    currentPosition: null,
    lockedRect: null,
    lockOriginX: 0,
    lockOriginY: 0,
  };

  function activate(target: HTMLElement, position: DropPosition, cursorX: number, cursorY: number): void {
    if (!s.sourceEl) return;

    // Save the target's bounding rect BEFORE any DOM mutation.
    s.lockedRect = target.getBoundingClientRect();
    s.lockOriginX = cursorX;
    s.lockOriginY = cursorY;

    // Save current position for revert (in case element was already moved by a
    // previous preview cycle).
    s.originalParent = s.sourceEl.parentElement;
    s.originalNextSibling = s.sourceEl.nextSibling;

    // Move the source element to the new position.
    switch (position) {
      case 'before':      target.insertAdjacentElement('beforebegin', s.sourceEl); break;
      case 'after':       target.insertAdjacentElement('afterend', s.sourceEl); break;
      case 'first-child': target.insertAdjacentElement('afterbegin', s.sourceEl); break;
      case 'last-child':  target.appendChild(s.sourceEl); break;
    }

    s.moved = true;
    onActivate?.();
  }

  function revert(): void {
    if (s.moved && s.sourceEl && s.originalParent) {
      if (s.originalNextSibling) {
        s.originalParent.insertBefore(s.sourceEl, s.originalNextSibling);
      } else {
        s.originalParent.appendChild(s.sourceEl);
      }
      s.moved = false;
    }
    s.lockedRect = null;
  }

  function cancelTimer(): void {
    if (s.timer !== null) {
      clearTimeout(s.timer);
      s.timer = null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────

  function update(target: HTMLElement, position: DropPosition, cursorX?: number, cursorY?: number): void {
    if (target !== s.currentTarget || position !== s.currentPosition) {
      // Different target/position — revert any active preview.
      clear();
      s.currentTarget = target;
      s.currentPosition = position;
    } else if (s.moved) {
      // Same target + position and preview already active — keep it.
      return;
    }

    // Reset the timer on every mouse move so the preview only activates
    // after the cursor has been idle for PREVIEW_DELAY ms.
    cancelTimer();
    const cx = cursorX ?? 0;
    const cy = cursorY ?? 0;
    s.timer = setTimeout(() => {
      s.timer = null;
      activate(target, position, cx, cy);
    }, PREVIEW_DELAY);
  }

  function clear(): void {
    cancelTimer();
    revert();
    s.currentTarget = null;
    s.currentPosition = null;
  }

  function isActive(): boolean {
    return s.moved;
  }

  function isInsideLockedRect(x: number, y: number): boolean {
    if (!s.lockedRect || !s.moved) return false;
    // If the cursor has moved far from the activation point, break the lock.
    const dx = x - s.lockOriginX;
    const dy = y - s.lockOriginY;
    if (dx * dx + dy * dy > LOCK_ESCAPE_THRESHOLD * LOCK_ESCAPE_THRESHOLD) return false;
    const r = s.lockedRect;
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function finalize(): FinalizeResult | null {
    cancelTimer();
    const target = s.currentTarget;
    const position = s.currentPosition;
    if (!s.sourceEl || !target || !position) {
      clear();
      return null;
    }
    s.moved = false;
    s.lockedRect = null;
    s.currentTarget = null;
    s.currentPosition = null;
    return { element: s.sourceEl, target, position };
  }

  function destroy(): void {
    clear();
  }

  return { update, clear, isActive, isInsideLockedRect, finalize, destroy };
}
