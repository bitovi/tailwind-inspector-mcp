import { armInsert, armGenericInsert, armElementSelect, cancelInsert, replaceElement, placeAtLockedInsert, startBrowse, getLockedInsert, clearLockedInsert, isActive as isDropZoneActive, findGhostAncestor, repositionOnScroll as repositionDropZone, injectGhostCss, buildSelector } from "./drop-zone";
import { isTextEditing, handleTextEditingClick, endTextEdit } from "./text-edit";
import { debugLog } from "../../shared/vybit-env";
import type { ContainerName, IContainer } from "./containers/IContainer";
import { PopupContainer } from "./containers/PopupContainer";
import "./web-components/vb-modal-container"; // side-effect: registers custom element
import "./web-components/vb-popover-container";
import "./web-components/vb-sidebar-container";
import type { VbModalContainer } from "./web-components/vb-modal-container";
import type { VbPopoverContainer } from "./web-components/vb-popover-container";
import type { VbSidebarContainer } from "./web-components/vb-sidebar-container";
import { buildContext, buildDeleteContext } from "./context";
import { detectComponent } from "./framework-detect";
import './design-canvas/index';
import { css, SHADOW_HOST, OVERLAY_CSS } from './styles';
import { VYBIT_LOGO_SVG } from './svg-icons';
import { saveScrollRatio } from './preserve-scroll';
import { findExactMatches } from "./grouping";
import { initDragDrop } from "./drag-drop";
import { initDragMove, revertMove } from "./drag-move";
import { getFiber, findOwningComponent, extractComponentProps } from "./react/fiber";
import { isAngularElement, findOwningComponent as findAngularOwningComponent, extractAngularComponentProps } from "./angular/detect";
import type { InsertMode } from "./messages";
import {
	applyPreview,
	applyPreviewBatch,
	commitPreview,
	ensureCommittedCss,
	getPreviewState,
	revertPreview,
} from "./patcher";
import { connect, onMessage, send, sendTo } from "./ws";
import { state, resolveTab, clearSelectionState } from "./overlay-state";
import { dom } from "./overlay-dom";
import { highlightElement, clearHighlights, clearHoverPreview, mouseMoveHandler, repositionHighlights } from "./element-highlight";
import { showDrawButton, initToolbar, repositionToolbar, showGroupPicker } from "./element-toolbar";
import { initElementDrawer, removeElementDrawer } from "./element-drawer";
import { injectDesignCanvas, handleCaptureScreenshot, handleDesignSubmitted, handleDesignClose, initDesignCanvasManager, removeAllDesignCanvases } from "./design-canvas-manager";
import { RecordingEngine } from "./recording/recording-engine";
import { getSameRectCandidates, showDepthPicker, dismissDepthPicker } from "./depth-picker";
import { showBottomToolbar, hideBottomToolbar, initBottomToolbar, updateToolState, updateInstanceCount, repositionBottomToolbar, getPageCenterX, setToolOverrides, clearToolOverrides, resetToolbar, setTextEditingLock } from "./bottom-toolbar";
import type { BugReportElement } from "../../shared/types";
import { setClipboard, getClipboard, extractGhostCssForElement } from "./clipboard";
import { initStateMachine, dispatch, getState, subscribe, type EffectDeps } from './overlay-state-machine';
import type { ToolbarVisual, ToolButtonVisual } from './overlay-state-machine/types';
import type { EditTool } from '../../shared/types';
import { createKeydownHandler } from './keyboard-handler';
import { createWsMessageHandler } from './ws-handler';

