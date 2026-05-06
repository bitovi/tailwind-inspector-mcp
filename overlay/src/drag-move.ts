// Drag-to-move system for reordering/reparenting elements on the page.
// Activated by mousedown+drag on a selected element (5px threshold).

import { send, sendTo } from './ws';
import { buildInsertContext } from './context';
import { getFiber, findOwningComponent } from './react/fiber';
import { isActive as isDropZoneActive } from './drop-zone';
import {
  computeDropPosition,
  adjustForEdgeChild,
  getAxis,
  findTarget,
  buildSelector,
  renderIndicator,
  type DropPosition,
} from './drop-zone';
import { state, clearGrabCursor, setGrabCursor } from './overlay-state';
import { dom } from './overlay-dom';
import { dispatch, getState } from './overlay-state-machine';
import { clearHighlights, highlightElement, clearHoverPreview } from './element-highlight';
import { removeElementDrawer } from './element-drawer';
import { showDrawButton } from './element-toolbar';
import { setToolOverrides, clearToolOverrides, updateToolState } from './bottom-toolbar';
import { revertPreview } from './patcher';
import type { Patch } from '../../shared/types';
import { createMovePreview, type MovePreviewHandle } from './drop-preview';

// ── Constants ────────────────────────────────────────────────────────────

const DRAG_THRESHOLD = 5; // px of movement before drag starts

// ── Session state ────────────────────────────────────────────────────────

interface MoveSession {
  sourceEl: HTMLElement;
  /** Original parent + index for undo/revert */
  originalParent: HTMLElement;
  originalNextSibling: Node | null;
  startX: number;
  startY: number;
  dragging: boolean; // true once threshold exceeded
  /** Whether select-mode was active before drag (restore on drop/cancel) */
  wasSelectModeOn: boolean;
}

let session: MoveSession | null = null;

/** Hover-to-preview handle for the current move session. */
let movePreview: MovePreviewHandle | null = null;

// ── DOM elements ─────────────────────────────────────────────────────────

interface MoveDragDOM {
  indicator: HTMLElement | null;
  currentTarget: HTMLElement | null;
  currentPosition: DropPosition | null;
  overlayHost: HTMLElement | null;
}

const dom: MoveDragDOM = {
  indicator: null,
  currentTarget: null,
  currentPosition: null,
  overlayHost: null,
};

// ── Public API ───────────────────────────────────────────────────────────

export function initDragMove(shadowHost: HTMLElement): void {
  dom.overlayHost = shadowHost;
  document.addEventListener('mousedown', onMouseDown, { capture: true });
}

export function destroyDragMove(): void {
  document.removeEventListener('mousedown', onMouseDown, { capture: true });
  if (session) cancelMove();
}

export function isDragMoveActive(): boolean {
  return session?.dragging === true;
}

// ── Mousedown — potential drag start ─────────────────────────────────────

