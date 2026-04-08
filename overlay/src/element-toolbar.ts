// Element toolbar — unified bar shown above the selected element.
// Extracted from index.ts. Contains showDrawButton() and showGroupPicker().

import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { cancelInsert, clearLockedInsert, getLockedInsert, startBrowse } from "./drop-zone";
import { highlightElement, clearHighlights, removeDrawButton } from "./element-highlight";
import { computeNearGroups, findSamePathElements } from "./grouping";
import type { PathMatchResult } from "./grouping";
import { state, resolveTab, clearSelectionState } from "./overlay-state";
import { revertPreview } from "./patcher";
import { SELECT_SVG, INSERT_SVG, DESIGN_SVG, TEXT_SVG, REPLACE_SVG, SEND_SVG, MIC_SVG, DRAG_GRIP_SVG } from "./svg-icons";
import { startTextEdit } from "./text-edit";
import { buildContext, buildInsertContext, buildTextContext } from "./context";
import { send, sendTo } from "./ws";

// Detect Web Speech API (Chrome/Edge: webkitSpeechRecognition, Safari: SpeechRecognition)
const SpeechRecognitionAPI: (new () => any) | null =
	typeof window !== "undefined"
		? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null)
		: null;

// Mic-blocked banner shown at top of page (not a toast)
let activeBanner: HTMLElement | null = null;
let bannerTimeout: ReturnType<typeof setTimeout> | null = null;

function showMicBanner(message: string): void {
	// Remove existing banner first
	if (activeBanner) {
		activeBanner.remove();
		activeBanner = null;
	}
	if (bannerTimeout) {
		clearTimeout(bannerTimeout);
		bannerTimeout = null;
	}

	const banner = document.createElement("div");
	banner.className = "mic-banner";

	const text = document.createElement("span");
	text.textContent = message;
	banner.appendChild(text);

	const dismiss = document.createElement("button");
	dismiss.className = "mic-banner-dismiss";
	dismiss.textContent = "×";
	dismiss.addEventListener("click", () => {
		banner.classList.remove("visible");
		setTimeout(() => banner.remove(), 250);
		activeBanner = null;
		if (bannerTimeout) {
			clearTimeout(bannerTimeout);
			bannerTimeout = null;
		}
	});
	banner.appendChild(dismiss);

	state.shadowRoot.appendChild(banner);
	activeBanner = banner;

	requestAnimationFrame(() => banner.classList.add("visible"));

	bannerTimeout = setTimeout(() => {
		banner.classList.remove("visible");
		setTimeout(() => banner.remove(), 250);
		activeBanner = null;
		bannerTimeout = null;
	}, 8000);
}

// ── Drag state ──
let toolbarDragged = false;

export function isToolbarDragged(): boolean {
	return toolbarDragged;
}

function setupToolbarDrag(handle: HTMLElement, toolbar: HTMLElement): void {
	let startX = 0, startY = 0, startLeft = 0, startTop = 0;

	const onMove = (e: MouseEvent) => {
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		toolbar.style.left = `${startLeft + dx}px`;
		toolbar.style.top = `${startTop + dy}px`;
		// Snap message row directly below toolbar
		if (state.msgRowEl) {
			const tRect = toolbar.getBoundingClientRect();
			state.msgRowEl.style.left = `${tRect.left}px`;
			state.msgRowEl.style.top = `${tRect.bottom + 4}px`;
		}
		// Reposition picker if open
		if (state.pickerEl) {
			const addGroupBtn = toolbar.querySelector('.tb-adjunct') as HTMLElement | null;
			if (addGroupBtn) {
				positionWithFlip(addGroupBtn, state.pickerEl, 'bottom-start');
			}
		}
	};

	const onUp = () => {
		document.removeEventListener('mousemove', onMove);
		document.removeEventListener('mouseup', onUp);
	};

	handle.addEventListener('mousedown', (e) => {
		e.preventDefault();
		toolbarDragged = true;
		startX = e.clientX;
		startY = e.clientY;
		startLeft = parseFloat(toolbar.style.left) || 0;
		startTop = parseFloat(toolbar.style.top) || 0;
		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	});
}

