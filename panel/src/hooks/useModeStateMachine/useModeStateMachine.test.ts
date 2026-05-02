import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { modeReducer, INITIAL_STATE } from './useModeStateMachine';
import type { ModeStateMachineState, ModeAction, ReducerResult } from './types';
import {
  computeActiveTab,
  computeCurrentTabs,
  computeIsPicking,
  getModeButtonColor,
  EDIT_TABS,
} from './types';
import type { ElementData, InsertPoint } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_ELEMENT: ElementData = {
  componentName: 'Button',
  instanceCount: 1,
  classes: 'px-4 py-2 bg-blue-500',
  parsedClasses: [],
  tailwindConfig: {},
};

const MOCK_INSERT_POINT: InsertPoint = {
  position: 'after',
  targetName: 'Button',
};

/** Dispatch an action and return the result. */
function dispatch(state: ModeStateMachineState, action: ModeAction): ReducerResult {
  return modeReducer(state, action);
}

/** Dispatch a sequence of actions, returning the final result. */
function dispatchAll(state: ModeStateMachineState, actions: ModeAction[]): ReducerResult {
  let result: ReducerResult = { state, effects: [] };
  const allEffects: ReducerResult['effects'] = [];
  for (const action of actions) {
    result = dispatch(result.state, action);
    allEffects.push(...result.effects);
  }
  return { state: result.state, effects: allEffects };
}

/** Shorthand for overlay messages in effects. */
function overlayMessages(result: ReducerResult): Record<string, unknown>[] {
  return result.effects
    .filter((e) => e.kind === 'sendToOverlay')
    .map((e) => (e as { kind: 'sendToOverlay'; message: Record<string, unknown> }).message);
}

// ============================================================================
// Pure helper tests
// ============================================================================

describe('computeActiveTab', () => {
  it('returns "components" when tabPreference is component', () => {
    expect(computeActiveTab('insert', 'component')).toBe('components');
    expect(computeActiveTab('select', 'component')).toBe('components');
  });

  it('returns "design" when tabPreference is design in select mode', () => {
    expect(computeActiveTab('select', 'design')).toBe('design');
  });

  it('returns "design" when mode is null', () => {
    expect(computeActiveTab(null, 'design')).toBe('design');
  });
});

describe('computeCurrentTabs', () => {
  it('returns EDIT_TABS for any mode', () => {
    expect(computeCurrentTabs('insert')).toBe(EDIT_TABS);
    expect(computeCurrentTabs('select')).toBe(EDIT_TABS);
    expect(computeCurrentTabs(null)).toBe(EDIT_TABS);
  });
});

describe('computeIsPicking', () => {
  it('returns true when selectModeActive', () => {
    expect(computeIsPicking('select', true, null, false)).toBe(true);
  });

  it('returns true when insert mode with no insert point and browse active', () => {
    expect(computeIsPicking('insert', false, null, true)).toBe(true);
  });

  it('returns false when insert mode with no insert point but browse inactive', () => {
    expect(computeIsPicking('insert', false, null, false)).toBe(false);
  });

  it('returns true when insert mode with insert point locked and browse active (persistent browse)', () => {
    expect(computeIsPicking('insert', false, MOCK_INSERT_POINT, true)).toBe(true);
  });

  it('returns false when insert mode with insert point locked and browse inactive', () => {
    expect(computeIsPicking('insert', false, MOCK_INSERT_POINT, false)).toBe(false);
  });

  it('returns false when select mode with selectModeActive false', () => {
    expect(computeIsPicking('select', false, null, false)).toBe(false);
  });

  it('returns false when idle', () => {
    expect(computeIsPicking(null, false, null, false)).toBe(false);
  });
});

describe('getModeButtonColor', () => {
  it('returns "gray" when mode is null', () => {
    expect(getModeButtonColor(null, false, null, null, false)).toBe('gray');
  });

  it('returns "orange" when select mode active (picking)', () => {
    expect(getModeButtonColor('select', true, null, null, false)).toBe('orange');
  });

  it('returns "teal" when select mode with element', () => {
    expect(getModeButtonColor('select', false, MOCK_ELEMENT, null, false)).toBe('teal');
  });

  it('returns "orange" when insert mode with browse active (no insert point)', () => {
    expect(getModeButtonColor('insert', false, null, null, true)).toBe('orange');
  });

  it('returns "gray" when insert mode with browse inactive (resting)', () => {
    expect(getModeButtonColor('insert', false, null, null, false)).toBe('gray');
  });

  it('returns "teal" when insert mode with insert point locked', () => {
    expect(getModeButtonColor('insert', false, null, MOCK_INSERT_POINT, false)).toBe('teal');
  });

  it('returns "gray" for bug-report mode (no picking/locking concept)', () => {
    expect(getModeButtonColor('bug-report', false, null, null, false)).toBe('gray');
  });
});

