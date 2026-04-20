/**
 * Convert any CSS color string to a hex value.
 * Uses a canvas 2D context as a universal color resolver.
 */
export function resolveToHex(cssColor: string): string {
  if (!cssColor || cssColor === 'transparent') return '#000000';

  // Already hex
  if (/^#[0-9a-fA-F]{6}$/.test(cssColor)) return cssColor;
  if (/^#[0-9a-fA-F]{3}$/.test(cssColor)) {
    const [, r, g, b] = cssColor.split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  // Use canvas to resolve any CSS color (rgb, hsl, oklch, etc.)
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#000000';

  ctx.fillStyle = cssColor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert a hex color (#rrggbb) to an oklch() CSS string.
 * Used when staging v4 theme changes (Tailwind v4 uses oklch in @theme blocks).
 */
export function hexToOklch(hex: string): string {
  // Parse hex to linear RGB
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  // sRGB to linear RGB
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // Linear RGB to XYZ (D65)
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
  const z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;

  // XYZ to LMS (using the M1 matrix for oklab)
  const l_ = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z;
  const m_ = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z;
  const s_ = 0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z;

  // Cube root
  const l_c = Math.cbrt(l_);
  const m_c = Math.cbrt(m_);
  const s_c = Math.cbrt(s_);

  // LMS to Oklab
  const L = 0.2104542553 * l_c + 0.7936177850 * m_c - 0.0040720468 * s_c;
  const A = 1.9779984951 * l_c - 2.4285922050 * m_c + 0.4505937099 * s_c;
  const B = 0.0259040371 * l_c + 0.7827717662 * m_c - 0.8086757660 * s_c;

  // Oklab to Oklch
  const C = Math.sqrt(A * A + B * B);
  let H = Math.atan2(B, A) * (180 / Math.PI);
  if (H < 0) H += 360;

  // Round for readability
  const Lr = Math.round(L * 1000) / 1000;
  const Cr = Math.round(C * 1000) / 1000;
  const Hr = Math.round(H * 100) / 100;

  return `oklch(${Lr} ${Cr} ${Hr})`;
}
