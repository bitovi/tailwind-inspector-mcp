/**
 * CSS rewrite helpers for ghost rendering.
 *
 * Ghost CSS is collected from the Storybook iframe with `:root` and `body`
 * selectors rewritten to `:host` (see css-collector.ts) so CSS custom
 * properties and base styles (color, font, etc.) resolve inside shadow DOM
 * containers.  When rendering ghost CSS in a non-shadow-DOM context
 * (e.g. rasterisation, measuring), the rewrite must be reversed.
 */

/** Rewrite `:root` and `body` selectors to `:host` for shadow DOM contexts. */
export function rewriteRootToHost(css: string): string {
  return css
    .replace(/:root/g, ':host')
    .replace(/(^|[\s,{;])body(?=\s*[,{:])/gm, '$1:host');
}

/** Rewrite `:host` selectors back to `:root` for document contexts. */
export function rewriteHostToRoot(css: string): string {
  return css.replace(/:host/g, ':root');
}

/**
 * Reset inherited properties that leak from the panel's dark theme.
 * The panel body sets color (#e5e5e5), font-family (Inter), and
 * font-size (12px) — all of which inherit across shadow boundaries
 * and into child elements appended to document.body.
 *
 * Used as a :host rule in shadow DOM (ShadowGhost) and as inline
 * styles in document-context rendering (rasterizeHtml).
 */
export const GHOST_STYLE_RESET = 'color:CanvasText;font-family:system-ui,sans-serif;font-size:16px;line-height:1.5';

/**
 * Extract `@property` rules from CSS and convert them to explicit `:host *`
 * variable declarations.  `@property` is a document-level feature that
 * doesn't work inside shadow DOM `<style>` blocks — the `initial-value` is
 * never applied.  Tailwind v4 relies on `@property` for defaults like
 * `--tw-border-style: solid`, so without this conversion borders, shadows,
 * and rings break inside shadow DOM ghosts.
 *
 * Returns CSS text like `:host, :host * { --tw-border-style: solid; ... }`.
 */
export function propertyRulesToFallbacks(css: string): string {
  const regex = /@property\s+(--[\w-]+)\s*\{([^}]+)\}/g;
  const declarations: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css)) !== null) {
    const name = match[1];
    const body = match[2];
    const ivMatch = body.match(/initial-value:\s*([^;]+)/);
    if (ivMatch) {
      declarations.push(`${name}:${ivMatch[1].trim()}`);
    }
  }
  if (declarations.length === 0) return '';
  return `:host,:host *{${declarations.join(';')}}`;
}
