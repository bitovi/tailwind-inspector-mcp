// Drag-drop placement system for component drag-from-panel-to-page.
// Runs in the overlay (vanilla DOM — no React).
//
// Two event source paths converge on the same rendering code:
// - Iframe path: pointer-events:none on iframe, parent document pointermove
// - Popup path: postMessage with screenX/screenY from popup window
//
// Reuses drop-zone geometry (computeDropPosition, getAxis, findTarget) and
// placement logic (injectGhostCss, buildSelector, findGhostAncestor).

import { send, sendTo } from './ws';
import { buildContext } from './context';
import { getFiber, findOwningComponent } from './react/fiber';
import {
  computeDropPosition,
  getAxis,
  findTarget,
  buildSelector,
  findGhostAncestor,
  injectGhostCss,
  type DropPosition,
} from './drop-zone';
import { isDragMessage, type DragStartMessage } from '../../shared/drag-types';
import type { Patch } from '../../shared/types';
import { css, TEAL, CURSOR_LABEL, INDICATOR_BASE, ARROW_BASE, DASHED_BORDER, LINE_BASE, FIXED_OVERLAY } from './styles';
import { state } from './overlay-state';
import { GHOST_STYLE_RESET } from '../../shared/css-utils';
import { createAutoScroller } from '../../shared/auto-scroll';

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
}

let session: DragSession | null = null;

// ── DOM elements owned by the drag session ───────────────────────────────

interface DragDOM {
  preview: HTMLElement | null;
  indicator: HTMLElement | null;
  arrowLeft: HTMLElement | null;
  arrowRight: HTMLElement | null;
  currentTarget: HTMLElement | null;
  currentPosition: DropPosition | null;
  overlayHost: HTMLElement | null;
}

