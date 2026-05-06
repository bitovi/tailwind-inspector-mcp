// Element highlight & hover preview utilities.
// Extracted from index.ts — operates on shared overlay state.

import { detectComponent } from "./framework-detect";
import { removeElementDrawer } from "./element-drawer";
import { dom } from "./overlay-dom";
import { state } from "./overlay-state";
import { getState } from "./overlay-state-machine";

export function highlightElement(el: HTMLElement): void {
	const rect = el.getBoundingClientRect();
	const overlay = document.createElement("div");
	overlay.className = "highlight-overlay";
	overlay.style.top = `${rect.top - 4}px`;
	overlay.style.left = `${rect.left - 4}px`;
	overlay.style.width = `${rect.width + 8}px`;
	overlay.style.height = `${rect.height + 8}px`;
	dom.shadowRoot.appendChild(overlay);
}

export function removeDrawButton(): void {
	dom.toolbarEl?.remove();
	dom.toolbarEl = null;
	dom.msgRowEl?.remove();
	dom.msgRowEl = null;
	dom.pickerEl?.remove();
	dom.pickerEl = null;
	removeElementDrawer();
}

export function clearHighlights(): void {
	dom.shadowRoot
		.querySelectorAll(".highlight-overlay")
		.forEach((el) => el.remove());
	removeDrawButton();
}

/** Re-render selection highlights at fresh getBoundingClientRect positions. */
export function repositionHighlights(): void {
	// Only reposition highlights that are actually in the DOM — don't create
	// new ones.  This keeps insert mode from spawning selection outlines.
	const existing = dom.shadowRoot.querySelectorAll(".highlight-overlay");
	if (existing.length === 0) return;
	// Don't re-create highlights during any exclusive interaction
	// (they were intentionally cleared on entry)
	if (getState().interaction.kind !== 'none') {
		existing.forEach((el) => el.remove());
		return;
	}
	existing.forEach((el) => el.remove());
	state.currentEquivalentNodes.forEach((n) => highlightElement(n));
}

export function clearHoverPreview(): void {
	dom.hoverOutlineEl?.remove();
	dom.hoverOutlineEl = null;
	dom.hoverTooltipEl?.remove();
	dom.hoverTooltipEl = null;
	dom.lastHoveredEl = null;
}

export function showHoverPreview(el: HTMLElement, componentName: string): void {
	const rect = el.getBoundingClientRect();

	if (!dom.hoverOutlineEl) {
		dom.hoverOutlineEl = document.createElement("div");
		dom.hoverOutlineEl.className = "hover-target-outline";
		dom.shadowRoot.appendChild(dom.hoverOutlineEl);
	}
	dom.hoverOutlineEl.style.top = `${rect.top - 4}px`;
	dom.hoverOutlineEl.style.left = `${rect.left - 4}px`;
	dom.hoverOutlineEl.style.width = `${rect.width + 8}px`;
	dom.hoverOutlineEl.style.height = `${rect.height + 8}px`;

	if (!dom.hoverTooltipEl) {
		dom.hoverTooltipEl = document.createElement("div");
		dom.hoverTooltipEl.className = "hover-tooltip";
		dom.shadowRoot.appendChild(dom.hoverTooltipEl);
	}
	const tag = el.tagName.toLowerCase();
	const cls =
		(typeof el.className === "string"
			? el.className.trim().split(/\s+/)[0]
			: "") ?? "";
	dom.hoverTooltipEl.innerHTML = `<span class="ht-dim">&lt;</span>${componentName}<span class="ht-dim">&gt;</span> <span class="ht-dim">${tag}${cls ? `.${cls}` : ""}</span>`;

	const tooltipHeight = 24;
	const ttTop = rect.top - tooltipHeight - 6;
	dom.hoverTooltipEl.style.top = `${ttTop < 4 ? rect.bottom + 6 : ttTop}px`;
	dom.hoverTooltipEl.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 200))}px`;
}

export function mouseMoveHandler(e: MouseEvent): void {
	// Suppress hover previews during any exclusive interaction
	if (getState().interaction.kind !== 'none') return;

	// Only show hover previews when actively picking (select mode or add mode)
	if (!state.selectModeOn && !state.addMode) return;

	const now = Date.now();
	if (now - dom.lastMoveTime < 16) return;
	dom.lastMoveTime = now;

	const composed = e.composedPath();
	if (composed.some((n) => n === dom.shadowHost)) {
		clearHoverPreview();
		return;
	}

	const target = e.target as Element;
	if (!target || !(target instanceof HTMLElement)) {
		clearHoverPreview();
		return;
	}

	// ── Persistent select: suppress hover outlines inside the selected element ──
	if (state.currentTargetEl && (target === state.currentTargetEl || state.currentTargetEl.contains(target))) {
		clearHoverPreview();
		dom.lastHoveredEl = target;
		return;
	}

	if (target === dom.lastHoveredEl) return;
	dom.lastHoveredEl = target;

	const rect = target.getBoundingClientRect();
	if (rect.width < 10 || rect.height < 10) {
		clearHoverPreview();
		return;
	}

	const boundary = detectComponent(target);
	const label = boundary?.componentName ?? target.tagName.toLowerCase();

	showHoverPreview(target, label);
}
