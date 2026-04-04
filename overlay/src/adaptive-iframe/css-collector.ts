/**
 * Collects all CSS from an iframe's document.styleSheets, filtering out
 * Storybook framework junk. Returns a single CSS string suitable for
 * injection into a shadow DOM wrapper alongside ghost HTML.
 */
import { rewriteRootToHost } from '../../../shared/css-utils';
export function collectIframeCss(doc: Document): string {
  const parts: string[] = [];

  for (const sheet of doc.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const text = rule.cssText;
        // Skip Storybook framework CSS
        if (text.includes('.sb-') || text.includes('#storybook-')) continue;
        // Skip Storybook font faces (Nunito Sans)
        if (text.includes('Nunito Sans')) continue;
        parts.push(text);
      }
    } catch {
      // Cross-origin stylesheet — skip (shouldn't happen with proxy)
    }
  }

  return rewriteRootToHost(parts.join('\n'));
}
