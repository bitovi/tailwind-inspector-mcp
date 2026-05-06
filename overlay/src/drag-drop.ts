// Drag-drop placement system for component drag-from-panel-to-page.
// Runs in the overlay (vanilla DOM — no React).
//
// Two event source paths converge on the same rendering code:
// - Iframe path: pointer-events:none on iframe, parent document pointermove
// - Popup path: postMessage with screenX/screenY from popup window
//
// Reuses drop-zone geometry (computeDropPosition, getAxis, findTarget),
// indicator rendering (renderIndicator), and patch building (buildComponentDropPatch).

import { send, sendTo } from './ws';
import {
  computeDropPosition,
  adjustForEdgeChild,
  getAxis,
  findTarget,
  injectGhostCss,
  renderIndicator,
  type DropPosition,
} from './drop-zone';
import { buildComponentDropPatch } from './patch-builder';
import { isDragMessage, type DragStartMessage, type CanvasDragEnterMessage, type CanvasDragMoveMessage, type CanvasDragDropMessage, type CanvasDragLeaveMessage } from '../../shared/drag-types';
import { css, TEAL, CURSOR_LABEL, INDICATOR_BASE, DASHED_BORDER, FIXED_OVERLAY } from './styles';
import { state } from './overlay-state';
import { dispatch } from './overlay-state-machine';
import { GHOST_STYLE_RESET } from '../../shared/css-utils';
import { createAutoScroller } from '../../shared/auto-scroll';
import { createDropPreview, type DropPreviewHandle } from './drop-preview';
import { detectComponent } from './framework-detect';
import { injectDesignCanvas } from './design-canvas-manager';

// ── Session state ────────────────────────────────────────────────────────

interface DragSession {
  componentName: string;
  storyId: string;
  ghostHtml: string | null;
  ghostCss: string | null;
  componentPath: string;
  componentArgs: Record<string, unknown>;
  /** 'iframe' = escape-the-iframe path, 'popup' = postMessage relay */
  source: 'iframe' | 'popup';
  /** Drag mode: 'replace' = Select active (outline + replace on drop), 'insert' = positional insert */
  mode: DragMode;
  /** When true, drop inserts a design canvas instead of a component. */
  canvasInsert: boolean;
  /** Insert mode context from the panel ('replace' | 'place'). */
  canvasInsertMode: string;
}

let session: DragSession | null = null;

/** Hover-to-preview handle for the current drag session. */
let dropPreview: DropPreviewHandle | null = null;

/** Design canvas iframe currently under the drag cursor (or null). */
let activeCanvasIframe: HTMLIFrameElement | null = null;

// ── DOM elements owned by the drag session ───────────────────────────────

interface DragDOM {
  preview: HTMLElement | null;
  indicator: HTMLElement | null;
  arrowLeft: HTMLElement | null;
  arrowRight: HTMLElement | null;
  replaceOutline: HTMLElement | null;
  currentTarget: HTMLElement | null;
  currentPosition: DropPosition | null;
  overlayHost: HTMLElement | null;
}

const dom: DragDOM = {
  preview: null,
  indicator: null,
  arrowLeft: null,
  arrowRight: null,
  replaceOutline: null,
  currentTarget: null,
  currentPosition: null,
  overlayHost: null,
};

// ── Auto-scroll ─────────────────────────────────────────────────────────

const autoScroller = createAutoScroller({
  edgeZone: 40,
  maxSpeed: 15,
  extraContainers: () => {
    const pw = document.getElementById('tw-page-wrapper');
    return pw ? [pw] : [];
  },
});

// ── Callbacks ────────────────────────────────────────────────────────────

let onDragStartCallback: (() => DragMode) | null = null;
let onDropCallback: ((el: HTMLElement, mode: DragMode) => void) | null = null;

/** Drag mode determined at drag-start from the active mode button state. */
export type DragMode = 'replace' | 'insert';

// ── Public API ───────────────────────────────────────────────────────────

/** Returns true while a drag session is active (preview visible, waiting for drop). */
export function isDragActive(): boolean {
  return session !== null;
}

