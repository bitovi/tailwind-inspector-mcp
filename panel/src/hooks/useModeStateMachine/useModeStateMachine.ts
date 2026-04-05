import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { parseTokens, TAILWIND_PARSERS } from '../../../../overlay/src/tailwind/grammar';
import { sendTo } from '../../ws';
import type {
  ElementData,
  ModeAction,
  ModeStateMachine,
  ModeStateMachineState,
  SideEffect,
} from './types';
import {
  computeActiveTab,
  computeCurrentTabs,
  computeIsPicking,
} from './types';
import type { AppMode } from '../../../../shared/types';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const INITIAL_STATE: ModeStateMachineState = {
  mode: null,
  tabPreference: 'design',
  selectModeActive: false,
  insertBrowseActive: false,
  textEditing: false,
  elementData: null,
  selectionId: 0,
  insertPoint: null,
};

// ---------------------------------------------------------------------------
// Pure reducer
// ---------------------------------------------------------------------------

export interface ReducerResult {
  state: ModeStateMachineState;
  effects: SideEffect[];
}

/**
 * Pure state-machine reducer. Returns the new state plus a list of
 * side-effects (overlay messages to send). Side effects are processed
 * by the hook after the render.
 */
export function modeReducer(
  prev: ModeStateMachineState,
  action: ModeAction,
): ReducerResult {
  switch (action.type) {
    // ------------------------------------------------------------------
    // MODE_CHANGE — panel or overlay mode button clicked
    // ------------------------------------------------------------------
    case 'MODE_CHANGE': {
      let newMode = action.mode;
      const fromOverlay = !!action.fromOverlay;
      const effects: SideEffect[] = [];

      // Re-click same mode
      if (newMode === prev.mode) {
        if (prev.elementData || prev.insertPoint) {
          // Deselect & re-enter
          return deselectAndReenter(prev, fromOverlay);
        }
        // Check if mode is actively browsing/selecting (orange state).
        // If so, toggle off. If idle (gray — e.g. after a place/replace),
        // fall through to re-activate browse/select mode.
        const isActive = (prev.mode === 'insert' && prev.insertBrowseActive)
          || (prev.mode === 'select' && prev.selectModeActive);
        if (isActive) {
          newMode = null;
        }
        // else: idle gray state → fall through to re-activate
      }

      // Clear previous selection
      const next: ModeStateMachineState = {
        ...prev,
        elementData: null,
        selectionId: prev.selectionId + 1,
        textEditing: false,
        insertPoint: null,
        mode: newMode,
      };

      if (newMode === null) {
        next.selectModeActive = false;
        next.insertBrowseActive = false;
        if (!fromOverlay) {
          effects.push({ kind: 'sendToOverlay', message: { type: 'CANCEL_MODE' } });
        }
        return { state: next, effects };
      }

      // Force tab preference if switching to insert (no Design tab).
      if (newMode === 'insert') {
        next.tabPreference = prev.tabPreference === 'design' ? 'component' : prev.tabPreference;
        next.insertBrowseActive = true;
      } else {
        next.insertBrowseActive = false;
      }
      // When entering select from any non-select state, reset preference.
      // Insert mode forces 'component' (no Design tab), and that preference
      // persists through mode=null (Escape). Always start select on Design.
      if (newMode === 'select' && prev.mode !== 'select') {
        next.tabPreference = 'design';
      }

      if (!fromOverlay) {
        effects.push({ kind: 'sendToOverlay', message: { type: 'MODE_CHANGED', mode: newMode } });
      }

      next.selectModeActive = newMode === 'select';

      return { state: next, effects };
    }

    // ------------------------------------------------------------------
    // TAB_CHANGE
    // ------------------------------------------------------------------
    case 'TAB_CHANGE': {
      const effects: SideEffect[] = [];
      const next = { ...prev };
      if (action.tab === 'replace' || action.tab === 'place') {
        next.tabPreference = 'component';
      } else if (action.tab === 'design') {
        next.tabPreference = 'design';
      }
      if (!action.fromOverlay) {
        effects.push({ kind: 'sendToOverlay', message: { type: 'TAB_CHANGED', tab: action.tab } });
      }
      return { state: next, effects };
    }

    // ------------------------------------------------------------------
    // DESELECT_AND_REENTER — deselect element but stay in mode
    // ------------------------------------------------------------------
    case 'DESELECT_AND_REENTER':
      return deselectAndReenter(prev, !!action.fromOverlay);

    // ------------------------------------------------------------------
    // ESCAPE — hierarchical escape behavior
    // ------------------------------------------------------------------
    case 'ESCAPE': {
      if (prev.elementData || prev.insertPoint) {
        return deselectAndReenter(prev, false);
      }
      if (prev.mode !== null) {
        // No selection — cancel mode entirely
        return {
          state: {
            ...prev,
            mode: null,
            selectModeActive: false,
            insertBrowseActive: false,
            insertPoint: null,
          },
          effects: [{ kind: 'sendToOverlay', message: { type: 'CANCEL_MODE' } }],
        };
      }
      return { state: prev, effects: [] };
    }

    // ------------------------------------------------------------------
    // WebSocket inbound messages
    // ------------------------------------------------------------------

    case 'WS_RESET_SELECTION':
      return {
        state: {
          ...prev,
          elementData: null,
          selectionId: prev.selectionId + 1,
          textEditing: false,
          insertPoint: null,
          selectModeActive: false,
          insertBrowseActive: false,
          mode: null,
        },
        effects: [],
      };

    case 'WS_DESELECT_ELEMENT':
      return deselectAndReenter(prev, true);

    case 'WS_ELEMENT_SELECTED':
      return {
        state: {
          ...prev,
          elementData: action.elementData,
          selectionId: prev.selectionId + 1,
          selectModeActive: false,
          mode: prev.mode ?? 'select',
        },
        effects: [],
      };

    case 'WS_SELECT_MODE_CHANGED':
      return {
        state: { ...prev, selectModeActive: action.active },
        effects: [],
      };

    case 'WS_MODE_CHANGED': {
      // Delegate to MODE_CHANGE with fromOverlay=true
      return modeReducer(prev, { type: 'MODE_CHANGE', mode: action.mode, fromOverlay: true });
    }

    case 'WS_TAB_CHANGED':
      return modeReducer(prev, { type: 'TAB_CHANGE', tab: action.tab, fromOverlay: true });

    case 'WS_TEXT_EDIT_ACTIVE':
      return { state: { ...prev, textEditing: true }, effects: [] };

    case 'WS_TEXT_EDIT_DONE':
      return { state: { ...prev, textEditing: false }, effects: [] };

    case 'WS_INSERT_POINT_LOCKED':
      return {
        state: {
          ...prev,
          insertPoint: { position: action.position, targetName: action.targetName },
          insertBrowseActive: false,
        },
        effects: [],
      };

    case 'WS_COMPONENT_DISARMED':
      // Component was placed or replaced — keep mode & tab, clear selection
      return {
        state: {
          ...prev,
          elementData: null,
          selectionId: prev.selectionId + 1,
          selectModeActive: false,
          insertBrowseActive: false,
          insertPoint: null,
        },
        effects: [],
      };

    default:
      return { state: prev, effects: [] };
  }
}

