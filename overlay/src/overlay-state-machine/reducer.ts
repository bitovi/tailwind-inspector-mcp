// Pure overlay state-machine reducer.
// All transitions happen here. Returns new state + declarative effects.

import type {
  OverlayState,
  OverlayAction,
  OverlayEffect,
  ReducerResult,
  SelectPhase,
  InsertPhase,
  ToolbarVisual,
} from './types';

// ── Initial state ────────────────────────────────────────────────────────

export const INITIAL_STATE: OverlayState = {
  active: false,
  mode: null,
  editTool: null,
  selectPhase: 'off',
  insertPhase: 'off',
  interaction: { kind: 'none' },
  selectedEl: null,
  equivalentNodes: [],
  boundary: null,
  lockedTarget: null,
  lockedPosition: null,
  currentTab: 'design',
  tabPreference: 'design',
  toolbar: { select: 'gray', insert: 'gray', text: 'gray' },
};

// ── Cleanup effect lists ─────────────────────────────────────────────────

const FULL_CLEANUP: OverlayEffect[] = [
  { kind: 'revert-preview' },
  { kind: 'clear-highlights' },
  { kind: 'cancel-insert' },
  { kind: 'clear-locked-insert' },
  { kind: 'clear-selection-state' },
];

const SELECTION_CLEANUP: OverlayEffect[] = [
  { kind: 'revert-preview' },
  { kind: 'clear-highlights' },
  { kind: 'clear-hover-preview' },
  { kind: 'clear-selection-state' },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function toolbarForPhases(selectPhase: SelectPhase, insertPhase: InsertPhase): ToolbarVisual {
  return {
    select: selectPhase === 'picking' ? 'picking'
          : selectPhase === 'engaged' ? 'engaged'
          : 'gray',
    insert: insertPhase === 'browsing' ? 'picking'
          : insertPhase === 'locked' ? 'engaged'
          : 'gray',
    text: 'gray',
  };
}

function clearSelection(prev: OverlayState): Partial<OverlayState> {
  return {
    selectedEl: null,
    equivalentNodes: [],
    boundary: null,
  };
}

function clearInsertLock(prev: OverlayState): Partial<OverlayState> {
  return {
    lockedTarget: null,
    lockedPosition: null,
  };
}

// ── Reducer ──────────────────────────────────────────────────────────────

function coreReducer(
  prev: OverlayState,
  action: OverlayAction,
): ReducerResult {
  switch (action.type) {

    // ════════════════════════════════════════════════════════════════════
    // Command actions (from panel)
    // ════════════════════════════════════════════════════════════════════

    case 'CMD_MODE_CHANGED': {
      const effects: OverlayEffect[] = [...FULL_CLEANUP];

      if (action.mode === 'select') {
        return {
          state: {
            ...prev,
            active: true,
            mode: 'select',
            editTool: 'select',
            selectPhase: 'picking',
            insertPhase: 'off',
            ...clearSelection(prev),
            ...clearInsertLock(prev),
            currentTab: prev.tabPreference === 'component' ? 'replace' : 'design',
          },
          effects: [
            ...effects,
            { kind: 'set-select-mode', on: true },
            { kind: 'show-toolbar' },
          ],
        };
      }

      if (action.mode === 'insert') {
        const tabPref = prev.tabPreference === 'design' ? 'component' : prev.tabPreference;
        return {
          state: {
            ...prev,
            active: true,
            mode: 'insert',
            editTool: 'insert',
            selectPhase: 'off',
            insertPhase: 'browsing',
            ...clearSelection(prev),
            ...clearInsertLock(prev),
            tabPreference: tabPref,
            currentTab: 'place',
          },
          effects: [
            ...effects,
            { kind: 'set-select-mode', on: false },
            { kind: 'start-browse' },
            { kind: 'show-toolbar' },
          ],
        };
      }

      // mode === null (or bug-report / theme) — cancel everything
      const isEditNull = action.mode === null;
      return {
        state: {
          ...prev,
          mode: action.mode,
          editTool: null,
          selectPhase: 'off',
          insertPhase: 'off',
          ...clearSelection(prev),
          ...clearInsertLock(prev),
        },
        effects: [
          ...effects,
          { kind: 'set-select-mode', on: false },
          ...(isEditNull && prev.active ? [{ kind: 'show-toolbar' as const }] : [{ kind: 'hide-toolbar' as const }]),
        ],
      };
    }

    case 'CMD_TOGGLE_SELECT_MODE': {
      if (action.active) {
        // Enter selecting (orange)
        return {
          state: {
            ...prev,
            active: true,
            selectPhase: 'picking',
          },
          effects: [
            { kind: 'set-select-mode', on: true },
            { kind: 'show-toolbar' },
            { kind: 'open-panel' },
          ],
        };
      } else {
        // Stop selecting (orange → teal if element, or just off)
        const newPhase: SelectPhase = prev.selectedEl ? 'engaged' : 'off';
        return {
          state: {
            ...prev,
            selectPhase: newPhase,
          },
          effects: [
            { kind: 'set-select-mode', on: false },
          ],
        };
      }
    }

    case 'CMD_TOGGLE_INSERT_BROWSE': {
      if (action.active) {
        // Teal → Orange: re-enable browsing, clear locked point
        return {
          state: {
            ...prev,
            insertPhase: 'browsing',
            ...clearInsertLock(prev),
            ...clearSelection(prev),
          },
          effects: [
            { kind: 'clear-locked-insert' },
            { kind: 'clear-selection-state' },
            { kind: 'start-browse' },
            { kind: 'show-toolbar' },
          ],
        };
      } else {
        // Orange → Teal: stop browsing, keep locked insert point
        const hasLock = prev.lockedTarget !== null;
        const newPhase: InsertPhase = hasLock ? 'locked' : 'off';
        return {
          state: {
            ...prev,
            insertPhase: newPhase,
          },
          effects: [
            { kind: 'cancel-insert' },
          ],
        };
      }
    }

    case 'CMD_CANCEL_MODE': {
      return {
        state: {
          ...prev,
          selectPhase: 'off',
          insertPhase: 'off',
          ...clearSelection(prev),
          ...clearInsertLock(prev),
        },
        effects: [
          { kind: 'revert-preview' },
          { kind: 'clear-highlights' },
          { kind: 'clear-selection-state' },
          { kind: 'set-select-mode', on: false },
          { kind: 'cancel-insert' },
          { kind: 'clear-locked-insert' },
        ],
      };
    }

    case 'CMD_TAB_CHANGED': {
      const tabPref = (action.tab === 'replace' || action.tab === 'place')
        ? 'component' as const
        : 'design' as const;
      return {
        state: {
          ...prev,
          currentTab: action.tab,
          tabPreference: tabPref,
        },
        effects: [],
      };
    }

    case 'CMD_EDIT_TOOL_CHANGED': {
      const toolbar: ToolbarVisual = {
        ...prev.toolbar,
        select: action.tool === 'select'
          ? (prev.selectedEl ? 'engaged' : 'picking')
          : (prev.toolbar.select === 'engaged' ? 'engaged' : 'gray'),
        insert: action.tool === 'insert'
          ? (prev.insertPhase === 'browsing' ? 'picking' : (prev.lockedTarget ? 'engaged' : 'picking'))
          : 'gray',
        text: action.tool === 'text' ? 'picking' : 'gray',
      };
      return {
        state: {
          ...prev,
          editTool: action.tool,
          toolbar,
        },
        effects: [],
      };
    }

    case 'CMD_COLOR_SCHEME': {
      // No state change needed — effect handles DOM
      return { state: prev, effects: [] };
    }

    // ════════════════════════════════════════════════════════════════════
    // Local actions (overlay-internal)
    // ════════════════════════════════════════════════════════════════════

    case 'ELEMENT_SELECTED': {
      return {
        state: {
          ...prev,
          selectedEl: action.el,
          equivalentNodes: action.equivalentNodes,
          boundary: action.boundary,
          // When element is selected, select phase stays as-is (persistent select)
          mode: prev.mode ?? 'select',
        },
        effects: [
          { kind: 'clear-highlights' },
          { kind: 'clear-hover-preview' },
          { kind: 'highlight-element', el: action.el },
          { kind: 'show-draw-button', el: action.el },
          { kind: 'set-grab-cursor', el: action.el },
        ],
      };
    }

    case 'ELEMENT_DESELECTED': {
      return {
        state: {
          ...prev,
          ...clearSelection(prev),
        },
        effects: [
          ...SELECTION_CLEANUP,
          { kind: 'remove-draw-button' },
        ],
      };
    }

    case 'INSERT_POINT_LOCKED': {
      return {
        state: {
          ...prev,
          // Keep browsing active if we're in browse mode — orange persists
          // so the user can re-click a different spot without re-clicking Insert.
          insertPhase: prev.insertPhase === 'browsing' ? 'browsing' : 'locked',
          lockedTarget: action.target,
          lockedPosition: action.position,
        },
        effects: [],
      };
    }

    case 'INSERT_POINT_CLEARED': {
      const newPhase: InsertPhase = prev.insertPhase === 'locked' ? 'off' : prev.insertPhase;
      return {
        state: {
          ...prev,
          insertPhase: newPhase,
          ...clearInsertLock(prev),
        },
        effects: [
          { kind: 'clear-locked-insert' },
        ],
      };
    }

    // ── Toolbar tool click (three-way toggle from overlay) ───────────

    case 'TOOLBAR_TOOL_CLICK': {
      const { tool } = action;

      // ── Select re-click toggle ──
      if (tool === 'select') {
        if (prev.selectPhase === 'picking' && !prev.selectedEl) {
          // Orange + no element → Gray: cancel selecting
          return {
            state: {
              ...prev,
              mode: null,
              editTool: null,
              selectPhase: 'off',
            },
            effects: [
              { kind: 'set-select-mode', on: false },
              { kind: 'send-to-panel', message: { type: 'MODE_CHANGED', mode: null } },
            ],
          };
        }
        if (prev.selectPhase === 'picking' && prev.selectedEl) {
          // Orange + element → Teal
          // Note: no MODE_CHANGED needed — panel is already in 'select' mode.
          // SELECT_MODE_CHANGED { active: false } (from set-select-mode) is enough.
          const toolbar = toolbarForPhases('engaged', prev.insertPhase);
          return {
            state: { ...prev, selectPhase: 'engaged', toolbar },
            effects: [
              { kind: 'set-select-mode', on: false },
              { kind: 'update-toolbar', visual: toolbar },
            ],
          };
        }
        if (prev.selectPhase === 'engaged') {
          // Teal → Orange: clear element, fresh selecting
          return {
            state: {
              ...prev,
              selectPhase: 'picking',
              ...clearSelection(prev),
            },
            effects: [
              ...SELECTION_CLEANUP,
              { kind: 'cancel-insert' },
              { kind: 'clear-locked-insert' },
              { kind: 'set-select-mode', on: true },
              { kind: 'send-to-panel', message: { type: 'MODE_CHANGED', mode: 'select' } },
            ],
          };
        }
        // Gray → Orange: enter select mode
        return {
          state: {
            ...prev,
            mode: 'select',
            editTool: 'select',
            selectPhase: 'picking',
            insertPhase: 'off',
            ...clearSelection(prev),
            ...clearInsertLock(prev),
          },
          effects: [
            ...FULL_CLEANUP,
            { kind: 'set-select-mode', on: true },
            { kind: 'send-to-panel', message: { type: 'EDIT_TOOL_CHANGED', tool: 'select' } },
          ],
        };
      }

      // ── Insert re-click toggle ──
      if (tool === 'insert') {
        if (prev.insertPhase === 'browsing' && !prev.lockedTarget) {
          // Orange + no point → Gray: cancel browsing
          return {
            state: {
              ...prev,
              mode: null,
              editTool: null,
              insertPhase: 'off',
            },
            effects: [
              { kind: 'cancel-insert' },
              { kind: 'send-to-panel', message: { type: 'MODE_CHANGED', mode: null } },
            ],
          };
        }
        if (prev.insertPhase === 'browsing' && prev.lockedTarget) {
          // Orange + point → Teal: stop browsing, keep point
          return {
            state: { ...prev, insertPhase: 'locked' },
            effects: [
              { kind: 'cancel-insert' },
              { kind: 'send-to-panel', message: { type: 'EDIT_TOOL_CHANGED', tool: 'insert' } },
            ],
          };
        }
        if (prev.insertPhase === 'locked') {
          // Teal → Orange: clear point, fresh browsing
          return {
            state: {
              ...prev,
              selectPhase: 'off',
              insertPhase: 'browsing',
              ...clearInsertLock(prev),
              ...clearSelection(prev),
            },
            effects: [
              { kind: 'clear-locked-insert' },
              { kind: 'clear-highlights' },
              { kind: 'clear-selection-state' },
              { kind: 'start-browse' },
              { kind: 'send-to-panel', message: { type: 'MODE_CHANGED', mode: 'insert' } },
            ],
          };
        }
        // Gray → Orange: enter insert mode
        return {
          state: {
            ...prev,
            mode: 'insert',
            editTool: 'insert',
            selectPhase: 'off',
            insertPhase: 'browsing',
            ...clearSelection(prev),
            ...clearInsertLock(prev),
            tabPreference: prev.tabPreference === 'design' ? 'component' : prev.tabPreference,
          },
          effects: [
            ...FULL_CLEANUP,
            { kind: 'set-select-mode', on: false },
            { kind: 'start-browse' },
            { kind: 'send-to-panel', message: { type: 'EDIT_TOOL_CHANGED', tool: 'insert' } },
          ],
        };
      }

      // ── null tool (deselect) ──
      return {
        state: {
          ...prev,
          mode: null,
          editTool: null,
          selectPhase: 'off',
          insertPhase: 'off',
          ...clearSelection(prev),
          ...clearInsertLock(prev),
        },
        effects: [
          ...FULL_CLEANUP,
          { kind: 'set-select-mode', on: false },
          { kind: 'send-to-panel', message: { type: 'EDIT_TOOL_CHANGED', tool: null } },
        ],
      };
    }

    // ── Escape key ───────────────────────────────────────────────────

    case 'ESCAPE': {
      // Insert mode escape (mirrors panel's layered escape)
      if (prev.insertPhase === 'browsing' && prev.lockedTarget) {
        // Orange + locked point → Teal: stop browsing, keep point
        return {
          state: { ...prev, insertPhase: 'locked' },
          effects: [
            { kind: 'cancel-insert' },
            { kind: 'send-to-panel', message: { type: 'INSERT_BROWSE_CHANGED', active: false } },
          ],
        };
      }
      if (prev.insertPhase === 'locked') {
        // Teal → Gray: clear locked point entirely
        return {
          state: {
            ...prev,
            mode: null,
            editTool: null,
            insertPhase: 'off',
            ...clearInsertLock(prev),
          },
          effects: [
            { kind: 'clear-locked-insert' },
            { kind: 'send-to-panel', message: { type: 'MODE_CHANGED', mode: null } },
          ],
        };
      }
      if (prev.insertPhase === 'browsing' && !prev.lockedTarget) {
        // Orange + no point → Gray: cancel insert entirely
        return {
          state: {
            ...prev,
            mode: null,
            editTool: null,
            insertPhase: 'off',
          },
          effects: [
            { kind: 'cancel-insert' },
            { kind: 'send-to-panel', message: { type: 'MODE_CHANGED', mode: null } },
          ],
        };
      }

      // Select mode escape
      if (prev.selectPhase === 'picking' && prev.selectedEl) {
        // Orange + element → Teal: stop selecting, keep element
        return {
          state: { ...prev, selectPhase: 'engaged' },
          effects: [
            { kind: 'set-select-mode', on: false },
          ],
        };
      }
      if (prev.selectPhase === 'engaged') {
        // Teal → Gray: deselect element entirely
        return {
          state: {
            ...prev,
            mode: null,
            editTool: null,
            selectPhase: 'off',
            ...clearSelection(prev),
          },
          effects: [
            ...SELECTION_CLEANUP,
            { kind: 'send-to-panel', message: { type: 'MODE_CHANGED', mode: null } },
          ],
        };
      }
      if (prev.selectPhase === 'picking' && !prev.selectedEl) {
        // Orange + no element → Gray: cancel select entirely
        return {
          state: {
            ...prev,
            mode: null,
            editTool: null,
            selectPhase: 'off',
          },
          effects: [
            { kind: 'set-select-mode', on: false },
            { kind: 'send-to-panel', message: { type: 'MODE_CHANGED', mode: null } },
          ],
        };
      }

      // No active mode — no-op
      return { state: prev, effects: [] };
    }

    // ── Drag-move lifecycle ──────────────────────────────────────────

    case 'DRAG_MOVE_START': {
      // Mousedown on selected element — doesn't start drag yet (5px threshold)
      // Just record intent; actual drag starts at DRAG_MOVE_THRESHOLD_MET
      return { state: prev, effects: [] };
    }

    case 'DRAG_MOVE_THRESHOLD_MET': {
      if (prev.interaction.kind !== 'none') {
        // Another interaction already active — reject
        return { state: prev, effects: [] };
      }
      const toolbar: ToolbarVisual = { select: 'gray', insert: 'picking', text: 'gray' };
      return {
        state: {
          ...prev,
          interaction: {
            kind: 'drag-moving',
            savedSelectPhase: prev.selectPhase,
            sourceEl: prev.selectedEl!,
          },
          selectPhase: 'off',
          toolbar,
        },
        effects: [
          { kind: 'set-select-mode', on: false },
          { kind: 'clear-grab-cursor', el: prev.selectedEl! },
        ],
      };
    }

    case 'DRAG_MOVE_DROPPED':
    case 'DRAG_MOVE_CANCELLED': {
      if (prev.interaction.kind !== 'drag-moving') {
        return { state: prev, effects: [] };
      }
      const saved = prev.interaction.savedSelectPhase;
      return {
        state: {
          ...prev,
          interaction: { kind: 'none' },
          selectPhase: saved,
        },
        effects: [
          { kind: 'set-select-mode', on: saved === 'picking' },
          ...(prev.selectedEl ? [
            { kind: 'set-grab-cursor' as const, el: prev.selectedEl },
            { kind: 'highlight-element' as const, el: prev.selectedEl },
            { kind: 'show-draw-button' as const, el: prev.selectedEl },
          ] : []),
          { kind: 'send-to-panel', message: {
            type: 'MODE_CHANGED',
            mode: 'select',
          }},
          ...(saved !== 'picking' ? [
            { kind: 'send-to-panel' as const, message: { type: 'SELECT_MODE_CHANGED', active: false } },
          ] : []),
        ],
      };
    }

    // ── Component drag lifecycle ─────────────────────────────────────

    case 'COMPONENT_DRAG_START': {
      if (prev.interaction.kind !== 'none') {
        return { state: prev, effects: [] };
      }
      return {
        state: {
          ...prev,
          interaction: { kind: 'component-drag', mode: action.mode },
        },
        effects: [
          { kind: 'cancel-insert' },
          { kind: 'clear-locked-insert' },
          { kind: 'clear-highlights' },
        ],
      };
    }

    case 'COMPONENT_DRAG_DROPPED':
    case 'COMPONENT_DRAG_CANCELLED': {
      if (prev.interaction.kind !== 'component-drag') {
        return { state: prev, effects: [] };
      }
      return {
        state: {
          ...prev,
          interaction: { kind: 'none' },
        },
        effects: [],
      };
    }

    // ── Text editing lifecycle ───────────────────────────────────────

    case 'TEXT_EDIT_START': {
      if (prev.interaction.kind !== 'none') {
        return { state: prev, effects: [] };
      }
      return {
        state: {
          ...prev,
          interaction: { kind: 'text-editing', targetEl: action.targetEl },
        },
        effects: [
          { kind: 'set-text-editing-lock', locked: true },
        ],
      };
    }

    case 'TEXT_EDIT_END': {
      if (prev.interaction.kind !== 'text-editing') {
        return { state: prev, effects: [] };
      }
      return {
        state: {
          ...prev,
          interaction: { kind: 'none' },
        },
        effects: [
          { kind: 'set-text-editing-lock', locked: false },
        ],
      };
    }

    // ── Component placed (restart browse for rapid placement) ────────

    case 'COMPONENT_PLACED': {
      // After a component is placed (Flow A or B), clear the locked point
      // but keep browse mode active so the user can rapidly place again.
      if (prev.insertPhase === 'browsing' || prev.insertPhase === 'locked') {
        return {
          state: {
            ...prev,
            insertPhase: 'browsing',
            ...clearInsertLock(prev),
          },
          effects: [
            { kind: 'clear-locked-insert' },
            { kind: 'start-browse' },
            { kind: 'send-to-panel', message: { type: 'COMPONENT_DISARMED' } },
          ],
        };
      }
      return { state: prev, effects: [] };
    }

    // ── Paste flow ───────────────────────────────────────────────────

    case 'PASTE_INITIATED': {
      const toolbar: ToolbarVisual = { select: 'completed', insert: 'picking', text: 'gray' };
      return {
        state: {
          ...prev,
          selectPhase: 'off',
          insertPhase: 'browsing',
          toolbar,
        },
        effects: [
          { kind: 'set-select-mode', on: false },
        ],
      };
    }

    // ── Activation ───────────────────────────────────────────────────

    case 'ACTIVATE': {
      return {
        state: { ...prev, active: true },
        effects: [{ kind: 'show-toolbar' }],
      };
    }

    case 'DEACTIVATE': {
      return {
        state: {
          ...prev,
          active: false,
          mode: null,
          editTool: null,
          selectPhase: 'off',
          insertPhase: 'off',
          interaction: { kind: 'none' },
          ...clearSelection(prev),
          ...clearInsertLock(prev),
        },
        effects: [
          ...FULL_CLEANUP,
          { kind: 'set-select-mode', on: false },
          { kind: 'hide-toolbar' },
        ],
      };
    }

    // ── Navigation reset ─────────────────────────────────────────────

    case 'NAVIGATION_RESET': {
      return {
        state: {
          ...prev,
          mode: null,
          editTool: null,
          selectPhase: 'off',
          insertPhase: 'off',
          interaction: { kind: 'none' },
          ...clearSelection(prev),
          ...clearInsertLock(prev),
        },
        effects: [
          ...FULL_CLEANUP,
          { kind: 'set-select-mode', on: false },
          { kind: 'send-to-panel', message: { type: 'RESET_SELECTION' } },
          { kind: 'send-to-panel', message: { type: 'COMPONENT_DISARMED' } },
        ],
      };
    }

    default:
      return { state: prev, effects: [] };
  }
}

// ── Auto-derive toolbar wrapper ──────────────────────────────────────────

export function overlayReducer(
  prev: OverlayState,
  action: OverlayAction,
): ReducerResult {
  const result = coreReducer(prev, action);

  // No-op branches return prev unchanged — skip toolbar derivation
  if (result.state === prev) {
    return result;
  }

  // If core set a custom toolbar (new object reference), keep it;
  // otherwise derive from phases.
  const coreSetToolbar = result.state.toolbar !== prev.toolbar;
  const toolbar = coreSetToolbar
    ? result.state.toolbar
    : toolbarForPhases(result.state.selectPhase, result.state.insertPhase);

  const toolbarChanged = toolbar.select !== prev.toolbar.select
    || toolbar.insert !== prev.toolbar.insert
    || toolbar.text !== prev.toolbar.text;

  // Strip any manually-added update-toolbar effects, then re-add if needed
  const filteredEffects = result.effects.filter(e => e.kind !== 'update-toolbar');

  return {
    state: { ...result.state, toolbar },
    effects: toolbarChanged
      ? [...filteredEffects, { kind: 'update-toolbar', visual: toolbar }]
      : filteredEffects,
  };
}
