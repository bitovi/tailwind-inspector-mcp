export type FlexDirectionValue = 'flex-row' | 'flex-col' | 'flex-row-reverse' | 'flex-col-reverse';

export interface FlexDirectionSelectProps {
  /** Currently applied class, or null if not set */
  currentValue: FlexDirectionValue | null;
  /** Staged (locked) value, or null */
  lockedValue: string | null;
  /** True when any property is globally locked */
  locked: boolean;
  onHover: (value: FlexDirectionValue) => void;
  onLeave: () => void;
  onClick: (value: FlexDirectionValue) => void;
}