// External callbacks set via initToolbar() — avoids circular dependencies
let setSelectMode: (on: boolean) => void;
let showToast: (message: string, duration?: number) => void;
let onBrowseLocked: (target: HTMLElement) => void;
let rebuildSelectionFromSources: () => void;
let setAddMode: (on: boolean) => void;

export function initToolbar(deps: {
	setSelectMode: (on: boolean) => void;
	showToast: (message: string, duration?: number) => void;
	onBrowseLocked: (target: HTMLElement) => void;
	rebuildSelectionFromSources: () => void;
	setAddMode: (on: boolean) => void;
}): void {
	setSelectMode = deps.setSelectMode;
	showToast = deps.showToast;
	onBrowseLocked = deps.onBrowseLocked;
	rebuildSelectionFromSources = deps.rebuildSelectionFromSources;
	setAddMode = deps.setAddMode;
}

async function positionWithFlip(
	anchor: HTMLElement,
	floating: HTMLElement,
	placement: "top-start" | "bottom-start" = "top-start",
	options?: { disableFlip?: boolean },
): Promise<"top-start" | "bottom-start"> {
	const middleware = options?.disableFlip
		? [offset(6)]
		: [offset(6), flip()];
	const { x, y, placement: resolved } = await computePosition(anchor, floating, {
		placement,
		middleware,
	});
	floating.style.left = `${x}px`;
	floating.style.top = `${y}px`;
	return resolved as "top-start" | "bottom-start";
}

/**
 * Position both toolbar and msgRow, avoiding overlap when toolbar flips below
 * the element (e.g. element is near top of viewport).
 */
export async function positionBothMenus(
	targetEl: HTMLElement,
	toolbar: HTMLElement,
	msgRow: HTMLElement | null,
): Promise<void> {
	const toolbarPlacement = await positionWithFlip(targetEl, toolbar, "top-start");
	if (!msgRow) return;
	const msgPlacement = await positionWithFlip(targetEl, msgRow, "bottom-start");

	if (toolbarPlacement === "bottom-start" && msgPlacement === "bottom-start") {
		// Top of viewport: both flipped below — stack msgRow under toolbar
		// Disable flip so msgRow doesn't re-flip back on top of toolbar
		await positionWithFlip(toolbar, msgRow, "bottom-start", { disableFlip: true });
	} else if (toolbarPlacement === "top-start" && msgPlacement === "top-start") {
		// Bottom of viewport: both flipped above — stack msgRow above toolbar
		// Disable flip so msgRow doesn't re-flip back on top of toolbar
		await positionWithFlip(toolbar, msgRow, "top-start", { disableFlip: true });
	}
	// Otherwise they're on opposite sides of the element — no overlap
}

export { positionWithFlip };

