export type FlexWrapValue = 'flex-nowrap' | 'flex-wrap' | 'flex-wrap-reverse';

export interface FlexWrapSelectProps {
  /** Currently applied class, or null if not set */
  currentValue: FlexWrapValue | null;
  /** Staged (locked) value, or null */
  lockedValue: string | null;
  /** True when any property is globally locked */
  locked: boolean;
  onHover: (value: FlexWrapValue) => void;
  onLeave: () => void;
  onClick: (value: FlexWrapValue) => void;
}
