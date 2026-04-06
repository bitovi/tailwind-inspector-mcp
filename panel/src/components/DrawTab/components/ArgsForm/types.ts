import type { ArgType } from '../../types';

export interface ArgsFormProps {
  argTypes: Record<string, ArgType>;
  args: Record<string, unknown>;
  onArgsChange: (args: Record<string, unknown>) => void;
  /** Which prop name in this form is the receptive target (teal glow), if any */
  receptivePropName?: string | null;
  /** Call to arm a ReactNode field as the receptive target */
  onArmField?: (propName: string) => void;
  /** Call to clear the receptive state */
  onClearReceptive?: () => void;
}
