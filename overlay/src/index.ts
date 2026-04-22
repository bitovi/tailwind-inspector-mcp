import { armInsert, armGenericInsert, armElementSelect, cancelInsert, replaceElement, placeAtLockedInsert, startBrowse, getLockedInsert, clearLockedInsert, isActive as isDropZoneActive, findGhostAncestor, repositionOnScroll as repositionDropZone } from "./drop-zone";
import { isTextEditing, handleTextEditingClick, endTextEdit } from "./text-edit";
import { debugLog } from "../../shared/vybit-env";
import type { ContainerName } from "./containers/IContainer";
import { ModalContainer } from "./containers/ModalContainer";
import { PopoverContainer } from "./containers/PopoverContainer";
import { PopupContainer } from "./containers/PopupContainer";
import { SidebarContainer } from "./containers/SidebarContainer";
import { buildContext } from "./context";
import { detectComponent } from "./framework-detect";
import './design-canvas/index';
import { css, SHADOW_HOST, OVERLAY_CSS } from './styles';
import { VYBIT_LOGO_SVG } from './svg-icons';
import { saveScrollRatio } from './preserve-scroll';
import { findExactMatches } from "./grouping";
import { getFiber, findComponentBoundary, extractComponentProps } from "./fiber";
import { isAngularElement, findAngularComponentBoundary, extractAngularComponentProps } from "./angular-detect";
import type { InsertMode } from "./messages";
import {
	applyPreview,
	applyPreviewBatch,
	commitPreview,
	getPreviewState,
	revertPreview,
} from "./patcher";
import { connect, onMessage, send, sendTo } from "./ws";
import { state, resolveTab, clearSelectionState } from "./overlay-state";
import { highlightElement, clearHighlights, clearHoverPreview, mouseMoveHandler, repositionHighlights } from "./element-highlight";
import { showDrawButton, initToolbar, repositionToolbar } from "./element-toolbar";
import { injectDesignCanvas, handleCaptureScreenshot, handleDesignSubmitted, handleDesignClose, initDesignCanvasManager, removeAllDesignCanvases } from "./design-canvas-manager";
import { RecordingEngine } from "./recording/recording-engine";
import { getSameRectCandidates, showDepthPicker, dismissDepthPicker } from "./depth-picker";
import type { BugReportElement } from "../../shared/types";

/** Callback for startBrowse — when user locks an insertion point, set it as current target and show toolbar */
function onBrowseLocked(target: HTMLElement): void {
	state.currentTargetEl = target;
	state.currentEquivalentNodes = [target];
	const boundary = detectComponent(target);
	state.currentBoundary = boundary
		? { componentName: boundary.componentName }
		: { componentName: target.tagName.toLowerCase() };
	state.cachedNearGroups = null;
	showDrawButton(target);
}

const THEME_PREVIEW_STYLE_ID = "vybit-theme-preview";

/**
 * Read all CSS custom properties declared in :root / :host rules from every
 * stylesheet on the page. Returns a flat map of { "--var-name": "value" }.
 */
function readThemeVars(): Record<string, string> {
	const vars: Record<string, string> = {};
	for (const sheet of Array.from(document.styleSheets)) {
		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			// Cross-origin stylesheet — skip
			continue;
		}
		for (const rule of Array.from(rules)) {
			// Unwrap @layer rules to reach the :root block inside
			const candidates: CSSRule[] = [rule];
			if (rule instanceof CSSLayerBlockRule) {
				candidates.push(...Array.from(rule.cssRules));
			}
			for (const candidate of candidates) {
				if (!(candidate instanceof CSSStyleRule)) continue;
				if (!/:root|:host/.test(candidate.selectorText)) continue;
				const style = candidate.style;
				for (let i = 0; i < style.length; i++) {
					const prop = style[i];
					if (prop.startsWith('--')) {
						vars[prop] = style.getPropertyValue(prop).trim();
					}
				}
			}
		}
	}
	return vars;
}

function sendThemeVars(): void {
	// Wait for stylesheets to be loaded before reading CSS custom properties.
	// During HMR full-reload, the overlay WS reconnects before stylesheets
	// are parsed, so readThemeVars() would return 0 vars.
	if (document.readyState !== 'complete') {
		window.addEventListener('load', () => sendThemeVars(), { once: true });
		return;
	}
	const vars = readThemeVars();
	sendTo('panel', { type: 'THEME_VARS', vars });
}

/**
 * Apply theme preview overrides by injecting/updating a <style> element.
 * For v4: CSS custom property overrides in :root.
 * For v3: pre-compiled CSS from server (THEME_PREVIEW_CSS message).
 */
function applyThemePreview(msg: any): void {
	let existing = document.getElementById(THEME_PREVIEW_STYLE_ID);

	if (msg.type === "THEME_PREVIEW_CSS") {
		// v3: server sends compiled CSS
		const css = msg.css as string;
		if (!css) {
			existing?.remove();
			return;
		}
		if (!existing) {
			existing = document.createElement("style");
			existing.id = THEME_PREVIEW_STYLE_ID;
			document.head.appendChild(existing);
		}
		existing.textContent = css;
		return;
	}

	// v4: CSS variable overrides
	const overrides: Array<{ variable: string; value: string }> = msg.overrides ?? [];
	if (overrides.length === 0) {
		existing?.remove();
		return;
	}
	const rules = overrides
		.map((o) => `  ${o.variable}: ${o.value} !important;`)
		.join("\n");
	const cssText = `:root {\n${rules}\n}`;

	if (!existing) {
		existing = document.createElement("style");
		existing.id = THEME_PREVIEW_STYLE_ID;
		document.head.appendChild(existing);
	}
	existing.textContent = cssText;
}

