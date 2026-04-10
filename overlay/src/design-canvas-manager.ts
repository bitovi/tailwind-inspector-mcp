import type { VbDesignCanvas } from './design-canvas/vb-design-canvas';
import type { InsertMode } from "./messages";
import { buildContext } from "./context";
import { areSiblings, captureRegion } from "./screenshot";
import { sendTo } from "./ws";
import { css, SUBMITTED_IMAGE } from './styles';
import { clearHighlights } from "./element-highlight";
import { showCanvasMessageRow, hideCanvasMessageRow, getCanvasMessageText } from "./element-toolbar";
import { state, clearSelectionState } from "./overlay-state";
import { send } from "./ws";

let serverOrigin = '';
let showToastFn: (msg: string, duration?: number) => void = () => {};

export function initDesignCanvasManager(deps: {
	serverOrigin: string;
	showToast: (msg: string, duration?: number) => void;
}): void {
	serverOrigin = deps.serverOrigin;
	showToastFn = deps.showToast;
}

export function injectDesignCanvas(insertMode: InsertMode): void {
	console.log('[tw-debug] injectDesignCanvas called, insertMode=', insertMode, 'currentTargetEl=', state.currentTargetEl, 'currentBoundary=', state.currentBoundary);
	if (!state.currentTargetEl || !state.currentBoundary) {
		showToastFn("Select an element first");
		return;
	}

	// Remove selection highlights and draw button
	clearHighlights();

	const targetEl = state.currentTargetEl;
	// Snapshot state before clearing — needed for ELEMENT_CONTEXT sent to design iframe
	const boundary = state.currentBoundary;
	const equivalentCount = state.currentEquivalentNodes.length;

	// Clear selection state so the overlay doesn't re-highlight after canvas insert
	clearSelectionState();

	// Create design canvas element
	const canvas = document.createElement('vb-design-canvas') as VbDesignCanvas;
	const canvasSrc = `${serverOrigin}/panel/?mode=design`;
	console.log('[tw-debug] creating vb-design-canvas, src=', canvasSrc, 'targetEl=', targetEl, 'insertMode=', insertMode);
	canvas.setAttribute('src', canvasSrc);
	const wrapper = canvas.getWrapper();

	// Insert into the DOM based on insertMode
	let replacedNodes: HTMLElement[] | null = null;
	let replacedParent: HTMLElement | null = null;
	let replacedAnchor: ChildNode | null = null;

	switch (insertMode) {
		case "replace": {
			// Replace: insert canvas before the target, then hide the target
			replacedParent = targetEl.parentElement;
			targetEl.insertAdjacentElement("beforebegin", canvas);
			replacedAnchor = canvas.nextSibling;
			replacedNodes = [targetEl];
			targetEl.style.display = "none";
			break;
		}
		case "before":
			targetEl.insertAdjacentElement("beforebegin", canvas);
			break;
		case "after":
			targetEl.insertAdjacentElement("afterend", canvas);
			break;
		case "first-child":
			targetEl.insertAdjacentElement("afterbegin", canvas);
			break;
		case "last-child":
			targetEl.appendChild(canvas);
			break;
		default:
			targetEl.insertAdjacentElement("beforebegin", canvas);
	}

	state.designCanvasWrappers.push({
		wrapper: canvas as unknown as HTMLElement,
		replacedNodes,
		parent: replacedParent,
		anchor: replacedAnchor,
	});
	requestAnimationFrame(() => showCanvasMessageRow(canvas.getWrapper(), boundary, state.shadowRoot));
	// Use a short delay to allow the iframe's WS client to connect and register
	console.log('[tw-debug] canvas inserted into DOM, listening for vb-canvas-ready...');
	canvas.addEventListener('vb-canvas-ready', () => {
		console.log('[tw-debug] vb-canvas-ready fired!');
		const contextMsg = {
			type: "ELEMENT_CONTEXT",
			componentName: boundary?.componentName ?? "",
			instanceCount: equivalentCount,
			target: {
				tag: targetEl.tagName.toLowerCase(),
				classes:
					typeof targetEl.className === "string" ? targetEl.className : "",
				innerText: (targetEl.innerText || "").trim().slice(0, 60),
			},
			context: buildContext(targetEl, "", "", new Map()),
			insertMode,
		};
		// Retry a few times so the design iframe's WS has time to register
		let attempts = 0;
		const trySend = () => {
			sendTo("design", contextMsg);
			attempts++;
			if (attempts < 5) setTimeout(trySend, 300);
		};
		setTimeout(trySend, 200);
	});
}