/** Callback for startBrowse — when user locks an insertion point, set it as current target and show toolbar */
function onBrowseLocked(target: HTMLElement): void {
	state.currentTargetEl = target;
	state.currentEquivalentNodes = [target];
	const boundary = detectComponent(target);
	state.currentBoundary = boundary
		? { componentName: boundary.componentName }
		: { componentName: target.tagName.toLowerCase() };
	state.cachedNearGroups = null;
	// Don't dispatch ELEMENT_SELECTED — that would show selection highlights.
	// The drop-zone already dispatched INSERT_POINT_LOCKED to the SM and
	// sent INSERT_POINT_LOCKED to the panel. We just need the element drawer.
	showDrawButton(target);
	// Persistent browse: stay orange (picking) — browse continues
	updateToolState('insert', true, false);
	updateInstanceCount(state.currentEquivalentNodes.length);
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
	if (dom.tailwindConfigCache) {
		return dom.tailwindConfigCache;
	}
	try {
		const res = await fetch(`${SERVER_ORIGIN}/tailwind-config`, { credentials: 'include' });
		dom.tailwindConfigCache = await res.json();
		return dom.tailwindConfigCache;
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
	if (composed.some((el) => el === dom.shadowHost)) { return; }

	// While text editing, suppress page click handlers (buttons, links, etc.)
	if (handleTextEditingClick(e)) return;

	// Ignore clicks during any exclusive interaction (drag-move, component-drag, text-editing)
	if (getState().interaction.kind !== 'none') return;

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

	// ── Persistent select: clicks inside the selected element pass through ──
	// Don't preventDefault, don't intercept — let the page handle the click normally.
	const clickTarget = e.target as HTMLElement;
	if (state.selectModeOn && state.currentTargetEl && !state.addMode && !e.shiftKey) {
		if (state.currentTargetEl === clickTarget || state.currentTargetEl.contains(clickTarget)) {
			return;
		}
	}

	e.preventDefault();
	e.stopPropagation();

	const target = e.target as Element;
	const targetEl = target as HTMLElement;
	let classString =
		typeof targetEl.className === "string" ? targetEl.className : "";

	// ── Add-mode: toggle element in/out of selection ──
	if (state.addMode) {
		// TODO: dispatch to state machine (add-mode modifies equivalentNodes incrementally)
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
		dom.shadowRoot
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
				tailwindConfig: dom.tailwindConfigCache,
			});
		}
		// Refresh picker UI (count chip, etc.) if open
		dom.pickerRefreshCallback?.();
		return;
	}

	// ── Shift+click: toggle element in/out of current selection ──
	if (e.shiftKey && state.currentTargetEl) {
		// TODO: dispatch to state machine (shift+click modifies equivalentNodes incrementally)
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
				tailwindConfig: dom.tailwindConfigCache,
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

	const result = findExactMatches(targetEl, dom.shadowHost);
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

	const config = await fetchTailwindConfig();

	// Store DOM caches/infrastructure (not tracked by SM)
	state.currentEquivalentNodes = [targetEl];
	state.currentTargetEl = targetEl;
	state.currentBoundary = { componentName };
	state.cachedNearGroups = null;
	state.cachedExactMatches = result.exactMatch;
	state.manuallyAddedNodes = new Set<HTMLElement>();

	dom.currentInstances = [{
		index: 0,
		label: (targetEl.innerText || "").trim().slice(0, 40) || `#1`,
		parent: targetEl.parentElement?.tagName.toLowerCase() ?? "",
	}];

	// Dispatch to SM — handles highlights, draw button, grab cursor, toolbar
	dispatch({
		type: 'ELEMENT_SELECTED',
		el: targetEl,
		equivalentNodes: [targetEl],
		boundary: { componentName },
	});

	updateInstanceCount(state.currentEquivalentNodes.length);

	if (!insideStorybook) {
		const panelUrl = `${SERVER_ORIGIN}/panel`;
		if (!dom.activeContainer.isOpen()) {
			dom.activeContainer.open(panelUrl);
		}
	}

	const resolvedConfig = config ? resolveConfigCssVars(config) : config;

	// Extract component props from React Fiber if available
	let componentProps: Record<string, unknown> | undefined;
	const fiber = getFiber(targetEl);
	if (fiber) {
		const boundary = findOwningComponent(fiber);
		if (boundary) {
			componentProps = extractComponentProps(boundary.componentFiber) ?? undefined;
			componentName = boundary.componentName;
		}
	}

	// Extract component props from Angular if available (and React didn't match)
	if (!componentProps && isAngularElement(targetEl)) {
		const boundary = findAngularOwningComponent(targetEl);
		if (boundary) {
			const instance = boundary.componentFiber;
			let hostEl: Element;

			if (instance instanceof Element) {
				hostEl = instance;
			} else {
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
			tailwindConfig: dom.tailwindConfigCache,
		});
	}
}

export { rebuildSelectionFromSources };