function getServerOrigin(): string {
	const scripts = document.querySelectorAll('script[src*="overlay.js"]');
	for (const s of scripts) {
		const src = (s as HTMLScriptElement).src;
		if (src) {
			try {
				const url = new URL(src);
				return url.origin;
			} catch {
				/* ignore */
			}
		}
	}
	return "http://localhost:3333";
}

const SERVER_ORIGIN = getServerOrigin();
debugLog('tw-overlay', `SERVER_ORIGIN resolved to: ${SERVER_ORIGIN}`);
debugLog('tw-overlay', `Script tags with "overlay.js":`, Array.from(document.querySelectorAll('script[src*="overlay.js"]')).map(s => (s as HTMLScriptElement).src));

// When running inside a Storybook iframe, the panel is already shown in
// the Storybook addon tab — suppress the overlay's own panel container.
const insideStorybook = !!(window as any).__STORYBOOK_PREVIEW__;

async function fetchTailwindConfig(): Promise<any> {
	if (state.tailwindConfigCache) {
		return state.tailwindConfigCache;
	}
	try {
		const res = await fetch(`${SERVER_ORIGIN}/tailwind-config`, { credentials: 'include' });
		state.tailwindConfigCache = await res.json();
		return state.tailwindConfigCache;
	} catch (err) {
		console.error("[tw-overlay] Failed to fetch tailwind config:", err);
		return {};
	}
}

/**
 * Resolve CSS variable references in the tailwind config's color values.
 * Since the overlay runs in the target app's DOM, it can use getComputedStyle
 * to resolve `var(--destructive)` → actual color value.
 */
function resolveConfigCssVars(config: any): any {
	if (!config || !config.colors) return config;

	const resolved = { ...config, colors: resolveColorObject(config.colors) };
	return resolved;
}

function resolveColorObject(obj: any): any {
	if (typeof obj === 'string') {
		return resolveCssVar(obj);
	}
	if (obj && typeof obj === 'object') {
		const result: Record<string, any> = {};
		for (const key of Object.keys(obj)) {
			result[key] = resolveColorObject(obj[key]);
		}
		return result;
	}
	return obj;
}

function resolveCssVar(value: string): string {
	if (!value.startsWith('var(')) return value;
	// Extract the variable name from var(--name) or var(--name, fallback)
	const match = value.match(/^var\(\s*(--[^,)]+)/);
	if (!match) return value;
	const computed = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
	if (!computed) return value;

	// The resolved value might be a fully valid CSS color (hex, rgb, hsl) — try it directly
	const directColor = normalizeToHex(computed);
	if (directColor) return directColor;

	// shadcn/ui pattern: the config has `var(--destructive)` and --destructive is bare HSL
	// channels like "0 84.2% 60.2%". Try wrapping in hsl().
	const hslColor = normalizeToHex(`hsl(${computed})`);
	if (hslColor) return hslColor;

	return computed;
}

/** Use the browser to normalize any CSS color string to a hex code, or return null. */
function normalizeToHex(cssColor: string): string | null {
	const el = document.createElement('div');
	el.style.color = cssColor;
	if (!el.style.color) return null; // browser rejected it
	document.body.appendChild(el);
	const rgb = getComputedStyle(el).color;
	document.body.removeChild(el);
	// rgb is like "rgb(239, 68, 68)" — convert to hex
	const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	if (!m) return null;
	const hex = '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
	return hex;
}

