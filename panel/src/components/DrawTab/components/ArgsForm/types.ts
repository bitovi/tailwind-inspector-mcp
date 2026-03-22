import type { ArgType } from '../../types';

export interface ArgsFormProps {
  argTypes: Record<string, ArgType>;
  args: Record<string, unknown>;
  onArgsChange: (args: Record<string, unknown>) => void;
}
