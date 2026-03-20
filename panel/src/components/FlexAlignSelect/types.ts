export type FlexDirectionCss = 'row' | 'column' | 'row-reverse' | 'column-reverse';

export interface FlexAlignSelectProps {
  /** Currently applied Tailwind class, or null if not set */
  currentValue: string | null;
  /** Staged (locked) value, or null */
  lockedValue: string | null;
  /** True when any property is globally locked */
  locked: boolean;
  /** Current flex-direction CSS value — diagrams adapt to this */
  flexDirection?: FlexDirectionCss;
  onHover: (value: string) => void;
  onLeave: () => void;
  onClick: (value: string) => void;
  onRemove?: () => void;
  onRemoveHover?: () => void;
}
