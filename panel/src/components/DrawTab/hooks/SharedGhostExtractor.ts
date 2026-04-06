import type { AdaptiveIframe } from '../../../../../overlay/src/adaptive-iframe/adaptive-iframe';
import '../../../../../overlay/src/adaptive-iframe';
import { buildArgsUrl } from './useArgsUrl';

// ── Types ────────────────────────────────────────────────────────────────

export interface GhostData {
  ghostHtml: string;
  ghostCss: string;
  hostStyles: Record<string, string>;
  storyBackground?: string;
  naturalWidth?: number;
  naturalHeight?: number;
}

interface QueueEntry {
  storyId: string;
  resolve: (data: GhostData) => void;
  reject: (error: Error) => void;
}

// ── Singleton ────────────────────────────────────────────────────────────

let instance: SharedGhostExtractor | null = null;

/**
 * Returns the singleton SharedGhostExtractor. Created on first call and
 * reused for the lifetime of the page.
 */
export function getSharedGhostExtractor(): SharedGhostExtractor {
  if (!instance) {
    instance = new SharedGhostExtractor();
  }
  return instance;
}

// ── Class ────────────────────────────────────────────────────────────────

/**
 * Manages a single hidden `<adaptive-iframe>` that extracts ghost data
 * for all components sequentially. First story loads via full page src;
 * subsequent stories navigate in-place via Storybook's `setCurrentStory`
 * postMessage — skipping the full Storybook bootstrap each time.
 *
 * Falls back to src change if `setCurrentStory` times out, and disables
 * in-place navigation after 2 consecutive failures.
 */
class SharedGhostExtractor {
  private iframe: AdaptiveIframe;
  private el: HTMLElement;
  private queue: QueueEntry[] = [];
  private processing = false;
  private hasLoadedFirstStory = false;
  private navFailCount = 0;

  /** After this many consecutive navigateToStory timeouts, stop trying. */
  private static MAX_NAV_FAILURES = 2;

  /** Timeout for navigateToStory before falling back to src (ms). */
  private static NAV_TIMEOUT = 3000;

  /** Timeout for src-based loading (ms). */
  private static SRC_TIMEOUT = 25000;

  constructor() {
    const el = document.createElement('adaptive-iframe') as unknown as HTMLElement;
    el.style.setProperty('position', 'fixed', 'important');
    el.style.setProperty('width', '800px', 'important');
    el.style.setProperty('height', '600px', 'important');
    el.style.setProperty('left', '0', 'important');
    el.style.setProperty('top', '0', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('overflow', 'hidden', 'important');
    el.style.setProperty('z-index', '-999999', 'important');
    document.body.appendChild(el);

    this.el = el;
    this.iframe = el as unknown as AdaptiveIframe;
  }

  /**
   * Queue a ghost extraction for the given story. Returns a promise that
   * resolves with the ghost data once extraction is complete.
   */
  extract(storyId: string): Promise<GhostData> {
    return new Promise((resolve, reject) => {
      this.queue.push({ storyId, resolve, reject });
      this.processNext();
    });
  }

  /** Remove a pending extraction request (e.g. on component unmount). */
  cancel(storyId: string): void {
    this.queue = this.queue.filter(r => r.storyId !== storyId);
  }

  // ── Internal queue processing ──────────────────────────────────────

  private processNext(): void {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const entry = this.queue.shift()!;
    this.extractSingle(entry.storyId)
      .then(data => entry.resolve(data))
      .catch(err => entry.reject(err))
      .finally(() => {
        this.processing = false;
        this.processNext();
      });
  }

  private extractSingle(storyId: string): Promise<GhostData> {
    const useNav =
      this.hasLoadedFirstStory &&
      this.navFailCount < SharedGhostExtractor.MAX_NAV_FAILURES;

    if (useNav) {
      return this.extractViaNavigate(storyId);
    }
    return this.extractViaSrc(storyId);
  }

  // ── Navigate-based extraction (fast, no page reload) ───────────────

  private extractViaNavigate(storyId: string): Promise<GhostData> {
    return new Promise((resolve, reject) => {
      let cleaned = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        this.el.removeEventListener('ghost-extracted', onExtracted);
        this.el.removeEventListener('iframe-error', onError);
        if (timeoutId) clearTimeout(timeoutId);
      };

      const onExtracted = (e: Event) => {
        cleanup();
        this.hasLoadedFirstStory = true;
        this.navFailCount = 0; // navigateToStory worked
        const d = (e as CustomEvent).detail;
        resolve({
          ghostHtml: d.ghostHtml,
          ghostCss: d.ghostCss,
          hostStyles: d.hostStyles,
          storyBackground: d.storyBackground,
          naturalWidth: d.naturalWidth,
          naturalHeight: d.naturalHeight,
        });
      };

      const onError = (e: Event) => {
        cleanup();
        const msg = (e as CustomEvent<{ message: string }>).detail.message;
        reject(new Error(msg));
      };

      this.el.addEventListener('ghost-extracted', onExtracted);
      this.el.addEventListener('iframe-error', onError);

      this.iframe.navigateToStory(storyId);

      // Timeout → fall back to src
      timeoutId = setTimeout(() => {
        cleanup();
        this.navFailCount++;
        this.extractViaSrc(storyId).then(resolve, reject);
      }, SharedGhostExtractor.NAV_TIMEOUT);
    });
  }

  // ── Src-based extraction (reliable, full page load) ────────────────

  private extractViaSrc(storyId: string): Promise<GhostData> {
    return new Promise((resolve, reject) => {
      let cleaned = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        this.el.removeEventListener('ghost-extracted', onExtracted);
        this.el.removeEventListener('iframe-error', onError);
        if (timeoutId) clearTimeout(timeoutId);
      };

      const onExtracted = (e: Event) => {
        cleanup();
        this.hasLoadedFirstStory = true;
        const d = (e as CustomEvent).detail;
        resolve({
          ghostHtml: d.ghostHtml,
          ghostCss: d.ghostCss,
          hostStyles: d.hostStyles,
          storyBackground: d.storyBackground,
          naturalWidth: d.naturalWidth,
          naturalHeight: d.naturalHeight,
        });
      };

      const onError = (e: Event) => {
        cleanup();
        const msg = (e as CustomEvent<{ message: string }>).detail.message;
        reject(new Error(msg));
      };

      this.el.addEventListener('ghost-extracted', onExtracted);
      this.el.addEventListener('iframe-error', onError);

      this.el.setAttribute('src', buildArgsUrl(storyId, {}));

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Extraction timeout for story: ${storyId}`));
      }, SharedGhostExtractor.SRC_TIMEOUT);
    });
  }
}
