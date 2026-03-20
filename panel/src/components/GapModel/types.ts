/** The three editable gap slots */
export type GapSlotKey = 'gap' | 'gap-x' | 'gap-y';

/** Data for a single gap slot */
export interface GapSlotData {
  key: GapSlotKey;
  /** Current full Tailwind class, e.g. "gap-4" or "gap-x-2". Null when unset. */
  value: string | null;
  /** All valid values for the scrubber dropdown, in ascending order */
  scaleValues?: string[];
}

export interface GapModelProps {
  /** Slot data for 'gap', 'gap-x', and 'gap-y' */
  slots: GapSlotData[];
  /** Called when a scrubber value is committed (click or scrub release) */
  onSlotChange?: (slot: GapSlotKey, value: string) => void;
  /** Called during hover preview; value=null means the user left */
  onSlotHover?: (slot: GapSlotKey, value: string | null) => void;
  /** Called when user removes a value via the dropdown's remove row */
  onSlotRemove?: (slot: GapSlotKey) => void;
  /** Called when user hovers the remove row — use to preview the removal in the live DOM */
  onSlotRemoveHover?: (slot: GapSlotKey) => void;
}