/**
 * Initialize the drag-drop listener. Call once from overlay init.
 * Listens for postMessage events with __vybitDrag marker.
 *
 * @param onStart — called when drag starts; returns 'replace' (Select active) or 'insert'.
 *                  The callback should prepare mode state (e.g. activate Insert if idle)
 *                  but NOT clear the mode — it persists through the drag.
 * @param onDrop — called after a successful drop with the inserted element and the drag mode.
 *                 Use to select the element (replace mode) or skip selection (insert mode).
 */
export function initDragDrop(
  shadowHost: HTMLElement,
  onStart?: () => DragMode,
  onDrop?: (el: HTMLElement, mode: DragMode) => void,
): void {
  dom.overlayHost = shadowHost;
  onDragStartCallback = onStart ?? null;
  onDropCallback = onDrop ?? null;
  window.addEventListener('message', onPostMessage);
}

/** Tear down all listeners (for cleanup on overlay destruction). */
export function destroyDragDrop(): void {
  window.removeEventListener('message', onPostMessage);
  if (session) endSession(true);
}

// ── Coordinate conversion ────────────────────────────────────────────────

/** Convert drag message coords to parent-page clientX/clientY.
 *  For iframe source: uses iframe bounding rect + iframe-local clientX/clientY (accurate).
 *  For popup source: falls back to screenX→clientX conversion (less reliable). */
function toParentClient(msg: { screenX: number; screenY: number; clientX?: number; clientY?: number }): { clientX: number; clientY: number } {
  // Prefer iframe-local coords when available — avoids unreliable screen→client math
  if (msg.clientX != null && msg.clientY != null) {
    const iframe = findPanelIframe();
    if (iframe) {
      const rect = iframe.getBoundingClientRect();
      return { clientX: rect.x + msg.clientX, clientY: rect.y + msg.clientY };
    }
  }
  // Fallback: screen→client (popup path or missing iframe)
  return {
    clientX: msg.screenX - window.screenX - (window.outerWidth - window.innerWidth),
    clientY: msg.screenY - window.screenY - (window.outerHeight - window.innerHeight),
  };
}

// ── postMessage handler ──────────────────────────────────────────────────

function onPostMessage(event: MessageEvent): void {
  if (!isDragMessage(event.data)) return;
  const msg = event.data;

  switch (msg.type) {
    case 'DRAG_START':
      handleDragStart(msg);
      break;
    case 'DRAG_MOVE':
      if (session) {
        const { clientX, clientY } = toParentClient(msg);
        updateDragPosition(clientX, clientY);
      }
      break;
    case 'DRAG_GHOST_READY':
      if (session) {
        session.ghostHtml = msg.ghostHtml;
        session.ghostCss = msg.ghostCss;
        // Upgrade the drag preview from text label to visual ghost thumbnail
        if (dom.preview) {
          dom.preview.innerHTML = '';
          renderGhostPreview(dom.preview, msg.ghostHtml, msg.ghostCss, session.componentName);
        }
        // If we had a pending drop, execute it now
        if (pendingDrop) {
          const { x, y } = pendingDrop;
          pendingDrop = null;
          executeDrop(x, y);
        }
      }
      break;
    case 'DRAG_END':
      if (session) {
        if (msg.cancelled) {
          endSession(true);
        } else {
          const { clientX, clientY } = toParentClient(msg);
          executeDrop(clientX, clientY);
        }
      }
      break;
  }
}

let pendingDrop: { x: number; y: number } | null = null;

// ── Drag start ───────────────────────────────────────────────────────────