// ============================================================================
// Reducer: Flow A — Place (component-first)
// ============================================================================

describe('Flow A: Place (component-first)', () => {
  it('Step 1→2: Click Insert → mode=insert, browsing (orange), Place tab', () => {
    const result = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'insert' });
    const { state } = result;

    expect(state.mode).toBe('insert');
    expect(state.selectModeActive).toBe(false);
    expect(state.insertBrowseActive).toBe(true);
    expect(state.insertPoint).toBeNull();
    expect(state.elementData).toBeNull();
    expect(computeActiveTab(state.mode, state.tabPreference)).toBe('components');
    expect(computeIsPicking(state.mode, state.selectModeActive, state.insertPoint, state.insertBrowseActive)).toBe(true);
    expect(getModeButtonColor(state.mode, state.selectModeActive, state.elementData, state.insertPoint, state.insertBrowseActive)).toBe('orange');

    // Should send MODE_CHANGED to overlay
    expect(overlayMessages(result)).toContainEqual({ type: 'MODE_CHANGED', mode: 'insert' });
  });

  it('Step 3→4: COMPONENT_DISARMED → mode stays insert, tab stays place, gray (resting)', () => {
    // Start in insert mode (step 2)
    const afterInsert = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'insert' });

    // Component armed (step 3) then placed → DISARMED (step 4)
    const result = dispatch(afterInsert.state, { type: 'WS_COMPONENT_DISARMED' });
    const { state } = result;

    expect(state.mode).toBe('insert');
    expect(state.selectModeActive).toBe(false);
    expect(state.insertBrowseActive).toBe(false);
    expect(state.elementData).toBeNull();
    expect(state.insertPoint).toBeNull();
    expect(computeActiveTab(state.mode, state.tabPreference)).toBe('components');
    // After placement, button is gray (resting insert — not browsing, not locked)
    expect(getModeButtonColor(state.mode, state.selectModeActive, state.elementData, state.insertPoint, state.insertBrowseActive)).toBe('gray');
  });
});

// ============================================================================
// Reducer: Flow B — Place (location-first)
// ============================================================================

describe('Flow B: Place (location-first)', () => {
  it('Step 2: Click Insert → browsing (orange)', () => {
    const result = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'insert' });
    expect(result.state.mode).toBe('insert');
    expect(result.state.insertBrowseActive).toBe(true);
    expect(getModeButtonColor(result.state.mode, result.state.selectModeActive, result.state.elementData, result.state.insertPoint, result.state.insertBrowseActive)).toBe('orange');
  });

  it('Step 3: INSERT_POINT_LOCKED → orange (persistent browse continues)', () => {
    const afterInsert = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'insert' });
    const result = dispatch(afterInsert.state, {
      type: 'WS_INSERT_POINT_LOCKED',
      position: 'after',
      targetName: 'Button',
    });
    const { state } = result;

    expect(state.mode).toBe('insert');
    expect(state.insertPoint).toEqual({ position: 'after', targetName: 'Button' });
    expect(state.insertBrowseActive).toBe(true); // persistent browse preserved
    expect(computeIsPicking(state.mode, state.selectModeActive, state.insertPoint, state.insertBrowseActive)).toBe(true);
    expect(getModeButtonColor(state.mode, state.selectModeActive, state.elementData, state.insertPoint, state.insertBrowseActive)).toBe('orange');
    expect(computeActiveTab(state.mode, state.tabPreference)).toBe('components');
  });

  it('Step 4: COMPONENT_DISARMED after placement → mode stays, tab stays, gray', () => {
    const afterLock = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'insert' },
      { type: 'WS_INSERT_POINT_LOCKED', position: 'after', targetName: 'Button' },
    ]);
    const result = dispatch(afterLock.state, { type: 'WS_COMPONENT_DISARMED' });
    const { state } = result;

    expect(state.mode).toBe('insert');
    expect(state.insertPoint).toBeNull();
    expect(state.elementData).toBeNull();
    expect(state.insertBrowseActive).toBe(false);
    expect(computeActiveTab(state.mode, state.tabPreference)).toBe('components');
    expect(getModeButtonColor(state.mode, state.selectModeActive, state.elementData, state.insertPoint, state.insertBrowseActive)).toBe('gray');
  });
});

// ============================================================================
// Reducer: Flow C — Replace (element-first)
// ============================================================================

