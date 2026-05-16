/**
 * Element Drawer — compact teal drawer below the selected element.
 * 
 * State A: Two buttons [Describe change] [Edit text]
 * State B: Textarea + controls row [← back] ... [mic] [Queue]
 * State C-Clean: [← back] [Editing text pill]
 * State C-Dirty: [Editing text pill] ... [✕ Discard] [Queue]
 */

import { computePosition, flip, offset, autoUpdate } from "@floating-ui/dom";
import { dom } from "./overlay-dom";
import { state } from "./overlay-state";
import { sendTo, send } from "./ws";
import { startTextEdit, endTextEdit, isTextEditing } from "./text-edit";
import { buildContext, buildInsertContext, buildTextContext } from "./context";
import { getLockedInsert } from "./drop-zone";
import { detectComponent } from "./framework-detect";
import { repositionHighlights } from "./element-highlight";
import './web-components/vb-button';

// Detect Web Speech API
const SpeechRecognitionAPI: (new () => any) | null =
	typeof window !== "undefined"
		? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null)
		: null;

type DrawerState = 'A' | 'B' | 'C-clean' | 'C-dirty';

let drawerEl: HTMLElement | null = null;
let cleanupAutoUpdate: (() => void) | null = null;
let currentState: DrawerState = 'A';
let anchorEl: HTMLElement | null = null;

// Callbacks set via initElementDrawer()
let showToast: (message: string, duration?: number) => void = () => {};
let deactivateSelectMode: () => void = () => {};

export function initElementDrawer(deps: {
	showToast: (message: string, duration?: number) => void;
	deactivateSelectMode: () => void;
}): void {
	showToast = deps.showToast;
	deactivateSelectMode = deps.deactivateSelectMode;
}

/** Show the element drawer below the given target element */
export function showElementDrawer(targetEl: HTMLElement): void {
	removeElementDrawer();
	anchorEl = targetEl;
	currentState = 'A';

	drawerEl = document.createElement("div");
	drawerEl.className = "element-drawer";
	drawerEl.addEventListener("click", (e) => e.stopPropagation());
	drawerEl.addEventListener("mousedown", (e) => e.stopPropagation());

	renderStateA();

	dom.shadowRoot.appendChild(drawerEl);

	// Position below element with auto-update
	cleanupAutoUpdate = autoUpdate(targetEl, drawerEl, () => {
		positionDrawer();
	});
}

/** Remove the element drawer */
export function removeElementDrawer(): void {
	if (cleanupAutoUpdate) {
		cleanupAutoUpdate();
		cleanupAutoUpdate = null;
	}
	drawerEl?.remove();
	drawerEl = null;
	anchorEl = null;
	currentState = 'A';
}

/** Reposition the drawer (call on scroll/resize) */
export function repositionDrawer(): void {
	if (!drawerEl || !anchorEl) return;
	positionDrawer();
}

async function positionDrawer(): Promise<void> {
	if (!drawerEl || !anchorEl) return;
	const { x, y } = await computePosition(anchorEl, drawerEl, {
		placement: "bottom-start",
		middleware: [offset(4), flip()],
	});
	drawerEl.style.left = `${x}px`;
	drawerEl.style.top = `${y}px`;
}

// ═══════════════════════════════════════════════════════════
// STATE A — Two buttons
// ═══════════════════════════════════════════════════════════

function renderStateA(): void {
	if (!drawerEl) return;
	currentState = 'A';
	drawerEl.innerHTML = '';

	const pair = document.createElement("div");
	pair.className = "ed-btn-pair";

	// Describe change button
	const describeBtn = document.createElement("vb-button") as HTMLElement;
	describeBtn.setAttribute('icon', 'describe');
	describeBtn.setAttribute('theme', 'primary');
	describeBtn.textContent = 'Describe change';
	describeBtn.addEventListener("click", () => {
		deactivateSelectMode();
		renderStateB();
	});
	pair.appendChild(describeBtn);

	// Edit/Insert text button — label depends on whether there's an insertion point
	const isInsert = !!getLockedInsert();
	const editTextBtn = document.createElement("vb-button") as HTMLElement;
	editTextBtn.setAttribute('icon', 'text');
	editTextBtn.setAttribute('theme', 'primary');
	editTextBtn.textContent = isInsert ? 'Insert text' : 'Edit text';
	editTextBtn.addEventListener("click", () => {
		deactivateSelectMode();
		enterTextEditMode();
	});
	pair.appendChild(editTextBtn);

	drawerEl.appendChild(pair);
}

