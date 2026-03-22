import { toPng } from 'html-to-image';

/**
 * Converts an HTML string (with inlined styles) to a PNG data URL.
 * Uses the same html-to-image library as overlay/src/screenshot.ts.
 *
 * Renders the HTML in a temporary offscreen DOM element, then
 * captures it with toPng (which is cross-origin safe because
 * it re-serializes computed styles rather than using an iframe).
 */
export async function rasterizeHtml(
  html: string,
  targetWidth?: number,
  targetHeight?: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  // Render offscreen to measure natural size
  const ghost = document.createElement('div');
  ghost.style.cssText =
    'position:fixed;left:0;top:0;z-index:999999;pointer-events:none;visibility:visible;';
  ghost.innerHTML = html;
  document.body.appendChild(ghost);

  try {
    const naturalWidth = ghost.offsetWidth || 100;
    const naturalHeight = ghost.offsetHeight || 40;

    // When target dimensions are provided, increase pixelRatio so the
    // output PNG has enough pixels to stay crisp at the display size.
    const scaleX = targetWidth ? targetWidth / naturalWidth : 1;
    const scaleY = targetHeight ? targetHeight / naturalHeight : 1;
    const pixelRatio = Math.max(scaleX, scaleY, 1);

    const dataUrl = await toPng(ghost, {
      skipFonts: true,
      width: naturalWidth,
      height: naturalHeight,
      pixelRatio,
    });

    // Return the target dimensions when provided so the caller can
    // set Fabric scaleX/scaleY = 1 (the PNG already has the right pixels).
    const outWidth = targetWidth ?? naturalWidth;
    const outHeight = targetHeight ?? naturalHeight;
    return { dataUrl, width: outWidth, height: outHeight };
  } finally {
    ghost.remove();
  }
}
