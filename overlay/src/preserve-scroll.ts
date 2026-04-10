/**
 * Preserve the user's scroll position when the page layout changes.
 *
 * When the sidebar opens, body children move into a fixed wrapper that
 * becomes the new scroll container. The original window scroll offset is
 * lost. This helper captures the scroll percentage before the move and
 * restores it on the new container afterward.
 *
 * Usage:
 *   const restore = captureScrollPosition();
 *   // ... restructure DOM ...
 *   restore(newScrollContainer);
 */

/** Capture current scroll percentage of the page. */
export function captureScrollPosition(): (target: Element) => void {
	const scrollEl = document.scrollingElement ?? document.documentElement;
	const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
	const ratio = maxScroll > 0 ? scrollEl.scrollTop / maxScroll : 0;

	return (target: Element) => {
		// Use rAF so the browser has laid out the new container first
		requestAnimationFrame(() => {
			const newMax = target.scrollHeight - target.clientHeight;
			if (newMax > 0) {
				target.scrollTop = Math.round(ratio * newMax);
			}
		});
	};
}
