// Bottom toolbar — persistent floating bar pinned to the bottom-center of the page area.
// Contains Select (with 1+ adjunct), Text, and Insert tool buttons.
// Now uses <vb-bottom-toolbar> Web Component instead of direct DOM manipulation.

import { dom } from "./overlay-dom";
import { state } from "./overlay-state";
import { getState } from "./overlay-state-machine";
import "./web-components/vb-bottom-toolbar"; // side-effect: registers custom element
import type { VbBottomToolbar } from "./web-components/vb-bottom-toolbar";
import type { EditTool } from "../../shared/types";
import type { ToolbarVisual } from "./overlay-state-machine/types";

// Web Component singleton instance
let webComponent: VbBottomToolbar | null = null;
let isWebComponentShown = false;

// Legacy state references (kept for compatibility with observers)
let selectGroupEl: HTMLElement | null = null;
let adjunctBtn: HTMLElement | null = null;
let groupSepEl: HTMLElement | null = null;

/** Per-tool visual state overrides (e.g. paste sets select=completed, insert=picking). */
export type ToolVisualState = 'picking' | 'engaged' | 'completed' | 'dim' | null;
let toolOverrides: Map<string, ToolVisualState> = new Map();

// External callbacks set via initBottomToolbar()
let onToolChange: ((tool: EditTool) => void) | null = null;
let onAdjunctClick: (() => void) | null = null;
let userDragged = false; // true once user drags — stop auto-centering

/**
 * Initialize the bottom toolbar module and set up Web Component.
 * Must be called before showing the toolbar.
 */
export function initBottomToolbar(deps: {
	onToolChange: (tool: EditTool) => void;
	onAdjunctClick: () => void;
}): void {
	onToolChange = deps.onToolChange;
	onAdjunctClick = deps.onAdjunctClick;

	// Create and configure Web Component singleton (if not already created)
	if (!webComponent) {
		webComponent = document.createElement("vb-bottom-toolbar") as VbBottomToolbar;
		dom.shadowRoot.appendChild(webComponent);

		// Listen to Web Component custom events and forward to callbacks
		webComponent.addEventListener("tool-change", (e: Event) => {
			const customEvent = e as CustomEvent<{ tool: EditTool }>;
			onToolChange?.(customEvent.detail.tool);
		});

		webComponent.addEventListener("adjunct-click", () => {
			onAdjunctClick?.();
		});
	}
}

/**
 * Called by the overlay when the mode/state changes (via update-toolbar effect).
 * Updates the Web Component to reflect the new toolbar state.
 */
export function updateToolState(tool: EditTool, picking: boolean, engaged: boolean): void {
	// Clear transient overrides (picking/engaged/dim) but keep 'completed' —
	// completed persists until explicitly cleared via clearToolOverrides().
	for (const [key, val] of toolOverrides) {
		if (val !== 'completed') toolOverrides.delete(key);
	}
	// Active picking always wins — clear any override on the current tool
	// so the orange picking state is never masked by a stale override.
	if (picking && tool) {
		toolOverrides.delete(tool);
	}
	updateButtonStates();
}

/**
 * Set per-tool visual overrides. Each entry maps a tool name (e.g. 'select', 'insert')
 * to a visual state. Overrides take precedence over the normal picking/engaged logic.
 * Call clearToolOverrides() when the override scenario ends.
 */
export function setToolOverrides(overrides: Record<string, ToolVisualState>): void {
	toolOverrides.clear();
	for (const [tool, state] of Object.entries(overrides)) {
		if (state) toolOverrides.set(tool, state);
	}
	updateButtonStates();
}

/** Clear all per-tool visual overrides and return to normal state logic. */
export function clearToolOverrides(): void {
	toolOverrides.clear();
	updateButtonStates();
}

/** Reset toolbar to fully idle (gray) — clears overrides and repaints from SM state. */
export function resetToolbar(): void {
	toolOverrides.clear();
	updateButtonStates();
}

/** Clear transient overrides (picking/engaged/dim) but preserve completed. */
export function clearTransientOverrides(): void {
	for (const [key, val] of toolOverrides) {
		if (val !== 'completed') toolOverrides.delete(key);
	}
	updateButtonStates();
}

/** Lock/unlock toolbar buttons during text editing */
export function setTextEditingLock(locked: boolean): void {
	if (!webComponent) return;
	webComponent.setTextEditingLock(locked);
}

