/**
 * Creates a StoryExtractor — a function-based API for loading Storybook
 * stories in a hidden iframe and extracting ghost HTML + CSS.
 *
 * Replaces the AdaptiveIframe custom element with a plain function:
 * no shadow DOM, no attribute observation, no custom element registration.
 */
import { rewriteRootToHost, propertyRulesToFallbacks } from '../../shared/css-utils';
import { tryAngularDirectUpdate } from './angular/storybook';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StoryExtractorOptions {
  /** Element to append the iframe into. Defaults to document.body (hidden). */
  iframeContainer?: HTMLElement;
  /** Iframe width for layout computation (default: 800). */
  width?: number;
  /** Iframe height (default: 600). */
  height?: number;
}

export interface GhostData {
  ghostHtml: string;
  ghostCss: string;
  storyBackground: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface ExtractCallbacks {
  onExtracted: (data: GhostData) => void;
  onLoaded?: () => void;
  onError?: (error: string) => void;
}

export interface NavigateOptions extends ExtractCallbacks {
  storyId: string;
  args?: Record<string, unknown>;
}

export interface StoryExtractor {
  /** Load a story by full URL. Replaces any previous callbacks. */
  load: (src: string, callbacks: ExtractCallbacks) => void;
  /** Navigate to a story in-place via Storybook channel message (fast, no reload). */
  navigate: (options: NavigateOptions) => void;
  /** Push new arg values to the current story (no reload). Triggers onExtracted again. */
  updateArgs: (storyId: string, args: Record<string, unknown>) => void;
  /** Remove the iframe from the DOM and clean up all timers. */
  teardown: () => void;
}

// ── Storybook infrastructure filters ───────────────────────────────────────

const INFRA_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT']);
const INFRA_IDS = new Set(['storybook-root', 'storybook-docs', 'sb-addons-root']);
const INFRA_CLASS_PREFIXES = ['sb-'];

// ── CSS collection ─────────────────────────────────────────────────────────

function collectIframeCss(doc: Document): string {
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

// ── Factory ────────────────────────────────────────────────────────────────

export function createStoryExtractor(opts?: StoryExtractorOptions): StoryExtractor {
  const container = opts?.iframeContainer;
  const width = opts?.width ?? 800;
  const height = opts?.height ?? 600;

  // ── State ──────────────────────────────────────────────────────────────
  let observer: MutationObserver | null = null;
  let loadTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let settleTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let pollId: ReturnType<typeof setInterval> | null = null;
  let hasLoaded = false;
  let loadedDispatched = false;
  let currentSrc: string | null = null;
  let callbacks: ExtractCallbacks | null = null;
  let tornDown = false;

  // ── Create iframe ──────────────────────────────────────────────────────
  const iframe = document.createElement('iframe');

  if (container) {
    // Visible mode — fill the container
    Object.assign(iframe.style, {
      position: 'relative',
      left: 'auto',
      top: 'auto',
      width: '100%',
      height: '100%',
      opacity: '1',
      pointerEvents: 'auto',
      border: 'none',
      zIndex: 'auto',
    });
    container.appendChild(iframe);
  } else {
    // Hidden mode — invisible on document.body.
    // Uses opacity:0 rather than visibility:hidden because browsers skip
    // CSS custom-property resolution for visibility:hidden iframes.
    const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug-extractor');
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: `${width}px`,
      height: `${height}px`,
      opacity: debug ? '1' : '0',
      pointerEvents: debug ? 'auto' : 'none',
      border: debug ? '2px solid red' : 'none',
      zIndex: debug ? '999999' : '-999999',
    });
    document.body.appendChild(iframe);
  }

  iframe.addEventListener('load', onIframeLoad);
  iframe.addEventListener('error', () => reportError('Failed to load iframe'));

  // ── Story root detection ───────────────────────────────────────────────

  function findStoryRoot(doc: Document): Element | null {
    const storybookRoot = doc.querySelector('#storybook-root');
    if (storybookRoot) {
      for (const child of storybookRoot.children) {
        if (child.classList.contains('sb-loader')) continue;
        if (child.id && (child.id.startsWith('storybook-') || child.id.startsWith('sb-'))) continue;
        // Skip empty elements without classes (Angular pre-bootstrap placeholder)
        if (child.children.length === 0 && !child.textContent?.trim() && !(child as HTMLElement).className) {
          return null;
        }
        return child;
      }

      // Empty #storybook-root — check for portal content
      const portalEl = findPortalContent(doc);
      if (portalEl) return portalEl;

      return null;
    }
    return doc.body.firstElementChild;
  }

