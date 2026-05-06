// Effect executor — maps declarative effect objects to imperative calls.
// Each effect is a simple dispatch to a dependency function.

import type { OverlayEffect, ToolbarVisual } from './types';

// ── Dependency interface ─────────────────────────────────────────────────
// All imperative side effects are injected via this interface.
// This makes the executor testable (pass mocks) and decouples it from imports.

export interface EffectDeps {
  revertPreview: () => void;
  clearHighlights: () => void;
  clearHoverPreview: () => void;
  clearSelectionState: () => void;
  highlightElement: (el: HTMLElement) => void;
  showDrawButton: (el: HTMLElement) => void;
  removeDrawButton: () => void;
  setGrabCursor: (el: HTMLElement) => void;
  clearGrabCursor: (el: HTMLElement) => void;
  startBrowse: () => void;
  cancelInsert: () => void;
  clearLockedInsert: () => void;
  showToolbar: () => void;
  hideToolbar: () => void;
  updateToolbar: (visual: ToolbarVisual) => void;
  sendToPanel: (message: Record<string, unknown>) => void;
  setSelectMode: (on: boolean) => void;
  openPanel: () => void;
  setTextEditingLock: (locked: boolean) => void;
}

// ── Executor ─────────────────────────────────────────────────────────────

export function executeEffects(effects: OverlayEffect[], deps: EffectDeps): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'revert-preview':
        deps.revertPreview();
        break;
      case 'clear-highlights':
        deps.clearHighlights();
        break;
      case 'clear-hover-preview':
        deps.clearHoverPreview();
        break;
      case 'clear-selection-state':
        deps.clearSelectionState();
        break;
      case 'highlight-element':
        deps.highlightElement(effect.el);
        break;
      case 'show-draw-button':
        deps.showDrawButton(effect.el);
        break;
      case 'remove-draw-button':
        deps.removeDrawButton();
        break;
      case 'set-grab-cursor':
        deps.setGrabCursor(effect.el);
        break;
      case 'clear-grab-cursor':
        deps.clearGrabCursor(effect.el);
        break;
      case 'start-browse':
        deps.startBrowse();
        break;
      case 'cancel-insert':
        deps.cancelInsert();
        break;
      case 'clear-locked-insert':
        deps.clearLockedInsert();
        break;
      case 'show-toolbar':
        deps.showToolbar();
        break;
      case 'hide-toolbar':
        deps.hideToolbar();
        break;
      case 'update-toolbar':
        deps.updateToolbar(effect.visual);
        break;
      case 'send-to-panel':
        deps.sendToPanel(effect.message);
        break;
      case 'set-select-mode':
        deps.setSelectMode(effect.on);
        break;
      case 'open-panel':
        deps.openPanel();
        break;
      case 'set-text-editing-lock':
        deps.setTextEditingLock(effect.locked);
        break;
    }
  }
}
