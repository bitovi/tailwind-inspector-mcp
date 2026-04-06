/**
 * Toggle between per-component iframe extraction (original) and
 * shared single-iframe extraction (experimental).
 *
 * When true, a single hidden iframe loads the first story via full page load,
 * then navigates to subsequent stories via Storybook's `setCurrentStory`
 * postMessage — skipping the full Storybook bootstrap for each component.
 *
 * Flip to false to revert to the original one-iframe-per-component approach.
 */
export const USE_SHARED_EXTRACTOR = true;
