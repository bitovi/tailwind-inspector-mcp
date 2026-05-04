// Overlay state machine types.
// Defines the single state struct, all actions, and all effects.

import type { AppMode, EditTool } from '../../../shared/types';
import type { DropPosition } from '../../../shared/drop-geometry';

// ── Phases ───────────────────────────────────────────────────────────────

/** Three-way toggle for the Select tool: off → picking → engaged */
export type SelectPhase = 'off' | 'picking' | 'engaged';

/** Three-way toggle for the Insert tool: off → browsing → locked */
export type InsertPhase = 'off' | 'browsing' | 'locked';

// ── Interaction (exclusive — at most one active) ─────────────────────────

export type Interaction =
  | { kind: 'none' }
  | { kind: 'drag-moving'; savedSelectPhase: SelectPhase; sourceEl: HTMLElement }
  | { kind: 'component-drag'; mode: 'replace' | 'insert' }
  | { kind: 'text-editing'; targetEl: HTMLElement };

// ── Toolbar visual state ─────────────────────────────────────────────────

export type ToolButtonVisual = 'gray' | 'picking' | 'engaged' | 'completed' | 'dim';

export interface ToolbarVisual {
  select: ToolButtonVisual;
  insert: ToolButtonVisual;
  text: ToolButtonVisual;
}

// ── State ────────────────────────────────────────────────────────────────

export interface OverlayState {
  active: boolean;
  mode: AppMode;
  editTool: EditTool;

  selectPhase: SelectPhase;
  insertPhase: InsertPhase;

  interaction: Interaction;

  // Selection (DOM-level, overlay-owned)
  selectedEl: HTMLElement | null;
  equivalentNodes: HTMLElement[];
  boundary: { componentName: string } | null;

  // Insert lock (DOM-level, overlay-owned)
  lockedTarget: HTMLElement | null;
  lockedPosition: DropPosition | null;

  // Tab (synced from panel)
  currentTab: string;
  tabPreference: 'design' | 'component';

  // Toolbar
  toolbar: ToolbarVisual;
}

// ── Actions ──────────────────────────────────────────────────────────────

// Command actions: panel → overlay (via WS). These drive mode transitions.
export type CommandAction =
  | { type: 'CMD_MODE_CHANGED'; mode: AppMode }
  | { type: 'CMD_TOGGLE_SELECT_MODE'; active: boolean }
  | { type: 'CMD_TOGGLE_INSERT_BROWSE'; active: boolean }
  | { type: 'CMD_CANCEL_MODE' }
  | { type: 'CMD_TAB_CHANGED'; tab: string }
  | { type: 'CMD_EDIT_TOOL_CHANGED'; tool: EditTool }
  | { type: 'CMD_COLOR_SCHEME'; scheme: 'dark' | 'light' };

// Local actions: overlay-internal (user interactions, drag lifecycle, etc.)
export type LocalAction =
  // Element selection
  | { type: 'ELEMENT_SELECTED'; el: HTMLElement; equivalentNodes: HTMLElement[]; boundary: { componentName: string } | null }
  | { type: 'ELEMENT_DESELECTED' }
  // Insert point
  | { type: 'INSERT_POINT_LOCKED'; target: HTMLElement; position: DropPosition }
  | { type: 'INSERT_POINT_CLEARED' }
  // Tool click from overlay bottom toolbar (three-way toggle)
  | { type: 'TOOLBAR_TOOL_CLICK'; tool: EditTool }
  // Escape key
  | { type: 'ESCAPE' }
  // Drag-move lifecycle
  | { type: 'DRAG_MOVE_START'; sourceEl: HTMLElement }
  | { type: 'DRAG_MOVE_THRESHOLD_MET' }
  | { type: 'DRAG_MOVE_DROPPED' }
  | { type: 'DRAG_MOVE_CANCELLED' }
  // Component drag lifecycle
  | { type: 'COMPONENT_DRAG_START'; mode: 'replace' | 'insert' }
  | { type: 'COMPONENT_DRAG_DROPPED' }
  | { type: 'COMPONENT_DRAG_CANCELLED' }
  // Text editing
  | { type: 'TEXT_EDIT_START'; targetEl: HTMLElement }
  | { type: 'TEXT_EDIT_END' }
  // Paste flow
  | { type: 'PASTE_INITIATED' }
  // Activation
  | { type: 'ACTIVATE' }
  | { type: 'DEACTIVATE' }
  // Navigation reset
  | { type: 'NAVIGATION_RESET' };

export type OverlayAction = CommandAction | LocalAction;

// ── Effects ──────────────────────────────────────────────────────────────

export type OverlayEffect =
  // DOM effects
  | { kind: 'revert-preview' }
  | { kind: 'clear-highlights' }
  | { kind: 'clear-hover-preview' }
  | { kind: 'highlight-element'; el: HTMLElement }
  | { kind: 'show-draw-button'; el: HTMLElement }
  | { kind: 'remove-draw-button' }
  | { kind: 'set-grab-cursor'; el: HTMLElement }
  | { kind: 'clear-grab-cursor'; el: HTMLElement }
  // Selection state
  | { kind: 'clear-selection-state' }
  // Drop-zone effects
  | { kind: 'start-browse' }
  | { kind: 'cancel-insert' }
  | { kind: 'clear-locked-insert' }
  // Toolbar effects
  | { kind: 'show-toolbar' }
  | { kind: 'hide-toolbar' }
  | { kind: 'update-toolbar'; visual: ToolbarVisual }
  // WS effects
  | { kind: 'send-to-panel'; message: Record<string, unknown> }
  // Crosshair / cursor
  | { kind: 'set-select-mode'; on: boolean }
  // Container
  | { kind: 'open-panel' }
  // Text editing
  | { kind: 'set-text-editing-lock'; locked: boolean };

// ── Reducer result ───────────────────────────────────────────────────────

export interface ReducerResult {
  state: OverlayState;
  effects: OverlayEffect[];
}