/** Update the instance count shown in the 1+ adjunct button */
export function updateInstanceCount(count: number): void {
	if (!webComponent) return;
	webComponent.instanceCount = count;
}

/**
 * Update button visual states based on toolbar state and overrides.
 * Forwards per-tool visual states to the Web Component.
 */
function updateButtonStates(): void {
	if (!webComponent) return;
	const { toolbar } = getState();

	// Determine if any tool is active (for dimming inactive ones)
	const anyActive = toolbar.select !== 'gray' || toolbar.insert !== 'gray' || toolbar.text !== 'gray';

	// Build per-tool visual states, matching original logic
	const states: Record<string, string | null> = {};

	for (const tool of ['select', 'insert'] as const) {
		const override = toolOverrides.get(tool);
		if (override) {
			states[tool] = override;
		} else {
			const visual = toolbar[tool];
			if (visual !== 'gray') {
				states[tool] = visual;
			} else if (anyActive) {
				states[tool] = 'dim';
			} else {
				states[tool] = null;
			}
		}
	}

	webComponent.applyVisualStates(states);
}

let pageWrapperObserver: MutationObserver | null = null;
let resizeObserver: ResizeObserver | null = null;

/** Show the bottom toolbar */
export function showBottomToolbar(): void {
	if (!webComponent) {
		// If not initialized, create it now
		const comp = document.createElement("vb-bottom-toolbar") as VbBottomToolbar;
		dom.shadowRoot.appendChild(comp);
		webComponent = comp;

		// Set up event listeners
		webComponent.addEventListener("tool-change", (e: Event) => {
			const customEvent = e as CustomEvent<{ tool: EditTool }>;
			onToolChange?.(customEvent.detail.tool);
		});

		webComponent.addEventListener("adjunct-click", () => {
			onAdjunctClick?.();
		});
	}

	if (isWebComponentShown) return; // already shown

	// Watch for sidebar container appearing/disappearing (#tw-page-wrapper)
	if (!pageWrapperObserver) {
		pageWrapperObserver = new MutationObserver(() => {
			centerToolbar();
			// Also observe the wrapper for size changes (sidebar resize handle)
			observePageWrapper();
		});
		pageWrapperObserver.observe(document.body, { childList: true });
	}
	observePageWrapper();

	// Show the Web Component
	webComponent.show();
	isWebComponentShown = true;
	userDragged = false;
	centerToolbar();
	updateButtonStates();

	// Set initial instance count from current state
	const count = state.currentEquivalentNodes.length;
	webComponent.instanceCount = count;
}

/** Hide the bottom toolbar */
export function hideBottomToolbar(): void {
	if (webComponent && isWebComponentShown) {
		webComponent.hide();
		isWebComponentShown = false;
		userDragged = false;
	}
	if (pageWrapperObserver) {
		pageWrapperObserver.disconnect();
		pageWrapperObserver = null;
	}
	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}
}

/** Check if bottom toolbar is visible */
export function isBottomToolbarVisible(): boolean {
	return isWebComponentShown;
}

/** Observe #tw-page-wrapper for size changes (sidebar resize). */
function observePageWrapper(): void {
	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}
	const wrapper = document.getElementById('tw-page-wrapper');
	if (wrapper) {
		resizeObserver = new ResizeObserver(() => centerToolbar());
		resizeObserver.observe(wrapper);
	}
}

/** Compute the horizontal center of the visible page area (accounts for sidebar). */
export function getPageCenterX(): number {
	const wrapper = document.getElementById('tw-page-wrapper');
	if (wrapper) {
		const rect = wrapper.getBoundingClientRect();
		return rect.left + rect.width / 2;
	}
	return window.innerWidth / 2;
}

/**
 * Center the toolbar on the page area. No-op if user has dragged it.
 * Interacts with the Web Component's internal toolbar element.
 */
function centerToolbar(): void {
	if (!webComponent || !isWebComponentShown || userDragged) return;

	// Access the Web Component's internal toolbar element (light DOM — no shadow root)
	const toolbar = webComponent.querySelector('.bottom-toolbar') as HTMLElement;
	if (!toolbar) return;

	const cx = getPageCenterX();
	const w = toolbar.offsetWidth;
	toolbar.style.left = `${cx - w / 2}px`;
	toolbar.style.transform = 'none';
}

/** Reposition the bottom toolbar (e.g. after sidebar opens/closes). */
export function repositionBottomToolbar(): void {
	centerToolbar();
}

// ── Note: Drag behavior is now handled entirely by the Web Component ──
