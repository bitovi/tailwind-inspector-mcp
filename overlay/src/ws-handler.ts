import { state, clearSelectionState } from "./overlay-state";
import { dom } from "./overlay-dom";
import { dispatch, getState } from "./overlay-state-machine";
import { send, sendTo } from "./ws";
import {
	applyPreview,
	applyPreviewBatch,
	commitPreview,
	revertPreview,
	getPreviewState,
	ensureCommittedCss,
} from "./patcher";
import { clearHighlights, highlightElement } from "./element-highlight";
import { showDrawButton } from "./element-toolbar";
import {
	cancelInsert,
	armInsert,
	armElementSelect,
	armGenericInsert,
	replaceElement,
	placeAtLockedInsert,
	getLockedInsert,
	clearLockedInsert,
} from "./drop-zone";
import { isTextEditing } from "./text-edit";
import { buildContext } from "./context";
import { detectComponent } from "./framework-detect";
import { findExactMatches } from "./grouping";
import { revertMove } from "./drag-move";
import {
	injectDesignCanvas,
	handleCaptureScreenshot,
	handleDesignSubmitted,
	handleDesignClose,
} from "./design-canvas-manager";
import type { InsertMode } from "./messages";
import type { ContainerName } from "./containers/IContainer";
import type { RecordingEngine } from "./recording/recording-engine";

export interface WsHandlerDeps {
	serverOrigin: string;
	panelOpenKey: string;
	insideStorybook: boolean;
	closePanel: () => void;
	getRecordingEngine: () => RecordingEngine;
	enterBugReportPickMode: () => void;
	applyThemePreview: (msg: any) => void;
	sendThemeVars: () => void;
	showToast: (msg: string, duration?: number) => void;
}

