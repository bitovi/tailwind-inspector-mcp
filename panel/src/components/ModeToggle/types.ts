import type { AppMode } from '../../../../shared/types';

export interface ModeToggleProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  /** True when the active mode is waiting for user action (crosshair / drop-zone). */
  isPicking?: boolean;
  /** True when a target is locked (element selected or insert point set). Shows teal. */
  isEngaged?: boolean;
}
