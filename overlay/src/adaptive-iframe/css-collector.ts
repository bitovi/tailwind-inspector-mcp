import { rewriteRootToHost, propertyRulesToFallbacks } from '../../../shared/css-utils';

/**
 * Collect all non-Storybook CSS from an iframe document.
 * Rewrites `:root` selectors to `:host` for shadow DOM usage and
 * prepends @property fallbacks so Tailwind v4 vars work in shadow DOM.
 */
export function collectIframeCss(doc: Document): string {
  const parts: string[] = [];
  for (const sheet of doc.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const text = rule.cssText;
        if (text.includes('.sb-') || text.includes('#storybook-')) continue;
        if (text.includes('Nunito Sans')) continue;
        parts.push(text);
      }
    } catch {
      // Cross-origin stylesheet — skip
    }
  }
  const raw = rewriteRootToHost(parts.join('\n'));
  // Prepend @property fallbacks so Tailwind v4 vars work in shadow DOM
  const fallbacks = propertyRulesToFallbacks(raw);
  return fallbacks ? `${fallbacks}\n${raw}` : raw;
}
