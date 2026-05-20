// Drop-zone tracking system for component arm-and-place.
// Runs in the overlay (vanilla DOM — no React).
//
// State is modelled as a discriminated union (DropZoneMode) instead of
// independent boolean flags, making invalid state combinations impossible.

import { send, sendTo } from './ws';
import { getFiber, findOwningComponent } from './react/fiber';
import type { Patch } from '../../shared/types';
import { css, TEAL, TEAL_06, Z_LOCKED, FIXED_OVERLAY, CURSOR_LABEL, INDICATOR_BASE, DASHED_BORDER, ARROW_BASE, LINE_BASE } from './styles';
import { createDropPreview, type DropPreviewHandle } from './drop-preview';
import { buildComponentDropPatch } from './patch-builder';
import { dom as overlayDom } from './overlay-dom';
import { clearSelectionState } from './overlay-state';
import { clearHighlights } from './element-highlight';
import { revertPreview } from './patcher';
import { dispatch } from './overlay-state-machine';
import { findAmbiguousSlots, showSlotPicker, dismissSlotPicker } from './slot-picker';

export { type DropPosition, getAxis, computeDropPosition, adjustForEdgeChild } from '../../shared/drop-geometry';
import type { DropPosition } from '../../shared/drop-geometry';
import { getAxis, computeDropPosition, adjustForEdgeChild } from '../../shared/drop-geometry';

type InsertCallback = (target: HTMLElement, position: DropPosition) => void;
type ElementSelectCallback = (target: HTMLElement) => void;

// ── Discriminated union state ────────────────────────────────────────────

type DropZoneMode =
  | { kind: 'idle' }
  | {
      kind: 'component-insert';
      componentName: string;
      storyId: string;
      ghostHtml: string;
      ghostCss: string;
      componentPath: string;
      componentArgs: Record<string, unknown>;
    }
  | { kind: 'generic-insert'; callback: InsertCallback }
  | { kind: 'element-select'; callback: ElementSelectCallback }
  | { kind: 'browse'; onLocked: ((target: HTMLElement, position: DropPosition) => void) | null };

let mode: DropZoneMode = { kind: 'idle' };

// ── Tracked DOM elements ─────────────────────────────────────────────────

interface DropZoneDOM {
  overlayHost: HTMLElement | null;
  cursorLabel: HTMLElement | null;
  indicator: HTMLElement | null;
  arrowLeft: HTMLElement | null;
  arrowRight: HTMLElement | null;
  outlineEl: HTMLElement | null;
  currentTarget: HTMLElement | null;
  currentPosition: DropPosition | null;
}

const dom: DropZoneDOM = {
  overlayHost: null,
  cursorLabel: null,
  indicator: null,
  arrowLeft: null,
  arrowRight: null,
  outlineEl: null,
  currentTarget: null,
  currentPosition: null,
};

/** Hover-to-preview handle for the current component-insert mode. */
let dropPreview: DropPreviewHandle | null = null;

interface LockedState {
  target: HTMLElement | null;
  position: DropPosition | null;
  indicator: HTMLElement | null;
  arrowLeft: HTMLElement | null;
  arrowRight: HTMLElement | null;
}

const locked: LockedState = {
  target: null,
  position: null,
  indicator: null,
  arrowLeft: null,
  arrowRight: null,
};

// ── Public API (signatures unchanged) ────────────────────────────────────

export function armInsert(
  msg: { componentName: string; storyId: string; ghostHtml: string; ghostCss?: string; componentPath?: string; args?: Record<string, unknown> },
  shadowHost: HTMLElement,
): void {
  arm(
    {
      kind: 'component-insert',
      componentName: msg.componentName,
      storyId: msg.storyId,
      ghostHtml: msg.ghostHtml,
      ghostCss: msg.ghostCss ?? '',
      componentPath: msg.componentPath ?? '',
      componentArgs: msg.args ?? {},
    },
    shadowHost,
    `Place: ${msg.componentName}`,
  );
}

/**
 * Place a component immediately at the locked insert point (Flow B).
 * Returns true if placement succeeded, false if no locked point exists.
 */