// ═══════════════════════════════════════════════════════════
// STATE B — Describe Change
// ═══════════════════════════════════════════════════════════

function renderStateB(): void {
	if (!drawerEl) return;
	currentState = 'B';
	drawerEl.innerHTML = '';

	const wrapper = document.createElement("div");
	wrapper.className = "ed-describe-wrapper";

	// Textarea
	const textarea = document.createElement("textarea");
	textarea.className = "ed-textarea";
	textarea.placeholder = "describe change";
	textarea.rows = 3;
	wrapper.appendChild(textarea);

	// Controls row
	const controls = document.createElement("div");
	controls.className = "ed-controls-row";

	// Back button
	const backBtn = document.createElement("vb-button") as HTMLElement;
	backBtn.setAttribute('icon', 'back');
	backBtn.setAttribute('size', 'sm');
	backBtn.addEventListener("click", () => renderStateA());
	controls.appendChild(backBtn);

	// Right side: mic + queue
	const rightGroup = document.createElement("div");
	rightGroup.className = "ed-controls-right";

	// Track whether voice was used to fill the textarea
	let usedVoice = false;

	// Mic button (if supported)
	if (SpeechRecognitionAPI) {
		const micBtn = createMicButton(textarea, () => { usedVoice = true; });
		rightGroup.appendChild(micBtn);
	}

	// Queue button
	const queueBtn = document.createElement("vb-button") as HTMLElement;
	queueBtn.setAttribute('theme', 'danger');
	queueBtn.setAttribute('structure', 'filled');
	queueBtn.setAttribute('size', 'sm');
	queueBtn.textContent = "Queue";
	queueBtn.addEventListener("click", () => {
		const text = textarea.value.trim();
		if (!text) return;
		submitDescribeChange(text, false, usedVoice ? 'voice' : undefined);
		renderStateA();
	});
	rightGroup.appendChild(queueBtn);

	// Commit button (stages + immediately commits at front of queue)
	const commitBtn = document.createElement("vb-button") as HTMLElement;
	commitBtn.setAttribute('theme', 'primary');
	commitBtn.setAttribute('structure', 'filled');
	commitBtn.setAttribute('size', 'sm');
	commitBtn.textContent = "Commit";
	commitBtn.addEventListener("click", () => {
		const text = textarea.value.trim();
		if (!text) return;
		submitDescribeChange(text, true, usedVoice ? 'voice' : undefined);
		renderStateA();
	});
	rightGroup.appendChild(commitBtn);

	controls.appendChild(rightGroup);
	wrapper.appendChild(controls);
	drawerEl.appendChild(wrapper);

	// Auto-grow textarea
	textarea.addEventListener("input", () => {
		textarea.style.height = "auto";
		textarea.style.height = textarea.scrollHeight + "px";
		positionDrawer();
	});

	// Escape to go back
	textarea.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			e.preventDefault();
			renderStateA();
		}
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
			e.preventDefault();
			const text = textarea.value.trim();
			if (text) {
				submitDescribeChange(text, true, usedVoice ? 'voice' : undefined);
				renderStateA();
			}
		} else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			const text = textarea.value.trim();
			if (text) {
				submitDescribeChange(text, false, usedVoice ? 'voice' : undefined);
				renderStateA();
			}
		}
	});

	// Focus textarea
	requestAnimationFrame(() => textarea.focus());
}

