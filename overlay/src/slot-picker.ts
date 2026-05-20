// Slot picker — insertion point disambiguation.
// When the user clicks near tightly packed sibling boundaries in insert mode,
// or on nested elements that share the same bounding rect, multiple valid
// insertion slots exist at the same pixel. This module detects those ambiguous
// slots and shows a picker so the user can choose the exact position they want.

import { computePosition, offset, flip, shift } from "@floating-ui/dom";
import { dom } from "./overlay-dom";
import { detectComponent } from "./framework-detect";
import { getAxis } from "../../shared/drop-geometry";
import type { DropPosition } from "../../shared/drop-geometry";

const BOUNDARY_THRESHOLD = 3; // px — how close to an edge counts as ambiguous
const RECT_THRESHOLD = 2;     // px — tolerance for "same rect" (matches depth-picker)

export interface SlotCandidate {
  target: HTMLElement;
  position: DropPosition;
  label: string;           // e.g. "↳ start" or "↑ before" or "↓ after"
  tag: string;             // e.g. "div", "a"
  componentName: string | null;
  classes: string;         // full className string
  depth: number;           // nesting depth for indentation (0 = innermost)
}

/**
 * Given a click point and the currently resolved target + position,
 * check whether the click is ambiguous — either because:
 *   1. Multiple sibling edges are within BOUNDARY_THRESHOLD of the cursor, or
 *   2. Multiple nested elements share the same bounding rect (same-rect wrappers)
 *
 * Returns the list of candidate slots (>1), or an empty array if unambiguous.
 */