export function placeAtLockedInsert(
  msg: { componentName: string; storyId: string; ghostHtml: string; ghostCss?: string; componentPath?: string; args?: Record<string, unknown> },
): boolean {
  if (!locked.target || !locked.position) return false;

  const target = locked.target;
  const position = locked.position;

  const template = document.createElement('template');
  template.innerHTML = msg.ghostHtml.trim();
  const inserted = template.content.firstElementChild as HTMLElement | null;
  if (!inserted) return false;
  inserted.dataset.twDroppedComponent = msg.componentName;

  switch (position) {
    case 'before':      target.insertAdjacentElement('beforebegin', inserted); break;
    case 'after':       target.insertAdjacentElement('afterend', inserted); break;
    case 'first-child': target.insertAdjacentElement('afterbegin', inserted); break;
    case 'last-child':  target.appendChild(inserted); break;
  }

  if (msg.ghostCss) injectGhostCss(msg.componentName, msg.ghostCss);

  const patch = buildComponentDropPatch({
    target,
    position,
    componentName: msg.componentName,
    storyId: msg.storyId,
    ghostHtml: msg.ghostHtml,
    ghostCss: msg.ghostCss,
    componentPath: msg.componentPath,
    componentArgs: msg.args,
  });

  inserted.dataset.twDroppedPatchId = patch.id;

  send({ type: 'COMPONENT_DROPPED', patch });
  // Note: COMPONENT_DISARMED is sent by the caller via dispatch({ type: 'COMPONENT_PLACED' })
  // which also restarts browse mode for rapid placement.

  clearLockedInsert();
  return true;
}

export function cancelInsert(): void {
  cleanup();
}

export function replaceElement(
  target: HTMLElement,
  msg: { componentName: string; storyId: string; ghostHtml: string; ghostCss?: string; componentPath?: string; args?: Record<string, unknown> },
): HTMLElement | null {
  const template = document.createElement('template');
  template.innerHTML = msg.ghostHtml.trim();
  const inserted = template.content.firstElementChild as HTMLElement | null;
  if (!inserted) return null;
  inserted.dataset.twDroppedComponent = msg.componentName;

  target.insertAdjacentElement('beforebegin', inserted);
  target.style.display = 'none';

  // Inject ghost CSS into the page so all classes resolve
  if (msg.ghostCss) {
    injectGhostCss(msg.componentName, msg.ghostCss);
  }

  const patch = buildComponentDropPatch({
    target,
    position: 'replace',
    componentName: msg.componentName,
    storyId: msg.storyId,
    ghostHtml: msg.ghostHtml,
    ghostCss: msg.ghostCss,
    componentPath: msg.componentPath,
    componentArgs: msg.args,
  });

  inserted.dataset.twDroppedPatchId = patch.id;

  send({ type: 'COMPONENT_DROPPED', patch });
  sendTo('panel', { type: 'COMPONENT_DISARMED' });

  return inserted;
}

export function armGenericInsert(
  label: string,
  shadowHost: HTMLElement,
  callback: InsertCallback,
): void {
  arm({ kind: 'generic-insert', callback }, shadowHost, label);
}

export function armElementSelect(
  label: string,
  shadowHost: HTMLElement,
  callback: ElementSelectCallback,
): void {
  arm({ kind: 'element-select', callback }, shadowHost, label);
}

export function isActive(): boolean {
  return mode.kind !== 'idle';
}

export function startBrowse(
  shadowHost: HTMLElement,
  onLocked?: (target: HTMLElement, position: DropPosition) => void,
): void {
  clearLockedInsert();
  arm({ kind: 'browse', onLocked: onLocked ?? null }, shadowHost);
}

export function getLockedInsert(): { target: HTMLElement; position: DropPosition } | null {
  if (!locked.target || !locked.position) return null;
  return { target: locked.target, position: locked.position };
}

export function clearLockedInsert(): void {
  locked.target = null;
  locked.position = null;
  if (locked.indicator) { locked.indicator.remove(); locked.indicator = null; }
  if (locked.arrowLeft) { locked.arrowLeft.remove(); locked.arrowLeft = null; }
  if (locked.arrowRight) { locked.arrowRight.remove(); locked.arrowRight = null; }
}

/** Re-render indicators at fresh getBoundingClientRect positions (call on scroll). */
export function repositionOnScroll(): void {
  // Hover indicator (only while a mode is active)
  if (mode.kind !== 'idle' && dom.currentTarget && dom.currentPosition && dom.indicator) {
    const parentAxis = dom.currentTarget.parentElement ? getAxis(dom.currentTarget.parentElement) : 'vertical';
    showDropIndicator(dom.currentTarget, dom.currentPosition, parentAxis);
  }

  // Element-select outline (only while selecting)
  if (mode.kind === 'element-select' && dom.currentTarget) {
    showElementSelectOutline(dom.currentTarget);
  }

  // Locked indicator — persists after mode returns to idle
  if (locked.target && locked.position && locked.indicator) {
    const parentAxis = locked.target.parentElement ? getAxis(locked.target.parentElement) : 'vertical';
    showLockedIndicator(locked.target, locked.position, parentAxis);
  }
}