describe('Flow C: Replace (element-first)', () => {
  it('Step 2: Click Select → mode=select, crosshair (orange)', () => {
    const result = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'select' });
    const { state } = result;

    expect(state.mode).toBe('select');
    expect(state.selectModeActive).toBe(true);
    expect(getModeButtonColor(state.mode, state.selectModeActive, state.elementData, state.insertPoint, state.insertBrowseActive)).toBe('orange');
    expect(computeActiveTab(state.mode, state.tabPreference)).toBe('design');
  });

  it('Step 3: ELEMENT_SELECTED → orange (selecting persists), Design tab', () => {
    const afterSelect = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'select' });
    const result = dispatch(afterSelect.state, {
      type: 'WS_ELEMENT_SELECTED',
      elementData: MOCK_ELEMENT,
    });
    const { state } = result;

    expect(state.mode).toBe('select');
    expect(state.selectModeActive).toBe(true);
    expect(state.elementData).toBe(MOCK_ELEMENT);
    expect(getModeButtonColor(state.mode, state.selectModeActive, state.elementData, state.insertPoint, state.insertBrowseActive)).toBe('orange');
    expect(computeActiveTab(state.mode, state.tabPreference)).toBe('design');
  });

  it('Step 4: Switch to Replace tab (still orange — selecting persists)', () => {
    const afterElement = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
    ]);
    const result = dispatch(afterElement.state, { type: 'TAB_CHANGE', tab: 'components' });
    const { state } = result;

    expect(state.mode).toBe('select');
    expect(state.elementData).toBe(MOCK_ELEMENT);
    expect(computeActiveTab(state.mode, state.tabPreference)).toBe('components');
    expect(getModeButtonColor(state.mode, state.selectModeActive, state.elementData, state.insertPoint, state.insertBrowseActive)).toBe('orange');
  });

  it('Step 5: COMPONENT_DISARMED → mode stays select, tab stays replace, gray', () => {
    const afterReplace = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
      { type: 'TAB_CHANGE', tab: 'components' },
    ]);
    const result = dispatch(afterReplace.state, { type: 'WS_COMPONENT_DISARMED' });
    const { state } = result;

    expect(state.mode).toBe('select');
    expect(state.elementData).toBeNull();
    expect(state.selectModeActive).toBe(false);
    expect(computeActiveTab(state.mode, state.tabPreference)).toBe('components');
  });
});

// ============================================================================
// Reducer: Flow D — Replace (component-first)
// ============================================================================

describe('Flow D: Replace (component-first)', () => {
  it('Step 2→3: Click Select → Replace tab → still orange', () => {
    const result = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'TAB_CHANGE', tab: 'components' },
    ]);
    const { state } = result;

    expect(state.mode).toBe('select');
    expect(state.selectModeActive).toBe(true);
    expect(computeActiveTab(state.mode, state.tabPreference)).toBe('components');
    expect(getModeButtonColor(state.mode, state.selectModeActive, state.elementData, state.insertPoint, state.insertBrowseActive)).toBe('orange');
  });

  it('Step 5: COMPONENT_DISARMED → mode stays select, tab replace, gray', () => {
    const afterArm = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'TAB_CHANGE', tab: 'components' },
    ]);
    const result = dispatch(afterArm.state, { type: 'WS_COMPONENT_DISARMED' });
    const { state } = result;

    expect(state.mode).toBe('select');
    expect(state.elementData).toBeNull();
    expect(state.selectModeActive).toBe(false);
    expect(computeActiveTab(state.mode, state.tabPreference)).toBe('components');
  });
});

// ============================================================================
// Reducer: Flow E — Cross-mode switching via overlay toolbar
// ============================================================================

