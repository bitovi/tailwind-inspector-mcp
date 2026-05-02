// Bottom toolbar — persistent floating bar pinned to the bottom-center of the page area.
// Contains Select (with 1+ adjunct), Text, and Insert tool buttons.
// Lives in the overlay shadow DOM.

import { state } from "./overlay-state";
import { sendTo } from "./ws";
import { SELECT_SVG, INSERT_SVG, DRAG_GRIP_SVG } from "./svg-icons";
import type { EditTool } from "../../shared/types";

let toolbarEl: HTMLElement | null = null;
let selectGroupEl: HTMLElement | null = null;
let adjunctBtn: HTMLElement | null = null;
let groupSepEl: HTMLElement | null = null;
let currentTool: EditTool = null;
let isPicking = false;
let isEngaged = false;

/** Per-tool visual state overrides (e.g. paste sets select=completed, insert=picking). */
export type ToolVisualState = 'picking' | 'engaged' | 'completed' | 'dim' | null;
let toolOverrides: Map<string, ToolVisualState> = new Map();

// External callbacks set via initBottomToolbar()
let onToolChange: ((tool: EditTool) => void) | null = null;
let onAdjunctClick: (() => void) | null = null;
let userDragged = false; // true once user drags — stop auto-centering

export function initBottomToolbar(deps: {
	onToolChange: (tool: EditTool) => void;
	onAdjunctClick: () => void;
}): void {
	onToolChange = deps.onToolChange;
	onAdjunctClick = deps.onAdjunctClick;
}

function createButton(label: string, svgHtml: string, tool: EditTool): HTMLElement {
	const btn = document.createElement("button");
	btn.className = "bt-combo";
	btn.dataset.tool = tool ?? "none";
	btn.innerHTML = `${svgHtml} ${label}`;
	btn.title = label;
	btn.addEventListener("click", () => {
		if (currentTool === tool) {
			// Re-click same tool → deselect
			setTool(null);
		} else {
			setTool(tool);
		}
	});
	return btn;
}

function setTool(tool: EditTool): void {
	currentTool = tool;
	isPicking = false;
	isEngaged = false;
	onToolChange?.(tool);
	// Notify panel of tool change
	sendTo("panel", { type: "EDIT_TOOL_CHANGED", tool });
	updateButtonStates();
}

