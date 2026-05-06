// Shared mutable state for the overlay.
// All overlay modules import from here instead of using module-level lets in index.ts.
//
// DOM refs and infrastructure live in overlay-dom.ts — this file holds only
// logical state (mode, selection, interaction locks, etc.).

import type { ElementGroup } from "./grouping";

// ── Exclusive interaction lock ───────────────────────────────────────────
// At most ONE transient interaction can be active at a time.  Every visual
// system (hover preview, selection highlights, drop indicators, element
// toolbar, cursor) checks this field to decide what to render.  Modules
// that start an exclusive interaction set it; modules that produce visuals
// gate on it.
//
// `null` means no transient interaction is active — the normal
// selecting / insert-browsing flow is in effect.

export type ExclusiveInteraction =
	| null              // idle — normal mode logic applies
	| 'drag-moving'     // dragging a selected element to a new position
	| 'component-drag'  // dragging a component from the panel onto the page
	| 'text-editing';   // inline contentEditable editing

export interface DesignCanvasEntry {
	wrapper: HTMLElement;
	replacedNodes: HTMLElement[] | null;
	parent: HTMLElement | null;
	anchor: ChildNode | null;
}

export const state = {
	active: false,

	// Current selection
	currentEquivalentNodes: [] as HTMLElement[],
	currentTargetEl: null as HTMLElement | null,
	currentBoundary: null as { componentName: string } | null,

	// Cached near-groups (computed lazily on first + click)
	cachedNearGroups: null as ElementGroup[] | null,

	// Cached exact matches from findExactMatches (all identical elements)
	cachedExactMatches: null as HTMLElement[] | null,

	// Add-mode state (click-to-add selection)
	addMode: false,
	manuallyAddedNodes: new Set<HTMLElement>(),

	// Exclusive interaction lock (see ExclusiveInteraction type above)
	exclusiveInteraction: null as ExclusiveInteraction,

	// Mode
	currentMode: 'select' as 'select' | 'insert',
	currentTab: 'design' as string,
	tabPreference: 'design' as 'design' | 'component',
	selectModeOn: false,
	replaceDirection: null as 'element-first' | null,
};

/** Derive the concrete tab ID from the current mode + tab preference */
export function resolveTab(): string {
	if (state.currentMode === 'insert') return 'place';
	return state.tabPreference === 'component' ? 'replace' : 'design';
}

/** Clear all element-selection state. Call before re-entering a mode or resetting. */
export function clearSelectionState(): void {
	clearGrabCursor();
	state.currentEquivalentNodes = [];
	state.currentTargetEl = null;
	state.currentBoundary = null;
	state.cachedNearGroups = null;
	state.cachedExactMatches = null;
	state.manuallyAddedNodes = new Set<HTMLElement>();
	state.addMode = false;
}

/** Apply grab cursor to the currently selected element. */
export function setGrabCursor(): void {
	if (state.currentTargetEl) {
		state.currentTargetEl.style.cursor = 'grab';
	}
}

/** Remove grab cursor from the currently selected element. */
export function clearGrabCursor(): void {
	if (state.currentTargetEl) {
		state.currentTargetEl.style.cursor = '';
	}
}
