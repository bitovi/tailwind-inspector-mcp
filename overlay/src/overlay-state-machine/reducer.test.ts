import { describe, it, expect } from 'vitest';
import { overlayReducer, INITIAL_STATE } from './reducer';
import type { OverlayState, OverlayEffect } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────

const div = {} as HTMLElement; // mock DOM element
const div2 = {} as HTMLElement;

function stateWith(overrides: Partial<OverlayState>): OverlayState {
  return { ...INITIAL_STATE, ...overrides };
}

function effectKinds(effects: OverlayEffect[]): string[] {
  return effects.map(e => e.kind);
}

// ════════════════════════════════════════════════════════════════════════════
// CMD_MODE_CHANGED
// ════════════════════════════════════════════════════════════════════════════

describe('CMD_MODE_CHANGED', () => {
  it('null → select: enters picking phase', () => {
    const { state, effects } = overlayReducer(INITIAL_STATE, { type: 'CMD_MODE_CHANGED', mode: 'select' });
    expect(state.mode).toBe('select');
    expect(state.editTool).toBe('select');
    expect(state.selectPhase).toBe('picking');
    expect(state.insertPhase).toBe('off');
    expect(state.selectedEl).toBeNull();
    expect(state.active).toBe(true);
    expect(effectKinds(effects)).toContain('set-select-mode');
    expect(effectKinds(effects)).toContain('show-toolbar');
    expect(effects.find(e => e.kind === 'set-select-mode')).toEqual({ kind: 'set-select-mode', on: true });
  });

  it('null → insert: enters browsing phase', () => {
    const { state, effects } = overlayReducer(INITIAL_STATE, { type: 'CMD_MODE_CHANGED', mode: 'insert' });
    expect(state.mode).toBe('insert');
    expect(state.editTool).toBe('insert');
    expect(state.selectPhase).toBe('off');
    expect(state.insertPhase).toBe('browsing');
    expect(state.tabPreference).toBe('component');
    expect(state.currentTab).toBe('place');
    expect(effectKinds(effects)).toContain('start-browse');
    expect(effectKinds(effects)).toContain('set-select-mode');
    expect(effects.find(e => e.kind === 'set-select-mode')).toEqual({ kind: 'set-select-mode', on: false });
  });

  it('select → null: full cleanup', () => {
    const prev = stateWith({ mode: 'select', selectPhase: 'picking', active: true });
    const { state, effects } = overlayReducer(prev, { type: 'CMD_MODE_CHANGED', mode: null });
    expect(state.mode).toBeNull();
    expect(state.editTool).toBeNull();
    expect(state.selectPhase).toBe('off');
    expect(effectKinds(effects)).toContain('revert-preview');
    expect(effectKinds(effects)).toContain('clear-highlights');
    expect(effectKinds(effects)).toContain('cancel-insert');
    expect(effectKinds(effects)).toContain('clear-locked-insert');
    expect(effectKinds(effects)).toContain('set-select-mode');
    expect(effectKinds(effects)).toContain('clear-selection-state');
    expect(effects.find(e => e.kind === 'set-select-mode')).toEqual({ kind: 'set-select-mode', on: false });
  });

  it('select → insert: clears selection, starts browse', () => {
    const prev = stateWith({ mode: 'select', selectPhase: 'engaged', selectedEl: div });
    const { state, effects } = overlayReducer(prev, { type: 'CMD_MODE_CHANGED', mode: 'insert' });
    expect(state.mode).toBe('insert');
    expect(state.selectPhase).toBe('off');
    expect(state.insertPhase).toBe('browsing');
    expect(state.selectedEl).toBeNull();
    expect(effectKinds(effects)).toContain('start-browse');
  });

  it('insert → select: clears insert, enters picking', () => {
    const prev = stateWith({ mode: 'insert', insertPhase: 'browsing', lockedTarget: div });
    const { state, effects } = overlayReducer(prev, { type: 'CMD_MODE_CHANGED', mode: 'select' });
    expect(state.mode).toBe('select');
    expect(state.insertPhase).toBe('off');
    expect(state.selectPhase).toBe('picking');
    expect(state.lockedTarget).toBeNull();
    expect(effectKinds(effects)).toContain('set-select-mode');
  });

  it('preserves tabPreference=component when entering insert', () => {
    const prev = stateWith({ tabPreference: 'component' });
    const { state } = overlayReducer(prev, { type: 'CMD_MODE_CHANGED', mode: 'insert' });
    expect(state.tabPreference).toBe('component');
  });

  it('converts tabPreference=design to component when entering insert', () => {
    const prev = stateWith({ tabPreference: 'design' });
    const { state } = overlayReducer(prev, { type: 'CMD_MODE_CHANGED', mode: 'insert' });
    expect(state.tabPreference).toBe('component');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CMD_TOGGLE_SELECT_MODE
// ════════════════════════════════════════════════════════════════════════════

describe('CMD_TOGGLE_SELECT_MODE', () => {
  it('active=true: enters picking phase', () => {
    const { state, effects } = overlayReducer(INITIAL_STATE, { type: 'CMD_TOGGLE_SELECT_MODE', active: true });
    expect(state.selectPhase).toBe('picking');
    expect(state.active).toBe(true);
    expect(effectKinds(effects)).toContain('set-select-mode');
    expect(effectKinds(effects)).toContain('open-panel');
  });

  it('active=false with element: enters engaged phase', () => {
    const prev = stateWith({ selectPhase: 'picking', selectedEl: div });
    const { state } = overlayReducer(prev, { type: 'CMD_TOGGLE_SELECT_MODE', active: false });
    expect(state.selectPhase).toBe('engaged');
  });

  it('active=false without element: enters off phase', () => {
    const prev = stateWith({ selectPhase: 'picking', selectedEl: null });
    const { state } = overlayReducer(prev, { type: 'CMD_TOGGLE_SELECT_MODE', active: false });
    expect(state.selectPhase).toBe('off');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CMD_TOGGLE_INSERT_BROWSE
// ════════════════════════════════════════════════════════════════════════════

describe('CMD_TOGGLE_INSERT_BROWSE', () => {
  it('active=true: enters browsing, clears locked point', () => {
    const prev = stateWith({ insertPhase: 'locked', lockedTarget: div });
    const { state, effects } = overlayReducer(prev, { type: 'CMD_TOGGLE_INSERT_BROWSE', active: true });
    expect(state.insertPhase).toBe('browsing');
    expect(state.lockedTarget).toBeNull();
    expect(effectKinds(effects)).toContain('clear-locked-insert');
    expect(effectKinds(effects)).toContain('start-browse');
  });

  it('active=false with locked point: enters locked phase', () => {
    const prev = stateWith({ insertPhase: 'browsing', lockedTarget: div, lockedPosition: 'before' });
    const { state, effects } = overlayReducer(prev, { type: 'CMD_TOGGLE_INSERT_BROWSE', active: false });
    expect(state.insertPhase).toBe('locked');
    expect(effectKinds(effects)).toContain('cancel-insert');
  });

  it('active=false without locked point: enters off phase', () => {
    const prev = stateWith({ insertPhase: 'browsing', lockedTarget: null });
    const { state } = overlayReducer(prev, { type: 'CMD_TOGGLE_INSERT_BROWSE', active: false });
    expect(state.insertPhase).toBe('off');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CMD_CANCEL_MODE
// ════════════════════════════════════════════════════════════════════════════

describe('CMD_CANCEL_MODE', () => {
  it('clears all phases and selection', () => {
    const prev = stateWith({
      selectPhase: 'picking',
      insertPhase: 'browsing',
      selectedEl: div,
      lockedTarget: div2,
    });
    const { state, effects } = overlayReducer(prev, { type: 'CMD_CANCEL_MODE' });
    expect(state.selectPhase).toBe('off');
    expect(state.insertPhase).toBe('off');
    expect(state.selectedEl).toBeNull();
    expect(state.lockedTarget).toBeNull();
    expect(effectKinds(effects)).toContain('set-select-mode');
    expect(effectKinds(effects)).toContain('cancel-insert');
    expect(effectKinds(effects)).toContain('clear-locked-insert');
    expect(effectKinds(effects)).toContain('clear-selection-state');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CMD_TAB_CHANGED
// ════════════════════════════════════════════════════════════════════════════

describe('CMD_TAB_CHANGED', () => {
  it('sets tabPreference to component for replace/place tabs', () => {
    const { state } = overlayReducer(INITIAL_STATE, { type: 'CMD_TAB_CHANGED', tab: 'replace' });
    expect(state.tabPreference).toBe('component');
    expect(state.currentTab).toBe('replace');
  });

  it('sets tabPreference to design for design tab', () => {
    const prev = stateWith({ tabPreference: 'component' });
    const { state } = overlayReducer(prev, { type: 'CMD_TAB_CHANGED', tab: 'design' });
    expect(state.tabPreference).toBe('design');
    expect(state.currentTab).toBe('design');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ELEMENT_SELECTED
// ════════════════════════════════════════════════════════════════════════════

describe('ELEMENT_SELECTED', () => {
  it('stores element and emits highlight effects', () => {
    const prev = stateWith({ mode: 'select', selectPhase: 'picking' });
    const boundary = { componentName: 'Button' };
    const { state, effects } = overlayReducer(prev, {
      type: 'ELEMENT_SELECTED',
      el: div,
      equivalentNodes: [div],
      boundary,
    });
    expect(state.selectedEl).toBe(div);
    expect(state.equivalentNodes).toEqual([div]);
    expect(state.boundary).toBe(boundary);
    expect(state.mode).toBe('select');
    // selectPhase stays as-is (persistent select)
    expect(state.selectPhase).toBe('picking');
    expect(effectKinds(effects)).toContain('highlight-element');
    expect(effectKinds(effects)).toContain('show-draw-button');
    expect(effectKinds(effects)).toContain('set-grab-cursor');
  });

  it('defaults mode to select if null', () => {
    const prev = stateWith({ mode: null });
    const { state } = overlayReducer(prev, {
      type: 'ELEMENT_SELECTED',
      el: div,
      equivalentNodes: [div],
      boundary: null,
    });
    expect(state.mode).toBe('select');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// INSERT_POINT_LOCKED
// ════════════════════════════════════════════════════════════════════════════

describe('INSERT_POINT_LOCKED', () => {
  it('transitions to locked phase', () => {
    const prev = stateWith({ insertPhase: 'browsing' });
    const { state } = overlayReducer(prev, {
      type: 'INSERT_POINT_LOCKED',
      target: div,
      position: 'before',
    });
    expect(state.insertPhase).toBe('locked');
    expect(state.lockedTarget).toBe(div);
    expect(state.lockedPosition).toBe('before');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TOOLBAR_TOOL_CLICK — three-way toggle
// ════════════════════════════════════════════════════════════════════════════

describe('TOOLBAR_TOOL_CLICK', () => {
  describe('select tool', () => {
    it('picking + element → engaged (Orange → Teal)', () => {
      const prev = stateWith({ selectPhase: 'picking', selectedEl: div, mode: 'select' });
      const { state, effects } = overlayReducer(prev, { type: 'TOOLBAR_TOOL_CLICK', tool: 'select' });
      expect(state.selectPhase).toBe('engaged');
      expect(effects.find(e => e.kind === 'set-select-mode')).toEqual({ kind: 'set-select-mode', on: false });
    });

    it('engaged → picking (Teal → Orange)', () => {
      const prev = stateWith({ selectPhase: 'engaged', selectedEl: div, mode: 'select' });
      const { state, effects } = overlayReducer(prev, { type: 'TOOLBAR_TOOL_CLICK', tool: 'select' });
      expect(state.selectPhase).toBe('picking');
      expect(state.selectedEl).toBeNull();
      expect(effects.find(e => e.kind === 'set-select-mode')).toEqual({ kind: 'set-select-mode', on: true });
    });

    it('off → picking (Gray → Orange)', () => {
      const prev = stateWith({ selectPhase: 'off' });
      const { state, effects } = overlayReducer(prev, { type: 'TOOLBAR_TOOL_CLICK', tool: 'select' });
      expect(state.selectPhase).toBe('picking');
      expect(state.mode).toBe('select');
      expect(state.editTool).toBe('select');
      expect(effectKinds(effects)).toContain('set-select-mode');
    });
  });

  describe('insert tool', () => {
    it('browsing + locked point → locked (Orange → Teal)', () => {
      const prev = stateWith({ insertPhase: 'browsing', lockedTarget: div, lockedPosition: 'after', mode: 'insert' });
      const { state, effects } = overlayReducer(prev, { type: 'TOOLBAR_TOOL_CLICK', tool: 'insert' });
      expect(state.insertPhase).toBe('locked');
      expect(effectKinds(effects)).toContain('cancel-insert');
    });

    it('locked → browsing (Teal → Orange)', () => {
      const prev = stateWith({ insertPhase: 'locked', lockedTarget: div, lockedPosition: 'before', mode: 'insert', selectPhase: 'engaged' });
      const { state, effects } = overlayReducer(prev, { type: 'TOOLBAR_TOOL_CLICK', tool: 'insert' });
      expect(state.insertPhase).toBe('browsing');
      expect(state.lockedTarget).toBeNull();
      expect(state.selectPhase).toBe('off');
      expect(effectKinds(effects)).toContain('clear-locked-insert');
      expect(effectKinds(effects)).toContain('start-browse');
    });

    it('off → browsing (Gray → Orange)', () => {
      const prev = stateWith({ insertPhase: 'off' });
      const { state, effects } = overlayReducer(prev, { type: 'TOOLBAR_TOOL_CLICK', tool: 'insert' });
      expect(state.insertPhase).toBe('browsing');
      expect(state.mode).toBe('insert');
      expect(state.editTool).toBe('insert');
      expect(effectKinds(effects)).toContain('start-browse');
    });
  });

  describe('null tool (deselect)', () => {
    it('resets all state', () => {
      const prev = stateWith({ mode: 'select', selectPhase: 'picking', selectedEl: div });
      const { state, effects } = overlayReducer(prev, { type: 'TOOLBAR_TOOL_CLICK', tool: null });
      expect(state.mode).toBeNull();
      expect(state.editTool).toBeNull();
      expect(state.selectPhase).toBe('off');
      expect(state.insertPhase).toBe('off');
      expect(effectKinds(effects)).toContain('set-select-mode');
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ESCAPE
// ════════════════════════════════════════════════════════════════════════════

describe('ESCAPE', () => {
  describe('insert mode', () => {
    it('browsing + locked → locked (Orange + point → Teal)', () => {
      const prev = stateWith({ insertPhase: 'browsing', lockedTarget: div, lockedPosition: 'before' });
      const { state, effects } = overlayReducer(prev, { type: 'ESCAPE' });
      expect(state.insertPhase).toBe('locked');
      expect(effectKinds(effects)).toContain('cancel-insert');
      const sendEffects = effects.filter(e => e.kind === 'send-to-panel');
      expect(sendEffects).toHaveLength(1);
    });

    it('locked → off (Teal → Gray)', () => {
      const prev = stateWith({ insertPhase: 'locked', lockedTarget: div, lockedPosition: 'after' });
      const { state, effects } = overlayReducer(prev, { type: 'ESCAPE' });
      expect(state.insertPhase).toBe('off');
      expect(state.mode).toBeNull();
      expect(state.lockedTarget).toBeNull();
      expect(effectKinds(effects)).toContain('clear-locked-insert');
    });

    it('browsing + no point → off (Orange → Gray)', () => {
      const prev = stateWith({ insertPhase: 'browsing', lockedTarget: null });
      const { state, effects } = overlayReducer(prev, { type: 'ESCAPE' });
      expect(state.insertPhase).toBe('off');
      expect(state.mode).toBeNull();
      expect(effectKinds(effects)).toContain('cancel-insert');
    });
  });

  describe('select mode', () => {
    it('picking + element → engaged (Orange → Teal)', () => {
      const prev = stateWith({ selectPhase: 'picking', selectedEl: div });
      const { state, effects } = overlayReducer(prev, { type: 'ESCAPE' });
      expect(state.selectPhase).toBe('engaged');
      expect(effects.find(e => e.kind === 'set-select-mode')).toEqual({ kind: 'set-select-mode', on: false });
    });

    it('engaged → off (Teal → Gray, deselect element)', () => {
      const prev = stateWith({ selectPhase: 'engaged', selectedEl: div });
      const { state, effects } = overlayReducer(prev, { type: 'ESCAPE' });
      expect(state.selectPhase).toBe('off');
      expect(state.mode).toBeNull();
      expect(state.selectedEl).toBeNull();
      expect(effectKinds(effects)).toContain('revert-preview');
      expect(effectKinds(effects)).toContain('clear-highlights');
    });

    it('picking + no element → off (Orange → Gray)', () => {
      const prev = stateWith({ selectPhase: 'picking', selectedEl: null });
      const { state, effects } = overlayReducer(prev, { type: 'ESCAPE' });
      expect(state.selectPhase).toBe('off');
      expect(state.mode).toBeNull();
      expect(effects.find(e => e.kind === 'set-select-mode')).toEqual({ kind: 'set-select-mode', on: false });
    });
  });

  it('no active mode → no-op', () => {
    const { state, effects } = overlayReducer(INITIAL_STATE, { type: 'ESCAPE' });
    expect(state).toEqual(INITIAL_STATE);
    expect(effects).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Drag-move lifecycle
// ════════════════════════════════════════════════════════════════════════════

describe('Drag-move lifecycle', () => {
  it('DRAG_MOVE_THRESHOLD_MET saves selectPhase and clears it', () => {
    const prev = stateWith({ selectPhase: 'picking', selectedEl: div });
    const { state, effects } = overlayReducer(prev, { type: 'DRAG_MOVE_THRESHOLD_MET' });
    expect(state.interaction).toEqual({
      kind: 'drag-moving',
      savedSelectPhase: 'picking',
      sourceEl: div,
    });
    expect(state.selectPhase).toBe('off');
    expect(effectKinds(effects)).toContain('set-select-mode');
    expect(effectKinds(effects)).toContain('clear-grab-cursor');
  });

  it('DRAG_MOVE_THRESHOLD_MET rejects if another interaction active', () => {
    const prev = stateWith({
      selectPhase: 'picking',
      selectedEl: div,
      interaction: { kind: 'text-editing', targetEl: div },
    });
    const { state, effects } = overlayReducer(prev, { type: 'DRAG_MOVE_THRESHOLD_MET' });
    expect(state.interaction.kind).toBe('text-editing');
    expect(effects).toHaveLength(0);
  });

  it('DRAG_MOVE_DROPPED restores savedSelectPhase', () => {
    const prev = stateWith({
      selectPhase: 'off',
      selectedEl: div,
      interaction: { kind: 'drag-moving', savedSelectPhase: 'engaged', sourceEl: div },
    });
    const { state, effects } = overlayReducer(prev, { type: 'DRAG_MOVE_DROPPED' });
    expect(state.selectPhase).toBe('engaged');
    expect(state.interaction.kind).toBe('none');
    expect(effectKinds(effects)).toContain('set-grab-cursor');
    expect(effectKinds(effects)).toContain('highlight-element');
  });

  it('DRAG_MOVE_CANCELLED restores savedSelectPhase', () => {
    const prev = stateWith({
      selectPhase: 'off',
      selectedEl: div,
      interaction: { kind: 'drag-moving', savedSelectPhase: 'picking', sourceEl: div },
    });
    const { state, effects } = overlayReducer(prev, { type: 'DRAG_MOVE_CANCELLED' });
    expect(state.selectPhase).toBe('picking');
    expect(state.interaction.kind).toBe('none');
    expect(effects.find(e => e.kind === 'set-select-mode')).toEqual({ kind: 'set-select-mode', on: true });
  });

  it('DRAG_MOVE_DROPPED sends non-picking select mode change', () => {
    const prev = stateWith({
      selectPhase: 'off',
      selectedEl: div,
      interaction: { kind: 'drag-moving', savedSelectPhase: 'engaged', sourceEl: div },
    });
    const { effects } = overlayReducer(prev, { type: 'DRAG_MOVE_DROPPED' });
    const sendEffects = effects.filter(e => e.kind === 'send-to-panel') as Array<{ kind: 'send-to-panel'; message: Record<string, unknown> }>;
    expect(sendEffects.some(e => (e.message as any).type === 'SELECT_MODE_CHANGED')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Component drag lifecycle
// ════════════════════════════════════════════════════════════════════════════

describe('Component drag lifecycle', () => {
  it('COMPONENT_DRAG_START sets interaction', () => {
    const { state, effects } = overlayReducer(INITIAL_STATE, { type: 'COMPONENT_DRAG_START', mode: 'insert' });
    expect(state.interaction).toEqual({ kind: 'component-drag', mode: 'insert' });
    expect(effectKinds(effects)).toContain('cancel-insert');
  });

  it('COMPONENT_DRAG_START rejects if another interaction active', () => {
    const prev = stateWith({ interaction: { kind: 'text-editing', targetEl: div } });
    const { state } = overlayReducer(prev, { type: 'COMPONENT_DRAG_START', mode: 'replace' });
    expect(state.interaction.kind).toBe('text-editing');
  });

  it('COMPONENT_DRAG_DROPPED clears interaction', () => {
    const prev = stateWith({ interaction: { kind: 'component-drag', mode: 'insert' } });
    const { state } = overlayReducer(prev, { type: 'COMPONENT_DRAG_DROPPED' });
    expect(state.interaction.kind).toBe('none');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Text editing lifecycle
// ════════════════════════════════════════════════════════════════════════════

describe('Text editing lifecycle', () => {
  it('TEXT_EDIT_START sets interaction', () => {
    const { state, effects } = overlayReducer(INITIAL_STATE, { type: 'TEXT_EDIT_START', targetEl: div });
    expect(state.interaction).toEqual({ kind: 'text-editing', targetEl: div });
    expect(effectKinds(effects)).toContain('set-text-editing-lock');
  });

  it('TEXT_EDIT_END clears interaction', () => {
    const prev = stateWith({ interaction: { kind: 'text-editing', targetEl: div } });
    const { state, effects } = overlayReducer(prev, { type: 'TEXT_EDIT_END' });
    expect(state.interaction.kind).toBe('none');
    expect(effects.find(e => e.kind === 'set-text-editing-lock')).toEqual({ kind: 'set-text-editing-lock', locked: false });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PASTE_INITIATED
// ════════════════════════════════════════════════════════════════════════════

describe('PASTE_INITIATED', () => {
  it('sets toolbar to completed/picking', () => {
    const prev = stateWith({ selectPhase: 'engaged', selectedEl: div });
    const { state } = overlayReducer(prev, { type: 'PASTE_INITIATED' });
    expect(state.toolbar.select).toBe('completed');
    expect(state.toolbar.insert).toBe('picking');
    expect(state.selectPhase).toBe('off');
    expect(state.insertPhase).toBe('browsing');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// NAVIGATION_RESET
// ════════════════════════════════════════════════════════════════════════════

describe('NAVIGATION_RESET', () => {
  it('resets all state and notifies panel', () => {
    const prev = stateWith({
      mode: 'select',
      selectPhase: 'engaged',
      selectedEl: div,
      active: true,
    });
    const { state, effects } = overlayReducer(prev, { type: 'NAVIGATION_RESET' });
    expect(state.mode).toBeNull();
    expect(state.selectPhase).toBe('off');
    expect(state.selectedEl).toBeNull();
    expect(state.interaction.kind).toBe('none');
    const sendEffects = effects.filter(e => e.kind === 'send-to-panel') as Array<{ kind: 'send-to-panel'; message: Record<string, unknown> }>;
    expect(sendEffects.some(e => (e.message as any).type === 'RESET_SELECTION')).toBe(true);
    expect(sendEffects.some(e => (e.message as any).type === 'COMPONENT_DISARMED')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Toolbar visual state derivation
// ════════════════════════════════════════════════════════════════════════════

describe('Toolbar visual state', () => {
  it('select picking → toolbar.select=picking', () => {
    const { state } = overlayReducer(INITIAL_STATE, { type: 'CMD_MODE_CHANGED', mode: 'select' });
    expect(state.toolbar.select).toBe('picking');
    expect(state.toolbar.insert).toBe('gray');
  });

  it('insert browsing → toolbar.insert=picking', () => {
    const { state } = overlayReducer(INITIAL_STATE, { type: 'CMD_MODE_CHANGED', mode: 'insert' });
    expect(state.toolbar.insert).toBe('picking');
    expect(state.toolbar.select).toBe('gray');
  });

  it('element selected + engaged → toolbar.select=engaged', () => {
    const prev = stateWith({ selectPhase: 'picking', selectedEl: div });
    const { state } = overlayReducer(prev, { type: 'ESCAPE' }); // picking+element → engaged
    expect(state.toolbar.select).toBe('engaged');
  });

  it('insert locked → toolbar.insert=engaged', () => {
    const prev = stateWith({ insertPhase: 'browsing' });
    const { state } = overlayReducer(prev, {
      type: 'INSERT_POINT_LOCKED',
      target: div,
      position: 'after',
    });
    expect(state.toolbar.insert).toBe('engaged');
  });
});