async function clickHandler(e: MouseEvent): Promise<void> {
	// Ignore clicks on our own shadow DOM UI
	const composed = e.composedPath();
	if (composed.some((el) => el === state.shadowHost)) { return; }

	// While text editing, suppress page click handlers (buttons, links, etc.)
	if (handleTextEditingClick(e)) return;

	// Ignore clicks while the drop-zone is handling element-select (e.g. replace mode)
	if (isDropZoneActive()) return;

	// Ignore clicks inside an active design canvas wrapper
	if (
		composed.some(
			(el) =>
				el instanceof HTMLElement && el.hasAttribute("data-tw-design-canvas"),
		)
	)
		return;

	// When select mode is off, only intercept shift+clicks or add-mode clicks
	if (!state.selectModeOn && !state.addMode && !e.shiftKey) return;

	e.preventDefault();
	e.stopPropagation();

	const target = e.target as Element;
	const targetEl = target as HTMLElement;
	let classString =
		typeof targetEl.className === "string" ? targetEl.className : "";

	// ── Add-mode: toggle element in/out of selection ──
	if (state.addMode) {
		if (state.manuallyAddedNodes.has(targetEl)) {
			state.manuallyAddedNodes.delete(targetEl);
		} else {
			state.manuallyAddedNodes.add(targetEl);
		}
		// Update highlights without rebuilding the toolbar/picker
		if (!state.currentTargetEl) return;
		const allNodes = [state.currentTargetEl];
		for (const n of state.manuallyAddedNodes) {
			if (!allNodes.includes(n)) allNodes.push(n);
		}
		state.currentEquivalentNodes = allNodes;
		// Remove only highlight overlays — NOT the toolbar/picker
		state.shadowRoot
			.querySelectorAll(".highlight-overlay")
			.forEach((el) => el.remove());
		for (const n of allNodes) {
			highlightElement(n);
		}
		if (state.currentBoundary) {
			sendTo("panel", {
				type: "ELEMENT_SELECTED",
				componentName: state.currentBoundary.componentName,
				instanceCount: allNodes.length,
				classes:
					typeof state.currentTargetEl.className === "string"
						? state.currentTargetEl.className
						: "",
				tailwindConfig: state.tailwindConfigCache,
			});
		}
		// Refresh picker UI (count chip, etc.) if open
		state.pickerRefreshCallback?.();
		return;
	}

	// ── Shift+click: toggle element in/out of current selection ──
	if (e.shiftKey && state.currentTargetEl) {
		const idx = state.currentEquivalentNodes.indexOf(targetEl);
		if (idx !== -1) {
			state.currentEquivalentNodes.splice(idx, 1);
		} else {
			state.currentEquivalentNodes.push(targetEl);
			state.manuallyAddedNodes.add(targetEl);
		}
		clearHighlights();
		for (const node of state.currentEquivalentNodes) {
			highlightElement(node);
		}
		showDrawButton(state.currentTargetEl);
		if (state.currentBoundary) {
			sendTo("panel", {
				type: "ELEMENT_SELECTED",
				componentName: state.currentBoundary.componentName,
				instanceCount: state.currentEquivalentNodes.length,
				classes:
					typeof state.currentTargetEl.className === "string"
						? state.currentTargetEl.className
						: "",
				tailwindConfig: state.tailwindConfigCache,
			});
		}
		return;
	}

	// ── Normal click: select single element ──

	// Dismiss any open depth picker from a previous click
	dismissDepthPicker();

	// ── Same-rect disambiguation ──
	// Walk up from clicked element; parents with the same bounding rect are candidates.
	const candidates = getSameRectCandidates(targetEl);

	if (candidates.length > 1) {
		// Multiple same-rect elements — show picker and let the user choose
		showDepthPicker(candidates, targetEl, (picked) => {
			finalizeSelection(picked.el);
		});
		return;
	}

	// Single candidate — select directly
	await finalizeSelection(targetEl);
}

/**
 * Complete an element selection: highlight, extract component info,
 * open the panel, and send ELEMENT_SELECTED to the panel via WS.
 */
async function finalizeSelection(targetEl: HTMLElement): Promise<void> {
	const classString =
		typeof targetEl.className === "string" ? targetEl.className : "";

	const result = findExactMatches(targetEl, state.shadowHost);
	let componentName = result.componentName ?? targetEl.tagName.toLowerCase();

	// ── Ghost element detection ──
	const isGhostTarget = !!targetEl.dataset.twDroppedComponent;
	const ghostAncestorEl = !isGhostTarget ? findGhostAncestor(targetEl) : null;
	const ghostEl = isGhostTarget ? targetEl : ghostAncestorEl;
	const ghostPatchId = ghostEl?.dataset.twDroppedPatchId ?? undefined;
	const ghostComponentName = ghostEl?.dataset.twDroppedComponent;
	if (ghostComponentName) {
		componentName = ghostComponentName;
	}

	clearHighlights();
	highlightElement(targetEl);

	const config = await fetchTailwindConfig();

	// Store selection state
	state.currentEquivalentNodes = [targetEl];
	state.currentTargetEl = targetEl;
	state.currentBoundary = { componentName };
	state.cachedNearGroups = null;
	state.cachedExactMatches = result.exactMatch;
	state.manuallyAddedNodes = new Set<HTMLElement>();

	state.currentInstances = [{
		index: 0,
		label: (targetEl.innerText || "").trim().slice(0, 40) || `#1`,
		parent: targetEl.parentElement?.tagName.toLowerCase() ?? "",
	}];

	clearHoverPreview();
	setSelectMode(false);

	showDrawButton(targetEl);

	if (!insideStorybook) {
		const panelUrl = `${SERVER_ORIGIN}/panel`;
		if (!state.activeContainer.isOpen()) {
			state.activeContainer.open(panelUrl);
		}
	}

	const resolvedConfig = config ? resolveConfigCssVars(config) : config;

	// Extract component props from React Fiber if available
	let componentProps: Record<string, unknown> | undefined;
	const fiber = getFiber(targetEl);
	if (fiber) {
		const boundary = findComponentBoundary(fiber);
		if (boundary) {
			componentProps = extractComponentProps(boundary.componentFiber) ?? undefined;
			componentName = boundary.componentName;
			// NOTE: We intentionally do NOT override classString with the component
			// root element's classes. The user selected this specific element (possibly
			// via the depth picker), so we send its own classes.
		}
	}

	// Extract component props from Angular if available (and React didn't match)
	if (!componentProps && isAngularElement(targetEl)) {
		const boundary = findAngularComponentBoundary(targetEl);
		if (boundary) {
			const instance = boundary.componentFiber;
			let hostEl: Element;

			if (instance instanceof Element) {
				// Prod fallback: componentFiber IS the host element
				hostEl = instance;
			} else {
				// Dev mode: componentFiber is the live component instance.
				// Find the host element via its tag selector.
				const selector = instance.constructor?.ɵcmp?.selectors?.[0]?.[0];
				hostEl = (selector ? targetEl.closest(selector) : null) ?? targetEl;
			}

			componentProps = extractAngularComponentProps(instance, hostEl) ?? undefined;
			componentName = boundary.componentName;
		}
	}

	sendTo("panel", {
		type: "ELEMENT_SELECTED",
		componentName,
		instanceCount: 1,
		classes: classString,
		tailwindConfig: resolvedConfig,
		componentProps,
		ghostPatchId,
	});
}

