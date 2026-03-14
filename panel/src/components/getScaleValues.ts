const SPECIAL_SPACING_ORDER: Record<string, number> = {
  px: 0.0625,
};

function spacingKeyOrder(k: string): number {
  if (!isNaN(Number(k))) return Number(k);
  return SPECIAL_SPACING_ORDER[k] ?? Infinity;
}

export function getScaleValues(prefix: string, themeKey: string | null, config: any): string[] {
  if (themeKey === 'spacing' && config?.spacing) {
    const keys = Object.keys(config.spacing);
    return keys
      .sort((a, b) => spacingKeyOrder(a) - spacingKeyOrder(b))
      .map((k) => `${prefix}${k}`);
  }
  if (themeKey === 'fontSize') {
    return ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl', 'text-7xl', 'text-8xl', 'text-9xl'];
  }
  if (themeKey === 'fontWeight') {
    return ['font-thin', 'font-extralight', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold', 'font-black'];
  }
  if (themeKey === 'borderRadius') {
    return ['rounded-none', 'rounded-sm', 'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full'];
  }
  return [];
}