// ── Shared arming logic ──────────────────────────────────────────────────

function arm(newMode: DropZoneMode, shadowHost: HTMLElement, label?: string): void {
  if (mode.kind !== 'idle') cleanup();
  mode = newMode;
  dom.overlayHost = shadowHost;

  document.documentElement.style.cursor = 'crosshair';

  if (label) {
    dom.cursorLabel = document.createElement('div');
    dom.cursorLabel.style.cssText = css(CURSOR_LABEL);
    dom.cursorLabel.textContent = label;
    document.body.appendChild(dom.cursorLabel);
  }

  if (newMode.kind === 'element-select') {
    dom.outlineEl = document.createElement('div');
    dom.outlineEl.style.cssText = css({ ...INDICATOR_BASE, ...DASHED_BORDER });
    document.body.appendChild(dom.outlineEl);
  } else {
    dom.indicator = document.createElement('div');
    dom.indicator.style.cssText = css(INDICATOR_BASE);
    document.body.appendChild(dom.indicator);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.documentElement.addEventListener('mouseleave', onMouseLeave);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown);

  // Initialize hover-to-preview for component-insert mode
  if (newMode.kind === 'component-insert') {
    dropPreview = createDropPreview(() => hideDropIndicator());
  }
}

// ── Drop position computation (re-exported from shared/drop-geometry.ts) ──

// ── Hit-test ─────────────────────────────────────────────────────────────

export function findTarget(x: number, y: number): HTMLElement | null {
  if (dom.indicator) dom.indicator.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  if (dom.indicator) dom.indicator.style.display = '';
  if (!el || el === document.documentElement || el === document.body) return null;
  // Filter out the overlay host (and anything it contains in the light DOM).
  // Use the shared overlayDom.shadowHost as fallback — dom.overlayHost is only
  // set when arm() has been called (click-to-place), but drag-drop/drag-move
  // also use findTarget without arming.
  const host = dom.overlayHost ?? overlayDom.shadowHost;
  if (host && (el === host || host.contains(el))) return null;
  if (dom.indicator && (el === dom.indicator || dom.indicator.contains(el))) return null;
  return el as HTMLElement;
}

// ── Pulse animation ──────────────────────────────────────────────────────

function ensurePulseStyle(): void {
  if (document.getElementById('tw-drop-pulse-style')) return;
  const style = document.createElement('style');
  style.id = 'tw-drop-pulse-style';
  style.textContent = `
    @keyframes tw-drop-pulse {
      0%, 100% { filter: hue-rotate(0deg); }
      50%      { filter: hue-rotate(189deg); }
    }
  `;
  document.head.appendChild(style);
}

// ── Shared indicator rendering ───────────────────────────────────────────

export interface RenderIndicatorOpts {
  zIndex: number;
  bgTint?: string;
  animate?: boolean;
}