export function showDrawButton(targetEl: HTMLElement): void {
	removeDrawButton();
	toolbarDragged = false;

	const instanceCount = state.currentEquivalentNodes.length;

	// ── Build 3f unified toolbar ──────────────────────────────
	const toolbar = document.createElement("div");
	toolbar.className = "el-toolbar";
	toolbar.style.left = "0px";
	toolbar.style.top = "0px";
	state.shadowRoot.appendChild(toolbar);
	state.toolbarEl = toolbar;

	// ── Drag handle ──
	const dragHandle = document.createElement("div");
	dragHandle.className = "drag-handle";
	dragHandle.title = "Drag to move toolbar";
	dragHandle.innerHTML = DRAG_GRIP_SVG;
	toolbar.appendChild(dragHandle);
	setupToolbarDrag(dragHandle, toolbar);

	// ── Select mode group (ring when active) or standalone Select button ──
	if (state.currentMode === 'select') {
		// Full group: Select + separator + N+
		const selectGroup = document.createElement("div");
		selectGroup.className = 'mode-group ring';

		const selectBtn = document.createElement("button");
		selectBtn.className = 'tb tb-combo tb-select';
		selectBtn.innerHTML = `${SELECT_SVG} Select`;
		selectBtn.style.cssText = 'color: #5fd4da; border-radius: 0;';
		selectBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			cancelInsert();
			clearLockedInsert();
			revertPreview();
			clearHighlights();
			clearSelectionState();
			// Deselect element, stay in select mode so user can pick another
			setSelectMode(true);
			sendTo("panel", { type: "DESELECT_ELEMENT" });
		});
		selectGroup.appendChild(selectBtn);

		const innerSep = document.createElement("div");
		innerSep.className = "mode-sep";
		selectGroup.appendChild(innerSep);

		const addGroupBtn = document.createElement("button");
		addGroupBtn.className = "tb tb-adjunct";
		addGroupBtn.innerHTML = `${instanceCount} <span style="font-size:9px;margin-left:1px;opacity:0.6;">+</span>`;
		addGroupBtn.style.cssText = 'color: #5fd4da; border-radius: 0;';
		addGroupBtn.title = `${instanceCount} matching element${instanceCount !== 1 ? "s" : ""} selected — click to add similar`;
		addGroupBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			if (state.pickerEl) {
				state.pickerEl.remove();
				state.pickerEl = null;
			} else {
				showGroupPicker(
					addGroupBtn,
					() => {},
					(totalCount) => {
						addGroupBtn.innerHTML = `${totalCount} <span style="font-size:9px;margin-left:1px;opacity:0.6;">+</span>`;
						addGroupBtn.title = `${totalCount} matching element${totalCount !== 1 ? "s" : ""} selected — click to add similar`;
					},
				);
			}
		});
		selectGroup.appendChild(addGroupBtn);
		toolbar.appendChild(selectGroup);
	} else {
		// Insert mode: standalone Select button (no N+ group)
		const selectBtn = document.createElement("button");
		selectBtn.className = 'tb tb-combo tb-select';
		selectBtn.innerHTML = `${SELECT_SVG} Select`;
		selectBtn.style.cssText = 'opacity: 0.4;';
		selectBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			cancelInsert();
			clearLockedInsert();
			revertPreview();
			clearHighlights();
			clearSelectionState();
			state.currentMode = 'select';
			state.currentTab = resolveTab();
			sendTo("panel", { type: "MODE_CHANGED", mode: "select" });
			setSelectMode(true);
		});
		toolbar.appendChild(selectBtn);
	}

	// ── Insert button (separate, ring when active) ──
	const insertBtn = document.createElement("button");
	insertBtn.className = `tb tb-combo`;
	insertBtn.innerHTML = `${INSERT_SVG} Insert`;
	if (state.currentMode === 'insert') {
		insertBtn.style.cssText = `box-shadow: inset 0 0 0 1.5px #00848B; color: #5fd4da;`;
	} else {
		insertBtn.style.cssText = `opacity: 0.4;`;
	}
	insertBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		cancelInsert();
		clearLockedInsert();
		revertPreview();
		clearHighlights();
		setSelectMode(false);
		clearSelectionState();
		if (state.currentMode === 'insert') {
			// Already in insert mode — deselect element, re-enter browse mode
			sendTo("panel", { type: "DESELECT_ELEMENT" });
			startBrowse(state.shadowHost, onBrowseLocked);
			return;
		}
		state.currentMode = 'insert';
		if (state.tabPreference === 'design') state.tabPreference = 'component';
		state.currentTab = resolveTab();
		sendTo("panel", { type: "MODE_CHANGED", mode: "insert" });
		startBrowse(state.shadowHost, onBrowseLocked);
	});
	toolbar.appendChild(insertBtn);

	// ── Separator ──
	const sep = document.createElement("div");
	sep.className = "tb-sep";
	toolbar.appendChild(sep);

	// ── Action buttons (mode-dependent) ──
	if (state.currentMode === 'select') {
		const actions = [
			{ id: 'design', label: 'Design', svg: DESIGN_SVG },
			{ id: 'text', label: 'Text', svg: TEXT_SVG },
			{ id: 'replace', label: 'Replace', svg: REPLACE_SVG },
		];
		for (const action of actions) {
			const btn = document.createElement("button");
			btn.className = `tb tb-combo ${state.currentTab === action.id ? 'active' : ''}`;
			btn.innerHTML = `${action.svg} ${action.label}`;
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				if (action.id === 'text') {
					startTextEdit(targetEl, {
						sendTo,
						send,
						currentBoundary: state.currentBoundary,
						currentTargetEl: targetEl,
						currentEquivalentNodes: state.currentEquivalentNodes,
						buildTextContext,
						positionToolbar: () => positionWithFlip(targetEl, toolbar),
						repositionHighlights: () => {
							clearHighlights();
							state.currentEquivalentNodes.forEach((n) => highlightElement(n));
						},
						shadowRoot: state.shadowRoot,
						onDone: () => showDrawButton(targetEl),
					});
					removeDrawButton();
					return;
				}
				state.currentTab = action.id;
				state.tabPreference = (action.id === 'replace' || action.id === 'place') ? 'component' : 'design';
				state.replaceDirection = action.id === 'replace' ? 'element-first' : null;
				sendTo("panel", { type: "TAB_CHANGED", tab: action.id as any });
				showDrawButton(targetEl);
			});
			toolbar.appendChild(btn);
		}
	} else {
		const placeBtn = document.createElement("button");
		placeBtn.className = "tb tb-combo active";
		placeBtn.innerHTML = `Place`;
		toolbar.appendChild(placeBtn);
	}

	// Position toolbar using @floating-ui/dom (msgRow added after creation below)

	// ── Message row (below element) ──
	let msgRow: HTMLElement;
	msgRow = createMsgRow(state.currentBoundary, () => {
		if (!toolbarDragged) positionBothMenus(targetEl, toolbar, msgRow);
	});
	state.shadowRoot.appendChild(msgRow);
	state.msgRowEl = msgRow;

	// Position both toolbar and message row, handling flip overlap
	positionBothMenus(targetEl, toolbar, msgRow);
}