describe('Flow E: Cross-mode switching via overlay toolbar', () => {
  it('full flow: select → element → overlay insert → lock point → overlay select → element', () => {
    // Step 1: Click Select (panel)
    const s1 = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'select' });
    expect(s1.state.mode).toBe('select');
    expect(s1.state.selectModeActive).toBe(true);
    expect(getModeButtonColor(s1.state.mode, s1.state.selectModeActive, s1.state.elementData, s1.state.insertPoint, s1.state.insertBrowseActive)).toBe('orange');

    // Step 2: Element selected (stays orange — persistent select)
    const s2 = dispatch(s1.state, { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT });
    expect(s2.state.mode).toBe('select');
    expect(s2.state.elementData).toBe(MOCK_ELEMENT);
    expect(getModeButtonColor(s2.state.mode, s2.state.selectModeActive, s2.state.elementData, s2.state.insertPoint, s2.state.insertBrowseActive)).toBe('orange');
    expect(computeActiveTab(s2.state.mode, s2.state.tabPreference)).toBe('design');

    // Step 3: Click Insert on overlay toolbar (MODE_CHANGED from overlay)
    const s3 = dispatch(s2.state, { type: 'WS_MODE_CHANGED', mode: 'insert' });
    expect(s3.state.mode).toBe('insert');
    expect(s3.state.elementData).toBeNull(); // cleared
    expect(s3.state.selectModeActive).toBe(false);
    expect(s3.state.insertBrowseActive).toBe(true);
    expect(computeActiveTab(s3.state.mode, s3.state.tabPreference)).toBe('components');
    expect(getModeButtonColor(s3.state.mode, s3.state.selectModeActive, s3.state.elementData, s3.state.insertPoint, s3.state.insertBrowseActive)).toBe('orange');
    // fromOverlay=true, so no outbound messages
    expect(overlayMessages(s3)).toEqual([]);

    // Step 4: Insert point locked (persistent browse keeps orange)
    const s4 = dispatch(s3.state, { type: 'WS_INSERT_POINT_LOCKED', position: 'before', targetName: 'Hero' });
    expect(s4.state.insertPoint).toEqual({ position: 'before', targetName: 'Hero' });
    expect(s4.state.insertBrowseActive).toBe(true); // persistent browse preserved
    expect(getModeButtonColor(s4.state.mode, s4.state.selectModeActive, s4.state.elementData, s4.state.insertPoint, s4.state.insertBrowseActive)).toBe('orange');

    // Step 5: Click Select on overlay toolbar
    const s5 = dispatch(s4.state, { type: 'WS_MODE_CHANGED', mode: 'select' });
    expect(s5.state.mode).toBe('select');
    expect(s5.state.insertPoint).toBeNull(); // cleared
    expect(s5.state.elementData).toBeNull(); // cleared
    expect(s5.state.selectModeActive).toBe(true);
    expect(getModeButtonColor(s5.state.mode, s5.state.selectModeActive, s5.state.elementData, s5.state.insertPoint, s5.state.insertBrowseActive)).toBe('orange');
    expect(computeActiveTab(s5.state.mode, s5.state.tabPreference)).toBe('components');

    // Step 6: Element selected again (stays orange — persistent select)
    const s6 = dispatch(s5.state, { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT });
    expect(s6.state.mode).toBe('select');
    expect(s6.state.elementData).toBe(MOCK_ELEMENT);
    expect(getModeButtonColor(s6.state.mode, s6.state.selectModeActive, s6.state.elementData, s6.state.insertPoint, s6.state.insertBrowseActive)).toBe('orange');
    expect(computeActiveTab(s6.state.mode, s6.state.tabPreference)).toBe('components');
  });
});

// ============================================================================
// Reducer: Escape key
// ============================================================================

describe('Escape key', () => {
  it('with element selected + selecting active → stop selecting, keep element (teal)', () => {
    const withElement = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
    ]);
    const result = dispatch(withElement.state, { type: 'ESCAPE' });
    const { state } = result;

    // Orange + element → Teal: stop selecting, keep element
    expect(state.mode).toBe('select');
    expect(state.elementData).toBe(MOCK_ELEMENT);
    expect(state.selectModeActive).toBe(false);
    expect(getModeButtonColor(state.mode, state.selectModeActive, state.elementData, state.insertPoint, state.insertBrowseActive)).toBe('teal');
    const msgs = overlayMessages(result);
    expect(msgs).toContainEqual({ type: 'TOGGLE_SELECT_MODE', active: false });
  });

  it('with element selected + selecting off (teal) → deselect, cancel mode (gray)', () => {
    // First get to teal: select → element → escape (stops selecting)
    const tealState = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
    ]);
    const afterFirstEscape = dispatch(tealState.state, { type: 'ESCAPE' });
    expect(afterFirstEscape.state.selectModeActive).toBe(false);
    expect(afterFirstEscape.state.elementData).toBe(MOCK_ELEMENT);

    // Second escape: teal → gray
    const result = dispatch(afterFirstEscape.state, { type: 'ESCAPE' });
    const { state } = result;

    expect(state.mode).toBeNull();
    expect(state.elementData).toBeNull();
    expect(state.selectModeActive).toBe(false);
    expect(overlayMessages(result)).toContainEqual({ type: 'CANCEL_MODE' });
  });

  it('with insert point locked + browsing → stop browsing, keep point (teal)', () => {
    const withPoint = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'insert' },
      { type: 'WS_INSERT_POINT_LOCKED', position: 'after', targetName: 'Card' },
    ]);
    // After lock, insertBrowseActive is still true (persistent browse)
    expect(withPoint.state.insertBrowseActive).toBe(true);

    const result = dispatch(withPoint.state, { type: 'ESCAPE' });
    const { state } = result;

    // Orange + point → Teal: stop browsing, keep point
    expect(state.mode).toBe('insert');
    expect(state.insertPoint).toEqual({ position: 'after', targetName: 'Card' });
    expect(state.insertBrowseActive).toBe(false);
    expect(getModeButtonColor(state.mode, state.selectModeActive, state.elementData, state.insertPoint, state.insertBrowseActive)).toBe('teal');
    const msgs = overlayMessages(result);
    expect(msgs).toContainEqual({ type: 'TOGGLE_INSERT_BROWSE', active: false });
  });

  it('with insert point locked + not browsing (teal) → clear point, cancel mode (gray)', () => {
    // Get to teal: insert → lock → escape (stops browsing)
    const withPoint = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'insert' },
      { type: 'WS_INSERT_POINT_LOCKED', position: 'after', targetName: 'Card' },
    ]);
    const afterFirstEscape = dispatch(withPoint.state, { type: 'ESCAPE' });
    expect(afterFirstEscape.state.insertBrowseActive).toBe(false);
    expect(afterFirstEscape.state.insertPoint).toEqual({ position: 'after', targetName: 'Card' });

    // Second escape: teal → gray
    const result = dispatch(afterFirstEscape.state, { type: 'ESCAPE' });
    const { state } = result;

    expect(state.mode).toBeNull();
    expect(state.insertPoint).toBeNull();
    expect(state.insertBrowseActive).toBe(false);
    expect(overlayMessages(result)).toContainEqual({ type: 'CANCEL_MODE' });
  });

  it('no selection, mode active → cancel mode → idle', () => {
    const inSelect = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'select' });
    const result = dispatch(inSelect.state, { type: 'ESCAPE' });
    const { state } = result;

    expect(state.mode).toBeNull();
    expect(state.selectModeActive).toBe(false);
    expect(overlayMessages(result)).toContainEqual({ type: 'CANCEL_MODE' });
  });

  it('idle → no-op', () => {
    const result = dispatch(INITIAL_STATE, { type: 'ESCAPE' });
    expect(result.state).toEqual(INITIAL_STATE);
    expect(result.effects).toEqual([]);
  });
});

