import type { ParsedToken } from '../../../../overlay/src/tailwind/grammar';
import type { AppMode, PanelTab } from '../../../../shared/types';
import type { Tab } from '../../components/TabBar';

// ---------------------------------------------------------------------------
// Element & insert-point data
// ---------------------------------------------------------------------------

export interface ElementData {
  componentName: string;
  instanceCount: number;
  classes: string;
  parsedClasses: ParsedToken[];
  tailwindConfig: any;
  /** Serialized React Fiber memoizedProps from the nearest component boundary */
  componentProps?: Record<string, unknown>;
  /** When the selected element is a ghost (inserted component), the patch ID that created it */
  ghostPatchId?: string;
}

export interface InsertPoint {
  position: string;
  targetName: string;
}

// ---------------------------------------------------------------------------
// Reducer state
// ---------------------------------------------------------------------------

export interface ModeStateMachineState {
  mode: AppMode;
  tabPreference: 'design' | 'component';
  selectModeActive: boolean;
  insertBrowseActive: boolean;
  textEditing: boolean;
  elementData: ElementData | null;
  selectionId: number;
  insertPoint: InsertPoint | null;
}

// ---------------------------------------------------------------------------
// Reducer actions
// ---------------------------------------------------------------------------

export type ModeAction =
  | { type: 'MODE_CHANGE'; mode: AppMode; fromOverlay?: boolean }
  | { type: 'TAB_CHANGE'; tab: string; fromOverlay?: boolean }
  | { type: 'DESELECT_AND_REENTER'; fromOverlay?: boolean }
  | { type: 'ESCAPE' }
  // WS inbound
  | { type: 'WS_RESET_SELECTION' }
  | { type: 'WS_DESELECT_ELEMENT' }
  | { type: 'WS_ELEMENT_SELECTED'; elementData: ElementData }
  | { type: 'WS_SELECT_MODE_CHANGED'; active: boolean }
  | { type: 'WS_MODE_CHANGED'; mode: AppMode }
  | { type: 'WS_TAB_CHANGED'; tab: string }
  | { type: 'WS_TEXT_EDIT_ACTIVE' }
  | { type: 'WS_TEXT_EDIT_DONE' }
  | { type: 'WS_INSERT_POINT_LOCKED'; position: string; targetName: string }
  | { type: 'WS_COMPONENT_DISARMED' };

// ---------------------------------------------------------------------------
// Side-effects emitted by the reducer (processed by the hook)
// ---------------------------------------------------------------------------

export type SideEffect =
  | { kind: 'sendToOverlay'; message: Record<string, unknown> }
  | { kind: 'none' };

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface ModeStateMachine {
  /** Current mode: 'select' | 'insert' | 'bug-report' | null */
  mode: AppMode;
  /** Currently selected element (null if none) */
  elementData: ElementData | null;
  /** Monotonically increasing ID — bumped on every selection change */
  selectionId: number;
  /** Locked insert point (null if none) */
  insertPoint: InsertPoint | null;
  /** True when select-mode crosshair / insert-mode browse is active */
  selectModeActive: boolean;
  /** True when text is being edited in the page */
  textEditing: boolean;
  /** Tab preference: 'design' | 'component' */
  tabPreference: 'design' | 'component';
  /** Tabs to show based on current mode */
  currentTabs: Tab[];
  /** Active tab ID */
  activeTab: string;
  /** True when the active mode is waiting for user action (crosshair / browse) */
  isPicking: boolean;

  /** Handle mode button click (works for both panel & overlay origin) */
  handleModeChange: (mode: AppMode, fromOverlay?: boolean) => void;
  /** Handle tab change (works for both panel & overlay origin) */
  handleTabChange: (tabId: string, fromOverlay?: boolean) => void;
  /** Process an inbound WebSocket message (mode-related only; returns false if not handled) */
  handleWsMessage: (msg: any) => boolean;
}

// ---------------------------------------------------------------------------
// Shared tab definitions
// ---------------------------------------------------------------------------

export const SELECT_TABS: Tab[] = [
  { id: 'design', label: 'Design' },
  { id: 'replace', label: 'Replace' },
];

export const INSERT_TABS: Tab[] = [
  { id: 'place', label: 'Place' },
];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Derive button color from mode state. */
export function getModeButtonColor(
  mode: AppMode,
  selectModeActive: boolean,
  elementData: ElementData | null,
  insertPoint: InsertPoint | null,
  insertBrowseActive: boolean,
): 'gray' | 'orange' | 'teal' {
  if (mode === null) return 'gray';
  // Orange = waiting for user to pick on the page
  if (mode === 'select' && selectModeActive) return 'orange';
  if (mode === 'insert' && !insertPoint && insertBrowseActive) return 'orange';
  // Teal = target locked
  if (mode === 'select' && (elementData !== null)) return 'teal';
  if (mode === 'insert' && insertPoint !== null) return 'teal';
  // Fallback: mode active but nothing happening = gray
  return 'gray';
}

export function computeActiveTab(mode: AppMode, tabPreference: 'design' | 'component'): string {
  if (mode === 'insert') return 'place';
  if (tabPreference === 'component') return 'replace';
  return 'design';
}

export function computeCurrentTabs(mode: AppMode): Tab[] {
  return mode === 'insert' ? INSERT_TABS : SELECT_TABS;
}

export function computeIsPicking(
  mode: AppMode,
  selectModeActive: boolean,
  insertPoint: InsertPoint | null,
  insertBrowseActive: boolean,
): boolean {
  return selectModeActive || (mode === 'insert' && !insertPoint && insertBrowseActive);
}
