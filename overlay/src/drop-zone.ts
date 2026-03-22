// Drop-zone tracking system for component arm-and-place.
// Runs in the overlay (vanilla DOM — no React).
// Click-to-arm: user arms a component in the panel, then clicks in the app to place it.
// Shows a floating cursor label and teal drop indicator while armed.

import { send, sendTo } from './ws';
import { buildContext } from './context';
import { getFiber, findComponentBoundary } from './fiber';
import type { Patch } from '../../shared/types';

type DropPosition = 'before' | 'after' | 'first-child' | 'last-child';

// ── State ────────────────────────────────────────────────────────────────

let active = false;
let componentName = '';
let storyId = '';
let ghostHtml = '';
let componentPath = '';
let componentArgs: Record<string, unknown> = {};

let cursorLabelEl: HTMLElement | null = null;
let indicatorEl: HTMLElement | null = null;
let arrowLeftEl: HTMLElement | null = null;
let arrowRightEl: HTMLElement | null = null;
let currentTarget: HTMLElement | null = null;
let currentPosition: DropPosition | null = null;
let overlayHost: HTMLElement | null = null;

const TEAL = '#00848B';

// ── Public API ───────────────────────────────────────────────────────────

export function armInsert(
  msg: { componentName: string; storyId: string; ghostHtml: string; componentPath?: string; args?: Record<string, unknown> },
  shadowHost: HTMLElement,
): void {
  if (active) cleanup();
  active = true;
  componentName = msg.componentName;
  storyId = msg.storyId;
  ghostHtml = msg.ghostHtml;
  componentPath = msg.componentPath ?? '';
  componentArgs = msg.args ?? {};
  overlayHost = shadowHost;

  // Crosshair cursor on the entire page
  document.documentElement.style.cursor = 'crosshair';

  // Floating cursor label — teal pill that follows the cursor
  cursorLabelEl = document.createElement('div');
  cursorLabelEl.style.cssText =
    'position:fixed;pointer-events:none;z-index:2147483647;' +
    `background:${TEAL};color:#fff;font-size:11px;font-family:system-ui,sans-serif;` +
    'padding:3px 8px;border-radius:4px;white-space:nowrap;opacity:0;' +
    'box-shadow:0 2px 6px rgba(0,0,0,0.3);transition:opacity 0.1s;';
  cursorLabelEl.textContent = `Place: ${componentName}`;
  document.body.appendChild(cursorLabelEl);

  // Drop indicator (reused and repositioned on each move)
  indicatorEl = document.createElement('div');
  indicatorEl.style.cssText =
    'position:fixed;pointer-events:none;z-index:2147483645;display:none;';
  document.body.appendChild(indicatorEl);

  document.addEventListener('mousemove', onMouseMove);
  document.documentElement.addEventListener('mouseleave', onMouseLeave);
  document.addEventListener('click', onClick, true); // capture so we can prevent default
  document.addEventListener('keydown', onKeyDown);
}

export function cancelInsert(): void {
  cleanup();
}

export function isActive(): boolean {
  return active;
}

// ── Drop position computation (matches Phase 1 useDropZone logic) ────────

function getAxis(el: Element): 'vertical' | 'horizontal' {
  const style = getComputedStyle(el);
  if (style.display.includes('flex')) {
    return style.flexDirection.startsWith('row') ? 'horizontal' : 'vertical';
  }
  if (style.display.includes('grid')) {
    return style.gridAutoFlow.startsWith('column') ? 'horizontal' : 'vertical';
  }
  return 'vertical';
}