function handleDragStart(msg: DragStartMessage): void {
  // Determine source: if the message came from an iframe child, it's iframe path
  const isPopup = !isFromIframe(msg);

  // Determine drag mode from the callback (which reads + prepares mode state)
  const dragMode: DragMode = onDragStartCallback ? onDragStartCallback() : 'insert';

  session = {
    componentName: msg.componentName,
    storyId: msg.storyId,
    ghostHtml: msg.ghostHtml ?? null,
    ghostCss: msg.ghostCss ?? null,
    componentPath: msg.componentPath ?? '',
    componentArgs: msg.args ?? {},
    source: isPopup ? 'popup' : 'iframe',
    mode: dragMode,
    canvasInsert: msg.canvasInsert ?? false,
    canvasInsertMode: msg.canvasInsertMode ?? 'place',
  };

  dispatch({ type: 'COMPONENT_DRAG_START', mode: dragMode });

  // Create drag preview
  const { clientX: initClientX, clientY: initClientY } = toParentClient(msg);
  dom.preview = document.createElement('div');
  dom.preview.style.cssText = css({
    ...FIXED_OVERLAY,
    zIndex: '2147483647',
    opacity: '0.9',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    pointerEvents: 'none',
    left: `${initClientX + 14}px`,
    top: `${initClientY - 28}px`,
  });

  // If ghost HTML is already available, render a visual thumbnail
  if (session.canvasInsert) {
    renderTextPreview(dom.preview, '🎨 Canvas');
  } else if (session.ghostHtml) {
    renderGhostPreview(dom.preview, session.ghostHtml, session.ghostCss, msg.componentName);
  } else {
    // Fallback: text-only label until DRAG_GHOST_READY arrives
    renderTextPreview(dom.preview, msg.componentName);
  }
  document.body.appendChild(dom.preview);

  // Create indicator element (reuse same rendering as drop-zone) — used for insert mode
  dom.indicator = document.createElement('div');
  dom.indicator.style.cssText = css(INDICATOR_BASE);
  document.body.appendChild(dom.indicator);

  // Create replace-mode outline element — used for replace mode (dashed teal border)
  dom.replaceOutline = document.createElement('div');
  dom.replaceOutline.style.cssText = css({
    ...FIXED_OVERLAY,
    ...DASHED_BORDER,
    zIndex: '2147483645',
    display: 'none',
    pointerEvents: 'none',
    background: 'rgba(0,132,139,0.06)',
  });
  document.body.appendChild(dom.replaceOutline);

  if (session.source === 'iframe') {
    // Escape the iframe: disable pointer events on the panel iframe
    const iframe = findPanelIframe();
    if (iframe) {
      iframe.style.pointerEvents = 'none';
    }
    // Capture pointermove on the parent document (fallback — may not fire
    // if browser retains implicit pointer capture on the iframe)
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }

  // Escape key cancels in both paths
  document.addEventListener('keydown', onKeyDown);

  // Initialize hover-to-preview
  dropPreview = createDropPreview(() => {
    hideDropIndicator();
    hideReplaceOutline();
  });
}

// ── Iframe detection ─────────────────────────────────────────────────────

function isFromIframe(msg: DragStartMessage): boolean {
  // If postMessage source is an iframe in our shadow DOM, it's the iframe path
  // We check by looking for the panel iframe element
  const iframe = findPanelIframe();
  return iframe !== null;
}

function findPanelIframe(): HTMLIFrameElement | null {
  if (!dom.overlayHost) return null;
  const shadow = dom.overlayHost.shadowRoot;
  if (!shadow) return null;
  // Panel iframe is inside a container div in the shadow DOM
  return shadow.querySelector('iframe') as HTMLIFrameElement | null;
}

// ── Design canvas detection ──────────────────────────────────────────────

/** Find the design canvas iframe if the given point is over a `<vb-design-canvas>`. */
function findDesignCanvasAt(clientX: number, clientY: number): HTMLIFrameElement | null {
  // Hide drag DOM elements to avoid self-hits
  if (dom.preview) dom.preview.style.display = 'none';
  if (dom.indicator) dom.indicator.style.display = 'none';
  if (dom.replaceOutline) dom.replaceOutline.style.display = 'none';

  const el = document.elementFromPoint(clientX, clientY);

  if (dom.preview) dom.preview.style.display = 'flex';
  if (dom.indicator) dom.indicator.style.display = '';

  if (!el || !(el instanceof HTMLElement)) return null;

  // Walk up to find a [data-tw-design-canvas] wrapper
  const canvasWrapper = el.closest('[data-tw-design-canvas]');
  if (!canvasWrapper) return null;

  const iframe = canvasWrapper.querySelector('iframe');
  return iframe as HTMLIFrameElement | null;
}