  function findPortalContent(doc: Document): Element | null {
    const win = doc.defaultView ?? window;
    for (const child of doc.body.children) {
      if (INFRA_TAGS.has(child.tagName)) continue;
      if (child.id && INFRA_IDS.has(child.id)) continue;
      if (child.id && (child.id.startsWith('storybook-') || child.id.startsWith('sb-'))) continue;

      if (child.className && typeof child.className === 'string') {
        const classes = child.className.split(/\s+/);
        if (classes.some(cls => INFRA_CLASS_PREFIXES.some(p => cls.startsWith(p)))) continue;
      }

      if (child instanceof HTMLElement) {
        const computed = win.getComputedStyle(child);
        if (computed.display === 'none' || computed.visibility === 'hidden') continue;
      }

      if (!child.children.length && !child.textContent?.trim()) continue;

      return child;
    }
    return null;
  }

  // ── Cleanup helper ─────────────────────────────────────────────────────

  function cleanupWatchers() {
    observer?.disconnect();
    observer = null;
    if (pollId) { clearInterval(pollId); pollId = null; }
    if (loadTimeoutId) { clearTimeout(loadTimeoutId); loadTimeoutId = null; }
    if (settleTimeoutId) { clearTimeout(settleTimeoutId); settleTimeoutId = null; }
  }

  // ── Extraction ─────────────────────────────────────────────────────────

  function extractGhost(doc: Document) {
    if (tornDown) return;
    const root = findStoryRoot(doc);
    if (!root) return;

    // Signal first successful render
    if (!loadedDispatched) {
      loadedDispatched = true;
      callbacks?.onLoaded?.();
    }

    // Ghost HTML — outerHTML of the story root with original class names
    const clone = root.cloneNode(true) as HTMLElement;
    const ghostHtml = clone.outerHTML;

    // Ghost CSS — collected from iframe stylesheets with @property fallbacks
    const ghostCss = collectIframeCss(doc);

    // Story background
    const storyBackground = getComputedStyle(doc.body).backgroundColor;

    // Measure natural dimensions
    const measurableRoot = root as HTMLElement;
    const prevWidth = measurableRoot.style.width;
    const prevDisplay = measurableRoot.style.display;
    measurableRoot.style.width = 'fit-content';
    if (!prevDisplay) measurableRoot.style.display = 'block';
    const naturalWidth = measurableRoot.scrollWidth;
    const naturalHeight = measurableRoot.scrollHeight;
    measurableRoot.style.width = prevWidth;
    measurableRoot.style.display = prevDisplay;

    callbacks?.onExtracted({
      ghostHtml,
      ghostCss,
      storyBackground,
      naturalWidth,
      naturalHeight,
    });
  }

  // ── Iframe load handling ───────────────────────────────────────────────

  function onIframeLoad() {
    if (tornDown) return;
    if (!currentSrc) return; // Ignore load from initial blank iframe

    if (loadTimeoutId) { clearTimeout(loadTimeoutId); loadTimeoutId = null; }
    hasLoaded = true;

    const doc = iframe.contentDocument;
    if (!doc) {
      console.warn('[StoryExtractor] iframe loaded but contentDocument is null');
      return;
    }

    // Strip body/html margins
    const resetStyle = doc.createElement('style');
    resetStyle.textContent = 'body,html{margin:0!important;padding:0!important}';
    doc.head.appendChild(resetStyle);

    waitForStoryContent(doc);
  }

  function waitForStoryContent(doc: Document) {
    cleanupWatchers();

    let extracted = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20;

    const tryExtract = (): boolean => {
      const root = findStoryRoot(doc);
      if (root) {
        extracted = true;
        extractGhost(doc);
        if (observer) { observer.disconnect(); observer = null; }
        return true;
      }
      return false;
    };

    if (tryExtract()) return;

    // Observe #storybook-root (or body) for child changes
    const storybookRoot = doc.querySelector('#storybook-root');
    const target = storybookRoot ?? doc.body;
    if (!target) return;

    const obs = new MutationObserver(() => {
      if (extracted) return;
      attempts++;
      if (tryExtract()) {
        if (pollId) { clearInterval(pollId); pollId = null; }
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        obs.disconnect();
        observer = null;
        if (pollId) { clearInterval(pollId); pollId = null; }
        reportError('Story did not render — component may not exist or Storybook story file has an error');
      }
    });
    observer = obs;
    obs.observe(target, { childList: true, subtree: true, characterData: true });

    // Also observe body for portal content
    if (storybookRoot && doc.body && storybookRoot !== doc.body) {
      obs.observe(doc.body, { childList: true });
    }

    // Polling fallback for Angular
    let pollCount = 0;
    pollId = setInterval(() => {
      if (extracted) { clearInterval(pollId!); pollId = null; return; }
      pollCount++;
      const liveDoc = iframe.contentDocument;
      if (liveDoc) {
        const root = findStoryRoot(liveDoc);
        if (root) {
          extracted = true;
          extractGhost(liveDoc);
          if (observer) { observer.disconnect(); observer = null; }
          clearInterval(pollId!); pollId = null;
          return;
        }
      }
      if (pollCount >= 40) { clearInterval(pollId!); pollId = null; }
    }, 1000);

    // Safety timeout
    setTimeout(() => {
      if (!extracted && observer === obs) {
        obs.disconnect();
        observer = null;
        if (pollId) { clearInterval(pollId); pollId = null; }
        reportError('Story did not render — 40s timeout');
      }
    }, 40000);
  }

