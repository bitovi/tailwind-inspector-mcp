import { ThemeTabV3 } from './ThemeTabV3';
import { ThemeTabV4 } from './ThemeTabV4';
import type { ThemeTabProps } from './types';

export function ThemeTab({ tailwindConfig, tailwindVersion, onStageThemeChange }: ThemeTabProps) {
  if (tailwindVersion === 3) {
    return <ThemeTabV3 tailwindConfig={tailwindConfig} onStageThemeChange={onStageThemeChange} />;
  }
  return <ThemeTabV4 tailwindConfig={tailwindConfig} onStageThemeChange={onStageThemeChange} />;
}