// ============================================================================
// Reducer: Mode toggle behavior
// ============================================================================

describe('Mode toggle', () => {
  it('re-click select with element + selecting active → stop selecting, keep element (teal)', () => {
    const withElement = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
    ]);
    const result = dispatch(withElement.state, { type: 'MODE_CHANGE', mode: 'select' });

    // Orange + element → Teal: stop selecting, keep element
    expect(result.state.mode).toBe('select');
    expect(result.state.elementData).toBe(MOCK_ELEMENT);
    expect(result.state.selectModeActive).toBe(false);
    expect(getModeButtonColor(result.state.mode, result.state.selectModeActive, result.state.elementData, result.state.insertPoint, result.state.insertBrowseActive)).toBe('teal');
  });

  it('re-click select when teal (element, not selecting) → clear element, fresh selecting (orange)', () => {
    // Get to teal: select → element → click Select (stop selecting)
    const withElement = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
    ]);
    const teal = dispatch(withElement.state, { type: 'MODE_CHANGE', mode: 'select' });
    expect(teal.state.selectModeActive).toBe(false);
    expect(teal.state.elementData).toBe(MOCK_ELEMENT);

    // Click Select again: teal → orange (clear element, fresh selecting)
    const result = dispatch(teal.state, { type: 'MODE_CHANGE', mode: 'select' });
    expect(result.state.mode).toBe('select');
    expect(result.state.selectModeActive).toBe(true);
    expect(result.state.elementData).toBeNull();
    expect(overlayMessages(result)).toContainEqual({ type: 'MODE_CHANGED', mode: 'select' });
  });

  it('re-click select with no element → toggle off', () => {
    const inSelect = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'select' });
    const result = dispatch(inSelect.state, { type: 'MODE_CHANGE', mode: 'select' });

    expect(result.state.mode).toBeNull();
    expect(overlayMessages(result)).toContainEqual({ type: 'CANCEL_MODE' });
  });

  it('re-click insert with point + browsing → stop browsing, keep point (teal)', () => {
    const withPoint = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'insert' },
      { type: 'WS_INSERT_POINT_LOCKED', position: 'before', targetName: 'Nav' },
    ]);
    // After lock, insertBrowseActive is still true (persistent browse)
    expect(withPoint.state.insertBrowseActive).toBe(true);

    const result = dispatch(withPoint.state, { type: 'MODE_CHANGE', mode: 'insert' });

    // Orange + point → Teal: stop browsing, keep point
    expect(result.state.mode).toBe('insert');
    expect(result.state.insertPoint).toEqual({ position: 'before', targetName: 'Nav' });
    expect(result.state.insertBrowseActive).toBe(false);
    expect(getModeButtonColor(result.state.mode, result.state.selectModeActive, result.state.elementData, result.state.insertPoint, result.state.insertBrowseActive)).toBe('teal');
  });

  it('re-click insert when teal (point, not browsing) → clear point, fresh browsing (orange)', () => {
    // Get to teal: insert → lock → click Insert (stop browsing)
    const withPoint = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'insert' },
      { type: 'WS_INSERT_POINT_LOCKED', position: 'before', targetName: 'Nav' },
    ]);
    const teal = dispatch(withPoint.state, { type: 'MODE_CHANGE', mode: 'insert' });
    expect(teal.state.insertBrowseActive).toBe(false);
    expect(teal.state.insertPoint).toEqual({ position: 'before', targetName: 'Nav' });

    // Click Insert again: teal → orange (clear point, fresh browsing)
    const result = dispatch(teal.state, { type: 'MODE_CHANGE', mode: 'insert' });
    expect(result.state.mode).toBe('insert');
    expect(result.state.insertBrowseActive).toBe(true);
    expect(result.state.insertPoint).toBeNull();
    expect(overlayMessages(result)).toContainEqual({ type: 'MODE_CHANGED', mode: 'insert' });
  });

  it('re-click insert when idle (after place) → re-activate browse, not toggle off', () => {
    // Simulate Flow A: insert → component placed → COMPONENT_DISARMED → idle gray
    const afterPlace = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'insert' },
      { type: 'WS_COMPONENT_DISARMED' },
    ]);
    expect(afterPlace.state.mode).toBe('insert');
    expect(afterPlace.state.insertBrowseActive).toBe(false);
    expect(afterPlace.state.insertPoint).toBeNull();

    // Re-click Insert → should re-activate browse, not toggle off
    const result = dispatch(afterPlace.state, { type: 'MODE_CHANGE', mode: 'insert' });

    expect(result.state.mode).toBe('insert');
    expect(result.state.insertBrowseActive).toBe(true);
    expect(overlayMessages(result)).toContainEqual({ type: 'MODE_CHANGED', mode: 'insert' });
  });

  it('re-click select when idle (after replace) → re-activate select mode, not toggle off', () => {
    // Simulate: select → component replaced → COMPONENT_DISARMED → idle gray
    const afterReplace = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_COMPONENT_DISARMED' },
    ]);
    expect(afterReplace.state.mode).toBe('select');
    expect(afterReplace.state.selectModeActive).toBe(false);
    expect(afterReplace.state.elementData).toBeNull();

    // Re-click Select → should re-activate select mode, not toggle off
    const result = dispatch(afterReplace.state, { type: 'MODE_CHANGE', mode: 'select' });

    expect(result.state.mode).toBe('select');
    expect(result.state.selectModeActive).toBe(true);
    expect(overlayMessages(result)).toContainEqual({ type: 'MODE_CHANGED', mode: 'select' });
  });

  it('switch from select to insert → clear element, enter insert', () => {
    const withElement = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
    ]);
    const result = dispatch(withElement.state, { type: 'MODE_CHANGE', mode: 'insert' });
    const { state } = result;

    expect(state.mode).toBe('insert');
    expect(state.elementData).toBeNull();
    expect(state.selectModeActive).toBe(false);
    expect(computeActiveTab(state.mode, state.tabPreference)).toBe('components');
  });

  it('switch from insert to select → clear insert point, enter select', () => {
    const withPoint = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'insert' },
      { type: 'WS_INSERT_POINT_LOCKED', position: 'after', targetName: 'Card' },
    ]);
    const result = dispatch(withPoint.state, { type: 'MODE_CHANGE', mode: 'select' });
    const { state } = result;

    expect(state.mode).toBe('select');
    expect(state.insertPoint).toBeNull();
    expect(state.selectModeActive).toBe(true);
    expect(computeActiveTab(state.mode, state.tabPreference)).toBe('components');
  });
});

