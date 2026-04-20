// Shared interface for Tailwind version adapters.
// Both v3 and v4 adapters implement this contract so the rest of
// the server code is version-agnostic.

export interface TailwindThemeSubset {
  tailwindVersion: 3 | 4;
  spacing: Record<string, string>;
  colors: Record<string, unknown>;
  fontSize: Record<string, unknown>;
  fontSizeLineHeight?: Record<string, string>; // v4 only: --text-*--line-height values
  fontWeight: Record<string, unknown>;
  borderRadius: Record<string, string>;
  otherVars?: Record<string, string>; // v4 only: unrecognized CSS custom properties
}

export interface TailwindAdapter {
  readonly version: 3 | 4;
  resolveTailwindConfig(): Promise<TailwindThemeSubset>;
  generateCssForClasses(classes: string[]): Promise<string>;
}
