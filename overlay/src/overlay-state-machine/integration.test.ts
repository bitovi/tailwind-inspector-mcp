// Integration test: dispatch → reducer → effect-executor → dep calls
// Verifies the full loop from action dispatch through to actual EffectDeps calls.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initStateMachine, dispatch, getState, resetState, subscribe } from './index';
import type { EffectDeps } from './effect-executor';

function createMockDeps(): EffectDeps {
  return {
    revertPreview: vi.fn(),
    clearHighlights: vi.fn(),
    clearHoverPreview: vi.fn(),
    clearSelectionState: vi.fn(),
    highlightElement: vi.fn(),
    showDrawButton: vi.fn(),
    removeDrawButton: vi.fn(),
    setGrabCursor: vi.fn(),
    clearGrabCursor: vi.fn(),
    startBrowse: vi.fn(),
    cancelInsert: vi.fn(),
    clearLockedInsert: vi.fn(),
    showToolbar: vi.fn(),
    hideToolbar: vi.fn(),
    updateToolbar: vi.fn(),
    sendToPanel: vi.fn(),
    setSelectMode: vi.fn(),
    openPanel: vi.fn(),
    setTextEditingLock: vi.fn(),
  };
}

describe('overlay state machine integration', () => {
  let deps: EffectDeps;

  beforeEach(() => {
    deps = createMockDeps();
    initStateMachine(deps);
    resetState();
  });

  // ── (a) CMD_MODE_CHANGED select ──────────────────────────────────────

  describe('CMD_MODE_CHANGED select', () => {
    it('transitions to select/picking and calls expected deps', () => {
      dispatch({ type: 'CMD_MODE_CHANGED', mode: 'select' });

      const s = getState();
      expect(s.mode).toBe('select');
      expect(s.selectPhase).toBe('picking');
      expect(s.insertPhase).toBe('off');

      // FULL_CLEANUP deps
      expect(deps.revertPreview).toHaveBeenCalled();
      expect(deps.clearHighlights).toHaveBeenCalled();
      expect(deps.cancelInsert).toHaveBeenCalled();
      expect(deps.clearLockedInsert).toHaveBeenCalled();
      expect(deps.clearSelectionState).toHaveBeenCalled();

      // Mode-specific deps
      expect(deps.setSelectMode).toHaveBeenCalledWith(true);
      expect(deps.showToolbar).toHaveBeenCalled();

      // Toolbar auto-derived: select changes from gray → picking
      expect(deps.updateToolbar).toHaveBeenCalledWith({
        select: 'picking',
        insert: 'gray',
        text: 'gray',
      });
    });
  });

  // ── (b) CMD_MODE_CHANGED insert ─────────────────────────────────────

  describe('CMD_MODE_CHANGED insert', () => {
    it('transitions to insert/browsing and calls expected deps', () => {
      dispatch({ type: 'CMD_MODE_CHANGED', mode: 'insert' });

      const s = getState();
      expect(s.mode).toBe('insert');
      expect(s.insertPhase).toBe('browsing');
      expect(s.selectPhase).toBe('off');

      expect(deps.setSelectMode).toHaveBeenCalledWith(false);
      expect(deps.startBrowse).toHaveBeenCalled();
      expect(deps.showToolbar).toHaveBeenCalled();

      // Toolbar auto-derived: insert changes from gray → picking
      expect(deps.updateToolbar).toHaveBeenCalledWith({
        select: 'gray',
        insert: 'picking',
        text: 'gray',
      });
    });
  });

  // ── (c) ELEMENT_SELECTED ─────────────────────────────────────────────

  describe('ELEMENT_SELECTED', () => {
    it('stores element and calls highlight/draw/cursor deps', () => {
      // Enter select mode first
      dispatch({ type: 'CMD_MODE_CHANGED', mode: 'select' });
      vi.clearAllMocks();

      const el = {} as HTMLElement;
      dispatch({
        type: 'ELEMENT_SELECTED',
        el,
        equivalentNodes: [el],
        boundary: null,
      });

      const s = getState();
      expect(s.selectedEl).toBe(el);

      expect(deps.clearHighlights).toHaveBeenCalled();
      expect(deps.clearHoverPreview).toHaveBeenCalled();
      expect(deps.highlightElement).toHaveBeenCalledWith(el);
      expect(deps.showDrawButton).toHaveBeenCalledWith(el);
      expect(deps.setGrabCursor).toHaveBeenCalledWith(el);
    });
  });

  // ── (d) CMD_CANCEL_MODE from engaged state ──────────────────────────

  describe('CMD_CANCEL_MODE from engaged', () => {
    it('clears selection/insert and calls cleanup deps', () => {
      // Enter select → select element → escape to engaged
      dispatch({ type: 'CMD_MODE_CHANGED', mode: 'select' });
      const el = {} as HTMLElement;
      dispatch({ type: 'ELEMENT_SELECTED', el, equivalentNodes: [el], boundary: null });
      dispatch({ type: 'ESCAPE' }); // picking + element → engaged
      expect(getState().selectPhase).toBe('engaged');
      vi.clearAllMocks();

      dispatch({ type: 'CMD_CANCEL_MODE' });

      const s = getState();
      expect(s.selectPhase).toBe('off');
      expect(s.insertPhase).toBe('off');

      expect(deps.revertPreview).toHaveBeenCalled();
      expect(deps.clearHighlights).toHaveBeenCalled();
      expect(deps.clearSelectionState).toHaveBeenCalled();
      expect(deps.setSelectMode).toHaveBeenCalledWith(false);
      expect(deps.cancelInsert).toHaveBeenCalled();
      expect(deps.clearLockedInsert).toHaveBeenCalled();

      // Toolbar: engaged → off, so select goes from 'engaged' → 'gray'
      expect(deps.updateToolbar).toHaveBeenCalledWith({
        select: 'gray',
        insert: 'gray',
        text: 'gray',
      });
    });
  });

  // ── (e) ESCAPE from select picking with element ─────────────────────

  describe('ESCAPE from select picking with element', () => {
    it('transitions to engaged and stops select mode', () => {
      dispatch({ type: 'CMD_MODE_CHANGED', mode: 'select' });
      const el = {} as HTMLElement;
      dispatch({ type: 'ELEMENT_SELECTED', el, equivalentNodes: [el], boundary: null });
      expect(getState().selectPhase).toBe('picking');
      vi.clearAllMocks();

      dispatch({ type: 'ESCAPE' });

      expect(getState().selectPhase).toBe('engaged');
      expect(deps.setSelectMode).toHaveBeenCalledWith(false);

      // Toolbar: picking → engaged
      expect(deps.updateToolbar).toHaveBeenCalledWith({
        select: 'engaged',
        insert: 'gray',
        text: 'gray',
      });
    });
  });

  // ── (f) Subscriber notification ──────────────────────────────────────

  describe('subscribe', () => {
    it('notifies subscriber with (newState, prevState, action)', () => {
      const fn = vi.fn();
      const unsub = subscribe(fn);

      const action = { type: 'CMD_MODE_CHANGED' as const, mode: 'select' as const };
      const prevState = getState();
      dispatch(action);

      expect(fn).toHaveBeenCalledTimes(1);
      const [newState, prev, receivedAction] = fn.mock.calls[0];
      expect(receivedAction).toBe(action);
      expect(prev).toBe(prevState);
      expect(newState.mode).toBe('select');

      unsub();
    });

    it('unsubscribe stops notifications', () => {
      const fn = vi.fn();
      const unsub = subscribe(fn);
      unsub();

      dispatch({ type: 'CMD_MODE_CHANGED', mode: 'select' });
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