export function renderIndicator(
  container: HTMLElement,
  position: DropPosition,
  axis: 'vertical' | 'horizontal',
  rect: DOMRect,
  opts: RenderIndicatorOpts,
): { arrowLeft: HTMLElement | null; arrowRight: HTMLElement | null } {
  const isInside = position === 'first-child' || position === 'last-child';

  if (isInside) {
    container.style.cssText = css({
      ...FIXED_OVERLAY,
      ...DASHED_BORDER,
      zIndex: `${opts.zIndex}`,
      display: 'block',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      background: opts.bgTint ?? 'none',
      ...(opts.animate ? { animation: 'tw-drop-pulse 2s ease-in-out infinite' } : {}),
    });

    const arrow = document.createElement('div');
    arrow.style.cssText = css(ARROW_BASE);

    const size = 6;
    const isVertical = axis === 'vertical';

    if (position === 'first-child') {
      if (isVertical) {
        arrow.style.top = '4px';
        arrow.style.left = '50%';
        arrow.style.transform = 'translateX(-50%)';
        arrow.style.borderWidth = `${size}px ${size}px 0 ${size}px`;
        arrow.style.borderColor = `${TEAL} transparent transparent transparent`;
      } else {
        arrow.style.left = '4px';
        arrow.style.top = '50%';
        arrow.style.transform = 'translateY(-50%)';
        arrow.style.borderWidth = `${size}px 0 ${size}px ${size}px`;
        arrow.style.borderColor = `transparent transparent transparent ${TEAL}`;
      }
    } else {
      if (isVertical) {
        arrow.style.bottom = '4px';
        arrow.style.left = '50%';
        arrow.style.transform = 'translateX(-50%)';
        arrow.style.borderWidth = `0 ${size}px ${size}px ${size}px`;
        arrow.style.borderColor = `transparent transparent ${TEAL} transparent`;
      } else {
        arrow.style.right = '4px';
        arrow.style.top = '50%';
        arrow.style.transform = 'translateY(-50%)';
        arrow.style.borderWidth = `${size}px ${size}px ${size}px 0`;
        arrow.style.borderColor = `transparent ${TEAL} transparent transparent`;
      }
    }
    container.appendChild(arrow);
    return { arrowLeft: arrow, arrowRight: null };
  }

  // Line mode (before/after)
  const lineWidth = 3;
  const isHorizontalLine = axis === 'vertical';

  if (isHorizontalLine) {
    const y = position === 'before' ? rect.top : rect.bottom;
    container.style.cssText = css({
      ...LINE_BASE,
      zIndex: `${opts.zIndex}`,
      top: `${y - lineWidth / 2}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${lineWidth}px`,
      borderRadius: `${lineWidth}px`,
      ...(opts.animate ? { animation: 'tw-drop-pulse 2s ease-in-out infinite' } : {}),
    });
  } else {
    const x = position === 'before' ? rect.left : rect.right;
    container.style.cssText = css({
      ...LINE_BASE,
      zIndex: `${opts.zIndex}`,
      top: `${rect.top}px`,
      left: `${x - lineWidth / 2}px`,
      width: `${lineWidth}px`,
      height: `${rect.height}px`,
      borderRadius: `${lineWidth}px`,
      ...(opts.animate ? { animation: 'tw-drop-pulse 2s ease-in-out infinite' } : {}),
    });
  }

  const arrowSize = 5;
  const inset = -2;

  const arrowLeft = document.createElement('div');
  arrowLeft.style.cssText = css(ARROW_BASE);
  const arrowRight = document.createElement('div');
  arrowRight.style.cssText = css(ARROW_BASE);

  if (isHorizontalLine) {
    arrowLeft.style.top = '50%';
    arrowLeft.style.left = `${inset}px`;
    arrowLeft.style.transform = 'translateY(-50%)';
    arrowLeft.style.borderWidth = `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`;
    arrowLeft.style.borderColor = `transparent transparent transparent ${TEAL}`;
    arrowRight.style.top = '50%';
    arrowRight.style.right = `${inset}px`;
    arrowRight.style.transform = 'translateY(-50%)';
    arrowRight.style.borderWidth = `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`;
    arrowRight.style.borderColor = `transparent ${TEAL} transparent transparent`;
  } else {
    arrowLeft.style.left = '50%';
    arrowLeft.style.top = `${inset}px`;
    arrowLeft.style.transform = 'translateX(-50%)';
    arrowLeft.style.borderWidth = `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`;
    arrowLeft.style.borderColor = `${TEAL} transparent transparent transparent`;
    arrowRight.style.left = '50%';
    arrowRight.style.bottom = `${inset}px`;
    arrowRight.style.transform = 'translateX(-50%)';
    arrowRight.style.borderWidth = `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`;
    arrowRight.style.borderColor = `transparent transparent ${TEAL} transparent`;
  }

  container.appendChild(arrowLeft);
  container.appendChild(arrowRight);
  return { arrowLeft, arrowRight };
}

// ── Hover indicator helpers ──────────────────────────────────────────────

function showDropIndicator(target: HTMLElement, position: DropPosition, axis: 'vertical' | 'horizontal'): void {
  if (!dom.indicator) return;

  if (dom.arrowLeft) { dom.arrowLeft.remove(); dom.arrowLeft = null; }
  if (dom.arrowRight) { dom.arrowRight.remove(); dom.arrowRight = null; }

  const rect = target.getBoundingClientRect();
  const arrows = renderIndicator(dom.indicator, position, axis, rect, { zIndex: 2147483645 });
  dom.arrowLeft = arrows.arrowLeft;
  dom.arrowRight = arrows.arrowRight;
}

