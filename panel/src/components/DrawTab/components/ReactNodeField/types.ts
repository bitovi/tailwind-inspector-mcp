import type { ReactNodeArgValue, ArmedComponentData } from '../../types';

export interface ReactNodeFieldProps {
  /** Prop name, used for display and as "Click to set X" placeholder */
  name: string;
  /** Current value — text content, raw HTML, or an assigned component */
  value: ReactNodeArgValue | undefined;
  onChange: (value: ReactNodeArgValue) => void;
  /** When non-null, a component is armed and this field is receptive */
  armedComponentData?: ArmedComponentData | null;
  /** Call to disarm the armed component after assignment */
  onDisarm?: () => void;
}
