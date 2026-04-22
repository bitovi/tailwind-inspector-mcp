import type { SlotArgValue } from '../../types';

export interface SlotFieldProps {
  /** Prop name, used for display and as "Click to set X" placeholder */
  name: string;
  /** Current value — text content, raw HTML, or an assigned component */
  value: SlotArgValue | undefined;
  onChange: (value: SlotArgValue) => void;
  /** Whether this specific field is the current receptive target (teal glow) */
  isReceptive?: boolean;
  /** Call to arm this field as the receptive target */
  onArmSelf?: () => void;
}