function submitDescribeChange(text: string, autoCommit: boolean, inputMethod?: string): void {
	const id = crypto.randomUUID();
	const locked = getLockedInsert();
	const targetEl = state.currentTargetEl ?? locked?.target ?? null;
	const target = targetEl
		? { tag: targetEl.tagName.toLowerCase(), classes: typeof targetEl.className === 'string' ? targetEl.className : '', innerText: targetEl.innerText?.slice(0, 100) ?? '' }
		: undefined;
	const insertMode = locked?.position;
	const context = targetEl
		? (insertMode ? buildInsertContext(targetEl, insertMode) : buildContext(targetEl, '', '', new Map()))
		: undefined;
	const pageUrl = window.location.href;
	let boundary = state.currentBoundary;
	if (!boundary && targetEl) {
		const detected = detectComponent(targetEl);
		boundary = detected
			? { componentName: detected.componentName }
			: { componentName: targetEl.tagName.toLowerCase() };
	}

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
		...(autoCommit ? { autoCommit: true } : {}),
		...(inputMethod ? { inputMethod } : {}),
	});
	showToast(autoCommit ? "Change committed" : "Change queued");
}

// ═══════════════════════════════════════════════════════════
// STATE C — Edit Text
// ═══════════════════════════════════════════════════════════

function enterTextEditMode(): void {
	if (!state.currentTargetEl) return;

	const locked = getLockedInsert();
	const isInsert = !!locked;
	let target = state.currentTargetEl;
	let insertedTextNode: Text | null = null;

	renderStateCClean();

	// Start contentEditable editing on the target element
	// (captures originalHtml BEFORE we insert placeholder text)
	startTextEdit(target, {
		sendTo,
		send,
		currentBoundary: state.currentBoundary,
		currentTargetEl: target,
		currentEquivalentNodes: state.currentEquivalentNodes,
		buildTextContext,
		positionToolbar: () => positionDrawer(),
		repositionHighlights,
		shadowRoot: dom.shadowRoot,
		suppressActionBar: true,
		onDone: () => {
			// Text edit ended — go back to State A
			// If this was an insert and the user discarded, remove the inserted text node
			if (isInsert && insertedTextNode && insertedTextNode.parentNode) {
				insertedTextNode.remove();
			}
			renderStateA();
		},
	});

	// For insert mode, insert placeholder text AFTER startTextEdit captured
	// the original HTML, then select it so user can type over it
	if (isInsert && locked) {
		insertedTextNode = document.createTextNode('Placeholder text');
		const ref = locked.target;
		switch (locked.position) {
			case 'before':      ref.parentNode?.insertBefore(insertedTextNode, ref); break;
			case 'after':       ref.parentNode?.insertBefore(insertedTextNode, ref.nextSibling); break;
			case 'first-child': ref.insertBefore(insertedTextNode, ref.firstChild); break;
			case 'last-child':  ref.appendChild(insertedTextNode); break;
		}
		const sel = window.getSelection();
		if (sel) {
			const range = document.createRange();
			range.selectNode(insertedTextNode);
			sel.removeAllRanges();
			sel.addRange(range);
		}
		renderStateCDirty();
	}

	// Listen for input on the target to detect dirty state
	const originalHtml = target.innerHTML;

	const inputHandler = () => {
		if (target.innerHTML !== originalHtml && currentState === 'C-clean') {
			renderStateCDirty();
		}
	};
	target.addEventListener("input", inputHandler);

	// Store cleanup for when we leave state C
	(drawerEl as any)?.__cleanupInput?.();
	if (drawerEl) {
		(drawerEl as any).__cleanupInput = () => {
			target.removeEventListener("input", inputHandler);
		};
	}
}

function renderStateCClean(): void {
	if (!drawerEl) return;
	currentState = 'C-clean';
	drawerEl.innerHTML = '';

	const row = document.createElement("div");
	row.className = "ed-edit-row";

	// Back button
	const backBtn = document.createElement("vb-button") as HTMLElement;
	backBtn.setAttribute('icon', 'back');
	backBtn.setAttribute('size', 'sm');
	backBtn.addEventListener("mousedown", (e) => e.preventDefault()); // prevent blur
	backBtn.addEventListener("click", () => {
		(drawerEl as any)?.__cleanupInput?.();
		endTextEdit(false); // cancel — nothing to lose
	});
	row.appendChild(backBtn);

	// "Editing text" pill
	const pill = document.createElement("span");
	pill.className = "ed-pill-orange";
	pill.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor" style="width:11px;height:11px;"><path d="M12.1.5a1.7 1.7 0 0 1 2.4 0l1 1a1.7 1.7 0 0 1 0 2.4L5.2 14.2a.5.5 0 0 1-.2.1l-3.5 1a.5.5 0 0 1-.6-.6l1-3.5a.5.5 0 0 1 .1-.2L12.1.5z"/></svg> Editing text`;
	row.appendChild(pill);

	drawerEl.appendChild(row);
}