// ---------------------------------------------------------------------------
// Shared helper: deselect current target, stay in mode, re-enter picking
// ---------------------------------------------------------------------------

function deselectAndReenter(
  prev: ModeStateMachineState,
  fromOverlay: boolean,
): ReducerResult {
  const effects: SideEffect[] = [];
  const next: ModeStateMachineState = {
    ...prev,
    elementData: null,
    selectionId: prev.selectionId + 1,
    textEditing: false,
    insertPoint: null,
  };

  if (!fromOverlay) {
    effects.push({ kind: 'sendToOverlay', message: { type: 'CLEAR_HIGHLIGHTS', deselect: true } });
    if (prev.mode === 'select') {
      next.selectModeActive = true;
      effects.push({ kind: 'sendToOverlay', message: { type: 'TOGGLE_SELECT_MODE', active: true } });
    } else if (prev.mode === 'insert') {
      next.insertBrowseActive = true;
      effects.push({ kind: 'sendToOverlay', message: { type: 'MODE_CHANGED', mode: 'insert' } });
    }
  }

  return { state: next, effects };
}

// ---------------------------------------------------------------------------
// React wrapper: useReducer + side-effect flushing
// ---------------------------------------------------------------------------

/**
 * Wraps the pure reducer in a useReducer hook. After each dispatch, any
 * side-effects (overlay messages) are flushed synchronously in a ref-based
 * post-dispatch callback.
 */
function flushEffects(pendingEffects: React.RefObject<SideEffect[]>): void {
  for (const effect of pendingEffects.current) {
    if (effect.kind === 'sendToOverlay') {
      sendTo('overlay', effect.message);
    }
  }
  pendingEffects.current = [];
}