function hideDropIndicator(): void {
  if (dom.indicator) dom.indicator.style.display = 'none';
  if (dom.arrowLeft) { dom.arrowLeft.remove(); dom.arrowLeft = null; }
  if (dom.arrowRight) { dom.arrowRight.remove(); dom.arrowRight = null; }
  dom.currentTarget = null;
  dom.currentPosition = null;
}

function showElementSelectOutline(target: HTMLElement): void {
  if (!dom.outlineEl) return;
  const rect = target.getBoundingClientRect();
  dom.outlineEl.style.top = `${rect.top}px`;
  dom.outlineEl.style.left = `${rect.left}px`;
  dom.outlineEl.style.width = `${rect.width}px`;
  dom.outlineEl.style.height = `${rect.height}px`;
  dom.outlineEl.style.display = 'block';
}

function hideElementSelectOutline(): void {
  if (dom.outlineEl) dom.outlineEl.style.display = 'none';
}

function showLockedIndicator(target: HTMLElement, position: DropPosition, axis: 'vertical' | 'horizontal'): void {
  if (!locked.indicator) return;
  ensurePulseStyle();

  if (locked.arrowLeft) { locked.arrowLeft.remove(); locked.arrowLeft = null; }
  if (locked.arrowRight) { locked.arrowRight.remove(); locked.arrowRight = null; }

  const rect = target.getBoundingClientRect();
  const arrows = renderIndicator(locked.indicator, position, axis, rect, {
    zIndex: 2147483644,
    bgTint: TEAL_06,
    animate: true,
  });
  locked.arrowLeft = arrows.arrowLeft;
  locked.arrowRight = arrows.arrowRight;
}

// ── Unified event handlers ───────────────────────────────────────────────

function updateCursorLabel(e: MouseEvent): void {
  if (dom.cursorLabel) {
    dom.cursorLabel.style.left = `${e.clientX + 14}px`;
    dom.cursorLabel.style.top = `${e.clientY - 28}px`;
    dom.cursorLabel.style.opacity = '1';
  }
}

/**
 * When the cursor lands on a container element, check whether it is actually
 * sitting inside a CSS gap between two adjacent children. If so, return the
 * child that precedes the gap (the drop should be 'after' that child).
 * Returns null if the cursor is not in any inter-child gap.
 */
function findChildInGap(
  container: HTMLElement,
  cx: number,
  cy: number,
): { child: HTMLElement; position: 'before' | 'after' } | null {
  const children = Array.from(container.children) as HTMLElement[];
  if (children.length === 0) return null;
  const axis = getAxis(container);
  const containerRect = container.getBoundingClientRect();

  // Leading padding: cursor is before the first child
  const first = children[0].getBoundingClientRect();
  const beforeFirst =
    axis === 'vertical'
      ? cy >= containerRect.top && cy < first.top
      : cx >= containerRect.left && cx < first.left;
  if (beforeFirst) return { child: children[0], position: 'before' };

  // Gaps between adjacent children
  for (let i = 0; i < children.length - 1; i++) {
    const a = children[i].getBoundingClientRect();
    const b = children[i + 1].getBoundingClientRect();
    const inGap =
      axis === 'vertical'
        ? cy > a.bottom && cy < b.top
        : cx > a.right && cx < b.left;
    if (inGap) return { child: children[i], position: 'after' };
  }

  // Trailing padding: cursor is past the last child but still within the container
  const last = children[children.length - 1];
  const lastRect = last.getBoundingClientRect();
  const pastLast =
    axis === 'vertical'
      ? cy > lastRect.bottom && cy <= containerRect.bottom
      : cx > lastRect.right && cx <= containerRect.right;
  if (pastLast) return { child: last, position: 'after' };

  return null;
}

