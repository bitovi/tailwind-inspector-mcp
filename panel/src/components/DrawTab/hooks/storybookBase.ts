/**
 * Configurable base path for Storybook URLs.
 *
 * In the normal server setup, the Express server proxies Storybook at `/storybook/`.
 * In the static demo (GitHub Pages), the base path includes the deploy prefix,
 * e.g. `/tailwind-inspector-mcp/storybook`.
 *
 * The demo's Vite config defines `__STORYBOOK_BASE__` at build time.
 * When not defined (normal panel build), falls back to `/storybook`.
 */
declare const __STORYBOOK_BASE__: string;

export const STORYBOOK_BASE: string =
  typeof __STORYBOOK_BASE__ !== 'undefined' ? __STORYBOOK_BASE__ : '/storybook';