function computeDropPosition(
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

// ── Hit-test: find the deepest element under cursor ──────────────────────

function findTarget(x: number, y: number): HTMLElement | null {
  if (indicatorEl) indicatorEl.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  if (indicatorEl) indicatorEl.style.display = '';
  if (!el || el === document.documentElement || el === document.body) return null;
  // Skip overlay elements
  if (overlayHost && (el === overlayHost || overlayHost.contains(el))) return null;
  // Skip our own indicator
  if (indicatorEl && (el === indicatorEl || indicatorEl.contains(el))) return null;
  return el as HTMLElement;
}

// ── Indicator rendering (teal variant) ───────────────────────────────────

function showIndicator(target: HTMLElement, position: DropPosition, axis: 'vertical' | 'horizontal'): void {
  if (!indicatorEl) return;
  const rect = target.getBoundingClientRect();
  const isInside = position === 'first-child' || position === 'last-child';

  // Remove old arrows
  if (arrowLeftEl) { arrowLeftEl.remove(); arrowLeftEl = null; }
  if (arrowRightEl) { arrowRightEl.remove(); arrowRightEl = null; }

  if (isInside) {
    // Border highlight mode
    indicatorEl.style.cssText =
      `position:fixed;pointer-events:none;z-index:2147483645;` +
      `top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;` +
      `border:2px dashed ${TEAL};border-radius:4px;box-sizing:border-box;display:block;background:none;`;

    // Directional arrow inside the border
    const arrow = document.createElement('div');
    arrow.style.cssText = 'position:absolute;width:0;height:0;border-style:solid;';

    const size = 6;
    const isVertical = axis === 'vertical';

    if (position === 'first-child') {
      if (isVertical) {
        // Arrow pointing down at top edge
        arrow.style.top = '4px';
        arrow.style.left = '50%';
        arrow.style.transform = 'translateX(-50%)';
        arrow.style.borderWidth = `${size}px ${size}px 0 ${size}px`;
        arrow.style.borderColor = `${TEAL} transparent transparent transparent`;
      } else {
        // Arrow pointing right at left edge
        arrow.style.left = '4px';
        arrow.style.top = '50%';
        arrow.style.transform = 'translateY(-50%)';
        arrow.style.borderWidth = `${size}px 0 ${size}px ${size}px`;
        arrow.style.borderColor = `transparent transparent transparent ${TEAL}`;
      }
    } else {
      if (isVertical) {
        // Arrow pointing up at bottom edge
        arrow.style.bottom = '4px';
        arrow.style.left = '50%';
        arrow.style.transform = 'translateX(-50%)';
        arrow.style.borderWidth = `0 ${size}px ${size}px ${size}px`;
        arrow.style.borderColor = `transparent transparent ${TEAL} transparent`;
      } else {
        // Arrow pointing left at right edge
        arrow.style.right = '4px';
        arrow.style.top = '50%';
        arrow.style.transform = 'translateY(-50%)';
        arrow.style.borderWidth = `${size}px ${size}px ${size}px 0`;
        arrow.style.borderColor = `transparent ${TEAL} transparent transparent`;
      }
    }
    indicatorEl.appendChild(arrow);
    arrowLeftEl = arrow; // reuse reference for cleanup
  } else {
    // Line mode (before/after)
    const lineWidth = 3;
    const isHorizontalLine = axis === 'vertical'; // vertical layout → horizontal line

    if (isHorizontalLine) {
      const y = position === 'before' ? rect.top : rect.bottom;
      indicatorEl.style.cssText =
        `position:fixed;pointer-events:none;z-index:2147483645;display:block;` +
        `top:${y - lineWidth / 2}px;left:${rect.left}px;width:${rect.width}px;height:${lineWidth}px;` +
        `background:${TEAL};border-radius:${lineWidth}px;`;
    } else {
      const x = position === 'before' ? rect.left : rect.right;
      indicatorEl.style.cssText =
        `position:fixed;pointer-events:none;z-index:2147483645;display:block;` +
        `top:${rect.top}px;left:${x - lineWidth / 2}px;width:${lineWidth}px;height:${rect.height}px;` +
        `background:${TEAL};border-radius:${lineWidth}px;`;
    }

    // Inward-pointing arrow end-caps (>———<)
    const arrowSize = 5;
    const inset = -2;

    arrowLeftEl = document.createElement('div');
    arrowLeftEl.style.cssText = 'position:absolute;width:0;height:0;border-style:solid;';
    arrowRightEl = document.createElement('div');
    arrowRightEl.style.cssText = 'position:absolute;width:0;height:0;border-style:solid;';

    if (isHorizontalLine) {
      // Left arrow: > pointing right, positioned at left end
      arrowLeftEl.style.top = '50%';
      arrowLeftEl.style.left = `${inset}px`;
      arrowLeftEl.style.transform = 'translateY(-50%)';
      arrowLeftEl.style.borderWidth = `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`;
      arrowLeftEl.style.borderColor = `transparent transparent transparent ${TEAL}`;
      // Right arrow: < pointing left, positioned at right end
      arrowRightEl.style.top = '50%';
      arrowRightEl.style.right = `${inset}px`;
      arrowRightEl.style.transform = 'translateY(-50%)';
      arrowRightEl.style.borderWidth = `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`;
      arrowRightEl.style.borderColor = `transparent ${TEAL} transparent transparent`;
    } else {
      // Top arrow: v pointing down, positioned at top end
      arrowLeftEl.style.left = '50%';
      arrowLeftEl.style.top = `${inset}px`;
      arrowLeftEl.style.transform = 'translateX(-50%)';
      arrowLeftEl.style.borderWidth = `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`;
      arrowLeftEl.style.borderColor = `${TEAL} transparent transparent transparent`;
      // Bottom arrow: ^ pointing up, positioned at bottom end
      arrowRightEl.style.left = '50%';
      arrowRightEl.style.bottom = `${inset}px`;
      arrowRightEl.style.transform = 'translateX(-50%)';
      arrowRightEl.style.borderWidth = `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`;
      arrowRightEl.style.borderColor = `transparent transparent ${TEAL} transparent`;
    }

    indicatorEl.appendChild(arrowLeftEl);
    indicatorEl.appendChild(arrowRightEl);
  }
}

function hideIndicator(): void {
  if (indicatorEl) indicatorEl.style.display = 'none';
  if (arrowLeftEl) { arrowLeftEl.remove(); arrowLeftEl = null; }
  if (arrowRightEl) { arrowRightEl.remove(); arrowRightEl = null; }
  currentTarget = null;
  currentPosition = null;
}

// ── Event handlers ───────────────────────────────────────────────────────

function onMouseMove(e: MouseEvent): void {
  if (!active) return;

  // Move cursor label near the pointer
  if (cursorLabelEl) {
    cursorLabelEl.style.left = `${e.clientX + 14}px`;
    cursorLabelEl.style.top = `${e.clientY - 28}px`;
    cursorLabelEl.style.opacity = '1';
  }

  const target = findTarget(e.clientX, e.clientY);

  if (!target) {
    hideIndicator();
    return;
  }

  const parentAxis = target.parentElement ? getAxis(target.parentElement) : 'vertical';
  const rect = target.getBoundingClientRect();
  const position = computeDropPosition(
    { x: e.clientX, y: e.clientY },
    rect,
    parentAxis,
  );

  currentTarget = target;
  currentPosition = position;
  showIndicator(target, position, parentAxis);
}

function onMouseLeave(): void {
  hideIndicator();
  if (cursorLabelEl) cursorLabelEl.style.opacity = '0';
}

function onClick(e: MouseEvent): void {
  if (!active) return;
  if (!currentTarget || !currentPosition) {
    cleanup();
    sendTo('panel', { type: 'COMPONENT_DISARMED' });
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  // Insert the component HTML directly (no wrapper div — preserves inline flow)
  const template = document.createElement('template');
  template.innerHTML = ghostHtml.trim();
  const inserted = template.content.firstElementChild as HTMLElement | null;
  if (!inserted) {
    cleanup();
    sendTo('panel', { type: 'COMPONENT_DISARMED' });
    return;
  }
  inserted.dataset.twDroppedComponent = componentName;

  switch (currentPosition) {
    case 'before':
      currentTarget.insertAdjacentElement('beforebegin', inserted);
      break;
    case 'after':
      currentTarget.insertAdjacentElement('afterend', inserted);
      break;
    case 'first-child':
      currentTarget.insertAdjacentElement('afterbegin', inserted);
      break;
    case 'last-child':
      currentTarget.appendChild(inserted);
      break;
  }

  // Build a CSS selector for the target element
  const targetSelector = buildSelector(currentTarget);

  // Detect if the drop target is a ghost from an earlier component-drop
  const isGhostTarget = !!currentTarget.dataset.twDroppedComponent;
  const ghostTargetPatchId = currentTarget.dataset.twDroppedPatchId;
  const ghostTargetName = currentTarget.dataset.twDroppedComponent;

  // Also detect when the drop target is a child element INSIDE a ghost
  const ghostAncestor = !isGhostTarget ? findGhostAncestor(currentTarget) : null;
  const effectiveGhostName = isGhostTarget ? ghostTargetName : ghostAncestor?.dataset.twDroppedComponent;
  const effectiveGhostPatchId = isGhostTarget ? ghostTargetPatchId : ghostAncestor?.dataset.twDroppedPatchId;

  // Build rich context HTML (same as class-change and design patches)
  const context = effectiveGhostName
    ? `Place "${componentName}" ${currentPosition} the <${effectiveGhostName} /> component (pending insertion from an earlier drop)`
    : buildContext(currentTarget, '', '', new Map());

  // Resolve the parent React component via fiber walking
  let parentComponent: { name: string } | undefined;
  const fiber = getFiber(currentTarget);
  if (fiber) {
    const boundary = findComponentBoundary(fiber);
    if (boundary) {
      parentComponent = { name: boundary.componentName };
    }
  }

  // Stage a component-drop patch
  const patch: Patch = {
    id: crypto.randomUUID(),
    kind: 'component-drop',
    elementKey: targetSelector,
    status: 'staged',
    originalClass: '',
    newClass: '',
    property: 'component-drop',
    timestamp: new Date().toISOString(),
    component: { name: componentName },
    target: isGhostTarget
      ? { tag: ghostTargetName?.toLowerCase() ?? 'unknown', classes: '', innerText: '' }
      : {
          tag: currentTarget.tagName.toLowerCase(),
          classes: currentTarget.className,
          innerText: currentTarget.innerText.slice(0, 100),
        },
    ghostHtml,
    componentStoryId: storyId,
    componentPath: componentPath || undefined,
    componentArgs: Object.keys(componentArgs).length > 0 ? componentArgs : undefined,
    parentComponent,
    insertMode: currentPosition,
    context,
    ...(effectiveGhostPatchId ? { targetPatchId: effectiveGhostPatchId, targetComponentName: effectiveGhostName } : {}),
  };

  // Stamp the ghost with the patch ID so subsequent drops can reference it
  inserted.dataset.twDroppedPatchId = patch.id;

  send({ type: 'COMPONENT_DROPPED', patch });
  sendTo('panel', { type: 'COMPONENT_DISARMED' });

  cleanup();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    sendTo('panel', { type: 'COMPONENT_DISARMED' });
    cleanup();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function findGhostAncestor(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el.parentElement;
  while (current && current !== document.body) {
    if (current.dataset.twDroppedComponent) return current;
    current = current.parentElement;
  }
  return null;
}

function buildSelector(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `#${el.id}`;
  const classes = Array.from(el.classList).slice(0, 3).join('.');
  return classes ? `${tag}.${classes}` : tag;
}

function cleanup(): void {
  active = false;
  document.documentElement.style.cursor = '';
  document.removeEventListener('mousemove', onMouseMove);
  document.documentElement.removeEventListener('mouseleave', onMouseLeave);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown);

  if (cursorLabelEl) { cursorLabelEl.remove(); cursorLabelEl = null; }
  if (indicatorEl) { indicatorEl.remove(); indicatorEl = null; }
  arrowLeftEl = null;
  arrowRightEl = null;
  currentTarget = null;
  currentPosition = null;
}