function onMouseDown(e: MouseEvent): void {
  // Only left button
  if (e.button !== 0) return;

  // Must have a selected element
  if (!state.currentTargetEl) return;

  // Don't start drag if clicking on our own shadow UI
  const composed = e.composedPath();
  if (composed.some(el => el === dom.shadowHost)) return;

  // Check if click is on or inside the selected element
  const target = e.target as HTMLElement;
  if (target !== state.currentTargetEl && !state.currentTargetEl.contains(target)) return;

  // Don't start during any exclusive interaction
  if (getState().interaction.kind !== 'none') return;
  if (isDropZoneActive()) return;


  session = {
    sourceEl: state.currentTargetEl,
    originalParent: state.currentTargetEl.parentElement!,
    originalNextSibling: state.currentTargetEl.nextSibling,
    startX: e.clientX,
    startY: e.clientY,
    dragging: false,
    wasSelectModeOn: state.selectModeOn,
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('selectstart', onSelectStart);
}

// ── Mouse move — threshold check + indicator update ──────────────────────

function onMouseMove(e: MouseEvent): void {
  if (!session) return;

  if (!session.dragging) {
    const dx = e.clientX - session.startX;
    const dy = e.clientY - session.startY;
    if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;

    // Threshold exceeded — start actual drag
    session.dragging = true;
    dispatch({ type: 'DRAG_MOVE_THRESHOLD_MET' });
    session.sourceEl.style.opacity = '0.3';
    clearGrabCursor();
    clearHighlights();
    clearHoverPreview();
    removeElementDrawer();

    // Update toolbar: Select=teal (engaged), Insert=orange (picking)
    setToolOverrides({ select: 'engaged', insert: 'picking' });
    sendTo('panel', { type: 'MODE_CHANGED', mode: 'insert' });

    // Create indicator element (plain container — renderIndicator fills it)
    dom.indicator = document.createElement('div');
    document.body.appendChild(dom.indicator);

    document.documentElement.style.cursor = 'grabbing';

    // Initialize hover-to-preview
    movePreview = createMovePreview(session.sourceEl, () => hideDropIndicator());
  }

  // If a move preview is active and cursor is still inside the pre-reflow rect,
  // skip hit-testing — the live preview holds stable.
  if (movePreview?.isInsideLockedRect(e.clientX, e.clientY)) {
    return;
  }

  // Update drop zone indicator
  // Hide source + indicator to avoid self-hits
  session.sourceEl.style.pointerEvents = 'none';
  if (dom.indicator) dom.indicator.style.display = 'none';

  const hitTarget = findTarget(e.clientX, e.clientY);

  session.sourceEl.style.pointerEvents = '';
  if (dom.indicator) dom.indicator.style.display = '';

  if (!hitTarget || hitTarget === session.sourceEl || session.sourceEl.contains(hitTarget)) {
    hideDropIndicator();
    movePreview?.clear();
    return;
  }

  const parentAxis = hitTarget.parentElement ? getAxis(hitTarget.parentElement) : 'vertical';
  const rect = hitTarget.getBoundingClientRect();
  const rawPosition = computeDropPosition({ x: e.clientX, y: e.clientY }, rect, parentAxis);
  const adjusted = adjustForEdgeChild(hitTarget, rawPosition);

  dom.currentTarget = adjusted.target;
  dom.currentPosition = adjusted.position;
  const indicatorAxis = adjusted.target.parentElement ? getAxis(adjusted.target.parentElement) : 'vertical';
  showDropIndicator(adjusted.target, adjusted.position, indicatorAxis);

  // Start/update hover-to-preview timer
  movePreview?.update(adjusted.target, adjusted.position, e.clientX, e.clientY);
}

function onMouseUp(e: MouseEvent): void {
  if (!session) return;

  if (!session.dragging) {
    // Didn't exceed threshold — not a drag, let normal click flow handle it
    cleanupListeners();
    session = null;
    return;
  }

  // Suppress the click event that follows mouseup after a drag
  suppressNextClick();

  const sourceEl = session.sourceEl;
  let target: HTMLElement;
  let position: DropPosition;

  // If hover-to-preview is active, finalize it — the element is already in the DOM
  // and we get target/position from the preview state (dom.currentTarget may be null).
  if (movePreview?.isActive()) {
    const result = movePreview.finalize();
    if (!result) {
      // finalize failed — revert
      cancelMove();
      return;
    }
    target = result.target;
    position = result.position as DropPosition;
    movePreview = null;
  } else if (dom.currentTarget && dom.currentPosition) {
    target = dom.currentTarget;
    position = dom.currentPosition;

    // Check: is this a same-position drop (no-op)?
    if (isSamePosition(sourceEl, target, position)) {
      cancelMove();
      return;
    }

    movePreview?.clear();
    switch (position) {
      case 'before':      target.insertAdjacentElement('beforebegin', sourceEl); break;
      case 'after':       target.insertAdjacentElement('afterend', sourceEl); break;
      case 'first-child': target.insertAdjacentElement('afterbegin', sourceEl); break;
      case 'last-child':  target.appendChild(sourceEl); break;
    }
    movePreview = null;
  } else {
    cancelMove();
    return;
  }

  // Check: is the source a ghost element?
  const isGhost = !!sourceEl.dataset.twDroppedComponent;
  const ghostPatchId = sourceEl.dataset.twDroppedPatchId;

  // Restore opacity
  sourceEl.style.opacity = '';

  if (isGhost && ghostPatchId) {
    // Ghost element — discard old patch and re-stage with new position
    // The ghost DOM node is already moved; just update the server
    const componentName = sourceEl.dataset.twDroppedComponent!;
    const targetSelector = buildSelector(target);
    const context = buildInsertContext(target, position);

    let parentComponent: { name: string } | undefined;
    const fiber = getFiber(target);
    if (fiber) {
      const boundary = findOwningComponent(fiber);
      if (boundary) parentComponent = { name: boundary.componentName };
    }

    // Discard old patch and stage a new one with updated position
    send({ type: 'DISCARD_DRAFTS', ids: [ghostPatchId] });

    const newPatchId = crypto.randomUUID();
    sourceEl.dataset.twDroppedPatchId = newPatchId;

    const patch: Patch = {
      id: newPatchId,
      kind: 'component-drop',
      elementKey: targetSelector,
      status: 'staged',
      originalClass: '',
      newClass: '',
      property: 'component-drop',
      timestamp: new Date().toISOString(),
      component: { name: componentName },
      target: {
        tag: target.tagName.toLowerCase(),
        classes: typeof target.className === 'string' ? target.className : '',
        innerText: (target.innerText || '').slice(0, 100),
      },
      ghostHtml: sourceEl.outerHTML,
      insertMode: position,
      parentComponent,
      context,
    };

    send({ type: 'COMPONENT_DROPPED', patch });
  } else {
    // Real element — stage a move-element patch
    const patchId = crypto.randomUUID();
    const componentName = state.currentBoundary?.componentName ?? sourceEl.tagName.toLowerCase();
    const context = buildInsertContext(target, position);

    // Track original position for revert
    sourceEl.dataset.twMoved = patchId;
    sourceEl.dataset.twMovedParent = getElementPath(session.originalParent);
    sourceEl.dataset.twMovedIndex = String(getChildIndex(session.originalNextSibling, session.originalParent));

    let parentComponent: { name: string } | undefined;
    const fiber = getFiber(target);
    if (fiber) {
      const boundary = findOwningComponent(fiber);
      if (boundary) parentComponent = { name: boundary.componentName };
    }

    const patch: Patch = {
      id: patchId,
      kind: 'move-element',
      elementKey: buildSelector(sourceEl),
      status: 'staged',
      originalClass: '',
      newClass: '',
      property: 'move-element',
      timestamp: new Date().toISOString(),
      pageUrl: window.location.href,
      component: { name: componentName },
      target: {
        tag: target.tagName.toLowerCase(),
        classes: typeof target.className === 'string' ? target.className : '',
        innerText: (target.innerText || '').slice(0, 100),
      },
      ghostHtml: sourceEl.outerHTML,
      insertMode: position,
      parentComponent,
      context,
    };

    send({ type: 'PATCH_STAGED', patch });
  }

  // Clean up
  cleanupDragUI();
  cleanupListeners();
  dispatch({ type: 'DRAG_MOVE_DROPPED' });

  // Keep the moved element selected: re-highlight and show drawer
  clearHighlights();
  highlightElement(sourceEl);
  showDrawButton(sourceEl);

  // Toolbar: restore pre-drag selecting state
  clearToolOverrides();
  if (session.wasSelectModeOn) {
    // Was orange/selecting → stay orange/selecting (persistent select)
    updateToolState('select', true, false);
    sendTo('panel', { type: 'MODE_CHANGED', mode: 'select' });
  } else {
    // Was teal/locked → restore teal/locked
    updateToolState('select', false, true);
    sendTo('panel', { type: 'MODE_CHANGED', mode: 'select' });
    sendTo('panel', { type: 'SELECT_MODE_CHANGED', active: false });
  }
  setGrabCursor();

  session = null;
}

// ── Key handler ──────────────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && session) {
    cancelMove();
  }
}