  // ── Error reporting ────────────────────────────────────────────────────

  function reportError(message: string) {
    console.error(`[StoryExtractor] ${message}`);
    callbacks?.onError?.(message);
  }

  // ── Public API ─────────────────────────────────────────────────────────

  function load(src: string, cbs: ExtractCallbacks) {
    if (tornDown) return;
    cleanupWatchers();
    callbacks = cbs;
    currentSrc = src;
    hasLoaded = false;
    loadedDispatched = false;
    iframe.src = src;

    loadTimeoutId = setTimeout(() => {
      if (!hasLoaded) {
        reportError(`Story failed to load (${src}) — check that Storybook is running`);
      }
    }, 20000);
  }

  function navigate(options: NavigateOptions) {
    if (tornDown) return;
    const { storyId, onExtracted, onLoaded, onError } = options;
    callbacks = { onExtracted, onLoaded, onError };

    // If no story has loaded yet, do a full load
    if (!hasLoaded) {
      const src = `/storybook/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story&vybit-ghost=1`;
      load(src, callbacks);
      return;
    }

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) {
      reportError('Cannot navigate: iframe not available');
      return;
    }

    cleanupWatchers();
    loadedDispatched = false;

    const storybookRoot = doc.querySelector('#storybook-root');
    if (!storybookRoot) {
      reportError('Cannot navigate: #storybook-root not found');
      return;
    }

    // Send setCurrentStory via Storybook channel
    win.postMessage(
      JSON.stringify({
        key: 'storybook-channel',
        event: { type: 'setCurrentStory', args: [{ storyId }] },
      }),
      '*',
    );

    // Watch for DOM changes, debounce until settled
    let settled = false;
    const obs = new MutationObserver(() => {
      if (settled) return;
      if (settleTimeoutId) clearTimeout(settleTimeoutId);
      settleTimeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        obs.disconnect();
        observer = null;
        settleTimeoutId = null;
        extractGhost(doc);
      }, 200);
    });

    observer = obs;
    obs.observe(storybookRoot, { childList: true, subtree: true, characterData: true });
    if (doc.body && storybookRoot !== doc.body) {
      obs.observe(doc.body, { childList: true });
    }
  }

  function updateArgsMethod(storyId: string, updatedArgs: Record<string, unknown>) {
    console.log('[StoryExtractor] updateArgs called', { storyId, updatedArgs, tornDown, hasWin: !!iframe.contentWindow, iframeSrc: iframe.src });
    if (tornDown) return;
    const win = iframe.contentWindow;
    if (!win) return;

    // Try Angular direct update first (postMessage doesn't trigger Angular CD)
    const angularHandled = tryAngularDirectUpdate(iframe, updatedArgs);

    if (!angularHandled) {
      // React / generic Storybook: use postMessage channel
      win.postMessage(
        JSON.stringify({
          key: 'storybook-channel',
          event: {
            type: 'updateStoryArgs',
            args: [{ storyId, updatedArgs }],
          },
        }),
        '*',
      );
    }

    // Re-extract after Storybook re-renders
    setTimeout(() => {
      const doc = iframe.contentDocument;
      const root = doc?.querySelector('#storybook-root');
      console.log('[StoryExtractor] re-extracting after updateArgs', { hasDoc: !!doc, angularHandled, rootHtml: root?.innerHTML?.substring(0, 300) });
      if (doc) extractGhost(doc);
    }, 300);
  }

  function teardown() {
    if (tornDown) return;
    tornDown = true;
    cleanupWatchers();
    iframe.removeEventListener('load', onIframeLoad);
    iframe.remove();
    callbacks = null;
  }

  return {
    load,
    navigate,
    updateArgs: updateArgsMethod,
    teardown,
  };
}