export async function handleCaptureScreenshot(): Promise<void> {
	if (!state.currentTargetEl || !state.currentBoundary) {
		showToastFn("Select an element first");
		return;
	}

	if (!areSiblings(state.currentEquivalentNodes)) {
		showToastFn(
			"Screenshot & Annotate requires all selected elements to be siblings in the DOM.",
		);
		return;
	}

	let screenshot: string;
	let screenshotWidth: number;
	let screenshotHeight: number;
	try {
		({
			dataUrl: screenshot,
			width: screenshotWidth,
			height: screenshotHeight,
		} = await captureRegion(state.currentEquivalentNodes));
	} catch (err) {
		showToastFn("Screenshot capture failed");
		return;
	}

	// Record insertion anchor before we remove nodes
	const parent = state.currentEquivalentNodes[0].parentElement;
	if (!parent) {
		showToastFn("Cannot find parent element");
		return;
	}
	// Use a marker node so the anchor survives sibling removal
	const marker = document.createComment("tw-placeholder");
	parent.insertBefore(marker, state.currentEquivalentNodes[0]);

	// Capture margins from the outer nodes before removal
	const firstStyle = getComputedStyle(state.currentEquivalentNodes[0]);
	const lastStyle = getComputedStyle(
		state.currentEquivalentNodes[state.currentEquivalentNodes.length - 1],
	);
	const marginTop = firstStyle.marginTop;
	const marginBottom = lastStyle.marginBottom;
	const marginLeft = firstStyle.marginLeft;
	const marginRight = firstStyle.marginRight;

	// Snapshot the nodes to restore on cancel — take references before removal
	const replacedNodes = [...state.currentEquivalentNodes];

	// Snapshot context before DOM mutation
	const targetEl = state.currentTargetEl;
	const boundary = state.currentBoundary;
	const instanceCount = state.currentEquivalentNodes.length;

	// Remove selection highlights and draw button
	clearHighlights();

	// Hide all selected nodes so the canvas takes their place
	for (const node of replacedNodes) {
		node.style.display = "none";
	}

	// Clear selection state so the overlay doesn't re-highlight after canvas insert
	clearSelectionState();

	// toolbar ~40px = no footer now
	const PANEL_CHROME_HEIGHT = 40;

	// Build canvas element (same structure as injectDesignCanvas)
	const canvas = document.createElement('vb-design-canvas') as VbDesignCanvas;
	canvas.setAttribute('src', `${serverOrigin}/panel/?mode=design`);
	canvas.setAttribute('width', `${screenshotWidth}px`);
	canvas.setAttribute('height', `${screenshotHeight + PANEL_CHROME_HEIGHT}px`);
	canvas.setAttribute('min-height', '0');
	const wrapper = canvas.getWrapper();
	wrapper.style.marginTop = marginTop;
	wrapper.style.marginBottom = marginBottom;
	wrapper.style.marginLeft = marginLeft;
	wrapper.style.marginRight = marginRight;

	// Insert at original position, then remove marker
	parent.insertBefore(canvas, marker);
	marker.remove();

	state.designCanvasWrappers.push({ wrapper: canvas as unknown as HTMLElement, replacedNodes, parent, anchor: canvas.nextSibling });
	requestAnimationFrame(() => showCanvasMessageRow(canvas.getWrapper(), boundary, state.shadowRoot));
	canvas.addEventListener('vb-canvas-ready', () => {
		const contextMsg = {
			type: "ELEMENT_CONTEXT",
			componentName: boundary.componentName,
			instanceCount,
			target: {
				tag: targetEl.tagName.toLowerCase(),
				classes:
					typeof targetEl.className === "string" ? targetEl.className : "",
				innerText: (targetEl.innerText || "").trim().slice(0, 60),
			},
			context: buildContext(targetEl, "", "", new Map()),
			insertMode: "replace" as InsertMode,
			screenshot,
		};
		let attempts = 0;
		const trySend = () => {
			sendTo("design", contextMsg);
			attempts++;
			if (attempts < 5) setTimeout(trySend, 300);
		};
		setTimeout(trySend, 200);
	});
}

export function removeAllDesignCanvases(): void {
	for (const entry of state.designCanvasWrappers) {
		entry.wrapper.remove();
	}
	state.designCanvasWrappers.length = 0;
}

export function handleDesignSubmitted(msg: { image?: string; patchId?: string }): void {
	const lastEntry = state.designCanvasWrappers[state.designCanvasWrappers.length - 1];
	const last = lastEntry?.wrapper;
	if (last) {
		// last may be the <vb-design-canvas> custom element; the actual wrapper div is its first child
		const wrapper = last.querySelector('[data-tw-design-canvas]') as HTMLElement ?? last;
		const iframe = wrapper.querySelector("iframe");
		if (iframe && msg.image) {
			const img = document.createElement("img");
			img.src = msg.image;
			img.style.cssText = css(SUBMITTED_IMAGE);
			// Remove all children (iframe, resize handles) and show just the image
			wrapper.innerHTML = "";
			wrapper.style.width = "auto";
			wrapper.style.height = "auto";
			wrapper.style.minHeight = "0";
			wrapper.style.overflow = "hidden";
			wrapper.appendChild(img);
		}
	}
	const messageText = getCanvasMessageText();
	if (messageText && msg.patchId) {
		send({ type: 'CANVAS_MESSAGE_ATTACH', patchId: msg.patchId, message: messageText });
	}
	hideCanvasMessageRow();
}

export function handleDesignClose(): void {
	const last = state.designCanvasWrappers.pop();
	if (last) {
		if (last.replacedNodes) {
			for (const node of last.replacedNodes) {
				node.style.display = "";
			}
		}
		last.wrapper.remove();
	}
	hideCanvasMessageRow();
}