function setSelectMode(on: boolean): void {
	console.log(`[paste-debug] setSelectMode(${on}) — currentTargetEl=${!!state.currentTargetEl}`);
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
	const wasActive = state.active;
	console.log('[toggle-debug] toggleInspect called, wasActive=', wasActive, 'insideStorybook=', insideStorybook, 'activeContainer=', dom.activeContainer?.name);
	if (!wasActive) {
		dispatch({ type: 'ACTIVATE' });
		btn.classList.add("active");
		btn.style.display = 'none';
		sessionStorage.setItem(PANEL_OPEN_KEY, "1");
		if (insideStorybook) {
			// In Storybook the panel is already in the addon tab — go straight to select mode
			setSelectMode(true);
		} else {
			// Open the container — select mode is activated via the panel's SelectElementButton
			const panelUrl = `${SERVER_ORIGIN}/panel`;
			console.log('[toggle-debug] Opening container, isOpen=', dom.activeContainer.isOpen(), 'panelUrl=', panelUrl);
			if (!dom.activeContainer.isOpen()) {
				dom.activeContainer.open(panelUrl);
				console.log('[toggle-debug] Container opened, checking iframe...');
				setTimeout(() => {
					const iframe = dom.shadowRoot.querySelector('iframe');
					console.log('[toggle-debug] iframe found=', !!iframe, 'src=', iframe?.src);
				}, 500);
			}
		}
	} else {
		dispatch({ type: 'DEACTIVATE' });
		btn.classList.remove("active");
		btn.style.display = '';
		sessionStorage.removeItem(PANEL_OPEN_KEY);
		if (!insideStorybook) {
			dom.activeContainer.close();
		}
	}
}