/** Convert parent-page clientX/Y to coordinates relative to the design canvas iframe. */
function toCanvasLocal(iframe: HTMLIFrameElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = iframe.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/** Send a postMessage to the design canvas iframe. */
function postToCanvas(iframe: HTMLIFrameElement, msg: CanvasDragEnterMessage | CanvasDragMoveMessage | CanvasDragDropMessage | CanvasDragLeaveMessage): void {
  if (iframe.contentWindow) {
    iframe.contentWindow.postMessage(msg, '*');
  }
}

// ── Drag position update (shared by both paths) ─────────────────────────

function updateDragPosition(clientX: number, clientY: number): void {
  if (!session) return;

  // Move floating cursor preview (always, even during locked preview)
  if (dom.preview) {
    dom.preview.style.left = `${clientX + 14}px`;
    dom.preview.style.top = `${clientY - 28}px`;
  }

  // If a drop preview is active and cursor is still inside the pre-reflow rect,
  // skip hit-testing entirely — the live preview holds stable.
  if (dropPreview?.isInsideLockedRect(clientX, clientY)) {
    return;
  }

  // ── Design canvas detection ──────────────────────────────────────────
  // Check if the cursor is over a design canvas iframe. If so, relay drag
  // coordinates to the canvas via postMessage instead of doing page hit-testing.
  // Skip for canvas-insert drags (can't drop a canvas onto a canvas).
  const canvasIframe = session.canvasInsert ? null : findDesignCanvasAt(clientX, clientY);
  if (canvasIframe && session.ghostHtml) {
    const local = toCanvasLocal(canvasIframe, clientX, clientY);

    // Hide the floating drag preview while over the canvas — the canvas
    // shows its own placement indicator, so the preview is just clutter.
    if (dom.preview) dom.preview.style.display = 'none';

    if (activeCanvasIframe !== canvasIframe) {
      // Left a previous canvas? Send leave.
      if (activeCanvasIframe) {
        postToCanvas(activeCanvasIframe, { __vybitCanvasDrag: true, type: 'CANVAS_DRAG_LEAVE' });
      }
      activeCanvasIframe = canvasIframe;
      // Entered a new canvas — send enter with full component data.
      postToCanvas(canvasIframe, {
        __vybitCanvasDrag: true,
        type: 'CANVAS_DRAG_ENTER',
        componentName: session.componentName,
        storyId: session.storyId,
        ghostHtml: session.ghostHtml,
        ghostCss: session.ghostCss,
        componentPath: session.componentPath,
        args: session.componentArgs,
        x: local.x,
        y: local.y,
      });
    } else {
      // Still over the same canvas — send move.
      postToCanvas(canvasIframe, {
        __vybitCanvasDrag: true,
        type: 'CANVAS_DRAG_MOVE',
        x: local.x,
        y: local.y,
      });
    }

    // Hide page-level indicators while over the canvas
    hideDropIndicator();
    hideReplaceOutline();
    dropPreview?.clear();
    autoScroller.stop();
    return;
  }

  // Cursor left the design canvas — notify it and restore drag preview
  if (activeCanvasIframe) {
    postToCanvas(activeCanvasIframe, { __vybitCanvasDrag: true, type: 'CANVAS_DRAG_LEAVE' });
    activeCanvasIframe = null;
    if (dom.preview) dom.preview.style.display = 'flex';
  }

  // Hit-test: hide preview/indicator/outline to avoid self-hits
  if (dom.preview) dom.preview.style.display = 'none';
  if (dom.indicator) dom.indicator.style.display = 'none';
  if (dom.replaceOutline) dom.replaceOutline.style.display = 'none';
  const target = findTarget(clientX, clientY);
  if (dom.preview) dom.preview.style.display = 'flex';
  if (dom.indicator) dom.indicator.style.display = '';

  if (!target) {
    hideDropIndicator();
    hideReplaceOutline();
    dropPreview?.clear();
    autoScroller.stop();
    return;
  }

  if (session.mode === 'replace' && !session.canvasInsert) {
    // Replace mode: show dashed teal outline around the target element
    hideDropIndicator();
    showReplaceOutline(target);
    dom.currentTarget = target;
    dom.currentPosition = null;

    // Start/update hover-to-preview timer (replace)
    if (session.ghostHtml && dropPreview) {
      dropPreview.update(target, 'replace', session.ghostHtml, session.ghostCss, clientX, clientY);
    }
  } else {
    // Insert mode: show positional line indicator
    hideReplaceOutline();
    const parentAxis = target.parentElement ? getAxis(target.parentElement) : 'vertical';
    const rect = target.getBoundingClientRect();
    const rawPosition = computeDropPosition({ x: clientX, y: clientY }, rect, parentAxis);
    const adjusted = adjustForEdgeChild(target, rawPosition);

    dom.currentTarget = adjusted.target;
    dom.currentPosition = adjusted.position;
    const indicatorAxis = adjusted.target.parentElement ? getAxis(adjusted.target.parentElement) : 'vertical';
    showDropIndicator(adjusted.target, adjusted.position, indicatorAxis);

    // Start/update hover-to-preview timer (insert) — skip for canvas-insert drags
    if (session.ghostHtml && dropPreview && !session.canvasInsert) {
      dropPreview.update(adjusted.target, adjusted.position, session.ghostHtml, session.ghostCss, clientX, clientY);
    }
  }

  // Auto-scroll
  autoScroller.update(clientX, clientY, target);
}

// ── Event handlers (iframe path) ─────────────────────────────────────────

function onPointerMove(e: PointerEvent): void {
  updateDragPosition(e.clientX, e.clientY);
}

function onPointerUp(e: PointerEvent): void {
  if (!session) return;
  executeDrop(e.clientX, e.clientY);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && session) {
    endSession(true);
  }
}