export function getCanvasMessageText(): string {
	const textarea = canvasMsgRow?.querySelector('textarea') as HTMLTextAreaElement | null;
	return textarea?.value.trim() ?? '';
}

function createMsgRow(
	boundary: { componentName: string } | null,
	onReposition: () => void,
	options?: { showSendButton?: boolean },
): HTMLElement {
	const showSendButton = options?.showSendButton ?? true;
	const msgRow = document.createElement("div");
	msgRow.className = "msg-row";
	msgRow.style.left = "0px";
	msgRow.style.top = "0px";

	const msgInput = document.createElement("textarea");
	msgInput.rows = 1;
	msgInput.placeholder = "add your message";
	msgRow.appendChild(msgInput);

	// ── Mic button (only if browser supports SpeechRecognition) ──
	let recognition: any = null;
	let micBtn: HTMLButtonElement | null = null;

	if (SpeechRecognitionAPI) {
		micBtn = document.createElement("button");
		micBtn.className = "mic-btn";
		micBtn.title = "Record voice message";
		micBtn.innerHTML = MIC_SVG;
		msgRow.appendChild(micBtn);

		micBtn.addEventListener("click", (e) => {
			e.stopPropagation();

			// Toggle off if already listening
			if (recognition) {
				recognition.stop();
				return;
			}

			const baseText = msgInput.value;
			recognition = new SpeechRecognitionAPI();
			recognition.continuous = false;
			recognition.interimResults = true;
			recognition.lang = navigator.language || "en-US";

			recognition.onresult = (event: any) => {
				let transcript = "";
				for (let i = 0; i < event.results.length; i++) {
					transcript += event.results[i][0].transcript;
				}
				const separator = baseText && !baseText.endsWith("\n") ? "\n" : "";
				msgInput.value = baseText + separator + transcript;
				msgInput.style.height = "auto";
				msgInput.style.height = msgInput.scrollHeight + "px";
				onReposition();
			};

			recognition.onend = () => {
				micBtn!.classList.remove("listening");
				recognition = null;
			};

			recognition.onerror = (event: any) => {
				micBtn!.classList.remove("listening");
				if (event.error === "not-allowed" || event.error === "service-not-allowed") {
					micBtn!.classList.add("error");
					showMicBanner("Microphone blocked — allow access in your browser's address bar");
				}
				recognition = null;
			};

			micBtn!.classList.remove("error");
			micBtn!.classList.add("listening");
			recognition.start();
		});
	}

	const msgSendBtn = showSendButton ? document.createElement("button") : null;
	if (msgSendBtn) {
		msgSendBtn.className = "msg-send";
		msgSendBtn.innerHTML = SEND_SVG;
		msgRow.appendChild(msgSendBtn);
	}

	function sendMessage() {
		const text = msgInput.value.trim();
		if (!text) return;
		const id = crypto.randomUUID();

		// Build placement context from the current target element
		const targetEl = state.currentTargetEl;
		const locked = getLockedInsert();
		const target = targetEl
			? { tag: targetEl.tagName.toLowerCase(), classes: typeof targetEl.className === 'string' ? targetEl.className : '', innerText: targetEl.innerText?.slice(0, 100) ?? '' }
			: undefined;
		const insertMode = locked?.position;
		const context = targetEl
			? (insertMode ? buildInsertContext(targetEl, insertMode) : buildContext(targetEl, '', '', new Map()))
			: undefined;
		const pageUrl = window.location.href;

		send({
			type: "MESSAGE_STAGE",
			id,
			message: text,
			elementKey: boundary?.componentName ?? "",
			component: boundary ? { name: boundary.componentName } : undefined,
			target,
			context,
			insertMode,
			pageUrl,
		});
		msgInput.value = "";
		msgInput.style.height = "auto";
		onReposition();
		showToast("Message staged");
	}

	msgSendBtn?.addEventListener("click", (e) => {
		e.stopPropagation();
		sendMessage();
	});

	msgInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
		if (e.key === "Escape") {
			msgInput.blur();
		}
	});

	msgInput.addEventListener("input", () => {
		msgInput.style.height = "auto";
		msgInput.style.height = msgInput.scrollHeight + "px";
		onReposition();
	});

	// Prevent clicks on the message row from triggering page click handlers
	msgRow.addEventListener("click", (e) => e.stopPropagation());

	return msgRow;
}

