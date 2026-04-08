import { createStoryExtractor, type StoryExtractor, type GhostData as ExtractorGhostData } from '../../../../../overlay/src/story-extractor';
import { buildArgsUrl } from './useArgsUrl';

// ── Types ────────────────────────────────────────────────────────────────

export interface GhostData {
  ghostHtml: string;
  ghostCss: string;
  storyBackground?: string;
  naturalWidth?: number;
  naturalHeight?: number;
}

interface QueueEntry {
  storyId: string;
  args?: Record<string, unknown>;
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
 * Manages a single hidden iframe (via createStoryExtractor) that extracts
 * ghost data for all components sequentially. First story loads via full
 * page src; subsequent stories navigate in-place via Storybook's
 * `setCurrentStory` postMessage — skipping the full Storybook bootstrap.
 *
 * Falls back to src change if navigate times out, and disables in-place
 * navigation after 2 consecutive failures.
 */
class SharedGhostExtractor {
  private extractor: StoryExtractor;
  private queue: QueueEntry[] = [];
  private processing = false;
  private hasLoadedFirstStory = false;
  private navFailCount = 0;

  private static MAX_NAV_FAILURES = 2;
  private static NAV_TIMEOUT = 3000;
  private static SRC_TIMEOUT = 25000;

  constructor() {
    this.extractor = createStoryExtractor({ width: 800, height: 600 });
  }

  extract(storyId: string, args?: Record<string, unknown>): Promise<GhostData> {
    return new Promise((resolve, reject) => {
      this.queue.push({ storyId, args, resolve, reject });
      this.processNext();
    });
  }

  cancel(storyId: string): void {
    this.queue = this.queue.filter(r => r.storyId !== storyId);
  }

  // ── Internal queue processing ──────────────────────────────────────

  private processNext(): void {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const entry = this.queue.shift()!;
    this.extractSingle(entry.storyId, entry.args)
      .then(data => entry.resolve(data))
      .catch(err => entry.reject(err))
      .finally(() => {
        this.processing = false;
        this.processNext();
      });
  }

  private extractSingle(storyId: string, args?: Record<string, unknown>): Promise<GhostData> {
    const hasArgs = args && Object.keys(args).length > 0;
    const useNav =
      !hasArgs &&
      this.hasLoadedFirstStory &&
      this.navFailCount < SharedGhostExtractor.MAX_NAV_FAILURES;

    if (useNav) {
      return this.extractViaNavigate(storyId);
    }
    return this.extractViaSrc(storyId, args);
  }

  private toGhostData(d: ExtractorGhostData): GhostData {
    return {
      ghostHtml: d.ghostHtml,
      ghostCss: d.ghostCss,
      storyBackground: d.storyBackground,
      naturalWidth: d.naturalWidth,
      naturalHeight: d.naturalHeight,
    };
  }

  // ── Navigate-based extraction (fast, no page reload) ───────────────

  private extractViaNavigate(storyId: string): Promise<GhostData> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const navTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.navFailCount++;
        this.extractViaSrc(storyId).then(resolve, reject);
      }, SharedGhostExtractor.NAV_TIMEOUT);

      this.extractor.navigate({
        storyId,
        onExtracted: (data) => {
          if (settled) return;
          settled = true;
          clearTimeout(navTimeout);
          this.hasLoadedFirstStory = true;
          this.navFailCount = 0;
          resolve(this.toGhostData(data));
        },
        onError: (msg) => {
          if (settled) return;
          settled = true;
          clearTimeout(navTimeout);
          reject(new Error(msg));
        },
      });
    });
  }

  // ── Src-based extraction (reliable, full page load) ────────────────

  private extractViaSrc(storyId: string, args?: Record<string, unknown>): Promise<GhostData> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const srcTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`Extraction timeout for story: ${storyId}`));
      }, SharedGhostExtractor.SRC_TIMEOUT);

      this.extractor.load(buildArgsUrl(storyId, args ?? {}), {
        onExtracted: (data) => {
          if (settled) return;
          settled = true;
          clearTimeout(srcTimeout);
          this.hasLoadedFirstStory = true;
          resolve(this.toGhostData(data));
        },
        onError: (msg) => {
          if (settled) return;
          settled = true;
          clearTimeout(srcTimeout);
          reject(new Error(msg));
        },
      });
    });
  }
}