/** Called by the overlay when the mode/state changes */
export function updateToolState(tool: EditTool, picking: boolean, engaged: boolean): void {
	currentTool = tool;
	isPicking = picking;
	isEngaged = engaged;
	// Clear transient overrides (picking/engaged/dim) but keep 'completed' —
	// completed persists until explicitly cleared via clearToolOverrides().
	for (const [key, state] of toolOverrides) {
		if (state !== 'completed') toolOverrides.delete(key);
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

/** Reset toolbar to fully idle (gray) — clears overrides, tool, and picking/engaged flags. */
export function resetToolbar(): void {
	toolOverrides.clear();
	currentTool = null;
	isPicking = false;
	isEngaged = false;
	updateButtonStates();
}

/** Clear transient overrides (picking/engaged/dim) but preserve completed. */
export function clearTransientOverrides(): void {
	for (const [key, state] of toolOverrides) {
		if (state !== 'completed') toolOverrides.delete(key);
	}
	updateButtonStates();
}

/** Lock/unlock toolbar buttons during text editing */
export function setTextEditingLock(locked: boolean): void {
	if (!toolbarEl) return;
	if (locked) {
		toolbarEl.classList.add('text-editing');
	} else {
		toolbarEl.classList.remove('text-editing');
	}
}

/** Update the instance count shown in the 1+ adjunct button */
export function updateInstanceCount(count: number): void {
	if (!adjunctBtn || !groupSepEl) return;
	if (count > 0) {
		adjunctBtn.innerHTML = `${count}<span class="plus">+</span>`;
		adjunctBtn.title = `${count} matching element${count !== 1 ? "s" : ""} selected — click to add similar`;
		adjunctBtn.style.display = "";
		groupSepEl.style.display = "";
	} else {
		adjunctBtn.style.display = "none";
		groupSepEl.style.display = "none";
	}
}

function updateButtonStates(): void {
	if (!toolbarEl) return;

	// Update standalone buttons (Text, Insert)
	const buttons = toolbarEl.querySelectorAll(".bt-combo:not(.bt-group .bt-combo)") as NodeListOf<HTMLElement>;
	buttons.forEach((btn) => {
		const btnTool = btn.dataset.tool;
		const isActive = btnTool === (currentTool ?? "none");

		btn.classList.remove("picking", "engaged", "completed", "dim");

		// Check for per-tool override first
		const override = btnTool ? toolOverrides.get(btnTool) : undefined;
		if (override) {
			btn.classList.add(override);
		} else if (isActive && isPicking) {
			btn.classList.add("picking");
		} else if (isActive && isEngaged) {
			btn.classList.add("engaged");
		} else if (!isActive && currentTool !== null) {
			// Another tool is active — dim inactive ones
			btn.classList.add("dim");
		}
		// When no tool is active (currentTool === null), all buttons stay at rest (#aaa)
	});

	// Update select group
	if (selectGroupEl) {
		selectGroupEl.classList.remove("picking", "engaged", "completed", "dim");
		const isSelectActive = currentTool === "select";

		// Check for per-tool override first
		const selectOverride = toolOverrides.get("select");
		if (selectOverride) {
			selectGroupEl.classList.add(selectOverride);
		} else if (isSelectActive && isPicking) {
			selectGroupEl.classList.add("picking");
		} else if (isSelectActive && isEngaged) {
			selectGroupEl.classList.add("engaged");
		} else if (!isSelectActive && currentTool !== null) {
			selectGroupEl.classList.add("dim");
		}
	}
}

let pageWrapperObserver: MutationObserver | null = null;
let resizeObserver: ResizeObserver | null = null;

/** Show the bottom toolbar */
export function showBottomToolbar(): void {
	if (toolbarEl) return; // already shown

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

	const toolbar = document.createElement("div");
	toolbar.className = "bottom-toolbar";

	// Drag grip
	const grip = document.createElement("div");
	grip.className = "bt-grip";
	grip.title = "Drag to move";
	grip.innerHTML = DRAG_GRIP_SVG;
	toolbar.appendChild(grip);

	// Select group (Select button + separator + 1+ adjunct)
	const selectGroup = document.createElement("div");
	selectGroup.className = "bt-group";

	const selectBtn = document.createElement("button");
	selectBtn.className = "bt-combo";
	selectBtn.dataset.tool = "select";
	selectBtn.innerHTML = `${SELECT_SVG} Select`;
	selectBtn.title = "Select";
	selectBtn.addEventListener("click", () => {
		if (currentTool === "select") {
			// Re-click Select — let onToolChange handle the toggle
			// (engaged/teal → re-enable picking, picking → disengage)
			onToolChange?.("select");
		} else {
			setTool("select");
		}
	});
	selectGroup.appendChild(selectBtn);

	const groupSep = document.createElement("div");
	groupSep.className = "bt-group-sep";
	groupSep.style.display = "none";
	selectGroup.appendChild(groupSep);
	groupSepEl = groupSep;

	const adjunct = document.createElement("button");
	adjunct.className = "bt-adjunct";
	adjunct.style.display = "none";
	const count = state.currentEquivalentNodes.length;
	if (count > 0) {
		adjunct.innerHTML = `${count}<span class="plus">+</span>`;
		adjunct.title = `${count} matching element${count !== 1 ? "s" : ""} selected — click to add similar`;
		adjunct.style.display = "";
		groupSep.style.display = "";
	}
	adjunct.addEventListener("click", (e) => {
		e.stopPropagation();
		onAdjunctClick?.();
	});
	selectGroup.appendChild(adjunct);
	adjunctBtn = adjunct;

	toolbar.appendChild(selectGroup);
	selectGroupEl = selectGroup;

	// Separator between select group and other tools
	const sep = document.createElement("div");
	sep.className = "bt-sep";
	toolbar.appendChild(sep);

	// Insert button (custom handler for three-way toggle, like Select)
	const insertBtn = document.createElement("button");
	insertBtn.className = "bt-combo";
	insertBtn.dataset.tool = "insert";
	insertBtn.innerHTML = `${INSERT_SVG} Insert`;
	insertBtn.title = "Insert";
	insertBtn.addEventListener("click", () => {
		if (currentTool === "insert") {
			// Re-click Insert — let onToolChange handle the toggle
			onToolChange?.("insert");
		} else {
			setTool("insert");
		}
	});
	toolbar.appendChild(insertBtn);

	// Setup drag
	setupDrag(grip, toolbar);

	state.shadowRoot.appendChild(toolbar);
	toolbarEl = toolbar;
	userDragged = false;
	centerToolbar();
	updateButtonStates();
}

/** Hide the bottom toolbar */
export function hideBottomToolbar(): void {
	if (toolbarEl) {
		toolbarEl.remove();
		toolbarEl = null;
		selectGroupEl = null;
		adjunctBtn = null;
		groupSepEl = null;
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
	return toolbarEl !== null;
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

/** Center the toolbar on the page area. No-op if user has dragged it. */
function centerToolbar(): void {
	if (!toolbarEl || userDragged) return;
	const cx = getPageCenterX();
	const w = toolbarEl.offsetWidth;
	toolbarEl.style.left = `${cx - w / 2}px`;
	toolbarEl.style.transform = 'none';
}

/** Reposition the bottom toolbar (e.g. after sidebar opens/closes). */
export function repositionBottomToolbar(): void {
	centerToolbar();
}

// ── Drag behavior ──
function setupDrag(handle: HTMLElement, toolbar: HTMLElement): void {
	let startX = 0;
	let startY = 0;
	let startLeft = 0;
	let startBottom = 0;
	let isDragging = false;

	const onMove = (e: MouseEvent) => {
		if (!isDragging) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		toolbar.style.left = `${startLeft + dx}px`;
		toolbar.style.bottom = `${startBottom - dy}px`;
		toolbar.style.transform = "none"; // remove centering transform while dragging
	};

	const onUp = () => {
		isDragging = false;
		document.removeEventListener("mousemove", onMove);
		document.removeEventListener("mouseup", onUp);
	};

	handle.addEventListener("mousedown", (e) => {
		e.preventDefault();
		isDragging = true;
		startX = e.clientX;
		startY = e.clientY;
		const rect = toolbar.getBoundingClientRect();
		startLeft = rect.left;
		startBottom = window.innerHeight - rect.bottom;
		// Switch from centered to absolute positioning
		toolbar.style.left = `${rect.left}px`;
		toolbar.style.bottom = `${window.innerHeight - rect.bottom}px`;
		toolbar.style.transform = "none";
		userDragged = true;
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	});
}