// ── Canvas-anchored message row ─────────────────────────────────────────────

let canvasMsgRow: HTMLElement | null = null;
let canvasMsgRowObserver: ResizeObserver | null = null;

export function showCanvasMessageRow(
	canvasWrapper: HTMLElement,
	boundary: { componentName: string } | null,
	shadowRoot: ShadowRoot,
): void {
	hideCanvasMessageRow();

	const msgRow = createMsgRow(boundary, () => positionCanvasMsgRow(canvasWrapper, msgRow), { showSendButton: false });
	msgRow.setAttribute("data-canvas-anchor", "true");
	shadowRoot.appendChild(msgRow);
	canvasMsgRow = msgRow;

	positionCanvasMsgRow(canvasWrapper, msgRow);

	canvasMsgRowObserver = new ResizeObserver(() => {
		positionCanvasMsgRow(canvasWrapper, msgRow);
	});
	canvasMsgRowObserver.observe(canvasWrapper);
}

export function hideCanvasMessageRow(): void {
	canvasMsgRowObserver?.disconnect();
	canvasMsgRowObserver = null;
	canvasMsgRow?.remove();
	canvasMsgRow = null;
}

function positionCanvasMsgRow(
	canvasWrapper: HTMLElement,
	msgRow: HTMLElement,
): void {
	computePosition(canvasWrapper, msgRow, {
		placement: "bottom-start",
		middleware: [
			shift({ padding: 8 }),
			flip(),
		],
	}).then(({ x, y }) => {
		Object.assign(msgRow.style, {
			position: "fixed",
			left: `${x}px`,
			top: `${y}px`,
		});
	});
}