function useReducerWithEffects() {
  const pendingEffects = useRef<SideEffect[]>([]);

  const wrappedReducer = useCallback(
    (state: ModeStateMachineState, action: ModeAction): ModeStateMachineState => {
      const { state: next, effects } = modeReducer(state, action);
      pendingEffects.current = effects;
      return next;
    },
    [],
  );

  const [state, rawDispatch] = useReducer(wrappedReducer, INITIAL_STATE);

  // Flush effects after every render. In React 18 with createRoot,
  // useReducer's dispatch does NOT always eagerly evaluate the reducer
  // (it skips when the fiber has pending lanes). When deferred, the
  // ref-based immediate flush below finds nothing. This useEffect
  // guarantees effects are sent once the reducer has actually run.
  useEffect(() => {
    flushEffects(pendingEffects);
  });

  const dispatch = useCallback(
    (action: ModeAction) => {
      rawDispatch(action);
      // Optimistic immediate flush — works when React eagerly evaluates
      // the reducer (no pending lanes). The useEffect above is the
      // fallback for deferred evaluation. Double-flush is safe because
      // flushEffects clears the ref.
      flushEffects(pendingEffects);
    },
    [rawDispatch],
  );

  return { state, dispatch };
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export function useModeStateMachine(): ModeStateMachine {
  const { state, dispatch } = useReducerWithEffects();

  // Escape key handler — stable dispatch, no stale closures
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch({ type: 'ESCAPE' });
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  // Public API: handleModeChange
  const handleModeChange = useCallback(
    (mode: AppMode, fromOverlay = false) => {
      dispatch({ type: 'MODE_CHANGE', mode, fromOverlay });
    },
    [dispatch],
  );

  // Public API: handleTabChange
  const handleTabChange = useCallback(
    (tabId: string, fromOverlay = false) => {
      dispatch({ type: 'TAB_CHANGE', tab: tabId, fromOverlay });
    },
    [dispatch],
  );

  // Public API: handleWsMessage — returns true if the message was handled
  const handleWsMessage = useCallback(
    (msg: any): boolean => {
      switch (msg.type) {
        case 'RESET_SELECTION':
          dispatch({ type: 'WS_RESET_SELECTION' });
          return true;
        case 'DESELECT_ELEMENT':
          dispatch({ type: 'WS_DESELECT_ELEMENT' });
          return true;
        case 'ELEMENT_SELECTED':
          dispatch({
            type: 'WS_ELEMENT_SELECTED',
            elementData: {
              componentName: msg.componentName,
              instanceCount: msg.instanceCount,
              classes: msg.classes,
              parsedClasses: parseTokens(msg.classes, TAILWIND_PARSERS),
              tailwindConfig: msg.tailwindConfig,
            },
          });
          return true;
        case 'SELECT_MODE_CHANGED':
          dispatch({ type: 'WS_SELECT_MODE_CHANGED', active: !!msg.active });
          return true;
        case 'MODE_CHANGED':
          dispatch({ type: 'WS_MODE_CHANGED', mode: msg.mode });
          return true;
        case 'TAB_CHANGED':
          dispatch({ type: 'WS_TAB_CHANGED', tab: msg.tab });
          return true;
        case 'TEXT_EDIT_ACTIVE':
          dispatch({ type: 'WS_TEXT_EDIT_ACTIVE' });
          return true;
        case 'TEXT_EDIT_DONE':
          dispatch({ type: 'WS_TEXT_EDIT_DONE' });
          return true;
        case 'INSERT_POINT_LOCKED':
          dispatch({ type: 'WS_INSERT_POINT_LOCKED', position: msg.position, targetName: msg.targetName });
          return true;
        case 'COMPONENT_DISARMED':
          dispatch({ type: 'WS_COMPONENT_DISARMED' });
          return true;
        default:
          return false;
      }
    },
    [dispatch],
  );

  // Derived values
  const currentTabs = useMemo(() => computeCurrentTabs(state.mode), [state.mode]);
  const activeTab = useMemo(
    () => computeActiveTab(state.mode, state.tabPreference),
    [state.mode, state.tabPreference],
  );
  const isPicking = useMemo(
    () => computeIsPicking(state.mode, state.selectModeActive, state.insertPoint, state.insertBrowseActive),
    [state.mode, state.selectModeActive, state.insertPoint, state.insertBrowseActive],
  );

  return {
    mode: state.mode,
    elementData: state.elementData,
    selectionId: state.selectionId,
    insertPoint: state.insertPoint,
    selectModeActive: state.selectModeActive,
    textEditing: state.textEditing,
    tabPreference: state.tabPreference,
    currentTabs,
    activeTab,
    isPicking,
    handleModeChange,
    handleTabChange,
    handleWsMessage,
  };
}
