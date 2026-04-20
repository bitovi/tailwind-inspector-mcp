export interface ThemeOverride {
  variable: string;   // CSS custom property name, e.g. "--color-blue-500"
  value: string;       // new value, e.g. "#3b82f6"
  lineHeight?: string; // v3 fontSize only: paired line-height value
}

export interface ThemeTabProps {
  tailwindConfig: any;
  tailwindVersion: 3 | 4;
  onStageThemeChange: (description: string) => void;
}