export function createWsMessageHandler(deps: WsHandlerDeps): (msg: any) => void {
	return (msg: any) => {
		if (msg.type === "TOGGLE_SELECT_MODE") {
			if (msg.active) {
				sessionStorage.setItem(deps.panelOpenKey, "1");
			}
			dispatch({ type: 'CMD_TOGGLE_SELECT_MODE', active: msg.active });
		} else if (msg.type === "TOGGLE_INSERT_BROWSE") {
			dispatch({ type: 'CMD_TOGGLE_INSERT_BROWSE', active: msg.active });
		} else if (msg.type === "MODE_CHANGED") {
			if (msg.mode) {
				sessionStorage.setItem(deps.panelOpenKey, "1");
			}
			dispatch({ type: 'CMD_MODE_CHANGED', mode: msg.mode });
		} else if (msg.type === "EDIT_TOOL_CHANGED") {
			dispatch({ type: 'CMD_EDIT_TOOL_CHANGED', tool: msg.tool });
		} else if (msg.type === "COLOR_SCHEME_CHANGED") {
			const scheme = msg.colorScheme as 'dark' | 'light';
			dom.shadowHost.classList.toggle('light', scheme === 'light');
			try { localStorage.setItem('vybit-color-scheme', scheme); } catch { /* ignore */ }
		} else if (msg.type === "TAB_CHANGED") {
			dispatch({ type: 'CMD_TAB_CHANGED', tab: msg.tab });
			state.replaceDirection = (msg.tab === 'replace' && state.currentTargetEl) ? 'element-first' : null;
			// Rebuild toolbar to highlight the correct action button
			if (state.currentTargetEl) showDrawButton(state.currentTargetEl);
		} else if (msg.type === "CANCEL_MODE") {
			dispatch({ type: 'CMD_CANCEL_MODE' });
		} else if (
			msg.type === "PATCH_PREVIEW" &&
			state.currentEquivalentNodes.length > 0 &&
			!isTextEditing()
		) {
			console.log(`[vybit-index] PATCH_PREVIEW received old="${msg.oldClass}" new="${msg.newClass}" nodes=${state.currentEquivalentNodes.length}`);
			applyPreview(
				state.currentEquivalentNodes,
				msg.oldClass,
				msg.newClass,
				deps.serverOrigin,
			);
		} else if (
			msg.type === "PATCH_PREVIEW_BATCH" &&
			state.currentEquivalentNodes.length > 0 &&
			!isTextEditing()
		) {
			applyPreviewBatch(state.currentEquivalentNodes, msg.pairs, deps.serverOrigin);
		} else if (msg.type === "PATCH_REVERT" && !isTextEditing()) {
			revertPreview();
		} else if (msg.type === "PATCH_REVERT_STAGED" && state.currentEquivalentNodes.length > 0) {
			// Undo a previously committed staged change: apply the reverse swap to the DOM
			// and commit it as the new baseline without telling the server.
			applyPreview(state.currentEquivalentNodes, msg.oldClass, msg.newClass, deps.serverOrigin)
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
						// TODO: dispatch to state machine (ghost replacement updates selection target)
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
		} else if (msg.type === "REVERT_DELETE" && msg.patchId) {
			// Un-hide a deleted element when its patch is discarded
			const deletedEl = document.querySelector(`[data-tw-deleted="${msg.patchId}"]`) as HTMLElement | null;
			if (deletedEl) {
				deletedEl.style.display = "";
				delete deletedEl.dataset.twDeleted;
			}
		} else if (msg.type === "REVERT_MOVE" && msg.patchId) {
			// Move an element back to its original position when its patch is discarded
			revertMove(msg.patchId);
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

			deps.showToast("Change staged");

			console.log(`[vybit-index] PATCH_STAGE received old="${msg.oldClass}" new="${msg.newClass}" hasPreviewState=${!!previewState} nodes=${state.currentEquivalentNodes.length}`);
			console.log(`[vybit-index] PATCH_STAGE target className="${state.currentTargetEl?.className}"`);

			// The staged change is now the baseline — clear preview tracking so the
			// next preview captures the current DOM state (with the staged class).
			// Special case: if this is an "add" (oldClass = '') with no prior preview,
			// the new class was never applied to the DOM. Apply it now, then commit
			// once the CSS is injected so the class renders immediately.
			if (!previewState && !msg.oldClass && msg.newClass) {
				console.log(`[vybit-index] PATCH_STAGE branch: ADD (no preview, no oldClass) → applyPreview+commitPreview`);
				applyPreview(state.currentEquivalentNodes, '', msg.newClass, deps.serverOrigin)
					.then(() => commitPreview());
			} else {
				console.log(`[vybit-index] PATCH_STAGE branch: COMMIT (has preview or has oldClass) → commitPreview+ensureCommittedCss`);
				commitPreview();
				// Guard against PATCH_PREVIEW→PATCH_STAGE race: if the preview's
				// CSS fetch was still in-flight when we committed, the CSS was never
				// injected and the class may not have been applied to the DOM.
				// Ensure both the class and its CSS are present.
				for (const node of state.currentEquivalentNodes) {
					if (msg.oldClass) node.classList.remove(msg.oldClass);
					if (msg.newClass) node.classList.add(msg.newClass);
					console.log(`[vybit-index] PATCH_STAGE forced classList: node.className="${node.className}"`);
				}
				if (msg.newClass) {
					ensureCommittedCss(msg.newClass, deps.serverOrigin);
				}
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
				if (getState().selectedEl !== null) {
					dispatch({ type: 'ELEMENT_DESELECTED' });
				}
			}
		} else if (msg.type === "SWITCH_CONTAINER") {
			const newName = msg.container as ContainerName;
			if (dom.containers[newName] && newName !== dom.activeContainer.name) {
				if (!deps.insideStorybook) {
					const wasOpen = dom.activeContainer.isOpen();
					dom.activeContainer.close();
					dom.activeContainer = dom.containers[newName];
					if (wasOpen) {
						dom.activeContainer.open(`${deps.serverOrigin}/panel`);
					}
				} else {
					dom.activeContainer = dom.containers[newName];
				}
			}
		} else if (msg.type === "INSERT_DESIGN_CANVAS") {
			if (msg.insertMode === 'replace') {
				if (state.currentTargetEl) {
					// Element already selected — capture screenshot and replace
					handleCaptureScreenshot();
				} else {
					// No element selected — arm element-select mode
					armElementSelect('Replace: Canvas', dom.shadowHost, (target) => {
						const result = findExactMatches(target, dom.shadowHost);
						const componentName = result.componentName ?? target.tagName.toLowerCase();
						state.currentTargetEl = target;
						state.currentBoundary = { componentName };
						state.currentEquivalentNodes = result.exactMatch;
						dispatch({
							type: 'ELEMENT_SELECTED',
							el: target,
							equivalentNodes: result.exactMatch,
							boundary: { componentName },
						});
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
					dispatch({
						type: 'ELEMENT_SELECTED',
						el: locked.target,
						equivalentNodes: [locked.target],
						boundary: state.currentBoundary,
					});
					clearLockedInsert();
					console.log('[tw-debug] locked path — calling injectDesignCanvas, position=', locked.position, 'boundary=', state.currentBoundary);
					injectDesignCanvas(locked.position as InsertMode);
				} else {
					// No locked position — arm canvas drop-zone
					console.log('[tw-debug] arming generic insert...');
					armGenericInsert('Place: Canvas', dom.shadowHost, (target, position) => {
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
							dispatch({
								type: 'ELEMENT_SELECTED',
								el: target,
								equivalentNodes: [target],
								boundary: state.currentBoundary,
							});
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
			if (state.active) deps.closePanel();
		} else if (msg.type === "COMPONENT_ARM") {
			if (msg.insertMode === 'replace') {
				const doReplace = (target: HTMLElement) => {
					const result = findExactMatches(target, dom.shadowHost);
					const componentName = result.componentName ?? target.tagName.toLowerCase();
					const ghost = replaceElement(target, msg);
					const selectionTarget = ghost ?? target;
					state.currentTargetEl = selectionTarget;
					state.currentBoundary = { componentName: msg.componentName };
					state.currentEquivalentNodes = [selectionTarget];
					dispatch({
						type: 'ELEMENT_SELECTED',
						el: selectionTarget,
						equivalentNodes: [selectionTarget],
						boundary: { componentName: msg.componentName },
					});
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
					armElementSelect(`Replace: ${msg.componentName}`, dom.shadowHost, doReplace);
				}
			} else if (!placeAtLockedInsert(msg)) {
				// No locked insert point — enter crosshair drop mode (Flow A)
				armInsert(msg, dom.shadowHost);
			} else {
				// Flow B: placed at locked insert — restart browse for rapid placement
				dispatch({ type: 'COMPONENT_PLACED' });
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
			deps.getRecordingEngine().getHistory().then(snapshots => {
				sendTo("panel", { type: "RECORDING_HISTORY", snapshots });
			});
		} else if (msg.type === "RECORDING_GET_SNAPSHOT") {
			deps.getRecordingEngine().getSnapshot(msg.snapshotId).then(snapshot => {
				if (snapshot) {
					sendTo("panel", { type: "RECORDING_SNAPSHOT", snapshot });
				}
			});
		} else if (msg.type === "RECORDING_GET_RANGE") {
			const ids: number[] = msg.ids ?? [];
			if (ids.length >= 2) {
				const min = Math.min(...ids);
				const max = Math.max(...ids);
				deps.getRecordingEngine().getRange(min, max).then(snapshots => {
					sendTo("panel", { type: "RECORDING_RANGE", snapshots });
				});
			}
		} else if (msg.type === "BUG_REPORT_PICK_ELEMENT") {
			deps.enterBugReportPickMode();
		} else if (msg.type === "THEME_PREVIEW" || msg.type === "THEME_PREVIEW_CSS") {
			deps.applyThemePreview(msg);
		} else if (msg.type === "REQUEST_THEME_VARS") {
			deps.sendThemeVars();
		}
	};
}