// ── Drop execution ───────────────────────────────────────────────────────

function executeDrop(clientX: number, clientY: number): void {
  if (!session) return;

  // ── Canvas-insert drag: insert a design canvas at the drop position ──
  if (session.canvasInsert) {
    dropPreview?.clear();

    // Find the target at the drop point
    if (dom.preview) dom.preview.style.display = 'none';
    if (dom.indicator) dom.indicator.style.display = 'none';
    if (dom.replaceOutline) dom.replaceOutline.style.display = 'none';
    const hitTarget = findTarget(clientX, clientY);
    if (dom.preview) dom.preview.style.display = 'flex';

    if (!hitTarget) {
      endSession(true);
      return;
    }

    const isReplace = session.canvasInsertMode === 'replace';
    let canvasTarget = hitTarget;
    let insertMode: string;

    if (isReplace) {
      insertMode = 'replace';
    } else {
      const parentAxis = canvasTarget.parentElement ? getAxis(canvasTarget.parentElement) : 'vertical';
      const rect = canvasTarget.getBoundingClientRect();
      const rawPos = computeDropPosition({ x: clientX, y: clientY }, rect, parentAxis);
      const adj = adjustForEdgeChild(canvasTarget, rawPos);
      canvasTarget = adj.target;
      insertMode = adj.position;
    }

    // Set overlay state needed by injectDesignCanvas
    const boundary = detectComponent(canvasTarget);
    state.currentTargetEl = canvasTarget;
    state.currentBoundary = boundary
      ? { componentName: boundary.componentName }
      : { componentName: canvasTarget.tagName.toLowerCase() };
    state.currentEquivalentNodes = [canvasTarget];

    injectDesignCanvas(insertMode as any);
    endSession(false);
    return;
  }

  // If ghost not ready yet, queue the drop
  if (!session.ghostHtml) {
    pendingDrop = { x: clientX, y: clientY };
    if (dom.preview) {
      dom.preview.innerHTML = '';
      renderTextPreview(dom.preview, `${session.componentName} (loading…)`);
    }
    return;
  }

  // ── Design canvas drop ──────────────────────────────────────────────
  // If cursor is over a design canvas, forward the drop to the canvas iframe.
  const canvasIframe = activeCanvasIframe ?? findDesignCanvasAt(clientX, clientY);
  if (canvasIframe) {
    const local = toCanvasLocal(canvasIframe, clientX, clientY);
    postToCanvas(canvasIframe, {
      __vybitCanvasDrag: true,
      type: 'CANVAS_DRAG_DROP',
      x: local.x,
      y: local.y,
    });
    activeCanvasIframe = null;
    endSession(false);
    return;
  }

  // If hover-to-preview is active, finalize it — the element is already in the DOM.
  const finalizeResult = dropPreview?.isActive() ? dropPreview!.finalize() : null;

  let inserted: HTMLElement;
  let target: HTMLElement;
  let position: DropPosition | 'replace';

  if (finalizeResult) {
    // Preview was showing — use the already-inserted element and its tracked target/position.
    inserted = finalizeResult.element;
    target = finalizeResult.target;
    position = finalizeResult.position;
    inserted.dataset.twDroppedComponent = session.componentName;
  } else {
    // No preview — standard insertion path.
    dropPreview?.clear();

    // Find the target at the drop point
    if (dom.preview) dom.preview.style.display = 'none';
    if (dom.indicator) dom.indicator.style.display = 'none';
    if (dom.replaceOutline) dom.replaceOutline.style.display = 'none';
    const hitTarget = findTarget(clientX, clientY);
    if (dom.preview) dom.preview.style.display = 'flex';

    if (!hitTarget) {
      endSession(true);
      return;
    }
    target = hitTarget;

    // Inject the ghost HTML
    const template = document.createElement('template');
    template.innerHTML = session.ghostHtml.trim();
    const el = template.content.firstElementChild as HTMLElement | null;
    if (!el) {
      endSession(true);
      return;
    }
    inserted = el;
    inserted.dataset.twDroppedComponent = session.componentName;

    // Determine insert mode and position based on drag mode
    const isReplace = session.mode === 'replace';

    if (isReplace) {
      // Replace mode: insert before target and hide it
      target.insertAdjacentElement('beforebegin', inserted);
      target.style.display = 'none';
      position = 'replace';
    } else {
      // Insert mode: positional placement
      const parentAxis = target.parentElement ? getAxis(target.parentElement) : 'vertical';
      const rect = target.getBoundingClientRect();
      const rawPos = computeDropPosition({ x: clientX, y: clientY }, rect, parentAxis);
      const adj = adjustForEdgeChild(target, rawPos);
      target = adj.target;
      position = adj.position;

      switch (position) {
        case 'before':      target.insertAdjacentElement('beforebegin', inserted); break;
        case 'after':       target.insertAdjacentElement('afterend', inserted); break;
        case 'first-child': target.insertAdjacentElement('afterbegin', inserted); break;
        case 'last-child':  target.appendChild(inserted); break;
      }
    }
  }

  // Inject ghost CSS
  if (session.ghostCss) {
    injectGhostCss(session.componentName, session.ghostCss);
  }

  // Build patch
  const patch = buildComponentDropPatch({
    target,
    position,
    componentName: session.componentName,
    storyId: session.storyId,
    ghostHtml: session.ghostHtml!,
    ghostCss: session.ghostCss ?? undefined,
    componentPath: session.componentPath,
    componentArgs: session.componentArgs,
  });

  inserted.dataset.twDroppedPatchId = patch.id;

  send({ type: 'COMPONENT_DROPPED', patch });

  // Notify caller of successful drop (with mode so caller can decide selection behavior)
  if (onDropCallback) onDropCallback(inserted, session.mode);

  endSession(false);
}