// ── Cancel / revert ──────────────────────────────────────────────────────

function cancelMove(): void {

  if (!session) return;
  const wasDragging = session.dragging;
  if (wasDragging) suppressNextClick();

  // Revert any active hover-to-preview (moves element back to original position)
  if (movePreview) {
    movePreview.destroy();
    movePreview = null;
  }

  session.sourceEl.style.opacity = '';
  cleanupDragUI();
  cleanupListeners();
  if (wasDragging) {
    dispatch({ type: 'DRAG_MOVE_CANCELLED' });
  }

  // Restore toolbar to pre-drag state
  if (wasDragging) {
    clearToolOverrides();
    if (session.wasSelectModeOn) {
      updateToolState('select', true, false);
      sendTo('panel', { type: 'MODE_CHANGED', mode: 'select' });
    } else {
      updateToolState('select', false, true);
      sendTo('panel', { type: 'MODE_CHANGED', mode: 'select' });
      sendTo('panel', { type: 'SELECT_MODE_CHANGED', active: false });
    }
    setGrabCursor();
    showDrawButton(session.sourceEl);
  }

  session = null;
}

/** Revert a move-element patch (called when server broadcasts REVERT_MOVE). */
export function revertMove(patchId: string): void {
  const movedEl = document.querySelector(`[data-tw-moved="${patchId}"]`) as HTMLElement | null;
  if (!movedEl) return;

  const parentPath = movedEl.dataset.twMovedParent;
  const indexStr = movedEl.dataset.twMovedIndex;

  if (parentPath) {
    const parent = document.querySelector(parentPath) as HTMLElement | null;
    if (parent) {
      const idx = indexStr ? parseInt(indexStr, 10) : -1;
      if (idx >= 0 && idx < parent.children.length) {
        parent.insertBefore(movedEl, parent.children[idx]);
      } else {
        parent.appendChild(movedEl);
      }
    }
  }

  delete movedEl.dataset.twMoved;
  delete movedEl.dataset.twMovedParent;
  delete movedEl.dataset.twMovedIndex;
}