function renderStateCDirty(): void {
	if (!drawerEl) return;
	currentState = 'C-dirty';
	drawerEl.innerHTML = '';

	const row = document.createElement("div");
	row.className = "ed-edit-row";

	// "Editing text" pill (no back button — must Discard or Queue)
	const pill = document.createElement("span");
	pill.className = "ed-pill-orange";
	pill.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor" style="width:11px;height:11px;"><path d="M12.1.5a1.7 1.7 0 0 1 2.4 0l1 1a1.7 1.7 0 0 1 0 2.4L5.2 14.2a.5.5 0 0 1-.2.1l-3.5 1a.5.5 0 0 1-.6-.6l1-3.5a.5.5 0 0 1 .1-.2L12.1.5z"/></svg> Editing text`;
	row.appendChild(pill);

	// Spacer
	const spacer = document.createElement("div");
	spacer.style.flex = "1";
	row.appendChild(spacer);

	// Discard button
	const discardBtn = document.createElement("vb-button") as HTMLElement;
	discardBtn.setAttribute('theme', 'danger');
	discardBtn.setAttribute('size', 'sm');
	discardBtn.textContent = "✕ Discard";
	discardBtn.addEventListener("mousedown", (e) => e.preventDefault()); // prevent blur
	discardBtn.addEventListener("click", () => {
		(drawerEl as any)?.__cleanupInput?.();
		endTextEdit(false); // revert changes
	});
	row.appendChild(discardBtn);

	// Queue button
	const queueBtn = document.createElement("vb-button") as HTMLElement;
	queueBtn.setAttribute('theme', 'danger');
	queueBtn.setAttribute('structure', 'filled');
	queueBtn.setAttribute('size', 'sm');
	queueBtn.textContent = "Queue";
	queueBtn.addEventListener("mousedown", (e) => e.preventDefault()); // prevent blur
	queueBtn.addEventListener("click", () => {
		(drawerEl as any)?.__cleanupInput?.();
		endTextEdit(true); // commit changes
	});
	row.appendChild(queueBtn);

	drawerEl.appendChild(row);
}

// ═══════════════════════════════════════════════════════════
// MIC BUTTON
// ═══════════════════════════════════════════════════════════

function createMicButton(textarea: HTMLTextAreaElement, onVoiceUsed: () => void): HTMLElement {
	const micBtn = document.createElement("vb-button") as HTMLElement;
	micBtn.setAttribute('icon', 'mic');
	micBtn.setAttribute('size', 'sm');
	let recognition: any = null;

	micBtn.addEventListener("click", (e) => {
		e.stopPropagation();

		if (recognition) {
			recognition.stop();
			return;
		}

		const baseText = textarea.value;
		recognition = new SpeechRecognitionAPI!();
		recognition.continuous = false;
		recognition.interimResults = true;
		recognition.lang = navigator.language || "en-US";

		recognition.onresult = (event: any) => {
			let transcript = "";
			for (let i = 0; i < event.results.length; i++) {
				transcript += event.results[i][0].transcript;
			}
			const separator = baseText && !baseText.endsWith("\n") ? "\n" : "";
			textarea.value = baseText + separator + transcript;
			onVoiceUsed();
			textarea.style.height = "auto";
			textarea.style.height = textarea.scrollHeight + "px";
			positionDrawer();
		};

		recognition.onend = () => {
			micBtn.setAttribute('state', 'default');
			recognition = null;
		};

		recognition.onerror = () => {
			micBtn.setAttribute('state', 'default');
			recognition = null;
		};

		micBtn.setAttribute('state', 'armed');
		recognition.start();
	});

	return micBtn;
}