/**
 * Rebuild currentEquivalentNodes from the base target + manually added nodes.
 * Used by add-mode and the group picker to unify all selection sources.
 */
function rebuildSelectionFromSources(): void {
	if (!state.currentTargetEl) return;
	const allNodes = [state.currentTargetEl];
	for (const n of state.manuallyAddedNodes) {
		if (!allNodes.includes(n)) allNodes.push(n);
	}
	state.currentEquivalentNodes = allNodes;
	clearHighlights();
	for (const n of allNodes) {
		highlightElement(n);
	}
	showDrawButton(state.currentTargetEl);
	if (state.currentBoundary) {
		sendTo("panel", {
			type: "ELEMENT_SELECTED",
			componentName: state.currentBoundary.componentName,
			instanceCount: allNodes.length,
			classes:
				typeof state.currentTargetEl.className === "string"
					? state.currentTargetEl.className
					: "",
			tailwindConfig: state.tailwindConfigCache,
		});
	}
}

export { rebuildSelectionFromSources };

function setSelectMode(on: boolean): void {
	state.selectModeOn = on;
	if (on) {
		document.documentElement.style.cursor = "crosshair";
		document.addEventListener("click", clickHandler, { capture: true });
		document.addEventListener("mousemove", mouseMoveHandler, { passive: true });
	} else {
		document.documentElement.style.cursor = "";
		// Keep clickHandler registered for shift+click multi-select;
		// it will early-return for non-shift clicks when selectModeOn is false
		document.removeEventListener("mousemove", mouseMoveHandler);
		clearHoverPreview();
	}
	sendTo("panel", { type: "SELECT_MODE_CHANGED", active: on });
}

/**
 * Enter or exit add-mode: registers click + hover handlers so the user
 * can click elements to add them to the selection.
 */
function setAddMode(on: boolean): void {
	state.addMode = on;
	if (on) {
		document.documentElement.style.cursor = "crosshair";
		document.addEventListener("click", clickHandler, { capture: true });
		document.addEventListener("mousemove", mouseMoveHandler, { passive: true });
	} else {
		document.documentElement.style.cursor = "";
		// Only remove clickHandler if select mode isn't keeping it alive for shift+click
		if (!state.selectModeOn) {
			document.removeEventListener("click", clickHandler, { capture: true });
		}
		document.removeEventListener("mousemove", mouseMoveHandler);
		clearHoverPreview();
	}
	sendTo("panel", { type: "SELECT_MODE_CHANGED", active: on });
}

const PANEL_OPEN_KEY = "tw-inspector-panel-open";

function toggleInspect(btn: HTMLButtonElement): void {
	state.active = !state.active;
	if (state.active) {
		btn.classList.add("active");
		sessionStorage.setItem(PANEL_OPEN_KEY, "1");
		if (insideStorybook) {
			// In Storybook the panel is already in the addon tab — go straight to select mode
			setSelectMode(true);
		} else {
			// Open the container — select mode is activated via the panel's SelectElementButton
			const panelUrl = `${SERVER_ORIGIN}/panel`;
			if (!state.activeContainer.isOpen()) {
				state.activeContainer.open(panelUrl);
			}
		}
	} else {
		btn.classList.remove("active");
		sessionStorage.removeItem(PANEL_OPEN_KEY);
		setSelectMode(false);
		if (!insideStorybook) {
			state.activeContainer.close();
		}
		revertPreview();
		clearHighlights();
	}
}

export function showToast(message: string, duration: number = 3000): void {
	const toast = document.createElement("div");
	toast.className = "toast";
	toast.textContent = message;
	state.shadowRoot.appendChild(toast);
	requestAnimationFrame(() => toast.classList.add("visible"));
	setTimeout(() => {
		toast.classList.remove("visible");
		setTimeout(() => toast.remove(), 200);
	}, duration);
}







/**
 * Full reset: clear all interaction state and deactivate selection.
 * Called on SPA navigation and Storybook story changes.
 */
function resetOnNavigation(): void {
	if (isTextEditing()) endTextEdit(false);
	revertPreview();
	clearHighlights();
	dismissDepthPicker();
	cancelInsert();
	clearLockedInsert();
	removeAllDesignCanvases();
	clearSelectionState();
	setSelectMode(false);
	sendTo("panel", { type: "RESET_SELECTION" });
	sendTo("panel", { type: "COMPONENT_DISARMED" });
}

function getDefaultContainer(): ContainerName {
	try {
		const stored = localStorage.getItem("tw-panel-container");
		if (
			stored &&
			(stored === "modal" ||
				stored === "popover" ||
				stored === "sidebar" ||
				stored === "popup")
		) {
			return stored as ContainerName;
		}
	} catch {
		/* ignore */
	}
	return "sidebar";
}