// ── Indicator rendering (delegates to shared renderIndicator) ────────────

function showDropIndicator(target: HTMLElement, position: DropPosition, axis: 'vertical' | 'horizontal'): void {
  if (!dom.indicator) return;

  // Clear previous content
  dom.indicator.innerHTML = '';

  const rect = target.getBoundingClientRect();
  renderIndicator(dom.indicator, position, axis, rect, { zIndex: 2147483645 });
}

function hideDropIndicator(): void {
  if (dom.indicator) { dom.indicator.innerHTML = ''; dom.indicator.style.display = 'none'; }
  dom.currentTarget = null;
  dom.currentPosition = null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function cleanupDragUI(): void {
  if (dom.indicator) { dom.indicator.remove(); dom.indicator = null; }
  dom.currentTarget = null;
  dom.currentPosition = null;
  document.documentElement.style.cursor = '';
}

function onSelectStart(e: Event): void {
  e.preventDefault();
}

function cleanupListeners(): void {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('selectstart', onSelectStart);
}

function isSamePosition(source: HTMLElement, target: HTMLElement, position: DropPosition): boolean {
  switch (position) {
    case 'before':
      return target.previousElementSibling === source;
    case 'after':
      return target.nextElementSibling === source;
    case 'first-child':
      return target.firstElementChild === source;
    case 'last-child':
      return target.lastElementChild === source;
    default:
      return false;
  }
}

function getElementPath(el: HTMLElement): string {
  return buildSelector(el);
}

function getChildIndex(nextSibling: Node | null, parent: HTMLElement): number {
  if (!nextSibling) return parent.children.length;
  const children = Array.from(parent.children);
  for (let i = 0; i < children.length; i++) {
    if (children[i] === nextSibling) return i;
  }
  return parent.children.length;
}

function suppressNextClick(): void {
  const handler = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    document.removeEventListener('click', handler, true);
  };
  document.addEventListener('click', handler, true);
  // Safety cleanup in case the click never fires
  setTimeout(() => document.removeEventListener('click', handler, true), 100);
}