function showGroupPicker(
	anchorBtn: HTMLElement,
	onClose: () => void,
	onCountChange: (totalCount: number) => void,
): void {
	if (state.pickerCloseHandler) {
		document.removeEventListener("click", state.pickerCloseHandler, {
			capture: true,
		});
		state.pickerCloseHandler = null;
	}
	state.pickerEl?.remove();

	// Lazily compute near-groups on first open
	if (!state.cachedNearGroups && state.currentTargetEl) {
		const exactSet = new Set(state.currentEquivalentNodes);
		state.cachedNearGroups = computeNearGroups(state.currentTargetEl, exactSet, state.shadowHost);
	}
	const groups = state.cachedNearGroups ?? [];

	// Compute path-match elements (React only)
	let pathMatch: PathMatchResult | null = null;
	if (state.currentTargetEl) {
		pathMatch = findSamePathElements(state.currentTargetEl);
	}

	const picker = document.createElement("div");
	picker.className = "el-picker";
	picker.style.left = "0px";
	picker.style.top = "0px";
	state.shadowRoot.appendChild(picker);
	state.pickerEl = picker;

	// Current selection summary
	const exactRow = document.createElement("div");
	exactRow.className = "el-group-exact";
	const chip = document.createElement("span");
	chip.className = "el-count-chip";
	chip.textContent = String(state.currentEquivalentNodes.length);
	exactRow.appendChild(chip);
	const exactLabel = document.createElement("span");
	exactLabel.textContent = "element selected";
	exactRow.appendChild(exactLabel);
	picker.appendChild(exactRow);

	// ── "Add more" / "Stop adding" button ──
	const addBtn = document.createElement("div");
	addBtn.className = "el-group-row";
	addBtn.style.cursor = "pointer";
	addBtn.style.fontWeight = "500";
	addBtn.style.fontSize = "11px";

	function styleAddBtn(active: boolean) {
		if (active) {
			addBtn.textContent = "Stop adding";
			addBtn.style.color = "#fff";
			addBtn.style.background = "#00848B";
			addBtn.style.borderRadius = "4px";
			addBtn.style.textAlign = "center";
		} else {
			addBtn.textContent = "Add more";
			addBtn.style.color = "#00848B";
			addBtn.style.background = "";
			addBtn.style.borderRadius = "";
			addBtn.style.textAlign = "";
		}
	}
	styleAddBtn(state.addMode);

	addBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		const entering = !state.addMode;
		setAddMode(entering);
		styleAddBtn(entering);
	});
	picker.appendChild(addBtn);

	// Track checked states for exact/path match
	let exactMatchChecked = false;
	let pathMatchChecked = false;

	function clearPreviewHighlights() {
		state.shadowRoot
			.querySelectorAll(".highlight-preview")
			.forEach((el) => el.remove());
	}

	function updateSelection() {
		if (!state.currentTargetEl) return;
		const allNodes = [state.currentTargetEl];

		// Add exact matches if checked
		if (exactMatchChecked && state.cachedExactMatches) {
			for (const el of state.cachedExactMatches) {
				if (!allNodes.includes(el)) allNodes.push(el);
			}
		}

		// Add path matches if checked
		if (pathMatchChecked && pathMatch) {
			for (const el of pathMatch.elements) {
				if (!allNodes.includes(el)) allNodes.push(el);
			}
		}

		// Add manually added nodes
		for (const el of state.manuallyAddedNodes) {
			if (!allNodes.includes(el)) allNodes.push(el);
		}

		// Add checked near-groups
		for (const idx of checkedGroups) {
			for (const el of groups[idx].elements) {
				if (!allNodes.includes(el)) allNodes.push(el);
			}
		}

		state.currentEquivalentNodes = allNodes;
		state.shadowRoot
			.querySelectorAll(".highlight-overlay")
			.forEach((el) => el.remove());
		state.currentEquivalentNodes.forEach((n) => highlightElement(n));

		// Update the summary chip
		chip.textContent = String(allNodes.length);

		onCountChange(state.currentEquivalentNodes.length);
		if (state.currentTargetEl && state.currentBoundary) {
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
	}

	const checkedGroups = new Set<number>();

	// Allow external code (add-mode click handler) to refresh the picker
	state.pickerRefreshCallback = updateSelection;

	// ── "All exact matches (N)" row ──
	const exactMatches = state.cachedExactMatches ?? [];
	if (exactMatches.length > 1) {
		const row = document.createElement("label");
		row.className = "el-group-row";

		const cb = document.createElement("input");
		cb.type = "checkbox";
		cb.checked = false;
		cb.addEventListener("change", () => {
			exactMatchChecked = cb.checked;
			updateSelection();
		});

		const label = document.createElement("span");
		label.className = "el-group-diff";
		label.textContent = `All exact matches (${exactMatches.length})`;
		label.style.fontFamily = "inherit";

		row.appendChild(cb);
		row.appendChild(label);
		picker.appendChild(row);

		row.addEventListener("mouseenter", () => {
			clearPreviewHighlights();
			for (const el of exactMatches) {
				if (state.currentEquivalentNodes.includes(el)) continue;
				const rect = el.getBoundingClientRect();
				const preview = document.createElement("div");
				preview.className = "highlight-preview";
				preview.style.top = `${rect.top - 3}px`;
				preview.style.left = `${rect.left - 3}px`;
				preview.style.width = `${rect.width + 6}px`;
				preview.style.height = `${rect.height + 6}px`;
				state.shadowRoot.appendChild(preview);
			}
		});
		row.addEventListener("mouseleave", () => clearPreviewHighlights());
	}

	// ── "All [path] (N)" row — React only, hidden if same set as exact matches ──
	const pathIsDuplicate = pathMatch && exactMatches.length > 1
		&& pathMatch.elements.length === exactMatches.length
		&& pathMatch.elements.every((el) => exactMatches.includes(el));
	if (pathMatch && pathMatch.elements.length > 1 && !pathIsDuplicate) {
		const row = document.createElement("label");
		row.className = "el-group-row";

		const cb = document.createElement("input");
		cb.type = "checkbox";
		cb.checked = false;
		cb.addEventListener("change", () => {
			pathMatchChecked = cb.checked;
			updateSelection();
		});

		const label = document.createElement("span");
		label.className = "el-group-diff";
		label.textContent = `All ${pathMatch.label} (${pathMatch.elements.length})`;
		label.style.fontFamily = "inherit";

		row.appendChild(cb);
		row.appendChild(label);
		picker.appendChild(row);

		row.addEventListener("mouseenter", () => {
			clearPreviewHighlights();
			for (const el of pathMatch!.elements) {
				if (state.currentEquivalentNodes.includes(el)) continue;
				const rect = el.getBoundingClientRect();
				const preview = document.createElement("div");
				preview.className = "highlight-preview";
				preview.style.top = `${rect.top - 3}px`;
				preview.style.left = `${rect.left - 3}px`;
				preview.style.width = `${rect.width + 6}px`;
				preview.style.height = `${rect.height + 6}px`;
				state.shadowRoot.appendChild(preview);
			}
		});
		row.addEventListener("mouseleave", () => clearPreviewHighlights());
	}

	groups.forEach((group, idx) => {
		const row = document.createElement("label");
		row.className = "el-group-row";

		const cb = document.createElement("input");
		cb.type = "checkbox";
		cb.checked = false;
		cb.addEventListener("change", () => {
			if (cb.checked) checkedGroups.add(idx);
			else checkedGroups.delete(idx);
			updateSelection();
		});

		const count = document.createElement("span");
		count.className = "el-group-count";
		count.textContent = `(${group.elements.length})`;

		const diff = document.createElement("span");
		diff.className = "el-group-diff";
		const parts: string[] = [];
		for (const a of group.added)
			parts.push(`<span class="diff-add">+${a}</span>`);
		for (const r of group.removed)
			parts.push(`<span class="diff-rem">-${r}</span>`);
		diff.innerHTML = parts.join(" ");

		row.appendChild(cb);
		row.appendChild(count);
		row.appendChild(diff);
		picker.appendChild(row);

		row.addEventListener("mouseenter", () => {
			clearPreviewHighlights();
			for (const el of group.elements) {
				const rect = el.getBoundingClientRect();
				const preview = document.createElement("div");
				preview.className = "highlight-preview";
				preview.style.top = `${rect.top - 3}px`;
				preview.style.left = `${rect.left - 3}px`;
				preview.style.width = `${rect.width + 6}px`;
				preview.style.height = `${rect.height + 6}px`;
				state.shadowRoot.appendChild(preview);
			}
		});

		row.addEventListener("mouseleave", () => {
			clearPreviewHighlights();
		});
	});

	// Position
	positionWithFlip(anchorBtn, picker);

	// Close on outside click
	const removePicker = () => {
		// Exit add-mode when closing picker
		if (state.addMode) {
			setAddMode(false);
		}
		state.pickerRefreshCallback = null;
		state.shadowRoot
			.querySelectorAll(".highlight-preview")
			.forEach((el) => el.remove());
		if (state.pickerCloseHandler) {
			document.removeEventListener("click", state.pickerCloseHandler, {
				capture: true,
			});
			state.pickerCloseHandler = null;
		}
		state.pickerEl?.remove();
		state.pickerEl = null;
	};

	setTimeout(() => {
		state.pickerCloseHandler = (e: MouseEvent) => {
			// Don't close the picker while add-mode is active — clicks go to clickHandler
			if (state.addMode) return;
			const path = e.composedPath();
			if (!path.includes(picker) && !path.includes(anchorBtn)) {
				removePicker();
				onClose();
			}
		};
		document.addEventListener("click", state.pickerCloseHandler, { capture: true });
	}, 0);
}