export function showToast(message: string, duration: number = 3000): void {
	const toast = document.createElement("div");
	toast.className = "toast";
	toast.textContent = message;
	toast.style.left = `${getPageCenterX()}px`;
	dom.shadowRoot.appendChild(toast);
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
	dismissDepthPicker();
	removeAllDesignCanvases();
	dispatch({ type: 'NAVIGATION_RESET' });
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

	dom.shadowHost = document.createElement("div");
	dom.shadowHost.id = "tw-visual-editor-host";
	dom.shadowHost.style.cssText = css(SHADOW_HOST);
	// Restore color scheme preference
	try {
		const scheme = localStorage.getItem('vybit-color-scheme');
		if (scheme === 'light') dom.shadowHost.classList.add('light');
	} catch { /* ignore */ }
	document.body.appendChild(dom.shadowHost);

	dom.shadowRoot = dom.shadowHost.attachShadow({ mode: "open" });

	const style = document.createElement("style");
	style.textContent = OVERLAY_CSS;
	dom.shadowRoot.appendChild(style);

	// Wire up toolbar callbacks (avoids circular deps)
	initToolbar({ setSelectMode, showToast, onBrowseLocked, rebuildSelectionFromSources, setAddMode });
	initElementDrawer({
		showToast,
		deactivateSelectMode: () => {
			if (state.selectModeOn) {
				dispatch({ type: 'CMD_TOGGLE_SELECT_MODE', active: false });
			}
			if (isDropZoneActive()) {
				cancelInsert();
				dispatch({ type: 'CMD_TOGGLE_INSERT_BROWSE', active: false });
			}
		},
	});
	initBottomToolbar({
		onToolChange: (tool) => {
			dispatch({ type: 'TOOLBAR_TOOL_CLICK', tool });
		},
		onAdjunctClick: () => {
			console.log('[index] onAdjunctClick fired', {
				pickerEl: !!dom.pickerEl,
				currentTargetEl: !!state.currentTargetEl,
			});
			// Toggle group picker from the bottom toolbar's 1+ button
			if (dom.pickerEl) {
				dom.pickerEl.remove();
				dom.pickerEl = null;
			} else if (state.currentTargetEl) {
				// Use the adjunct button inside the vb-button-group web component as anchor
				const anchor = dom.shadowRoot.querySelector('vb-button-group .vb-btn-group__adjunct') as HTMLElement;
				console.log('[index] adjunct anchor element:', anchor);
				if (anchor) {
					showGroupPicker(
						anchor,
						() => {},
						(totalCount) => {
							updateInstanceCount(totalCount);
						},
					);
				} else {
					console.log('[index] anchor NOT found — tried: vb-button-group .vb-btn-group__adjunct');
				}
			} else {
				console.log('[index] no currentTargetEl — nothing to show group picker for');
			}
		},
	});
	initDesignCanvasManager({ serverOrigin: SERVER_ORIGIN, showToast });

	// ── Initialize overlay state machine ─────────────────────────────────
	// The state machine provides a pure reducer for all mode/interaction
	// transitions. Effects are executed via the deps interface below.
	// A subscriber keeps the legacy overlay-state.ts in sync during migration.

	const smEffectDeps: EffectDeps = {
		revertPreview: () => revertPreview(),
		clearHighlights: () => clearHighlights(),
		clearHoverPreview: () => clearHoverPreview(),
		clearSelectionState: () => clearSelectionState(),
		highlightElement: (el) => highlightElement(el),
		showDrawButton: (el) => showDrawButton(el),
		removeDrawButton: () => removeElementDrawer(),
		setGrabCursor: (el) => { el.style.cursor = 'grab'; },
		clearGrabCursor: (el) => { el.style.cursor = ''; },
		startBrowse: () => startBrowse(dom.shadowHost, onBrowseLocked),
		cancelInsert: () => cancelInsert(),
		clearLockedInsert: () => clearLockedInsert(),
		showToolbar: () => showBottomToolbar(),
		hideToolbar: () => hideBottomToolbar(),
		updateToolbar: (visual: ToolbarVisual) => {
			// Bridge from ToolbarVisual to existing updateToolState API.
			// Handle override states (completed = paste flow)
			if (visual.select === 'completed' || visual.insert === 'completed') {
				const overrides: Record<string, string> = {};
				for (const [key, val] of Object.entries(visual)) {
					if (val !== 'gray') overrides[key] = val;
				}
				setToolOverrides(overrides as any);
				return;
			}
			// Normal case: find active tool and its state
			const tool: EditTool =
				(visual.select !== 'gray') ? 'select'
				: (visual.text !== 'gray') ? 'text'
				: (visual.insert !== 'gray') ? 'insert'
				: null;
			const picking = tool ? visual[tool as keyof ToolbarVisual] === 'picking' : false;
			const engaged = tool ? visual[tool as keyof ToolbarVisual] === 'engaged' : false;
			updateToolState(tool, picking, engaged);
		},
		sendToPanel: (msg) => sendTo('panel', msg),
		setSelectMode: (on) => setSelectMode(on),
		openPanel: () => {
			if (!insideStorybook) {
				const panelUrl = `${SERVER_ORIGIN}/panel`;
				if (!dom.activeContainer.isOpen()) dom.activeContainer.open(panelUrl);
			}
		},
		setTextEditingLock: (locked) => setTextEditingLock(locked),
	};

	initStateMachine(smEffectDeps);

	// Sync state machine → legacy overlay-state.ts so modules that still
	// read the old `state` object (click handlers, drag-move, etc.) see
	// consistent values. This bridge is temporary — modules will be
	// migrated to read from getState() directly.
	subscribe((newState) => {
		(state as any).currentMode = newState.mode;
		state.selectModeOn = newState.selectPhase === 'picking';
		state.currentTab = newState.currentTab;
		state.tabPreference = newState.tabPreference;
		state.active = newState.active;
		state.currentTargetEl = newState.selectedEl;
		state.currentEquivalentNodes = newState.equivalentNodes;
		state.currentBoundary = newState.boundary;
		state.exclusiveInteraction =
			newState.interaction.kind === 'drag-moving' ? 'drag-moving'
			: newState.interaction.kind === 'component-drag' ? 'component-drag'
			: newState.interaction.kind === 'text-editing' ? 'text-editing'
			: null;

		// Keep bottom toolbar badge in sync with equivalent nodes
		updateInstanceCount(newState.equivalentNodes.length);
	});

	// Initialize containers using Web Components
	const createModalContainer = (): IContainer => {
		const el = document.createElement('vb-modal-container') as VbModalContainer;
		dom.shadowRoot.appendChild(el);
		return {
			name: 'modal' as const,
			open: (url: string) => el.open(url),
			close: () => el.close(),
			isOpen: () => el.isOpen,
		};
	};

	const createPopoverContainer = (): IContainer => {
		const el = document.createElement('vb-popover-container') as VbPopoverContainer;
		dom.shadowRoot.appendChild(el);
		return {
			name: 'popover' as const,
			open: (url: string) => el.open(url),
			close: () => el.close(),
			isOpen: () => el.isOpen,
		};
	};

	const createSidebarContainer = (): IContainer => {
		const el = document.createElement('vb-sidebar-container') as VbSidebarContainer;
		dom.shadowRoot.appendChild(el);
		return {
			name: 'sidebar' as const,
			open: (url: string) => el.open(url),
			close: () => el.close(),
			isOpen: () => el.isOpen,
		};
	};

	dom.containers = {
		popover: createPopoverContainer(),
		modal: createModalContainer(),
		sidebar: createSidebarContainer(),
		popup: new PopupContainer(),
	};
	dom.activeContainer = dom.containers[getDefaultContainer()];

	// Initialize drag-drop placement (listens for postMessage from panel)
	initDragDrop(
		dom.shadowHost,
		// onDragStart: determine drag mode from current button state, preserve mode
		() => {
			// Clear visual clutter but NOT mode state
			cancelInsert();
			clearLockedInsert();
			clearHighlights();
			clearSelectionState();

			if (state.selectModeOn) {
				// Select is active → drag will replace
				return 'replace';
			}

			// Insert active or both gray → drag will insert.
			// If both are gray, activate insert mode so the button turns orange.
			if (state.currentMode !== 'insert') {
				state.currentMode = 'insert';
				setSelectMode(false);
				sendTo("panel", { type: "MODE_CHANGED", mode: "insert" });
			}
			return 'insert';
		},
		// onDrop: in replace mode, select the dropped element; in insert mode, stay in insert
		(el: HTMLElement, mode) => {
			if (mode === 'replace') {
				finalizeSelection(el);
			}
			// insert mode: don't select — stay in insert mode for subsequent drags
		},
	);

	// Initialize drag-to-move (mousedown on selected element to reorder/reparent)
	initDragMove(dom.shadowHost);

	const btn = document.createElement("button");
	btn.className = "toggle-btn";
	btn.setAttribute("aria-label", "Open VyBit inspector");
	btn.innerHTML = VYBIT_LOGO_SVG;
	btn.addEventListener("click", () => toggleInspect(btn));
	if (insideStorybook) {
		btn.style.display = 'none';
	}
	dom.shadowRoot.appendChild(btn);

	// Storybook story change — reset all interaction state and return to select mode
	window.addEventListener('message', (event) => {
		if (event.data?.type === 'STORYBOOK_STORY_RENDERED') {
			if (state.active) {
				resetOnNavigation();
			}
		}
	});

	// Escape key — layered escape for select and insert modes
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			// Exit add-mode first if active (SM doesn't handle add-mode yet)
			if (state.addMode) {
				setAddMode(false);
				return;
			}

			// Dispatch through the state machine — it handles:
			// - Insert: browsing+locked → locked, locked → off, browsing → off
			// - Select: picking+element → engaged, engaged → off, picking → off
			const prevState = getState();
			dispatch({ type: 'ESCAPE' });
			const newState = getState();

			// If the SM handled it (state changed), we're done
			if (prevState !== newState) return;

			// Fallback: non-select/insert mode with a selected element
			// (e.g. element selected while in a mode that was cancelled)
			if (state.currentTargetEl) {
				revertPreview();
				clearHighlights();
				clearSelectionState();
				resetToolbar();
				if (state.currentMode === 'insert') {
					sendTo("panel", { type: "DESELECT_ELEMENT" });
					startBrowse(dom.shadowHost, onBrowseLocked);
				} else {
					sendTo("panel", { type: "RESET_SELECTION" });
				}
			}
		}
	});

	// ── Delete / Copy / Paste / Cut / Duplicate ─────────────────────────────
	document.addEventListener("keydown", createKeydownHandler({
		serverOrigin: SERVER_ORIGIN,
		showToast,
		setSelectMode,
	}));

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
	onMessage(createWsMessageHandler({
		serverOrigin: SERVER_ORIGIN,
		panelOpenKey: PANEL_OPEN_KEY,
		insideStorybook,
		closePanel: () => toggleInspect(btn),
		getRecordingEngine: () => recordingEngine,
		enterBugReportPickMode,
		applyThemePreview,
		sendThemeVars,
		showToast,
	}));

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
		btn.style.display = 'none';
		showBottomToolbar();
		if (!insideStorybook) {
			dom.activeContainer.open(`${SERVER_ORIGIN}/panel`);
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
		if (dom.wasConnected) {
			showToast("Reconnected");
		}
		dom.wasConnected = true;
		// Send theme vars to panel on every connect/reconnect
		sendThemeVars();
	});

	window.addEventListener("overlay-ws-disconnected", () => {
		if (dom.wasConnected) {
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
		if (!target || target === dom.shadowHost || e.composedPath().some(el => el === dom.shadowHost)) {
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