// ============================================================================

describe('Invariants', () => {
  it('#1: selectModeActive stays true when element is selected (persistent select)', () => {
    const result = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
    ]);
    // Persistent select: selectModeActive stays true, button is orange
    expect(result.state.selectModeActive).toBe(true);
    expect(getModeButtonColor(result.state.mode, result.state.selectModeActive, result.state.elementData, result.state.insertPoint, result.state.insertBrowseActive)).toBe('orange');
  });

  it('#2: COMPONENT_DISARMED keeps mode (tab stays visible)', () => {
    // Insert mode
    const insertResult = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'insert' },
      { type: 'WS_COMPONENT_DISARMED' },
    ]);
    expect(insertResult.state.mode).toBe('insert');

    // Select mode with element
    const selectResult = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
      { type: 'TAB_CHANGE', tab: 'components' },
      { type: 'WS_COMPONENT_DISARMED' },
    ]);
    expect(selectResult.state.mode).toBe('select');
    expect(computeActiveTab(selectResult.state.mode, selectResult.state.tabPreference)).toBe('components');
  });

  it('#3: tab never disappears after place/replace (mode stays active)', () => {
    // After placing in insert mode
    const placeResult = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'insert' },
      { type: 'WS_INSERT_POINT_LOCKED', position: 'after', targetName: 'Card' },
      { type: 'WS_COMPONENT_DISARMED' },
    ]);
    expect(placeResult.state.mode).not.toBeNull();
    expect(computeCurrentTabs(placeResult.state.mode)).toBe(EDIT_TABS);

    // After replacing in select mode
    const replaceResult = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
      { type: 'TAB_CHANGE', tab: 'components' },
      { type: 'WS_COMPONENT_DISARMED' },
    ]);
    expect(replaceResult.state.mode).not.toBeNull();
    expect(computeCurrentTabs(replaceResult.state.mode)).toBe(EDIT_TABS);
  });

  it('#5: teal only when target locked and not picking', () => {
    // No target → not teal
    const noTarget = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'select' });
    expect(getModeButtonColor(noTarget.state.mode, noTarget.state.selectModeActive, noTarget.state.elementData, noTarget.state.insertPoint, noTarget.state.insertBrowseActive)).not.toBe('teal');

    // With element + selectModeActive → orange (persistent select), not teal
    const withElPicking = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
    ]);
    expect(getModeButtonColor(withElPicking.state.mode, withElPicking.state.selectModeActive, withElPicking.state.elementData, withElPicking.state.insertPoint, withElPicking.state.insertBrowseActive)).toBe('orange');

    // With element + selectModeActive off → teal (locked)
    const tealState = dispatch(withElPicking.state, { type: 'MODE_CHANGE', mode: 'select' });
    expect(getModeButtonColor(tealState.state.mode, tealState.state.selectModeActive, tealState.state.elementData, tealState.state.insertPoint, tealState.state.insertBrowseActive)).toBe('teal');

    // With insert point + browsing active → orange (persistent browse)
    const withIP = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'insert' },
      { type: 'WS_INSERT_POINT_LOCKED', position: 'before', targetName: 'Nav' },
    ]);
    expect(withIP.state.insertBrowseActive).toBe(true);
    expect(getModeButtonColor(withIP.state.mode, withIP.state.selectModeActive, withIP.state.elementData, withIP.state.insertPoint, withIP.state.insertBrowseActive)).toBe('orange');

    // With insert point + browsing stopped → teal (locked)
    const tealIP = dispatch(withIP.state, { type: 'MODE_CHANGE', mode: 'insert' });
    expect(tealIP.state.insertBrowseActive).toBe(false);
    expect(getModeButtonColor(tealIP.state.mode, tealIP.state.selectModeActive, tealIP.state.elementData, tealIP.state.insertPoint, tealIP.state.insertBrowseActive)).toBe('teal');
  });
});