function onMouseMove(e: MouseEvent): void {
  if (mode.kind === 'idle') return;

  updateCursorLabel(e);

  // If a drop preview is active and cursor is still inside the pre-reflow rect,
  // skip hit-testing — the live preview holds stable.
  if (dropPreview?.isInsideLockedRect(e.clientX, e.clientY)) {
    return;
  }

  const target = findTarget(e.clientX, e.clientY);

  if (mode.kind === 'element-select') {
    if (!target) {
      hideElementSelectOutline();
      dom.currentTarget = null;
      return;
    }
    dom.currentTarget = target;
    showElementSelectOutline(target);
    return;
  }

  // component-insert, generic-insert, browse
  if (!target) {
    hideDropIndicator();
    dropPreview?.clear();
    return;
  }

  // Gap/padding detection: if the cursor landed on a container, check whether
  // it is in a CSS gap between two children, in the leading padding (before the
  // first child), or in the trailing padding (after the last child). In those
  // cases bypass the 4-zone position heuristic and use the adjacent child
  // directly so we always stay inside the right container.
  const gapResult = findChildInGap(target, e.clientX, e.clientY);
  const resolvedTarget = gapResult ? gapResult.child : target;

  const parentAxis = resolvedTarget.parentElement ? getAxis(resolvedTarget.parentElement) : 'vertical';
  const rect = resolvedTarget.getBoundingClientRect();
  const rawPosition = gapResult
    ? gapResult.position
    : computeDropPosition({ x: e.clientX, y: e.clientY }, rect, parentAxis);
  const adjusted = adjustForEdgeChild(resolvedTarget, rawPosition);

  dom.currentTarget = adjusted.target;
  dom.currentPosition = adjusted.position;
  // For before/after positions we need the parent's axis (sibling context).
  // For first-child/last-child we're inserting *inside* adjusted.target, so use its own axis.
  const indicatorAxis =
    adjusted.position === 'first-child' || adjusted.position === 'last-child'
      ? getAxis(adjusted.target)
      : adjusted.target.parentElement
        ? getAxis(adjusted.target.parentElement)
        : 'vertical';
  showDropIndicator(adjusted.target, adjusted.position, indicatorAxis);

  // Start/update hover-to-preview timer (component-insert mode only)
  if (dropPreview && mode.kind === 'component-insert') {
    dropPreview.update(adjusted.target, adjusted.position, mode.ghostHtml, mode.ghostCss || null, e.clientX, e.clientY);
  }
}

function onMouseLeave(): void {
  if (mode.kind === 'element-select') {
    hideElementSelectOutline();
    dom.currentTarget = null;
  } else {
    hideDropIndicator();
    dropPreview?.clear();
  }
  if (dom.cursorLabel) dom.cursorLabel.style.opacity = '0';
}

function onClick(e: MouseEvent): void {
  if (mode.kind === 'idle') return;

  // Ignore clicks on the overlay shadow host (e.g. drawer buttons, toolbar)
  const host = dom.overlayHost ?? overlayDom.shadowHost;
  if (host) {
    const path = e.composedPath();
    if (path.includes(host)) {
      console.log('[drop-zone-debug] onClick ignored — click is on overlay shadow host');
      return;
    }
  }

  switch (mode.kind) {
    case 'element-select': return handleElementSelectClick(e);
    case 'browse': return handleBrowseClick(e);
    case 'generic-insert': return handleGenericInsertClick(e);
    case 'component-insert': return handleComponentInsertClick(e);
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (mode.kind === 'browse' && locked.target) {
      // Persistent browse with a locked point — just stop browsing, keep point
      // Panel Escape handler will send TOGGLE_INSERT_BROWSE or CANCEL_MODE
      cleanup();
      return;
    }
    sendTo('panel', { type: 'COMPONENT_DISARMED' });
    cleanup();
  }
}

// ── Per-mode click handlers ──────────────────────────────────────────────

function handleElementSelectClick(e: MouseEvent): void {
  if (!dom.currentTarget) return;
  e.preventDefault();
  e.stopPropagation();
  const target = dom.currentTarget;
  const cb = mode.kind === 'element-select' ? mode.callback : null;
  cleanup();
  sendTo('panel', { type: 'COMPONENT_DISARMED' });
  if (cb) cb(target);
}

function handleBrowseClick(e: MouseEvent): void {
  if (!dom.currentTarget || !dom.currentPosition) return;
  e.preventDefault();
  e.stopPropagation();

  // Check for ambiguous insertion slots near tightly packed boundaries
  const slots = findAmbiguousSlots(e.clientX, e.clientY, dom.currentTarget, dom.currentPosition);
  if (slots.length > 1) {
    console.log('[insert-text-debug] slot picker showing with', slots.length, 'candidates');
    showSlotPicker(slots, e.clientX, e.clientY, (picked) => {
      console.log('[insert-text-debug] slot picker onPick callback fired:', { tag: picked.target.tagName, position: picked.position });
      lockBrowseInsert(picked.target, picked.position);
    });
    return;
  }

  lockBrowseInsert(dom.currentTarget, dom.currentPosition);
}