const dom: DragDOM = {
  preview: null,
  indicator: null,
  arrowLeft: null,
  arrowRight: null,
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

let onDragStartCallback: (() => void) | null = null;
let onDropCallback: ((el: HTMLElement) => void) | null = null;

// ── Public API ───────────────────────────────────────────────────────────

/** Returns true while a drag session is active (preview visible, waiting for drop). */
export function isDragActive(): boolean {
  return session !== null;
}

/**
 * Initialize the drag-drop listener. Call once from overlay init.
 * Listens for postMessage events with __vybitDrag marker.
 *
 * @param onStart — called when drag starts; use to cancel active selection/insertion
 * @param onDrop — called after a successful drop with the inserted element; use to select it
 */
export function initDragDrop(
  shadowHost: HTMLElement,
  onStart?: () => void,
  onDrop?: (el: HTMLElement) => void,
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
        const clientX = msg.screenX - window.screenX - (window.outerWidth - window.innerWidth);
        const clientY = msg.screenY - window.screenY - (window.outerHeight - window.innerHeight);
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
          const clientX = msg.screenX - window.screenX - (window.outerWidth - window.innerWidth);
          const clientY = msg.screenY - window.screenY - (window.outerHeight - window.innerHeight);
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

  session = {
    componentName: msg.componentName,
    storyId: msg.storyId,
    ghostHtml: msg.ghostHtml ?? null,
    ghostCss: msg.ghostCss ?? null,
    componentPath: msg.componentPath ?? '',
    componentArgs: msg.args ?? {},
    source: isPopup ? 'popup' : 'iframe',
  };

  // Notify overlay to cancel any active selection/insertion before drag
  if (onDragStartCallback) onDragStartCallback();
  state.exclusiveInteraction = 'component-drag';

  // Create drag preview
  const initClientX = msg.screenX - window.screenX - (window.outerWidth - window.innerWidth);
  const initClientY = msg.screenY - window.screenY - (window.outerHeight - window.innerHeight);
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
  if (session.ghostHtml) {
    renderGhostPreview(dom.preview, session.ghostHtml, session.ghostCss, msg.componentName);
  } else {
    // Fallback: text-only label until DRAG_GHOST_READY arrives
    renderTextPreview(dom.preview, msg.componentName);
  }
  document.body.appendChild(dom.preview);

  // Create indicator element (reuse same rendering as drop-zone)
  dom.indicator = document.createElement('div');
  dom.indicator.style.cssText = css(INDICATOR_BASE);
  document.body.appendChild(dom.indicator);

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

// ── Drag position update (shared by both paths) ─────────────────────────

function updateDragPosition(clientX: number, clientY: number): void {
  if (!session) return;

  // Move preview
  if (dom.preview) {
    dom.preview.style.left = `${clientX + 14}px`;
    dom.preview.style.top = `${clientY - 28}px`;
  }

  // Hit-test: hide preview/indicator to avoid self-hits
  if (dom.preview) dom.preview.style.display = 'none';
  if (dom.indicator) dom.indicator.style.display = 'none';
  const target = findTarget(clientX, clientY);
  if (dom.preview) dom.preview.style.display = 'flex';
  if (dom.indicator) dom.indicator.style.display = '';

  if (!target) {
    hideDropIndicator();
    autoScroller.stop();
    return;
  }

  const parentAxis = target.parentElement ? getAxis(target.parentElement) : 'vertical';
  const rect = target.getBoundingClientRect();
  const position = computeDropPosition({ x: clientX, y: clientY }, rect, parentAxis);

  dom.currentTarget = target;
  dom.currentPosition = position;
  showDropIndicator(target, position, parentAxis);

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

  // If ghost not ready yet, queue the drop
  if (!session.ghostHtml) {
    pendingDrop = { x: clientX, y: clientY };
    if (dom.preview) {
      dom.preview.innerHTML = '';
      renderTextPreview(dom.preview, `${session.componentName} (loading…)`);
    }
    return;
  }

  // Find the target at the drop point
  if (dom.preview) dom.preview.style.display = 'none';
  if (dom.indicator) dom.indicator.style.display = 'none';
  const target = findTarget(clientX, clientY);
  if (dom.preview) dom.preview.style.display = 'flex';

  if (!target) {
    endSession(true);
    return;
  }

  const parentAxis = target.parentElement ? getAxis(target.parentElement) : 'vertical';
  const rect = target.getBoundingClientRect();
  const position = computeDropPosition({ x: clientX, y: clientY }, rect, parentAxis);

  // Inject the ghost HTML
  const template = document.createElement('template');
  template.innerHTML = session.ghostHtml.trim();
  const inserted = template.content.firstElementChild as HTMLElement | null;
  if (!inserted) {
    endSession(true);
    return;
  }
  inserted.dataset.twDroppedComponent = session.componentName;

  switch (position) {
    case 'before':      target.insertAdjacentElement('beforebegin', inserted); break;
    case 'after':       target.insertAdjacentElement('afterend', inserted); break;
    case 'first-child': target.insertAdjacentElement('afterbegin', inserted); break;
    case 'last-child':  target.appendChild(inserted); break;
  }

  // Inject ghost CSS
  if (session.ghostCss) {
    injectGhostCss(session.componentName, session.ghostCss);
  }

  // Build patch
  const targetSelector = buildSelector(target);
  const isGhostTarget = !!target.dataset.twDroppedComponent;
  const ghostTargetPatchId = target.dataset.twDroppedPatchId;
  const ghostTargetName = target.dataset.twDroppedComponent;
  const ghostAncestor = !isGhostTarget ? findGhostAncestor(target) : null;
  const effectiveGhostName = isGhostTarget ? ghostTargetName : ghostAncestor?.dataset.twDroppedComponent;
  const effectiveGhostPatchId = isGhostTarget ? ghostTargetPatchId : ghostAncestor?.dataset.twDroppedPatchId;

  const context = effectiveGhostName
    ? `Place "${session.componentName}" ${position} the <${effectiveGhostName} /> component (pending insertion from an earlier drop)`
    : buildContext(target, '', '', new Map());

  let parentComponent: { name: string } | undefined;
  const fiber = getFiber(target);
  if (fiber) {
    const boundary = findOwningComponent(fiber);
    if (boundary) parentComponent = { name: boundary.componentName };
  }

  const patch: Patch = {
    id: crypto.randomUUID(),
    kind: 'component-drop',
    elementKey: targetSelector,
    status: 'staged',
    originalClass: '',
    newClass: '',
    property: 'component-drop',
    timestamp: new Date().toISOString(),
    component: { name: session.componentName },
    target: isGhostTarget
      ? { tag: ghostTargetName?.toLowerCase() ?? 'unknown', classes: '', innerText: '' }
      : {
          tag: target.tagName.toLowerCase(),
          classes: target.className,
          innerText: target.innerText.slice(0, 100),
        },
    ghostHtml: session.ghostHtml,
    ghostCss: session.ghostCss || undefined,
    componentStoryId: session.storyId,
    componentPath: session.componentPath || undefined,
    componentArgs: Object.keys(session.componentArgs).length > 0 ? session.componentArgs : undefined,
    parentComponent,
    insertMode: position,
    context,
    ...(effectiveGhostPatchId ? { targetPatchId: effectiveGhostPatchId, targetComponentName: effectiveGhostName } : {}),
  };

  inserted.dataset.twDroppedPatchId = patch.id;

  send({ type: 'COMPONENT_DROPPED', patch });

  // Select the newly dropped component
  if (onDropCallback) onDropCallback(inserted);

  endSession(false);
}

// ── Session cleanup ──────────────────────────────────────────────────────

function endSession(cancelled: boolean): void {
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
  dom.currentTarget = null;
  dom.currentPosition = null;
  pendingDrop = null;

  autoScroller.stop();

  state.exclusiveInteraction = null;
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

// ── Indicator rendering (mirrors drop-zone.ts logic) ─────────────────────

function showDropIndicator(target: HTMLElement, position: DropPosition, axis: 'vertical' | 'horizontal'): void {
  if (!dom.indicator) return;

  // Clear old arrows
  if (dom.arrowLeft) { dom.arrowLeft.remove(); dom.arrowLeft = null; }
  if (dom.arrowRight) { dom.arrowRight.remove(); dom.arrowRight = null; }

  const rect = target.getBoundingClientRect();
  const isInside = position === 'first-child' || position === 'last-child';

  if (isInside) {
    dom.indicator.style.cssText = css({
      ...FIXED_OVERLAY,
      ...DASHED_BORDER,
      zIndex: '2147483645',
      display: 'block',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
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
    dom.indicator.appendChild(arrow);
    dom.arrowLeft = arrow;
  } else {
    // Line mode (before/after)
    const lineWidth = 3;
    const isHorizontalLine = axis === 'vertical';

    if (isHorizontalLine) {
      const y = position === 'before' ? rect.top : rect.bottom;
      dom.indicator.style.cssText = css({
        ...LINE_BASE,
        zIndex: '2147483645',
        top: `${y - lineWidth / 2}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${lineWidth}px`,
        borderRadius: `${lineWidth}px`,
      });
    } else {
      const x = position === 'before' ? rect.left : rect.right;
      dom.indicator.style.cssText = css({
        ...LINE_BASE,
        zIndex: '2147483645',
        top: `${rect.top}px`,
        left: `${x - lineWidth / 2}px`,
        width: `${lineWidth}px`,
        height: `${rect.height}px`,
        borderRadius: `${lineWidth}px`,
      });
    }

    // Arrows on line ends
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

    dom.indicator.appendChild(arrowLeft);
    dom.indicator.appendChild(arrowRight);
    dom.arrowLeft = arrowLeft;
    dom.arrowRight = arrowRight;
  }
}

function hideDropIndicator(): void {
  if (dom.indicator) dom.indicator.style.display = 'none';
  if (dom.arrowLeft) { dom.arrowLeft.remove(); dom.arrowLeft = null; }
  if (dom.arrowRight) { dom.arrowRight.remove(); dom.arrowRight = null; }
  dom.currentTarget = null;
  dom.currentPosition = null;
}

// ── Auto-scroll (delegated to shared/auto-scroll.ts) ─────────────────────