export function findAmbiguousSlots(
  cx: number,
  cy: number,
  target: HTMLElement,
  position: DropPosition,
): SlotCandidate[] {
  const candidates: SlotCandidate[] = [];

  console.log('[slot-picker] findAmbiguousSlots called', {
    cx, cy,
    target: target.tagName.toLowerCase(),
    targetClasses: target.className,
    position,
    childCount: target.children.length,
    firstChild: target.firstElementChild?.tagName,
  });

  // ── Check 1: Same-rect ancestor stack ──
  const sameRectCandidates = findSameRectInsertSlots(cx, cy, target, position);
  console.log('[slot-picker] Check 1 (same-rect):', sameRectCandidates.length, 'candidates');
  candidates.push(...sameRectCandidates);

  // ── Check 2: Sibling boundary proximity ──
  const siblingCandidates = findSiblingBoundarySlots(cx, cy, target, position);
  console.log('[slot-picker] Check 2 (sibling):', siblingCandidates.length, 'candidates');
  candidates.push(...siblingCandidates);

  // ── Check 3: Edge ambiguity ──
  const edgeCandidates = findEdgeChildSlots(cx, cy, target, position);
  console.log('[slot-picker] Check 3 (edge-child):', edgeCandidates.length, 'candidates');
  candidates.push(...edgeCandidates);

  console.log('[slot-picker] Total before dedup:', candidates.length, candidates.map(c => `${c.position}@${c.tag}.${c.classes.split(' ')[0]}`));

  // Deduplicate by target+position
  const seen = new Set<string>();
  const unique = candidates.filter(c => {
    const key = `${elId(c.target)}:${c.position}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Deduplicate equivalent DOM insertion points:
  // "after A" ≡ "before A.nextElementSibling" (adjacent siblings)
  // "first-child C" ≡ "before C.firstElementChild"
  // "last-child C" ≡ "after C.lastElementChild"
  const removed = new Set<number>();
  for (let i = 0; i < unique.length; i++) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < unique.length; j++) {
      if (removed.has(j)) continue;
      if (areSameInsertionPoint(unique[i], unique[j])) {
        removed.add(j);
      }
    }
  }
  const deduped = unique.filter((_, i) => !removed.has(i));

  console.log('[slot-picker] After dedup:', deduped.length, 'candidates', deduped.map(c => `${c.position}@<${c.tag}>`));
  if (removed.size > 0) {
    console.log('[slot-picker] Removed', removed.size, 'equivalent insertion points');
  }

  // Only show picker if there are genuinely multiple options
  return deduped.length > 1 ? deduped : [];
}

/**
 * Two candidates represent the same DOM insertion point if:
 * - "after A" and "before B" where B is A's next sibling
 * - "first-child C" and "before C's first child"
 * - "last-child C" and "after C's last child"
 */
function areSameInsertionPoint(a: SlotCandidate, b: SlotCandidate): boolean {
  if (a.position === 'after' && b.position === 'before'
      && a.target.nextElementSibling === b.target) return true;
  if (b.position === 'after' && a.position === 'before'
      && b.target.nextElementSibling === a.target) return true;

  if (a.position === 'first-child' && b.position === 'before'
      && a.target.firstElementChild === b.target) return true;
  if (b.position === 'first-child' && a.position === 'before'
      && b.target.firstElementChild === a.target) return true;

  if (a.position === 'last-child' && b.position === 'after'
      && a.target.lastElementChild === b.target) return true;
  if (b.position === 'last-child' && a.position === 'after'
      && b.target.lastElementChild === a.target) return true;

  return false;
}

/** Check if two DOMRects match within the threshold. */
function rectsMatch(a: DOMRect, b: DOMRect): boolean {
  return (
    Math.abs(a.top - b.top) <= RECT_THRESHOLD &&
    Math.abs(a.left - b.left) <= RECT_THRESHOLD &&
    Math.abs(a.width - b.width) <= RECT_THRESHOLD &&
    Math.abs(a.height - b.height) <= RECT_THRESHOLD
  );
}

/**
 * Walk up from the target, collecting insertion slots for each ancestor
 * whose bounding rect matches the target's (same-rect wrappers).
 * For each matching layer, offer first-child and last-child slots.
 */
function findSameRectInsertSlots(
  cx: number,
  cy: number,
  target: HTMLElement,
  position: DropPosition,
): SlotCandidate[] {
  const candidates: SlotCandidate[] = [];

  // Determine the innermost element — if position is first/last-child,
  // target is the container; we want to start from its first child.
  const isInside = position === 'first-child' || position === 'last-child';
  const startEl = isInside && target.firstElementChild
    ? target.firstElementChild as HTMLElement
    : target;

  const startRect = startEl.getBoundingClientRect();

  // Always include the current resolved slot
  {
    const tag = target.tagName.toLowerCase();
    const comp = detectComponent(target);
    const classes = typeof target.className === "string" ? target.className : "";
    candidates.push({
      target,
      position,
      label: positionLabel(position),
      tag,
      componentName: comp?.componentName ?? null,
      classes,
      depth: 0,
    });
  }

  // Walk up from startEl, checking each parent for same-rect match
  let depth = 1;
  let el: HTMLElement | null = startEl.parentElement;
  while (el) {
    if (
      el === dom.shadowHost ||
      el === document.body ||
      el === document.documentElement
    ) break;

    const parentRect = el.getBoundingClientRect();
    if (!rectsMatch(startRect, parentRect)) break;

    // This parent shares the same rect — only offer the same position
    // type as the original click (start stays start, end stays end)
    const cls = typeof el.className === "string" ? el.className : "";
    if (cls.trim()) {
      addCandidate(candidates, el, position, el, depth);
      depth++;
    }

    el = el.parentElement;
  }

  return candidates;
}

/**
 * Check sibling edges within BOUNDARY_THRESHOLD of the cursor.
 */
function findSiblingBoundarySlots(
  cx: number,
  cy: number,
  target: HTMLElement,
  position: DropPosition,
): SlotCandidate[] {
  const parent = target.parentElement;
  if (!parent) return [];

  const isInside = position === 'first-child' || position === 'last-child';
  const container = isInside ? target : parent;
  const children = Array.from(container.children) as HTMLElement[];
  if (children.length === 0) return [];

  const axis = getAxis(container);
  const candidates: SlotCandidate[] = [];

  for (let i = 0; i < children.length; i++) {
    const rect = children[i].getBoundingClientRect();

    const leadingDist = axis === 'horizontal'
      ? Math.abs(cx - rect.left)
      : Math.abs(cy - rect.top);

    const trailingDist = axis === 'horizontal'
      ? Math.abs(cx - rect.right)
      : Math.abs(cy - rect.bottom);

    if (leadingDist <= BOUNDARY_THRESHOLD) {
      addCandidate(candidates, children[i], 'before', container);
      if (i > 0) {
        addCandidate(candidates, children[i - 1], 'after', container);
      } else {
        addCandidate(candidates, container, 'first-child', container);
      }
    }

    if (trailingDist <= BOUNDARY_THRESHOLD) {
      addCandidate(candidates, children[i], 'after', container);
      if (i < children.length - 1) {
        addCandidate(candidates, children[i + 1], 'before', container);
      } else {
        addCandidate(candidates, container, 'last-child', container);
      }
    }
  }

  return candidates;
}

/**
 * When the resolved position is first-child/last-child of a container,
 * the cursor sits at the boundary of the edge child element. The user
 * might want to insert *inside* that child instead of beside it.
 *
 * E.g. clicking left of "Left" in [Left, Middle, Right]:
 *   resolved = first-child of container (insert before Left)
 *   also valid = first-child of Left (insert inside Left)
 */
function findEdgeChildSlots(
  _cx: number,
  _cy: number,
  target: HTMLElement,
  position: DropPosition,
): SlotCandidate[] {
  const candidates: SlotCandidate[] = [];

  if (position === 'first-child') {
    const child = target.firstElementChild as HTMLElement | null;
    console.log('[slot-picker] edge-child check: first-child, child =', child?.tagName, 'childClasses =', child?.className);
    if (child) {
      addCandidate(candidates, child, 'first-child', child, 1);
    }
  }

  if (position === 'last-child') {
    const child = target.lastElementChild as HTMLElement | null;
    console.log('[slot-picker] edge-child check: last-child, child =', child?.tagName, 'childClasses =', child?.className);
    if (child) {
      addCandidate(candidates, child, 'last-child', child, 1);
    }
  }

  return candidates;
}

function elId(el: HTMLElement): string {
  // Use a simple identity — dataset id or pointer
  return (el as any).__slotId ?? ((el as any).__slotId = String(Math.random()));
}

function addCandidate(
  candidates: SlotCandidate[],
  target: HTMLElement,
  position: DropPosition,
  container: HTMLElement,
  depth?: number,
): void {
  const tag = target.tagName.toLowerCase();
  const comp = detectComponent(target);
  const classes = typeof target.className === "string" ? target.className : "";
  candidates.push({
    target,
    position,
    label: positionLabel(position),
    tag,
    componentName: comp?.componentName ?? null,
    classes,
    depth: depth ?? 0,
  });
}

function positionLabel(position: DropPosition): string {
  switch (position) {
    case 'before': return '↑ before';
    case 'after': return '↓ after';
    case 'first-child': return '↳ start';
    case 'last-child': return '↳ end';
  }
}

// ── Slot Picker UI ───────────────────────────────────────────────────────

let currentPicker: HTMLElement | null = null;

export function showSlotPicker(
  candidates: SlotCandidate[],
  anchorX: number,
  anchorY: number,
  onPick: (candidate: SlotCandidate) => void,
): void {
  dismissSlotPicker();

  // Notify the page so tutorial progress can detect the picker
  window.dispatchEvent(new CustomEvent('vybit:message', {
    detail: { type: 'DISAMBIGUATOR_SHOWN', candidateCount: candidates.length },
  }));

  const picker = document.createElement("div");
  picker.className = "slot-picker";

  // Header
  const header = document.createElement("div");
  header.className = "slot-picker-header";
  const title = document.createElement("span");
  title.className = "slot-picker-title";
  title.textContent = "Pick insertion point";
  header.appendChild(title);
  picker.appendChild(header);

  // List
  const list = document.createElement("div");
  list.className = "slot-picker-list";

  let previewEl: HTMLElement | null = null;

  candidates.forEach((candidate) => {
    const row = document.createElement("div");
    row.className = `slot-picker-row depth-${Math.min(candidate.depth, 4)}`;

    // Position badge (before/after/start/end)
    const posSpan = document.createElement("span");
    posSpan.className = "slot-picker-pos";
    posSpan.textContent = candidate.label;
    row.appendChild(posSpan);

    // Element identifier: <tag .class1 .class2...>
    const elSpan = document.createElement("span");
    elSpan.className = "slot-picker-tag";
    const classTokens = candidate.classes.trim()
      ? " " + candidate.classes.trim().split(/\s+/).slice(0, 5).map(c => `.${c}`).join(" ")
      : "";
    elSpan.textContent = `<${candidate.tag}${classTokens}>`;
    row.appendChild(elSpan);

    // Hover: show preview indicator at this slot's position
    row.addEventListener("mouseenter", () => {
      clearPreview();
      previewEl = createSlotPreview(candidate.target, candidate.position);
    });

    row.addEventListener("mouseleave", () => {
      clearPreview();
    });

    // Click: pick this slot
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissSlotPicker();
      onPick(candidate);
    });

    list.appendChild(row);
  });

  picker.appendChild(list);

  // Hint
  const hint = document.createElement("div");
  hint.className = "slot-picker-hint";
  const kbd = document.createElement("kbd");
  kbd.textContent = "Esc";
  hint.appendChild(kbd);
  hint.appendChild(document.createTextNode(" to dismiss"));
  picker.appendChild(hint);

  dom.shadowRoot.appendChild(picker);
  currentPicker = picker;

  // Position near the click point using a virtual anchor
  const virtualAnchor = {
    getBoundingClientRect: () => ({
      x: anchorX, y: anchorY,
      top: anchorY, left: anchorX,
      bottom: anchorY, right: anchorX,
      width: 0, height: 0,
      toJSON: () => {},
    }),
  };

  computePosition(virtualAnchor as Element, picker, {
    placement: "bottom-start",
    middleware: [offset(6), flip(), shift({ padding: 8 })],
  }).then(({ x, y }) => {
    picker.style.left = `${x}px`;
    picker.style.top = `${y}px`;
  });

  // Escape to dismiss
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      dismissSlotPicker();
    }
  };

  // Click outside to dismiss
  const onClickOutside = (e: MouseEvent) => {
    if (!picker.contains(e.target as Node)) {
      dismissSlotPicker();
    }
  };

  const cleanup = () => {
    document.removeEventListener("keydown", onKeydown, { capture: true });
    document.removeEventListener("click", onClickOutside, { capture: true });
    clearPreview();
  };
  (picker as any).__slotPickerCleanup = cleanup;

  document.addEventListener("keydown", onKeydown, { capture: true });
  requestAnimationFrame(() => {
    document.addEventListener("click", onClickOutside, { capture: true });
  });

  function clearPreview() {
    if (previewEl) {
      previewEl.remove();
      previewEl = null;
    }
  }
}

/** Remove the slot picker if open. */
export function dismissSlotPicker(): void {
  if (currentPicker) {
    const cleanup = (currentPicker as any).__slotPickerCleanup;
    if (typeof cleanup === "function") cleanup();
    currentPicker.remove();
    currentPicker = null;
  }
}

/** Create a visual preview line at the candidate's insertion position. */
function createSlotPreview(target: HTMLElement, position: DropPosition): HTMLElement {
  const el = document.createElement("div");
  el.className = "slot-picker-preview";

  const rect = target.getBoundingClientRect();
  const parent = target.parentElement;
  const axis = parent ? getAxis(parent) : 'vertical';

  // For first-child/last-child, the target is the container itself
  if (position === 'first-child' || position === 'last-child') {
    const containerAxis = getAxis(target);
    if (containerAxis === 'horizontal') {
      const x = position === 'first-child' ? rect.left : rect.right;
      Object.assign(el.style, {
        position: 'fixed',
        left: `${x - 1}px`,
        top: `${rect.top}px`,
        width: '2px',
        height: `${rect.height}px`,
      });
    } else {
      const y = position === 'first-child' ? rect.top : rect.bottom;
      Object.assign(el.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${y - 1}px`,
        width: `${rect.width}px`,
        height: '2px',
      });
    }
  } else if (axis === 'horizontal') {
    const x = position === 'before' ? rect.left : rect.right;
    Object.assign(el.style, {
      position: 'fixed',
      left: `${x - 1}px`,
      top: `${rect.top}px`,
      width: '2px',
      height: `${rect.height}px`,
    });
  } else {
    const y = position === 'before' ? rect.top : rect.bottom;
    Object.assign(el.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${y - 1}px`,
      width: `${rect.width}px`,
      height: '2px',
    });
  }

  dom.shadowRoot.appendChild(el);
  return el;
}
