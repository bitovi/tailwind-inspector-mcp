/**
 * Vitest-based HTML snapshot generator for panel React components.
 *
 * Uses the panel's existing Vite config (CSS handling, jsdom, single React)
 * to render stories via @testing-library/react and write the innerHTML
 * to panel/snapshots/{ComponentName}/{StoryName}.html
 *
 * Run:
 *   cd panel && npx vitest run generate-snapshots
 *   cd panel && npx vitest run generate-snapshots -t "TabBar"   # single component
 */

import { describe, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { createElement } from 'react';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SNAPSHOTS_DIR = path.resolve(import.meta.dirname, '..', 'snapshots');

// ── Story modules to snapshot ─────────────────────────────────────────
// Each entry: [componentName, () => import('...stories.tsx')]
// Add new components here as needed.

const STORY_MODULES: [string, () => Promise<Record<string, any>>][] = [
  ['TabBar', () => import('./components/TabBar/TabBar.stories')],
  ['ModeToggle', () => import('./components/ModeToggle/ModeToggle.stories')],
  ['PropertySection', () => import('./components/PropertySection/PropertySection.stories')],
  ['ScaleScrubber', () => import('./components/ScaleScrubber/ScaleScrubber.stories')],
  ['FlexJustify', () => import('./components/FlexJustify/FlexJustify.stories')],
];

// ── Helpers ───────────────────────────────────────────────────────────

/** Extract named story exports (PascalCase, not 'default') */
function getStories(mod: Record<string, any>): [string, any][] {
  return Object.entries(mod).filter(
    ([key, val]) => key !== 'default' && /^[A-Z]/.test(key) && typeof val === 'object'
  );
}

/** Render a story to an HTML string */
function renderStoryToHtml(
  meta: { component?: React.ComponentType<any> },
  story: { render?: (...args: any[]) => any; args?: Record<string, any> },
): string | null {
  let element: React.ReactElement | null = null;

  if (typeof story.render === 'function') {
    element = story.render(story.args ?? {}, {} as any);
  } else if (meta.component && story.args) {
    element = createElement(meta.component, story.args);
  } else if (meta.component) {
    element = createElement(meta.component);
  }

  if (!element) return null;

  const { container } = render(element);
  const html = container.innerHTML;
  cleanup();
  return html;
}

/** Pretty-print HTML with basic indentation */
function formatHtml(html: string): string {
  // Simple formatting: add newlines after closing tags
  return html
    .replace(/></g, '>\n<')
    .replace(/\n\n+/g, '\n');
}

// ── Tests (one per component) ─────────────────────────────────────────

describe('generate-snapshots', () => {
  for (const [componentName, importFn] of STORY_MODULES) {
    describe(componentName, () => {
      it(`generates HTML snapshots`, async () => {
        const mod = await importFn();
        const meta = mod.default;
        const stories = getStories(mod);

        const outDir = path.join(SNAPSHOTS_DIR, componentName);
        await mkdir(outDir, { recursive: true });

        let generated = 0;
        for (const [storyName, story] of stories) {
          try {
            const html = renderStoryToHtml(meta, story);
            if (!html) continue;

            const formatted = formatHtml(html);
            const outPath = path.join(outDir, `${storyName}.html`);
            await writeFile(outPath, formatted, 'utf-8');
            generated++;
          } catch (err) {
            console.warn(`  ⚠ ${componentName}/${storyName}: ${(err as Error).message}`);
          }
        }

        console.log(`  ✓ ${componentName}: ${generated}/${stories.length} stories`);
      });
    });
  }
});