// ============================================================================
// Reducer: WS message handling
// ============================================================================

describe('WS messages', () => {
  it('RESET_SELECTION → full reset to idle', () => {
    const withElement = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
    ]);
    const result = dispatch(withElement.state, { type: 'WS_RESET_SELECTION' });
    const { state } = result;

    expect(state.mode).toBeNull();
    expect(state.elementData).toBeNull();
    expect(state.selectModeActive).toBe(false);
    expect(state.insertPoint).toBeNull();
    expect(state.textEditing).toBe(false);
  });

  it('DESELECT_ELEMENT → clears element, stays in mode', () => {
    const withElement = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
    ]);
    const result = dispatch(withElement.state, { type: 'WS_DESELECT_ELEMENT' });

    expect(result.state.mode).toBe('select');
    expect(result.state.elementData).toBeNull();
    // fromOverlay=true, so no outbound messages
    expect(overlayMessages(result)).toEqual([]);
  });

  it('ELEMENT_SELECTED with no mode → defaults to select', () => {
    const result = dispatch(INITIAL_STATE, { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT });
    expect(result.state.mode).toBe('select');
    expect(result.state.elementData).toBe(MOCK_ELEMENT);
  });

  it('ELEMENT_SELECTED with existing mode → keeps mode', () => {
    const inInsert = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'insert' });
    const result = dispatch(inInsert.state, { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT });
    expect(result.state.mode).toBe('insert');
  });

  it('SELECT_MODE_CHANGED → updates selectModeActive', () => {
    const result = dispatch(INITIAL_STATE, { type: 'WS_SELECT_MODE_CHANGED', active: true });
    expect(result.state.selectModeActive).toBe(true);

    const result2 = dispatch(result.state, { type: 'WS_SELECT_MODE_CHANGED', active: false });
    expect(result2.state.selectModeActive).toBe(false);
  });

  it('TEXT_EDIT_ACTIVE/DONE → toggle textEditing', () => {
    const active = dispatch(INITIAL_STATE, { type: 'WS_TEXT_EDIT_ACTIVE' });
    expect(active.state.textEditing).toBe(true);

    const done = dispatch(active.state, { type: 'WS_TEXT_EDIT_DONE' });
    expect(done.state.textEditing).toBe(false);
  });

  it('INSERT_POINT_LOCKED → sets insertPoint', () => {
    const result = dispatch(INITIAL_STATE, {
      type: 'WS_INSERT_POINT_LOCKED',
      position: 'first-child',
      targetName: 'Header',
    });
    expect(result.state.insertPoint).toEqual({ position: 'first-child', targetName: 'Header' });
  });
});