// ── Session cleanup ──────────────────────────────────────────────────────

function endSession(cancelled: boolean): void {
  // Clean up hover-to-preview
  if (dropPreview) {
    dropPreview.destroy();
    dropPreview = null;
  }

  // Notify any active design canvas that the drag ended
  if (activeCanvasIframe) {
    postToCanvas(activeCanvasIframe, { __vybitCanvasDrag: true, type: 'CANVAS_DRAG_LEAVE' });
    activeCanvasIframe = null;
  }

  // Remove event listeners
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  document.removeEventListener('keydown', onKeyDown);

  // Restore pointer events on panel iframe
  const iframe = findPanelIframe();
  if (iframe) {
    iframe.style.pointerEvents = '';
  }

  // Clean up DOM
  if (dom.preview) { dom.preview.remove(); dom.preview = null; }
  if (dom.indicator) { dom.indicator.remove(); dom.indicator = null; }
  if (dom.arrowLeft) { dom.arrowLeft.remove(); dom.arrowLeft = null; }
  if (dom.arrowRight) { dom.arrowRight.remove(); dom.arrowRight = null; }
  if (dom.replaceOutline) { dom.replaceOutline.remove(); dom.replaceOutline = null; }
  dom.currentTarget = null;
  dom.currentPosition = null;
  pendingDrop = null;

  autoScroller.stop();

  dispatch({ type: cancelled ? 'COMPONENT_DRAG_CANCELLED' : 'COMPONENT_DRAG_DROPPED' });
  session = null;
}

