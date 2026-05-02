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
import type { AppMode, EditTool } from '../../../../shared/types';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const INITIAL_STATE: ModeStateMachineState = {
  mode: null,
  editTool: null,
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

      console.log(`[theme-trace] MODE_CHANGE: ${prev.mode} → ${newMode} (fromOverlay=${fromOverlay})`);

      // Re-click same mode
      if (newMode === prev.mode) {
        // ── Select mode three-way toggle ──
        // Orange + element → Teal (stop selecting, keep element)
        // Orange + no element → Gray (cancel selecting)
        // Teal (element, not selecting) → Gray (deselect everything)
        if (prev.mode === 'select') {
          if (prev.selectModeActive && prev.elementData) {
            // Orange with element → Teal: stop selecting, keep element
            return {
              state: {
                ...prev,
                selectModeActive: false,
              },
              effects: fromOverlay ? [] : [
                { kind: 'sendToOverlay', message: { type: 'TOGGLE_SELECT_MODE', active: false } },
              ],
            };
          }
          if (prev.selectModeActive && !prev.elementData) {
            // Orange with no element → Gray: cancel
            newMode = null;
          } else if (!prev.selectModeActive && prev.elementData) {
            // Teal → Orange: clear element and re-enter fresh selecting
            return {
              state: {
                ...prev,
                selectModeActive: true,
                elementData: null,
                selectionId: prev.selectionId + 1,
              },
              effects: fromOverlay ? [] : [
                { kind: 'sendToOverlay', message: { type: 'MODE_CHANGED', mode: 'select' } },
              ],
            };
          }
          // else: gray select (idle) → fall through to re-activate
        } else if (prev.mode === 'insert') {
          // ── Insert mode three-way toggle (mirrors Select) ──
          // Orange + point → Teal (stop browsing, keep point)
          // Orange + no point → Gray (cancel browsing)
          // Teal (point, not browsing) → Orange (clear point, fresh browsing)
          if (prev.insertBrowseActive && prev.insertPoint) {
            // Orange with point → Teal: stop browsing, keep point
            return {
              state: {
                ...prev,
                insertBrowseActive: false,
              },
              effects: fromOverlay ? [] : [
                { kind: 'sendToOverlay', message: { type: 'TOGGLE_INSERT_BROWSE', active: false } },
              ],
            };
          }
          if (prev.insertBrowseActive && !prev.insertPoint) {
            // Orange with no point → Gray: cancel
            newMode = null;
          } else if (!prev.insertBrowseActive && prev.insertPoint) {
            // Teal → Orange: clear point and re-enter fresh browsing
            return {
              state: {
                ...prev,
                insertBrowseActive: true,
                insertPoint: null,
              },
              effects: fromOverlay ? [] : [
                { kind: 'sendToOverlay', message: { type: 'MODE_CHANGED', mode: 'insert' } },
              ],
            };
          }
          // else: gray insert (idle) → fall through to re-activate
        } else {
          if (prev.elementData || prev.insertPoint) {
            return deselectAndReenter(prev, fromOverlay);
          }
          newMode = null;
        }
      }

      // Clear previous selection
      const next: ModeStateMachineState = {
        ...prev,
        elementData: null,
        selectionId: prev.selectionId + 1,
        textEditing: false,
        insertPoint: null,
        mode: newMode,
        editTool: newMode === 'select' ? 'select'
          : newMode === 'insert' ? 'insert'
          : (newMode === null && (prev.mode === 'select' || prev.mode === 'insert')) ? null
          : prev.editTool,
      };

      if (newMode === null) {
        next.selectModeActive = false;
        next.insertBrowseActive = false;
        next.editTool = null;
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
      if (action.tab === 'components' || action.tab === 'replace' || action.tab === 'place') {
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
    // EDIT_TOOL_CHANGE — bottom toolbar tool clicked
    // ------------------------------------------------------------------
    case 'EDIT_TOOL_CHANGE': {
      const tool = action.tool;
      const fromOverlay = !!action.fromOverlay;
      const effects: SideEffect[] = [];

      // Map tool to internal mode
      if (tool === 'select') {
        return modeReducer(prev, { type: 'MODE_CHANGE', mode: 'select', fromOverlay });
      }
      if (tool === 'insert') {
        return modeReducer(prev, { type: 'MODE_CHANGE', mode: 'insert', fromOverlay });
      }
      if (tool === 'text') {
        // Text tool is like select but with text editing intent
        const result = modeReducer(prev, { type: 'MODE_CHANGE', mode: 'select', fromOverlay });
        result.state.editTool = 'text';
        return result;
      }
      // tool === null — deselect tool
      const next: ModeStateMachineState = {
        ...prev,
        editTool: null,
        mode: null,
        elementData: null,
        selectionId: prev.selectionId + 1,
        textEditing: false,
        insertPoint: null,
        selectModeActive: false,
        insertBrowseActive: false,
      };
      if (!fromOverlay) {
        effects.push({ kind: 'sendToOverlay', message: { type: 'CANCEL_MODE' } });
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
      // ── Select mode layered escape ──
      // Orange + element → Teal (stop selecting, keep element)
      // Orange + no element → Gray
      // Teal + element → Gray (deselect)
      if (prev.mode === 'select') {
        if (prev.selectModeActive && prev.elementData) {
          // Orange with element → Teal: stop selecting, keep element
          return {
            state: {
              ...prev,
              selectModeActive: false,
            },
            effects: [
              { kind: 'sendToOverlay', message: { type: 'TOGGLE_SELECT_MODE', active: false } },
            ],
          };
        }
        if (!prev.selectModeActive && prev.elementData) {
          // Teal → Gray: deselect element
          return {
            state: {
              ...prev,
              mode: null,
              editTool: null,
              elementData: null,
              selectionId: prev.selectionId + 1,
              selectModeActive: false,
              textEditing: false,
            },
            effects: [{ kind: 'sendToOverlay', message: { type: 'CANCEL_MODE' } }],
          };
        }
        // Orange with no element or gray → cancel mode
        return {
          state: {
            ...prev,
            mode: null,
            editTool: null,
            selectModeActive: false,
            insertBrowseActive: false,
            insertPoint: null,
          },
          effects: [{ kind: 'sendToOverlay', message: { type: 'CANCEL_MODE' } }],
        };
      }

      // ── Insert mode layered escape (mirrors Select) ──
      // Orange + point → Teal (stop browsing, keep point)
      // Orange + no point → Gray
      // Teal + point → Gray (clear point)
      if (prev.mode === 'insert') {
        if (prev.insertBrowseActive && prev.insertPoint) {
          // Orange with point → Teal: stop browsing, keep point
          return {
            state: {
              ...prev,
              insertBrowseActive: false,
            },
            effects: [
              { kind: 'sendToOverlay', message: { type: 'TOGGLE_INSERT_BROWSE', active: false } },
            ],
          };
        }
        if (!prev.insertBrowseActive && prev.insertPoint) {
          // Teal → Gray: clear point
          return {
            state: {
              ...prev,
              mode: null,
              editTool: null,
              insertPoint: null,
              insertBrowseActive: false,
            },
            effects: [{ kind: 'sendToOverlay', message: { type: 'CANCEL_MODE' } }],
          };
        }
        // Orange with no point or gray → cancel mode
        return {
          state: {
            ...prev,
            mode: null,
            editTool: null,
            selectModeActive: false,
            insertBrowseActive: false,
            insertPoint: null,
          },
          effects: [{ kind: 'sendToOverlay', message: { type: 'CANCEL_MODE' } }],
        };
      }

      // ── Other modes: existing behavior ──
      if (prev.elementData || prev.insertPoint) {
        return deselectAndReenter(prev, false);
      }
      // If a tool is active but no selection, deselect the tool (go to edit with no tool)
      if (prev.editTool !== null && prev.mode !== 'bug-report' && prev.mode !== 'theme') {
        return {
          state: {
            ...prev,
            mode: null,
            editTool: null,
            selectModeActive: false,
            insertBrowseActive: false,
            insertPoint: null,
          },
          effects: [{ kind: 'sendToOverlay', message: { type: 'CANCEL_MODE' } }],
        };
      }
      if (prev.mode !== null) {
        // No selection — cancel mode entirely
        return {
          state: {
            ...prev,
            mode: null,
            editTool: null,
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
      console.log(`[theme-trace] WS_RESET_SELECTION while mode=${prev.mode}`);
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
          editTool: null,
        },
        effects: [],
      };

    case 'WS_DESELECT_ELEMENT':
      return deselectAndReenter(prev, true);

    case 'WS_ELEMENT_SELECTED':
      // Ignore stale element selections while theme or bug-report mode is active
      if (prev.mode === 'theme' || prev.mode === 'bug-report') {
        console.log(`[theme-trace] WS_ELEMENT_SELECTED ignored (mode=${prev.mode})`);
        return { state: prev, effects: [] };
      }
      return {
        state: {
          ...prev,
          elementData: action.elementData,
          selectionId: prev.selectionId + 1,
          // Persistent select: keep selectModeActive so user can re-select
          selectModeActive: prev.selectModeActive,
          mode: prev.mode ?? 'select',
        },
        effects: [],
      };

    case 'WS_SELECT_MODE_CHANGED':
      // Ignore stale select-mode updates while theme or bug-report mode is active
      if (prev.mode === 'theme' || prev.mode === 'bug-report') {
        return { state: prev, effects: [] };
      }
      return {
        state: { ...prev, selectModeActive: action.active },
        effects: [],
      };

    case 'WS_INSERT_BROWSE_CHANGED':
      return {
        state: { ...prev, insertBrowseActive: action.active },
        effects: [],
      };

    case 'WS_MODE_CHANGED': {
      console.log(`[theme-trace] WS_MODE_CHANGED: ${action.mode} (current=${prev.mode})`);
      // Delegate to MODE_CHANGE with fromOverlay=true
      return modeReducer(prev, { type: 'MODE_CHANGE', mode: action.mode, fromOverlay: true });
    }

    case 'WS_TAB_CHANGED':
      return modeReducer(prev, { type: 'TAB_CHANGE', tab: action.tab, fromOverlay: true });

    case 'WS_EDIT_TOOL_CHANGED':
      return modeReducer(prev, { type: 'EDIT_TOOL_CHANGE', tool: action.tool, fromOverlay: true });

    case 'WS_TEXT_EDIT_ACTIVE':
      return { state: { ...prev, textEditing: true }, effects: [] };

    case 'WS_TEXT_EDIT_DONE':
      return { state: { ...prev, textEditing: false }, effects: [] };

    case 'WS_INSERT_POINT_LOCKED':
      return {
        state: {
          ...prev,
          insertPoint: { position: action.position, targetName: action.targetName },
          // Keep insertBrowseActive as-is (persistent browse mode)
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

  // Public API: handleEditToolChange
  const handleEditToolChange = useCallback(
    (tool: EditTool, fromOverlay = false) => {
      dispatch({ type: 'EDIT_TOOL_CHANGE', tool, fromOverlay });
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
              componentProps: msg.componentProps,
              ghostPatchId: msg.ghostPatchId,
            },
          });
          return true;
        case 'SELECT_MODE_CHANGED':
          dispatch({ type: 'WS_SELECT_MODE_CHANGED', active: !!msg.active });
          return true;
        case 'INSERT_BROWSE_CHANGED':
          dispatch({ type: 'WS_INSERT_BROWSE_CHANGED', active: !!msg.active });
          return true;
        case 'MODE_CHANGED':
          dispatch({ type: 'WS_MODE_CHANGED', mode: msg.mode });
          return true;
        case 'EDIT_TOOL_CHANGED':
          dispatch({ type: 'WS_EDIT_TOOL_CHANGED', tool: msg.tool });
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

  // Edit mode is active when we're in select/insert/null (not bug-report/theme)
  const isEditMode = state.mode === 'select' || state.mode === 'insert' || state.mode === null;

  return {
    mode: state.mode,
    editTool: state.editTool,
    elementData: state.elementData,
    selectionId: state.selectionId,
    insertPoint: state.insertPoint,
    selectModeActive: state.selectModeActive,
    textEditing: state.textEditing,
    tabPreference: state.tabPreference,
    currentTabs,
    activeTab,
    isPicking,
    isEditMode,
    handleModeChange,
    handleEditToolChange,
    handleTabChange,
    handleWsMessage,
  };
}