// ============================================================================
// Reducer: Side effects (overlay messages)
// ============================================================================

describe('Side effects', () => {
  it('MODE_CHANGE sends MODE_CHANGED to overlay', () => {
    const result = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'select' });
    expect(overlayMessages(result)).toContainEqual({ type: 'MODE_CHANGED', mode: 'select' });
  });

  it('MODE_CHANGE from overlay does NOT send back', () => {
    const result = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'select', fromOverlay: true });
    expect(overlayMessages(result)).toEqual([]);
  });

  it('TAB_CHANGE sends TAB_CHANGED to overlay', () => {
    const result = dispatch(INITIAL_STATE, { type: 'TAB_CHANGE', tab: 'components' });
    expect(overlayMessages(result)).toContainEqual({ type: 'TAB_CHANGED', tab: 'components' });
  });

  it('TAB_CHANGE from overlay does NOT send back', () => {
    const result = dispatch(INITIAL_STATE, { type: 'TAB_CHANGE', tab: 'components', fromOverlay: true });
    expect(overlayMessages(result)).toEqual([]);
  });

  it('ESCAPE with element + selecting active sends TOGGLE_SELECT_MODE(false)', () => {
    const withElement = dispatchAll(INITIAL_STATE, [
      { type: 'MODE_CHANGE', mode: 'select' },
      { type: 'WS_ELEMENT_SELECTED', elementData: MOCK_ELEMENT },
    ]);
    const result = dispatch(withElement.state, { type: 'ESCAPE' });
    const msgs = overlayMessages(result);
    // Orange + element → Teal: sends TOGGLE_SELECT_MODE(false)
    expect(msgs).toContainEqual({ type: 'TOGGLE_SELECT_MODE', active: false });
    expect(msgs).not.toContainEqual(expect.objectContaining({ type: 'CLEAR_HIGHLIGHTS' }));
  });

  it('ESCAPE with no selection sends CANCEL_MODE', () => {
    const inSelect = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'select' });
    const result = dispatch(inSelect.state, { type: 'ESCAPE' });
    expect(overlayMessages(result)).toContainEqual({ type: 'CANCEL_MODE' });
  });

  it('MODE_CHANGE toggling off sends CANCEL_MODE', () => {
    const inSelect = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'select' });
    const result = dispatch(inSelect.state, { type: 'MODE_CHANGE', mode: 'select' });
    expect(overlayMessages(result)).toContainEqual({ type: 'CANCEL_MODE' });
  });
});

// ============================================================================
// Reducer: Tab preference
// ============================================================================

describe('Tab preference', () => {
  it('switching to insert forces tabPreference from design to component', () => {
    const result = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'insert' });
    expect(result.state.tabPreference).toBe('component');
  });

  it('switching to insert keeps component preference', () => {
    const withComponent = dispatch(INITIAL_STATE, { type: 'TAB_CHANGE', tab: 'components' });
    const result = dispatch(withComponent.state, { type: 'MODE_CHANGE', mode: 'insert' });
    expect(result.state.tabPreference).toBe('component');
  });

  it('switching to select from null preserves tab preference', () => {
    const withComponent = dispatch(INITIAL_STATE, { type: 'TAB_CHANGE', tab: 'components' });
    const result = dispatch(withComponent.state, { type: 'MODE_CHANGE', mode: 'select' });
    expect(result.state.tabPreference).toBe('component');
    expect(computeActiveTab(result.state.mode, result.state.tabPreference)).toBe('components');
  });

  it('insert → escape → select preserves tab preference', () => {
    const afterInsert = dispatch(INITIAL_STATE, { type: 'MODE_CHANGE', mode: 'insert' });
    expect(afterInsert.state.tabPreference).toBe('component');
    // Escape cancels mode (mode→null), preference stays 'component'
    const afterEscape = dispatch(afterInsert.state, { type: 'ESCAPE' });
    expect(afterEscape.state.mode).toBeNull();
    expect(afterEscape.state.tabPreference).toBe('component');
    // Entering select preserves the current preference
    const afterSelect = dispatch(afterEscape.state, { type: 'MODE_CHANGE', mode: 'select' });
    expect(afterSelect.state.tabPreference).toBe('component');
    expect(computeActiveTab(afterSelect.state.mode, afterSelect.state.tabPreference)).toBe('components');
  });
});
