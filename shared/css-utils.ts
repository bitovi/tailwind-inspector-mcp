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
