import type { ArgType, ArmedComponentData } from '../../types';

export interface ArgsFormProps {
  argTypes: Record<string, ArgType>;
  args: Record<string, unknown>;
  onArgsChange: (args: Record<string, unknown>) => void;
  armedComponentData?: ArmedComponentData | null;
  onDisarm?: () => void;
}