function init(): void {
	// Running inside the VyBit panel itself — do not activate the overlay.
	// This prevents infinite nesting when the panel is embedded in a sidebar.
	if ((window as any).__VYBIT_PANEL__) return;

	// Ghost frames used for component extraction must not run the overlay —
	// they would send spurious RESET_SELECTION messages. Ghost frames get
	// ?vybit-ghost=1 from AdaptiveIframe.
	const params = new URLSearchParams(location.search);
	if (params.get('vybit-ghost') === '1') return;

	state.shadowHost = document.createElement("div");
	state.shadowHost.id = "tw-visual-editor-host";
	state.shadowHost.style.cssText = css(SHADOW_HOST);
	document.body.appendChild(state.shadowHost);

	state.shadowRoot = state.shadowHost.attachShadow({ mode: "open" });

	const style = document.createElement("style");
	style.textContent = OVERLAY_CSS;
	state.shadowRoot.appendChild(style);

	// Wire up toolbar callbacks (avoids circular deps)
	initToolbar({ setSelectMode, showToast, onBrowseLocked, rebuildSelectionFromSources, setAddMode });
	initDesignCanvasManager({ serverOrigin: SERVER_ORIGIN, showToast });

	// Initialize containers
	state.containers = {
		popover: new PopoverContainer(state.shadowRoot),
		modal: new ModalContainer(state.shadowRoot),
		sidebar: new SidebarContainer(state.shadowRoot),
		popup: new PopupContainer(),
	};
	state.activeContainer = state.containers[getDefaultContainer()];

	const btn = document.createElement("button");
	btn.className = "toggle-btn";
	btn.setAttribute("aria-label", "Open VyBit inspector");
	btn.innerHTML = VYBIT_LOGO_SVG;
	btn.addEventListener("click", () => toggleInspect(btn));
	if (insideStorybook) {
		btn.style.display = 'none';
	}
	state.shadowRoot.appendChild(btn);

	// Storybook story change — reset all interaction state and return to select mode
	window.addEventListener('message', (event) => {
		if (event.data?.type === 'STORYBOOK_STORY_RENDERED') {
			if (state.active) {
				resetOnNavigation();
			}
		}
	});

	// Escape key — exit add-mode, deselect element (keep mode), or deactivate mode
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			// Exit add-mode first if active
			if (state.addMode) {
				setAddMode(false);
				return;
			}
			if (state.currentTargetEl) {
				// Deselect element, stay in current mode
				revertPreview();
				clearHighlights();
				clearSelectionState();
				// Re-enter selection/browse mode (don't send RESET_SELECTION — that nukes the panel to landing)
				if (state.currentMode === 'select') {
					setSelectMode(true);
					sendTo("panel", { type: "DESELECT_ELEMENT" });
				} else if (state.currentMode === 'insert') {
					sendTo("panel", { type: "DESELECT_ELEMENT" });
					startBrowse(state.shadowHost, onBrowseLocked);
				} else {
					sendTo("panel", { type: "RESET_SELECTION" });
				}
			} else if (state.selectModeOn) {
				// No element, deactivate select mode → go to landing
				setSelectMode(false);
				sendTo("panel", { type: "MODE_CHANGED", mode: null });
			} else if (isDropZoneActive()) {
				// No element, cancel insert mode → go to landing
				cancelInsert();
				clearLockedInsert();
				sendTo("panel", { type: "MODE_CHANGED", mode: null });
			}
		}
	});

	// WebSocket connection — derive WS URL from script src
	// In proxy mode (overlay served from same origin), use /__vybit_ws path
	// so Vite can proxy the WebSocket to the VyBit server.
	const isProxied = SERVER_ORIGIN === window.location.origin;
	const wsUrl = isProxied
		? `${window.location.origin.replace(/^http/, "ws")}/__vybit_ws`
		: SERVER_ORIGIN.replace(/^http/, "ws");
	debugLog('tw-overlay', `Connecting WebSocket to: ${wsUrl} (proxied=${isProxied})`);
	connect(wsUrl, SERVER_ORIGIN);

	// Handle messages from Panel via WS
	onMessage((msg: any) => {
		if (msg.type === "TOGGLE_SELECT_MODE") {
			if (msg.active) {
				state.active = true;
				sessionStorage.setItem(PANEL_OPEN_KEY, "1");
				setSelectMode(true);
				// Ensure panel is open (skip in Storybook — panel lives in addon tab)
				if (!insideStorybook) {
					const panelUrl = `${SERVER_ORIGIN}/panel`;
					if (!state.activeContainer.isOpen()) state.activeContainer.open(panelUrl);
				}
			} else {
				setSelectMode(false);
			}
		} else if (msg.type === "MODE_CHANGED") {
			// Mark VyBit as active when any mode is engaged
			if (msg.mode) {
				state.active = true;
				sessionStorage.setItem(PANEL_OPEN_KEY, "1");
			}
			// Clear current selection and toolbar
			revertPreview();
			clearHighlights();
			cancelInsert();
			clearLockedInsert();
			clearSelectionState();

			state.currentMode = msg.mode;
			if (msg.mode === 'insert') {
				setSelectMode(false);
				if (state.tabPreference === 'design') state.tabPreference = 'component';
				state.currentTab = resolveTab();
				startBrowse(state.shadowHost, onBrowseLocked);
			} else if (msg.mode === 'select') {
				state.currentTab = resolveTab();
				setSelectMode(true);
			} else {
				// bug-report or null — no element selection
				setSelectMode(false);
			}
		} else if (msg.type === "TAB_CHANGED") {
			state.currentTab = msg.tab;
			state.tabPreference = (msg.tab === 'replace' || msg.tab === 'place') ? 'component' : 'design';
			state.replaceDirection = (msg.tab === 'replace' && state.currentTargetEl) ? 'element-first' : null;
			// Rebuild toolbar to highlight the correct action button
			if (state.currentTargetEl) showDrawButton(state.currentTargetEl);
		} else if (msg.type === "CANCEL_MODE") {
			// Panel sent Escape — deactivate select/insert mode
			setSelectMode(false);
			cancelInsert();
			clearLockedInsert();
		} else if (
			msg.type === "PATCH_PREVIEW" &&
			state.currentEquivalentNodes.length > 0 &&
			!isTextEditing()
		) {
			applyPreview(
				state.currentEquivalentNodes,
				msg.oldClass,
				msg.newClass,
				SERVER_ORIGIN,
			);
		} else if (
			msg.type === "PATCH_PREVIEW_BATCH" &&
			state.currentEquivalentNodes.length > 0 &&
			!isTextEditing()
		) {
			applyPreviewBatch(state.currentEquivalentNodes, msg.pairs, SERVER_ORIGIN);
		} else if (msg.type === "PATCH_REVERT" && !isTextEditing()) {
			revertPreview();
		} else if (msg.type === "PATCH_REVERT_STAGED" && state.currentEquivalentNodes.length > 0) {
			// Undo a previously committed staged change: apply the reverse swap to the DOM
			// and commit it as the new baseline without telling the server.
			applyPreview(state.currentEquivalentNodes, msg.oldClass, msg.newClass, SERVER_ORIGIN)
				.then(() => commitPreview());
		} else if (msg.type === "GHOST_UPDATE" && msg.patchId) {
			// Update a ghost element's HTML/CSS in the page DOM
			const ghostEl = document.querySelector(`[data-tw-dropped-patch-id="${msg.patchId}"]`) as HTMLElement | null;
			if (ghostEl) {
				const template = document.createElement('template');
				template.innerHTML = msg.ghostHtml.trim();
				const newContent = template.content.firstElementChild as HTMLElement | null;
				if (newContent) {
					// Preserve ghost tracking attributes on the replacement
					newContent.dataset.twDroppedPatchId = msg.patchId;
					newContent.dataset.twDroppedComponent = msg.componentName ?? ghostEl.dataset.twDroppedComponent ?? '';
					ghostEl.replaceWith(newContent);
					// Update current selection if we were pointing at this ghost
					if (state.currentTargetEl === ghostEl) {
						state.currentTargetEl = newContent;
						state.currentEquivalentNodes = [newContent];
						clearHighlights();
						highlightElement(newContent);
						showDrawButton(newContent);
					}
				}
				// Update injected CSS
				if (msg.ghostCss) {
					const compName = msg.componentName ?? ghostEl.dataset.twDroppedComponent ?? 'unknown';
					const styleId = `vybit-ghost-css-${compName}`;
					let styleEl = document.getElementById(styleId);
					if (!styleEl) {
						styleEl = document.createElement('style');
						styleEl.id = styleId;
						document.head.appendChild(styleEl);
					}
					styleEl.textContent = msg.ghostCss;
				}
			}
		} else if (
			msg.type === "PATCH_STAGE" &&
			state.currentTargetEl &&
			state.currentBoundary &&
			!isTextEditing()
		) {
			// Build context and send PATCH_STAGED to server
			const previewState = getPreviewState();
			const originalClassMap = new Map<HTMLElement, string>();
			if (previewState) {
				for (let i = 0; i < previewState.elements.length; i++) {
					originalClassMap.set(previewState.elements[i], previewState.originalClasses[i]);
				}
			}

			const targetElIndex = state.currentEquivalentNodes.indexOf(state.currentTargetEl);
			const originalClassString =
				previewState && targetElIndex !== -1
					? previewState.originalClasses[targetElIndex]
					: state.currentTargetEl.className;

			const context = buildContext(
				state.currentTargetEl,
				msg.oldClass,
				msg.newClass,
				originalClassMap,
			);

			send({
				type: "PATCH_STAGED",
				patch: {
					id: msg.id,
					elementKey: state.currentBoundary.componentName,
					status: "staged",
					originalClass: msg.oldClass,
					newClass: msg.newClass,
					property: msg.property,
					timestamp: new Date().toISOString(),
					pageUrl: window.location.href,
					component: { name: state.currentBoundary.componentName },
					target: {
						tag: state.currentTargetEl.tagName.toLowerCase(),
						classes: originalClassString,
						innerText: (state.currentTargetEl.innerText || "").trim().slice(0, 60),
					},
					context,
				},
			});

			showToast("Change staged");

			// The staged change is now the baseline — clear preview tracking so the
			// next preview captures the current DOM state (with the staged class).
			// Special case: if this is an "add" (oldClass = '') with no prior preview,
			// the new class was never applied to the DOM. Apply it now, then commit
			// once the CSS is injected so the class renders immediately.
			if (!previewState && !msg.oldClass && msg.newClass) {
				applyPreview(state.currentEquivalentNodes, '', msg.newClass, SERVER_ORIGIN)
					.then(() => commitPreview());
			} else {
				commitPreview();
			}
		} else if (msg.type === "CLEAR_HIGHLIGHTS") {
			revertPreview();
			clearHighlights();
			cancelInsert();
			clearLockedInsert();
			if (msg.deselect) {
				state.currentEquivalentNodes = [];
				state.currentTargetEl = null;
				state.currentBoundary = null;
				state.cachedNearGroups = null;
			}
		} else if (msg.type === "SWITCH_CONTAINER") {
			const newName = msg.container as ContainerName;
			if (state.containers[newName] && newName !== state.activeContainer.name) {
				if (!insideStorybook) {
					const wasOpen = state.activeContainer.isOpen();
					state.activeContainer.close();
					state.activeContainer = state.containers[newName];
					if (wasOpen) {
						state.activeContainer.open(`${SERVER_ORIGIN}/panel`);
					}
				} else {
					state.activeContainer = state.containers[newName];
				}
			}
		} else if (msg.type === "INSERT_DESIGN_CANVAS") {
			if (msg.insertMode === 'replace') {
				if (state.currentTargetEl) {
					// Element already selected — capture screenshot and replace
					handleCaptureScreenshot();
				} else {
					// No element selected — arm element-select mode
					armElementSelect('Replace: Canvas', state.shadowHost, (target) => {
						const result = findExactMatches(target, state.shadowHost);
						const componentName = result.componentName ?? target.tagName.toLowerCase();
						state.currentTargetEl = target;
						state.currentBoundary = { componentName };
						state.currentEquivalentNodes = result.exactMatch;
						handleCaptureScreenshot();
					});
				}
			} else {
				// Check for a locked insertion point from browse mode
				const locked = getLockedInsert();
				console.log('[tw-debug] INSERT_DESIGN_CANVAS else branch, locked=', locked, 'currentTargetEl=', state.currentTargetEl);
				if (locked) {
					// Use the locked position
					state.currentTargetEl = locked.target;
					const boundary = detectComponent(locked.target);
					state.currentBoundary = boundary
						? { componentName: boundary.componentName }
						: { componentName: locked.target.tagName.toLowerCase() };
					state.currentEquivalentNodes = [locked.target];
					clearLockedInsert();
					console.log('[tw-debug] locked path — calling injectDesignCanvas, position=', locked.position, 'boundary=', state.currentBoundary);
					injectDesignCanvas(locked.position as InsertMode);
				} else {
					// No locked position — arm canvas drop-zone
					console.log('[tw-debug] arming generic insert...');
					armGenericInsert('Place: Canvas', state.shadowHost, (target, position) => {
						console.log('[tw-debug] armGenericInsert callback fired, target=', target, 'position=', position);
						try {
							console.log('[tw-debug] step 1: setting currentTargetEl');
							state.currentTargetEl = target;
							console.log('[tw-debug] step 2: calling detectComponent');
							const boundary = detectComponent(target);
							console.log('[tw-debug] step 3: boundary=', boundary);
							state.currentBoundary = boundary
								? { componentName: boundary.componentName }
								: { componentName: target.tagName.toLowerCase() };
							state.currentEquivalentNodes = [target];
							console.log('[tw-debug] step 4: state set, currentBoundary=', state.currentBoundary, '— calling injectDesignCanvas');
							injectDesignCanvas(position as InsertMode);
							console.log('[tw-debug] injectDesignCanvas returned OK');
						} catch (err) {
							console.error('[tw-debug] CALLBACK THREW (this is the real error):', err);
							if (err instanceof Error) {
								console.error('[tw-debug] message:', err.message, 'stack:', err.stack);
							}
						}
					});
				}
			}
		} else if (msg.type === "CAPTURE_SCREENSHOT") {
			handleCaptureScreenshot();
		} else if (msg.type === "DESIGN_SUBMITTED") {
			handleDesignSubmitted(msg);
		} else if (msg.type === "CLOSE_PANEL") {
			if (state.active) toggleInspect(btn);
		} else if (msg.type === "COMPONENT_ARM") {
			if (msg.insertMode === 'replace') {
				const doReplace = (target: HTMLElement) => {
					const result = findExactMatches(target, state.shadowHost);
					const componentName = result.componentName ?? target.tagName.toLowerCase();
					const ghost = replaceElement(target, msg);
					const selectionTarget = ghost ?? target;
					state.currentTargetEl = selectionTarget;
					state.currentBoundary = { componentName: msg.componentName };
					state.currentEquivalentNodes = [selectionTarget];
					requestAnimationFrame(() => {
						clearHighlights();
						highlightElement(selectionTarget);
						showDrawButton(selectionTarget);
					});
				};

				if (state.replaceDirection === 'element-first' && state.currentTargetEl) {
					// Element-first mode — replace the current target immediately
					doReplace(state.currentTargetEl);
				} else {
					// Component-first mode — arm crosshair to pick the target
					armElementSelect(`Replace: ${msg.componentName}`, state.shadowHost, doReplace);
				}
			} else if (!placeAtLockedInsert(msg)) {
				// No locked insert point — enter crosshair drop mode (Flow A)
				armInsert(msg, state.shadowHost);
			} else {
				// Flow B: placed at locked insert — clean up toolbar & selection
				clearHighlights();
				clearSelectionState();
			}
		} else if (msg.type === "COMPONENT_DISARM") {
			cancelInsert();
		} else if (msg.type === "DESIGN_CLOSE") {
			handleDesignClose();

			// Re-apply selection highlights and toolbar so the user can keep editing
			if (state.currentTargetEl && state.currentEquivalentNodes.length > 0) {
				for (const n of state.currentEquivalentNodes) {
					highlightElement(n);
				}
				showDrawButton(state.currentTargetEl);
			}
		} else if (msg.type === "RECORDING_GET_HISTORY") {
			recordingEngine.getHistory().then(snapshots => {
				sendTo("panel", { type: "RECORDING_HISTORY", snapshots });
			});
		} else if (msg.type === "RECORDING_GET_SNAPSHOT") {
			recordingEngine.getSnapshot(msg.snapshotId).then(snapshot => {
				if (snapshot) {
					sendTo("panel", { type: "RECORDING_SNAPSHOT", snapshot });
				}
			});
		} else if (msg.type === "RECORDING_GET_RANGE") {
			const ids: number[] = msg.ids ?? [];
			if (ids.length >= 2) {
				const min = Math.min(...ids);
				const max = Math.max(...ids);
				recordingEngine.getRange(min, max).then(snapshots => {
					sendTo("panel", { type: "RECORDING_RANGE", snapshots });
				});
			}
		} else if (msg.type === "BUG_REPORT_PICK_ELEMENT") {
			enterBugReportPickMode();
		} else if (msg.type === "THEME_PREVIEW" || msg.type === "THEME_PREVIEW_CSS") {
			applyThemePreview(msg);
		} else if (msg.type === "REQUEST_THEME_VARS") {
			sendThemeVars();
		}
	});

	// ── Unified reposition on scroll / resize ────────────────────────────────
	// Each function is a no-op when it has nothing visible to reposition,
	// so no branching is needed — just call them all.
	function repositionAll(): void {
		repositionHighlights();
		repositionToolbar();
		repositionDropZone();
	}
	window.addEventListener("resize", repositionAll);
	window.addEventListener("scroll", repositionAll, { capture: true, passive: true });

	// Auto-open panel if it was open before the last page refresh
	if (sessionStorage.getItem(PANEL_OPEN_KEY) === "1") {
		state.active = true;
		btn.classList.add("active");
		if (!insideStorybook) {
			state.activeContainer.open(`${SERVER_ORIGIN}/panel`);
		}
	}

	// Persist scroll position before unload so the sidebar can restore it.
	// The browser's own scroll restoration hasn't run yet when the overlay
	// restructures the DOM, so we save the ratio to sessionStorage.
	window.addEventListener("beforeunload", () => {
		const wrapper = document.getElementById('tw-page-wrapper');
		saveScrollRatio(wrapper);
	});

	window.addEventListener("overlay-ws-connected", () => {
		if (state.wasConnected) {
			showToast("Reconnected");
		}
		state.wasConnected = true;
		// Send theme vars to panel on every connect/reconnect
		sendThemeVars();
	});

	window.addEventListener("overlay-ws-disconnected", () => {
		if (state.wasConnected) {
			showToast("Connection lost — restart the server and refresh.", 5000);
		}
	});

	// Start always-on background recording once WS is connected
	window.addEventListener('overlay-ws-connected', () => {
		recordingEngine.startRecording().catch(err => {
			console.error("[tw-overlay] Failed to start recording:", err);
		});
	}, { once: true });
}

