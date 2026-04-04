import { extractStyles, applyStylesToHost, injectChildStyles } from './style-cloner';
import { collectIframeCss } from './css-collector';

export class AdaptiveIframe extends HTMLElement {
  static observedAttributes = ['src', 'srcdoc'];

  private shadow: ShadowRoot;
  private ghostEl: HTMLDivElement;
  private hiddenIframe: HTMLIFrameElement;
  private loadTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pollId: ReturnType<typeof setInterval> | null = null;
  private hasLoaded = false;
  private _loadedDispatched = false;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });

    // Ghost content container — visible placeholder.
    // display:contents removes its box from the tree so the host element's
    // own display value (block, inline, inline-block) drives layout directly.
    this.ghostEl = document.createElement('div');
    this.ghostEl.setAttribute('part', 'ghost');
    this.ghostEl.style.display = 'contents';

    const style = document.createElement('style');
    style.textContent = `
      iframe {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        border: none;
        opacity: 0;
        transition: opacity 0.2s ease-in;
        pointer-events: none;
      }
      iframe.visible {
        opacity: 1;
        pointer-events: auto;
      }
    `;
    this.shadow.append(style, this.ghostEl);

    // Hidden iframe for style extraction — positioned at (0,0) and made
    // invisible via opacity:0 rather than visibility:hidden or a large negative
    // offset.  Browsers skip CSS custom-property resolution for
    // visibility:hidden iframes and for elements scrolled far off-screen, so
    // computed colors (e.g. --secondary) come back wrong.  opacity:0 keeps the
    // element fully rendered while remaining invisible to the user.
    this.hiddenIframe = document.createElement('iframe');
    Object.assign(this.hiddenIframe.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '800px',
      height: '600px',
      opacity: '0',
      pointerEvents: 'none',
      border: 'none',
      zIndex: '-999999',
    });
    this.hiddenIframe.addEventListener('load', () => this.onIframeLoad());
    this.hiddenIframe.addEventListener('error', () => this.reportError('Failed to load iframe'));
  }

  private observer: MutationObserver | null = null;

  connectedCallback() {
    document.body.appendChild(this.hiddenIframe);
    this.syncIframeWidth();
    this.triggerLoad();
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }
    this.hiddenIframe.remove();
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      this.syncIframeWidth();
      this.triggerLoad();
    }
  }

  /** Sync the hidden iframe width to the host element's container width so
   *  the story renders at the correct size from the start. */
  private syncIframeWidth() {
    const hostWidth = this.clientWidth;
    if (hostWidth > 0) {
      this.hiddenIframe.style.width = hostWidth + 'px';
    }
  }

  private triggerLoad() {
    // Clean up any previous observer
    this.observer?.disconnect();
    this.observer = null;

    // Clear any pending load timeout and polling interval
    if (this.loadTimeoutId) clearTimeout(this.loadTimeoutId);
    if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }
    this.hasLoaded = false;
    this._loadedDispatched = false;

    const src = this.getAttribute('src');
    const srcdoc = this.getAttribute('srcdoc');
    if (srcdoc != null) {
      this.hiddenIframe.srcdoc = srcdoc;
    } else if (src) {
      this.hiddenIframe.src = src;
    }

    // Set a timeout to detect if the iframe never loads (e.g., wrong URL, network error)
    this.loadTimeoutId = setTimeout(() => {
      if (!this.hasLoaded) {
        const src = this.getAttribute('src');
        this.reportError(`Story failed to load (${src || 'unknown'}) — check that Storybook is running on port 6006+`);
      }
    }, 20000);
  }

  private onIframeLoad() {
    // Ignore load events from the initial blank iframe (no src/srcdoc set yet)
    const src = this.getAttribute('src');
    const srcdoc = this.getAttribute('srcdoc');
    if (!src && srcdoc == null) return;

    // Clear the load timeout since the iframe loaded successfully
    if (this.loadTimeoutId) {
      clearTimeout(this.loadTimeoutId);
      this.loadTimeoutId = null;
    }
    this.hasLoaded = true;

    const doc = this.hiddenIframe.contentDocument;
    if (!doc) {
      console.warn('[AdaptiveIframe] iframe loaded but contentDocument is null');
      return;
    }

    // Strip body/html margin and padding
    const resetStyle = doc.createElement('style');
    resetStyle.textContent =
      'body,html{margin:0!important;padding:0!important}';
    doc.head.appendChild(resetStyle);

    // For srcdoc iframes, content is available immediately
    if (srcdoc != null) {
      this.extractAndApply(doc);
      return;
    }

    // For Storybook src iframes, the story component renders asynchronously
    // after the page load event. Wait for a non-spinner child in #storybook-root.
    this.waitForStoryContent(doc);
  }

  /**
   * Sends an updateStoryArgs message to the Storybook iframe via the channel.
   * This avoids a full page reload and bypasses Storybook's URL args validation
   * (which rejects values containing special characters like periods).
   */
  updateArgs(storyId: string, updatedArgs: Record<string, unknown>) {
    const win = this.hiddenIframe.contentWindow;
    if (!win) return;
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
    // Re-extract after Storybook re-renders with updated args
    setTimeout(() => {
      const doc = this.hiddenIframe.contentDocument;
      if (doc) this.extractAndApply(doc);
    }, 300);
  }

  /**
   * Waits for the actual story content to appear in #storybook-root.
   * Storybook initially shows a loading spinner; we need the real component.
   * After the first extraction, the observer stays active to re-extract
   * when the story re-renders (e.g. after an updateArgs call).
   */
  private waitForStoryContent(doc: Document) {
    // Clean up any previous observer and polling interval
    this.observer?.disconnect();
    this.observer = null;
    if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }

    let extracted = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20; // ~10 seconds at 500ms intervals

    const tryExtract = () => {
      const root = this.findStoryRoot(doc);
      if (root) {
        extracted = true;
        this.extractAndApply(doc);
        // Done — disconnect the observer
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }
        return true;
      }
      return false;
    };

    // Check if content is already there
    if (tryExtract()) return;

    // Observe #storybook-root (or body as fallback) for child changes
    const storybookRoot = doc.querySelector('#storybook-root');
    const target = storybookRoot ?? doc.body;
    if (!target) return;

    const observer = new MutationObserver((mutations) => {
      if (!extracted) {
        attempts++;
        if (tryExtract()) {
          if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }
          return;
        }
        // Give up after MAX_ATTEMPTS mutations without finding content
        if (attempts >= MAX_ATTEMPTS) {
          observer.disconnect();
          this.observer = null;
          if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }
          console.error(`[AdaptiveIframe] gave up after ${attempts} mutations — story never appeared. src=${this.getAttribute('src')}`);
          this.reportError('Story did not render — component may not exist or Storybook story file has an error');
        }
      }
    });
    this.observer = observer;
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Also observe body for portal-rendered content (e.g. Radix dialogs)
    if (storybookRoot && doc.body && storybookRoot !== doc.body) {
      observer.observe(doc.body, { childList: true });
    }

    // Polling fallback — Angular renders content asynchronously and may not
    // trigger MutationObserver if the doc reference goes stale.  Re-read the
    // live contentDocument on each poll to handle iframe navigations.
    let pollCount = 0;
    this.pollId = setInterval(() => {
      if (extracted) { clearInterval(this.pollId!); this.pollId = null; return; }
      pollCount++;
      // Re-read live document in case the iframe navigated
      const liveDoc = this.hiddenIframe.contentDocument;
      // Try extraction against the live document
      if (liveDoc) {
        const root = this.findStoryRoot(liveDoc);
        if (root) {
          extracted = true;
          this.extractAndApply(liveDoc);
          if (this.observer) { this.observer.disconnect(); this.observer = null; }
          clearInterval(this.pollId!); this.pollId = null;
          return;
        }
      }
      if (pollCount >= 40) {
        clearInterval(this.pollId!); this.pollId = null;
      }
    }, 1000);

    // Safety timeout — disconnect if story never renders
    setTimeout(() => {
      if (!extracted && this.observer === observer) {
        this.observer.disconnect();
        this.observer = null;
        if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }
        console.error(`[AdaptiveIframe] 40s timeout — story never rendered. src=${this.getAttribute('src')}`);
        this.reportError('Story did not render — component may not exist or Storybook story file has an error');
      }
    }, 40000);
  }

  /**
   * Finds the story's root element, skipping Storybook's loading spinner.
   * Also detects portal-rendered content (e.g. Radix UI dialogs, Headless UI)
   * that mounts outside #storybook-root onto document.body.
   */
  private findStoryRoot(doc: Document): Element | null {
    const storybookRoot = doc.querySelector('#storybook-root');
    if (storybookRoot) {
      // Skip Storybook infrastructure elements (spinner, highlights addon, etc.)
      for (const child of storybookRoot.children) {
        if (child.classList.contains('sb-loader')) continue;
        if (child.id && (child.id.startsWith('storybook-') || child.id.startsWith('sb-'))) continue;
        // Angular Storybook adds <storybook-root> before Angular bootstraps the
        // component template inside it.  Skip empty elements so the
        // MutationObserver keeps waiting for content to render.
        // But preserve elements with classes — they're real rendered components
        // (e.g. a <button> checkbox with no text/children).
        if (child.children.length === 0 && !child.textContent?.trim() && !(child as HTMLElement).className) {
          return null;
        }
        return child;
      }

      // #storybook-root is empty — check for portaled content that renders
      // as a direct child of body outside of #storybook-root.
      const portalEl = this.findPortalContent(doc);
      if (portalEl) {
        return portalEl;
      }

      return null;
    }
    return doc.body.firstElementChild;
  }

  /** Tags that are Storybook infrastructure — never portal content. */
  private static INFRA_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT']);

  /** IDs that are Storybook infrastructure — never portal content. */
  private static INFRA_IDS = new Set(['storybook-root', 'storybook-docs', 'sb-addons-root']);

  /** Class prefixes that indicate Storybook infrastructure elements on body. */
  private static INFRA_CLASS_PREFIXES = ['sb-'];

  /**
   * Generic portal detection: finds the first direct child of body that isn't
   * Storybook infrastructure (scripts, styles, #storybook-root, etc.).
   * Works for Radix, Headless UI, Floating UI, MUI, Chakra, Ark UI, and any
   * library that portals to body.
   */
  private findPortalContent(doc: Document): Element | null {
    const win = doc.defaultView ?? window;
    for (const child of doc.body.children) {
      if (AdaptiveIframe.INFRA_TAGS.has(child.tagName)) continue;
      if (child.id && AdaptiveIframe.INFRA_IDS.has(child.id)) continue;
      // Skip any element whose ID starts with storybook- or sb- (addons, highlights, etc.)
      if (child.id && (child.id.startsWith('storybook-') || child.id.startsWith('sb-'))) continue;

      // Skip Storybook infrastructure elements (sb-preparing-story, sb-wrapper, etc.)
      if (child.className && typeof child.className === 'string') {
        const classes = child.className.split(/\s+/);
        if (classes.some(cls => AdaptiveIframe.INFRA_CLASS_PREFIXES.some(p => cls.startsWith(p)))) {
          continue;
        }
      }

      // Skip elements that are hidden via computed style (not just inline style)
      if (child instanceof HTMLElement) {
        const computed = win.getComputedStyle(child);
        if (computed.display === 'none' || computed.visibility === 'hidden') continue;
      }

      // Skip empty elements with no meaningful content (e.g. aria-live <span>)
      if (!child.children.length && !child.textContent?.trim()) continue;

      return child;
    }
    return null;
  }

  /**
   * Returns the raw outerHTML of the story root element with original
   * class names preserved — no inline styles on children.
   *
   * Styling is provided by ghostCss (collected from iframe stylesheets)
   * which travels alongside this HTML and is injected as a <style> tag
   * inside a shadow DOM wrapper wherever the ghost is rendered.
   */
  getComponentHtml(): string {
    const doc = this.hiddenIframe.contentDocument;
    if (!doc) return '';
    const root = this.findStoryRoot(doc);
    if (!root) return this.ghostEl.innerHTML;

    const clone = root.cloneNode(true) as HTMLElement;
    return clone.outerHTML;
  }

  /**
   * Returns the collected CSS from the iframe's stylesheets.
   * Used alongside getComponentHtml() for arming.
   */
  getComponentCss(): string {
    const doc = this.hiddenIframe.contentDocument;
    if (!doc) return '';
    return collectIframeCss(doc);
  }

  private extractAndApply(doc: Document) {
    const root = this.findStoryRoot(doc);
    const win = root ? (root.ownerDocument.defaultView ?? window) : window;
    if (!root) return;

    // Extract computed styles and apply to host (drives layout flow)
    const styles = extractStyles(root);

    // For portal content (position:fixed dialogs, etc.), strip viewport-relative
    // positioning and animation properties so the ghost renders inline and visible
    // in the card. Entry animations (e.g. Radix animate-in/fade-in-0) can leave
    // opacity at 0 at extraction time.
    if (styles['position'] === 'fixed' || styles['position'] === 'absolute') {
      const portalStripProps = [
        // Positioning
        'position', 'left', 'right', 'top', 'bottom',
        'inset', 'inset-block', 'inset-block-start', 'inset-block-end',
        'inset-inline', 'inset-inline-start', 'inset-inline-end',
        'transform', 'translate', 'z-index',
        // Animation / transition (entry animations can leave opacity=0)
        'opacity',
        'animation', 'animation-name', 'animation-duration', 'animation-delay',
        'animation-fill-mode', 'animation-timing-function',
        'transition', 'transition-property', 'transition-duration',
        'transition-delay', 'transition-timing-function',
      ];
      for (const prop of portalStripProps) {
        delete styles[prop];
      }
    }

    applyStylesToHost(this, styles, parseInt(this.hiddenIframe.style.width) || 800);

    // Clone story content into the ghost — use innerHTML (not outerHTML)
    // because the host element already carries the root's styles (padding,
    // background, border, etc.).  outerHTML would duplicate them.
    this.ghostEl.innerHTML = root.innerHTML;

    // Inline computed styles on every cloned child for visual fidelity
    const rootChildren = root.children;
    const ghostChildren = this.ghostEl.children;
    const len = Math.min(rootChildren.length, ghostChildren.length);
    for (let i = 0; i < len; i++) {
      injectChildStyles(rootChildren[i], ghostChildren[i]);
    }

    // Signal first successful render so the load queue can free its slot.
    if (!this._loadedDispatched) {
      this._loadedDispatched = true;
      this.dispatchEvent(new CustomEvent('iframe-loaded'));
    }

    // Emit extracted ghost data for caching — fires on every extraction
    // (initial load AND arg-change re-renders) so the cache stays fresh.
    const ghostHtml = this.getComponentHtml();
    const ghostCss = collectIframeCss(doc);
    const storyBackground = getComputedStyle(doc.body).backgroundColor;

    // Measure the component's intrinsic (content-fit) dimensions for
    // thumbnail scaling.  Block-level components expand to fill their
    // parent, so we briefly set `width: fit-content` on the root to
    // collapse it to the component's natural width before reading sizes.
    const measurableRoot = root as HTMLElement;
    const prevWidth = measurableRoot.style.width;
    const prevDisplay = measurableRoot.style.display;
    measurableRoot.style.width = 'fit-content';
    // Ensure this is a block formatting context so fit-content applies
    if (!prevDisplay) measurableRoot.style.display = 'block';
    const naturalWidth = measurableRoot.scrollWidth;
    const naturalHeight = measurableRoot.scrollHeight;
    // Restore original styles
    measurableRoot.style.width = prevWidth;
    measurableRoot.style.display = prevDisplay;

    this.dispatchEvent(new CustomEvent('ghost-extracted', {
      detail: { ghostHtml, ghostCss, hostStyles: styles, storyBackground, naturalWidth, naturalHeight },
    }));
  }

  private _error: string | null = null;

  /** Report an error that occurred during loading or rendering. */
  private reportError(message: string) {
    this._error = message;
    console.error(`[AdaptiveIframe] ${message}`);
    this.dispatchEvent(new CustomEvent('iframe-error', { detail: { message } }));
  }

  /** Get any error message from the last load attempt. */
  getError(): string | null {
    return this._error;
  }

  /** Clear the error state (e.g. when retrying). */
  clearError() {
    this._error = null;
  }
}