// ── Drag preview rendering ───────────────────────────────────────────────

const PREVIEW_MAX_W = 80;
const PREVIEW_MAX_H = 56;

/** Render a text-only label into the preview container. */
function renderTextPreview(container: HTMLElement, text: string): void {
  const label = document.createElement('div');
  label.style.cssText = css({
    ...CURSOR_LABEL,
    position: 'relative',
    opacity: '1',
    display: 'block',
    fontSize: '12px',
    padding: '6px 12px',
  });
  label.textContent = text;
  container.appendChild(label);
}

/** Render ghost HTML as a scaled thumbnail inside a shadow DOM, with a name label. */
function renderGhostPreview(container: HTMLElement, ghostHtml: string, ghostCss: string | null, componentName: string): void {
  // Thumbnail container — use max-width so it shrinks to content
  const thumb = document.createElement('div');
  thumb.style.cssText = css({
    maxWidth: `${PREVIEW_MAX_W}px`,
    maxHeight: `${PREVIEW_MAX_H}px`,
    overflow: 'hidden',
    borderRadius: '6px',
    background: '#ffffff',
    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
    border: `2px solid ${TEAL}`,
    position: 'relative',
    visibility: 'hidden',
  });

  // Shadow DOM host for CSS isolation
  const ghostHost = document.createElement('div');
  ghostHost.style.cssText = 'overflow:hidden;width:max-content;';
  const shadow = ghostHost.attachShadow({ mode: 'open' });
  const hostReset = `:host{${GHOST_STYLE_RESET}}`;
  const cssBlock = ghostCss ? `${hostReset}${ghostCss}` : hostReset;
  shadow.innerHTML = `<style>${cssBlock}</style><div style="pointer-events:none;transform-origin:top left;width:max-content" id="ghost-content">${ghostHtml}</div>`;
  thumb.appendChild(ghostHost);
  container.appendChild(thumb);

  // Measure and scale to fit after the browser lays it out
  requestAnimationFrame(() => {
    const content = shadow.getElementById('ghost-content');
    if (!content) return;
    const w = content.scrollWidth;
    const h = content.scrollHeight;
    if (w > 0 && h > 0) {
      const scale = Math.min(PREVIEW_MAX_W / w, PREVIEW_MAX_H / h, 1.0);
      content.style.transform = `scale(${scale})`;
      const scaledW = Math.ceil(w * scale);
      const scaledH = Math.ceil(h * scale);
      ghostHost.style.width = `${scaledW}px`;
      ghostHost.style.height = `${scaledH}px`;
      thumb.style.width = `${scaledW}px`;
      thumb.style.height = `${scaledH}px`;
    }
    thumb.style.visibility = 'visible';
  });

  // Name label below thumbnail
  const label = document.createElement('div');
  label.style.cssText = css({
    ...CURSOR_LABEL,
    position: 'relative',
    opacity: '1',
    display: 'block',
    fontSize: '10px',
    padding: '2px 8px',
  });
  label.textContent = componentName;
  container.appendChild(label);
}

// ── Indicator rendering (delegates to shared renderIndicator) ─────────────

function showDropIndicator(target: HTMLElement, position: DropPosition, axis: 'vertical' | 'horizontal'): void {
  if (!dom.indicator) return;

  // Clear previous content
  dom.indicator.innerHTML = '';

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

// ── Replace-mode outline (dashed teal border around hover target) ────────

function showReplaceOutline(target: HTMLElement): void {
  if (!dom.replaceOutline) return;
  const rect = target.getBoundingClientRect();
  dom.replaceOutline.style.display = 'block';
  dom.replaceOutline.style.top = `${rect.top}px`;
  dom.replaceOutline.style.left = `${rect.left}px`;
  dom.replaceOutline.style.width = `${rect.width}px`;
  dom.replaceOutline.style.height = `${rect.height}px`;
}

function hideReplaceOutline(): void {
  if (dom.replaceOutline) dom.replaceOutline.style.display = 'none';
}

// ── Auto-scroll (delegated to shared/auto-scroll.ts) ─────────────────────