// Recording engine — always-on background recording
const recordingEngine = new RecordingEngine({
	serverOrigin: SERVER_ORIGIN,
	onNewSnapshot: (meta) => {
		sendTo("panel", { type: "RECORDING_SNAPSHOT_META", meta });
	},
	onNavigation: () => {
		if (state.active) resetOnNavigation();
	},
	isClickSuppressed: () => state.selectModeOn || state.currentMode === 'insert' || bugReportPickCleanup !== null,
});

// Bug report element pick mode
let bugReportPickCleanup: (() => void) | null = null;

function enterBugReportPickMode(): void {
	// Clean up any existing pick mode
	if (bugReportPickCleanup) bugReportPickCleanup();

	document.documentElement.style.cursor = "crosshair";

	const handleClick = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const target = e.target as HTMLElement;
		if (!target || target === state.shadowHost || e.composedPath().some(el => el === state.shadowHost)) {
			return;
		}

		const boundary = detectComponent(target);

		// Build selector path
		const selectorPath = buildSelectorPath(target);

		const rect = target.getBoundingClientRect();
		const element: BugReportElement = {
			tag: target.tagName.toLowerCase(),
			id: target.id || undefined,
			classes: typeof target.className === 'string' ? target.className : '',
			selectorPath,
			componentName: boundary?.componentName,
			outerHTML: target.outerHTML.slice(0, 10000),
			boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
		};

		sendTo("panel", { type: "BUG_REPORT_ELEMENT_PICKED", element });
		cleanup();
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			sendTo("panel", { type: "BUG_REPORT_PICK_CANCELLED" });
			cleanup();
		}
	};

	function cleanup() {
		document.documentElement.style.cursor = "";
		document.removeEventListener("click", handleClick, { capture: true });
		document.removeEventListener("keydown", handleKeydown, { capture: true });
		document.removeEventListener("mousemove", mouseMoveHandler);
		clearHoverPreview();
		bugReportPickCleanup = null;
	}

	document.addEventListener("click", handleClick, { capture: true });
	document.addEventListener("keydown", handleKeydown, { capture: true });
	document.addEventListener("mousemove", mouseMoveHandler, { passive: true });

	bugReportPickCleanup = cleanup;
}

function buildSelectorPath(el: HTMLElement): string {
	const parts: string[] = [];
	let current: HTMLElement | null = el;
	while (current && current !== document.body) {
		let selector = current.tagName.toLowerCase();
		if (current.id) {
			selector += `#${current.id}`;
		} else if (current.className && typeof current.className === 'string') {
			const cls = current.className.trim().split(/\s+/).slice(0, 2).join('.');
			if (cls) selector += `.${cls}`;
		}
		parts.unshift(selector);
		current = current.parentElement;
	}
	return parts.join(' > ');
}

init();
