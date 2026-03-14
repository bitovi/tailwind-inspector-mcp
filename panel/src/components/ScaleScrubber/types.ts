export interface ScaleScrubberProps {
  /** All valid values in ascending order (e.g. ['px-0', 'px-1', 'px-2', …]) */
  values: string[];
  /** The currently applied class */
  currentValue: string;
  /** The staged (previewed but not committed) value, or null */
  lockedValue: string | null;
  /** True when any property is locked — disables all interactions */
  locked: boolean;
  onStart?: () => void;
  onHover: (value: string) => void;
  onLeave: () => void;
  onClick: (value: string) => void;
}