/** Finalize the browse-click lock at a resolved target + position. */
function lockBrowseInsert(target: HTMLElement, position: DropPosition): void {
  console.log('[insert-text-debug] lockBrowseInsert called:', { tag: target.tagName, position, modeKind: mode.kind });
  clearLockedInsert();
  locked.target = target;
  locked.position = position;

  // Sync SM so ESCAPE and toolbar three-way toggle see the locked point
  dispatch({ type: 'INSERT_POINT_LOCKED', target, position });

  const parentAxis = target.parentElement ? getAxis(target.parentElement) : 'vertical';
  locked.indicator = document.createElement('div');
  locked.indicator.style.cssText = css({ ...FIXED_OVERLAY, zIndex: Z_LOCKED });
  document.body.appendChild(locked.indicator);
  showLockedIndicator(target, position, parentAxis);

  const fiber = getFiber(target);
  const boundary = fiber ? findOwningComponent(fiber) : null;
  const targetName = boundary?.componentName ?? target.tagName.toLowerCase();

  sendTo('panel', {
    type: 'INSERT_POINT_LOCKED',
    position,
    targetName,
    targetTag: target.tagName.toLowerCase(),
  });

  // Persistent browse: keep mode active, just notify via callback
  const cb = mode.kind === 'browse' ? mode.onLocked : null;
  console.log('[insert-text-debug] lockBrowseInsert callback:', { hasCallback: !!cb, modeKind: mode.kind });
  if (cb) cb(target, position);
}

function handleGenericInsertClick(e: MouseEvent): void {
  // If no target was set by mousemove (e.g. user clicked without moving the
  // mouse after arming), do a hit-test at the click position.
  if (!dom.currentTarget || !dom.currentPosition) {
    const hitTarget = findTarget(e.clientX, e.clientY);
    if (hitTarget) {
      const parentAxis = hitTarget.parentElement ? getAxis(hitTarget.parentElement) : 'vertical';
      const rect = hitTarget.getBoundingClientRect();
      const rawPosition = computeDropPosition({ x: e.clientX, y: e.clientY }, rect, parentAxis);
      const adjusted = adjustForEdgeChild(hitTarget, rawPosition);
      dom.currentTarget = adjusted.target;
      dom.currentPosition = adjusted.position;
    }
  }

  if (!dom.currentTarget || !dom.currentPosition) {
    cleanup();
    sendTo('panel', { type: 'COMPONENT_DISARMED' });
    return;
  }
  e.preventDefault();
  e.stopPropagation();

  // Check for ambiguous insertion slots near tightly packed boundaries
  const slots = findAmbiguousSlots(e.clientX, e.clientY, dom.currentTarget, dom.currentPosition);
  if (slots.length > 1) {
    const cb = mode.kind === 'generic-insert' ? mode.callback : null;
    showSlotPicker(slots, e.clientX, e.clientY, (picked) => {
      cleanup();
      if (cb) cb(picked.target, picked.position);
    });
    return;
  }

  const target = dom.currentTarget;
  const position = dom.currentPosition;
  const cb = mode.kind === 'generic-insert' ? mode.callback : null;
  cleanup();
  if (cb) cb(target, position);
}

function handleComponentInsertClick(e: MouseEvent): void {
  // If no target was set by mousemove (e.g. user clicked without moving the
  // mouse after arming), do a hit-test at the click position.
  if (!dom.currentTarget || !dom.currentPosition) {
    const hitTarget = findTarget(e.clientX, e.clientY);
    if (hitTarget) {
      const parentAxis = hitTarget.parentElement ? getAxis(hitTarget.parentElement) : 'vertical';
      const rect = hitTarget.getBoundingClientRect();
      const rawPosition = computeDropPosition({ x: e.clientX, y: e.clientY }, rect, parentAxis);
      const adjusted = adjustForEdgeChild(hitTarget, rawPosition);
      dom.currentTarget = adjusted.target;
      dom.currentPosition = adjusted.position;
    }
  }

  if (!dom.currentTarget || !dom.currentPosition) {
    cleanup();
    sendTo('panel', { type: 'COMPONENT_DISARMED' });
    return;
  }
  e.preventDefault();
  e.stopPropagation();

  if (mode.kind !== 'component-insert') return;

  // Check for ambiguous insertion slots near tightly packed boundaries
  const slots = findAmbiguousSlots(e.clientX, e.clientY, dom.currentTarget, dom.currentPosition);
  if (slots.length > 1) {
    showSlotPicker(slots, e.clientX, e.clientY, (picked) => {
      dom.currentTarget = picked.target;
      dom.currentPosition = picked.position;
      finalizeComponentInsert();
    });
    return;
  }

  finalizeComponentInsert();
}

