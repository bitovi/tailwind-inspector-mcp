// Same-rect element disambiguation picker.
// When a click lands on overlapping elements that share the same bounding rect,
// this module shows a small popup so the user can pick which element they meant.

import { computePosition, offset, flip, shift } from "@floating-ui/dom";
import { state } from "./overlay-state";
import { detectComponent } from "./framework-detect";

const RECT_THRESHOLD = 2; // px tolerance for "same rect"

/** Check if two DOMRects match within a pixel threshold. */
function rectsMatch(a: DOMRect, b: DOMRect): boolean {
  return (
    Math.abs(a.top - b.top) <= RECT_THRESHOLD &&
    Math.abs(a.left - b.left) <= RECT_THRESHOLD &&
    Math.abs(a.width - b.width) <= RECT_THRESHOLD &&
    Math.abs(a.height - b.height) <= RECT_THRESHOLD
  );
}

export interface DepthCandidate {
  el: HTMLElement;
  tag: string;
  componentName: string | null;
  classes: string;
}

/**
 * Walk up from the clicked element, collecting parent elements whose
 * bounding rect matches the target's within the threshold.
 * Returns candidates ordered outermost-first (reversed from the walk).
 */
export function getSameRectCandidates(target: HTMLElement): DepthCandidate[] {
  const targetRect = target.getBoundingClientRect();
  const candidates: DepthCandidate[] = [];

  // Start with the target itself
  candidates.push(makeCandidate(target));

  let el: HTMLElement | null = target.parentElement;
  while (el) {
    if (
      el === state.shadowHost ||
      el === document.body ||
      el === document.documentElement
    ) {
      break;
    }
    const parentRect = el.getBoundingClientRect();
    if (rectsMatch(targetRect, parentRect)) {
      // Only include if it has classes (structural wrappers without classes aren't useful)
      const cls = typeof el.className === "string" ? el.className : "";
      if (cls.trim()) {
        candidates.push(makeCandidate(el));
      }
      el = el.parentElement;
    } else {
      break; // stop at first parent that doesn't match
    }
  }

  // Reverse: outermost first (parent → child)
  candidates.reverse();
  return candidates;
}

function makeCandidate(el: HTMLElement): DepthCandidate {
  const tag = el.tagName.toLowerCase();
  const boundary = detectComponent(el);
  const classes = typeof el.className === "string" ? el.className : "";
  return {
    el,
    tag,
    componentName: boundary?.componentName ?? null,
    classes,
  };
}

/**
 * Show the disambiguation picker anchored to the target element.
 * Calls `onPick` with the chosen element when the user clicks a row.
 */
export function showDepthPicker(
  candidates: DepthCandidate[],
  anchorEl: HTMLElement,
  onPick: (candidate: DepthCandidate) => void,
): void {
  dismissDepthPicker();

  const picker = document.createElement("div");
  picker.className = "depth-picker";

  // Header
  const header = document.createElement("div");
  header.className = "depth-picker-header";
  const title = document.createElement("span");
  title.className = "depth-picker-title";
  title.textContent = "Pick an element";
  header.appendChild(title);
  picker.appendChild(header);

  // List
  const list = document.createElement("div");
  list.className = "depth-picker-list";

  // Preview highlight element (reused for hover)
  let previewEl: HTMLElement | null = null;

  candidates.forEach((candidate, i) => {
    const row = document.createElement("div");
    row.className = `depth-picker-row depth-${Math.min(i, 4)}`;

    const tagSpan = document.createElement("span");
    tagSpan.className = "depth-picker-tag";
    tagSpan.textContent = `<${candidate.tag}>`;
    row.appendChild(tagSpan);

    if (candidate.componentName) {
      const compSpan = document.createElement("span");
      compSpan.className = "depth-picker-comp";
      compSpan.textContent = candidate.componentName;
      row.appendChild(compSpan);
    }

    const classSpan = document.createElement("span");
    classSpan.className = "depth-picker-classes";
    // Show first few classes as dot-prefixed tokens
    const classTokens = candidate.classes
      .trim()
      .split(/\s+/)
      .slice(0, 6)
      .map((c) => `.${c}`)
      .join(" ");
    classSpan.textContent = classTokens;
    row.appendChild(classSpan);

    // Hover: show preview highlight
    row.addEventListener("mouseenter", () => {
      clearPreview();
      const rect = candidate.el.getBoundingClientRect();
      previewEl = document.createElement("div");
      previewEl.className = "depth-picker-preview";
      previewEl.style.cssText = `
        position: fixed;
        left: ${rect.left - 3}px;
        top: ${rect.top - 3}px;
        width: ${rect.width + 6}px;
        height: ${rect.height + 6}px;
      `;
      state.shadowRoot.appendChild(previewEl);
    });

    row.addEventListener("mouseleave", () => {
      clearPreview();
    });

    // Click: pick this element
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissDepthPicker();
      onPick(candidate);
    });

    list.appendChild(row);
  });

  picker.appendChild(list);

  // Hint
  const hint = document.createElement("div");
  hint.className = "depth-picker-hint";
  const kbd = document.createElement("kbd");
  kbd.textContent = "Esc";
  hint.appendChild(kbd);
  hint.appendChild(document.createTextNode(" to dismiss"));
  picker.appendChild(hint);

  state.shadowRoot.appendChild(picker);
  state.depthPickerEl = picker;

  // Position with floating-ui
  computePosition(anchorEl, picker, {
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
      dismissDepthPicker();
    }
  };

  // Click outside to dismiss (next tick so the opening click doesn't dismiss)
  const onClickOutside = (e: MouseEvent) => {
    if (!picker.contains(e.target as Node)) {
      dismissDepthPicker();
    }
  };

  // Store cleanup refs
  const cleanup = () => {
    document.removeEventListener("keydown", onKeydown, { capture: true });
    document.removeEventListener("click", onClickOutside, { capture: true });
    clearPreview();
  };
  (picker as any).__depthPickerCleanup = cleanup;

  document.addEventListener("keydown", onKeydown, { capture: true });
  // Delay click-outside listener so the current click doesn't trigger it
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

/** Remove the depth picker if open. */
export function dismissDepthPicker(): void {
  if (state.depthPickerEl) {
    const cleanup = (state.depthPickerEl as any).__depthPickerCleanup;
    if (typeof cleanup === "function") cleanup();
    state.depthPickerEl.remove();
    state.depthPickerEl = null;
  }
}
