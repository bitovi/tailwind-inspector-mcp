import { state, clearSelectionState } from "./overlay-state";
import { dom } from "./overlay-dom";
import { send, sendTo } from "./ws";
import { isTextEditing } from "./text-edit";
import { revertPreview } from "./patcher";
import { clearHighlights } from "./element-highlight";
import { getLockedInsert, placeAtLockedInsert, armInsert, injectGhostCss, buildSelector } from "./drop-zone";
import { setClipboard, getClipboard, extractGhostCssForElement } from "./clipboard";
import { buildContext, buildDeleteContext } from "./context";
import { getFiber, findOwningComponent } from "./react/fiber";
import { setToolOverrides, clearToolOverrides } from "./bottom-toolbar";

export interface KeyboardHandlerDeps {
	serverOrigin: string;
	showToast: (msg: string, duration?: number) => void;
	setSelectMode: (on: boolean) => void;
}

export function createKeydownHandler(deps: KeyboardHandlerDeps): (e: KeyboardEvent) => void {
	return (e: KeyboardEvent) => {
		// Skip when typing in inputs, textareas, or contenteditable.
		// Use composedPath() so we see the real element inside shadow DOM
		// (e.target is retargeted to the shadow host at the document level).
		const origin = e.composedPath()[0] as HTMLElement;
		if (
			origin.tagName === "INPUT" ||
			origin.tagName === "TEXTAREA" ||
			origin.isContentEditable
		) return;
		// Skip during text editing mode
		if (isTextEditing()) return;

		const isMod = e.metaKey || e.ctrlKey;

		// ── Delete / Backspace ────────────────────────────────────────────
		if ((e.key === "Delete" || e.key === "Backspace") && state.currentTargetEl) {
			e.preventDefault();
			const el = state.currentTargetEl;
			const isGhost = !!el.dataset.twDroppedComponent;
			const ghostPatchId = el.dataset.twDroppedPatchId;

			if (isGhost && ghostPatchId) {
				// Ghost element — remove from DOM and discard the draft patch
				el.remove();
				send({ type: "DISCARD_DRAFTS", ids: [ghostPatchId] });
			} else {
				// Real element — hide and stage a delete-element patch
				const patchId = crypto.randomUUID();
				const componentName = state.currentBoundary?.componentName ?? el.tagName.toLowerCase();

				const context = buildDeleteContext(el, new Map());

				el.dataset.twDeleted = patchId;
				el.style.display = "none";

				send({
					type: "PATCH_STAGED",
					patch: {
						id: patchId,
						kind: "delete-element",
						elementKey: componentName,
						status: "staged",
						originalClass: "",
						newClass: "",
						property: "delete-element",
						timestamp: new Date().toISOString(),
						pageUrl: window.location.href,
						component: { name: componentName },
						target: {
							tag: el.tagName.toLowerCase(),
							classes: typeof el.className === "string" ? el.className : "",
							innerText: (el.innerText || "").trim().slice(0, 60),
						},
						ghostHtml: el.outerHTML,
						context,
					},
				});
			}

			// Clear selection
			revertPreview();
			clearHighlights();
			clearSelectionState();
			sendTo("panel", { type: "MODE_CHANGED", mode: null });
			deps.showToast("Element deleted");
			return;
		}

		// ── Cmd+C — Copy ──────────────────────────────────────────────────
		if (isMod && e.key === "c" && state.currentTargetEl) {
			const el = state.currentTargetEl;
			const componentName = state.currentBoundary?.componentName ?? el.tagName.toLowerCase();
			extractGhostCssForElement(el, deps.serverOrigin).then((ghostCss) => {
				setClipboard({
					ghostHtml: el.outerHTML,
					ghostCss,
					sourceComponentName: componentName,
					sourceClasses: typeof el.className === "string" ? el.className : "",
				});
				deps.showToast("Copied");
			});
			// Don't preventDefault — allow native text copy too
			return;
		}

		// ── Cmd+X — Cut ──────────────────────────────────────────────────
		if (isMod && e.key === "x" && state.currentTargetEl) {
			e.preventDefault();
			const el = state.currentTargetEl;
			const componentName = state.currentBoundary?.componentName ?? el.tagName.toLowerCase();
			extractGhostCssForElement(el, deps.serverOrigin).then((ghostCss) => {
				setClipboard({
					ghostHtml: el.outerHTML,
					ghostCss,
					sourceComponentName: componentName,
					sourceClasses: typeof el.className === "string" ? el.className : "",
				});

				// Now delete (same logic as Delete key above)
				const isGhost = !!el.dataset.twDroppedComponent;
				const ghostPatchId = el.dataset.twDroppedPatchId;

				if (isGhost && ghostPatchId) {
					el.remove();
					send({ type: "DISCARD_DRAFTS", ids: [ghostPatchId] });
				} else {
					const patchId = crypto.randomUUID();
					const context = buildDeleteContext(el, new Map());
					el.dataset.twDeleted = patchId;
					el.style.display = "none";
					send({
						type: "PATCH_STAGED",
						patch: {
							id: patchId,
							kind: "delete-element",
							elementKey: componentName,
							status: "staged",
							originalClass: "",
							newClass: "",
							property: "delete-element",
							timestamp: new Date().toISOString(),
							pageUrl: window.location.href,
							component: { name: componentName },
							target: {
								tag: el.tagName.toLowerCase(),
								classes: typeof el.className === "string" ? el.className : "",
								innerText: (el.innerText || "").trim().slice(0, 60),
							},
							ghostHtml: el.outerHTML,
							context,
						},
					});
				}

				revertPreview();
				clearHighlights();
				clearSelectionState();
				sendTo("panel", { type: "MODE_CHANGED", mode: null });
				deps.showToast("Cut");
			});
			return;
		}

		// ── Cmd+V — Paste ─────────────────────────────────────────────────
		if (isMod && e.key === "v") {
			const clip = getClipboard();
			if (!clip) return; // No VyBit clipboard — let native paste through
			e.preventDefault();

			console.log(`[paste-debug] Cmd+V: selectModeOn=${state.selectModeOn}, currentTargetEl=${!!state.currentTargetEl}, lockedInsert=${!!getLockedInsert()}`);

			// Disable select mode so crosshair doesn't interfere with placement
			if (state.selectModeOn) {
				deps.setSelectMode(false);
			}

			const lockedInsert = getLockedInsert();
			if (lockedInsert) {
				// Place immediately at the locked insertion point
				placeAtLockedInsert({
					componentName: clip.sourceComponentName,
					storyId: "",
					ghostHtml: clip.ghostHtml,
					ghostCss: clip.ghostCss,
				});
				// Reset toolbar after immediate placement
				clearToolOverrides();
				deps.showToast("Pasted");
			} else {
				// Show toolbar: Select = green (done), Insert = orange (placing)
				setToolOverrides({ select: 'completed', insert: 'picking' });

				// Enter drop-zone crosshair flow
				armInsert(
					{
						componentName: clip.sourceComponentName,
						storyId: "",
						ghostHtml: clip.ghostHtml,
						ghostCss: clip.ghostCss,
					},
					dom.shadowHost,
				);
				deps.showToast("Click to place");
			}
			return;
		}

		// ── Cmd+D — Duplicate ─────────────────────────────────────────────
		if (isMod && e.key === "d" && state.currentTargetEl) {
			e.preventDefault();
			const el = state.currentTargetEl;
			const componentName = state.currentBoundary?.componentName ?? el.tagName.toLowerCase();

			extractGhostCssForElement(el, deps.serverOrigin).then((ghostCss) => {
				const template = document.createElement("template");
				template.innerHTML = el.outerHTML.trim();
				const clone = template.content.firstElementChild as HTMLElement | null;
				if (!clone) return;

				clone.dataset.twDroppedComponent = componentName;
				el.insertAdjacentElement("afterend", clone);

				if (ghostCss) injectGhostCss(componentName, ghostCss);

				// Build context and stage a component-drop patch
				const context = buildContext(el, "", "", new Map());
				const patchId = crypto.randomUUID();
				clone.dataset.twDroppedPatchId = patchId;

				let parentComponent: { name: string } | undefined;
				const fiber = getFiber(el);
				if (fiber) {
					const boundary = findOwningComponent(fiber);
					if (boundary) parentComponent = { name: boundary.componentName };
				}

				send({
					type: "COMPONENT_DROPPED",
					patch: {
						id: patchId,
						kind: "component-drop",
						elementKey: buildSelector(el),
						status: "staged",
						originalClass: "",
						newClass: "",
						property: "component-drop",
						timestamp: new Date().toISOString(),
						component: { name: componentName },
						target: {
							tag: el.tagName.toLowerCase(),
							classes: typeof el.className === "string" ? el.className : "",
							innerText: (el.innerText || "").trim().slice(0, 60),
						},
						ghostHtml: el.outerHTML,
						ghostCss: ghostCss || undefined,
						insertMode: "after",
						context,
						parentComponent,
						pageUrl: window.location.href,
					},
				});

				deps.showToast("Duplicated");
			});
			return;
		}
	};
}
