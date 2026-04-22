/**
 * Preserve the user's scroll position when the page layout changes.
 *
 * When the sidebar opens, body children move into a fixed wrapper that
 * becomes the new scroll container. The original window scroll offset is
 * lost. This helper captures the scroll percentage before the move and
 * restores it on the new container afterward.
 *
 * On page refresh the browser's scroll restoration may not have run yet
 * when the sidebar restructures the DOM, so `captureScrollPosition()`
 * would capture 0.  To handle this we persist the scroll ratio to
 * sessionStorage on `beforeunload` and read it back on the next load.
 *
 * Usage:
 *   const restore = captureScrollPosition();
 *   // ... restructure DOM ...
 *   restore(newScrollContainer);
 */

const SCROLL_KEY = 'tw-sidebar-scroll-ratio';

/** Capture current scroll percentage of the page. */
export function captureScrollPosition(): (target: Element) => void {
	const scrollEl = document.scrollingElement ?? document.documentElement;
	const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
	let ratio = maxScroll > 0 ? scrollEl.scrollTop / maxScroll : 0;

	// On a fresh page load the browser may not have restored scroll yet,
	// so the live value is 0.  Fall back to the value we saved before unload.
	if (ratio === 0) {
		const saved = getSavedScrollRatio();
		if (saved !== null) ratio = saved;
	}

	return (target: Element) => {
		const tryRestore = (): boolean => {
			const newMax = target.scrollHeight - target.clientHeight;
			if (newMax > 0) {
				target.scrollTop = Math.round(ratio * newMax);
				return true;
			}
			return false;
		};

		// Try immediately after a rAF; if content hasn't laid out yet, watch
		// the wrapper's children with a ResizeObserver — the wrapper itself is
		// fixed-size so won't trigger, but its children grow as React renders.
		requestAnimationFrame(() => {
			if (tryRestore()) return;

			const ro = new ResizeObserver(() => {
				if (tryRestore()) ro.disconnect();
			});
			// Observe existing children; also watch for children being added
			const observeChildren = () => Array.from(target.children).forEach(c => ro.observe(c));
			observeChildren();

			// If no children yet, use a MutationObserver to catch them being added
			const mo = new MutationObserver(() => {
				observeChildren();
				if (tryRestore()) { ro.disconnect(); mo.disconnect(); }
			});
			mo.observe(target, { childList: true, subtree: false });

			// Safety: disconnect after 5s to avoid leaking observers
			setTimeout(() => { ro.disconnect(); mo.disconnect(); }, 5000);
		});
	};
}

/**
 * Save the current scroll ratio to sessionStorage.
 * Call this from a `beforeunload` handler.
 * @param wrapper  If the sidebar wrapper is active, pass it so we read
 *                 its scrollTop instead of the (hidden) document.
 */
export function saveScrollRatio(wrapper?: Element | null): void {
	try {
		const el = wrapper ?? document.scrollingElement ?? document.documentElement;
		const max = el.scrollHeight - el.clientHeight;
		const ratio = max > 0 ? el.scrollTop / max : 0;
		sessionStorage.setItem(SCROLL_KEY, String(ratio));
	} catch { /* quota / security errors */ }
}

/** Read back the ratio saved by `saveScrollRatio`, then clear it. */
export function getSavedScrollRatio(): number | null {
	try {
		const raw = sessionStorage.getItem(SCROLL_KEY);
		if (raw !== null) {
			sessionStorage.removeItem(SCROLL_KEY);
			const n = parseFloat(raw);
			return Number.isFinite(n) ? n : null;
		}
	} catch { /* ignore */ }
	return null;
}