function finalizeComponentInsert(): void {
  if (!dom.currentTarget || !dom.currentPosition) return;
  if (mode.kind !== 'component-insert') return;

  const { componentName: cName, storyId: sId, ghostHtml: gHtml, ghostCss: gCss, componentPath: cPath, componentArgs: cArgs } = mode;

  // If hover-to-preview is active, finalize it — the element is already in the DOM.
  const finalizeResult = dropPreview?.isActive() ? dropPreview.finalize() : null;

  let inserted: HTMLElement;
  let finalizedTarget: HTMLElement | null = null;
  let finalizedPosition: DropPosition | 'replace' | null = null;

  if (finalizeResult) {
    inserted = finalizeResult.element;
    finalizedTarget = finalizeResult.target;
    finalizedPosition = finalizeResult.position;
    inserted.dataset.twDroppedComponent = cName;
  } else {
    dropPreview?.clear();

    const template = document.createElement('template');
    template.innerHTML = gHtml.trim();
    const el = template.content.firstElementChild as HTMLElement | null;
    if (!el) {
      cleanup();
      sendTo('panel', { type: 'COMPONENT_DISARMED' });
      return;
    }
    inserted = el;
    inserted.dataset.twDroppedComponent = cName;

    switch (dom.currentPosition) {
      case 'before':
        dom.currentTarget.insertAdjacentElement('beforebegin', inserted);
        break;
      case 'after':
        dom.currentTarget.insertAdjacentElement('afterend', inserted);
        break;
      case 'first-child':
        dom.currentTarget.insertAdjacentElement('afterbegin', inserted);
        break;
      case 'last-child':
        dom.currentTarget.appendChild(inserted);
        break;
    }
  }

  const target = finalizedTarget ?? dom.currentTarget;
  const position = finalizedPosition ?? dom.currentPosition;

  // Inject ghost CSS into the page so all classes resolve
  if (gCss) {
    injectGhostCss(cName, gCss);
  }

  const patch = buildComponentDropPatch({
    target,
    position: position!,
    componentName: cName,
    storyId: sId,
    ghostHtml: gHtml,
    ghostCss: gCss,
    componentPath: cPath,
    componentArgs: cArgs,
  });

  inserted.dataset.twDroppedPatchId = patch.id;

  send({ type: 'COMPONENT_DROPPED', patch });

  // Clear stale selection state from the element that was selected before paste
  revertPreview();
  clearHighlights();
  clearSelectionState();

  cleanup();

  // Dispatch COMPONENT_PLACED to restart browse mode for rapid placement.
  // This sends COMPONENT_DISARMED to the panel and triggers start-browse.
  dispatch({ type: 'COMPONENT_PLACED' });
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function findGhostAncestor(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el.parentElement;
  while (current && current !== document.body) {
    if (current.dataset.twDroppedComponent) return current;
    current = current.parentElement;
  }
  return null;
}

export function buildSelector(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `#${el.id}`;
  const classes = Array.from(el.classList).slice(0, 3).join('.');
  return classes ? `${tag}.${classes}` : tag;
}

// ── Cleanup (mode-agnostic) ──────────────────────────────────────────────

function cleanup(): void {
  mode = { kind: 'idle' };
  document.documentElement.style.cursor = '';

  document.removeEventListener('mousemove', onMouseMove);
  document.documentElement.removeEventListener('mouseleave', onMouseLeave);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown);

  if (dom.cursorLabel) { dom.cursorLabel.remove(); dom.cursorLabel = null; }
  if (dom.indicator) { dom.indicator.remove(); dom.indicator = null; }
  if (dom.outlineEl) { dom.outlineEl.remove(); dom.outlineEl = null; }
  dom.arrowLeft = null;
  dom.arrowRight = null;
  dom.currentTarget = null;
  dom.currentPosition = null;

  // Dismiss slot picker if open
  dismissSlotPicker();

  // Clean up hover-to-preview
  if (dropPreview) {
    dropPreview.destroy();
    dropPreview = null;
  }
}

// ── Ghost CSS injection ──────────────────────────────────────────────────

/**
 * Inject collected ghost CSS into the target app's page head as a <style> tag.
 * Ensures all Tailwind utilities and component library CSS resolve for the
 * dropped ghost element, even if the target app's own build doesn't include them.
 */
export function injectGhostCss(componentName: string, css: string): void {
  const id = `vybit-ghost-css-${componentName}`;
  // Remove any existing ghost CSS for this component (refreshes on re-drop)
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}
