/**
 * Generate static HTML snapshots from panel Storybook stories.
 *
 * Usage:
 *   npx tsx scripts/generate-snapshots.ts              # all components
 *   npx tsx scripts/generate-snapshots.ts ColorGrid    # single component
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const PANEL_DIR = path.join(ROOT, 'panel');
const SNAPSHOTS_DIR = path.join(PANEL_DIR, 'snapshots');
const OVERLAY_STORIES_DIR = path.join(PANEL_DIR, 'src', 'stories', 'overlay');

const filterName = process.argv[2] ?? null;

// ── HTML template ────────────────────────────────────────────────────

function wrapHtml(componentName: string, storyName: string, body: string): string {
  return `<!-- Auto-generated from ${componentName}.stories.tsx — DO NOT EDIT -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Snapshot: ${componentName} / ${storyName}</title>
  <link rel="stylesheet" href="../../shared/tokens/panel-tokens.css">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwindcss.config = {
      theme: { extend: { colors: {
        'bit-bg': '#2c2c2c', 'bit-surface': '#383838', 'bit-surface-hi': '#404040',
        'bit-border': '#3a3a3a', 'bit-text': '#e5e5e5', 'bit-text-mid': '#b3b3b3',
        'bit-muted': '#999999', 'bit-orange': '#F5532D', 'bit-teal': '#00848B',
        'bit-teal-dark': '#00464A', 'bit-teal-mid': '#003D40', 'bit-teal-hover': '#006b70',
        'bit-teal-light': '#5fd4da', 'bit-green': '#2E7229',
        'bit-draft': '#fbbf24', 'bit-committed': '#F5532D',
      }}}
    }
  </script>
  <style>body { margin: 0; padding: 16px; background: #2c2c2c; color: #e5e5e5; font-family: 'Inter', system-ui, sans-serif; }</style>
</head>
<body>
  ${body}
</body>
</html>
`;
}

// ── Helpers ───────────────────────────────────────────────────────────

function isOverlayStory(filePath: string): boolean {
  return filePath.startsWith(OVERLAY_STORIES_DIR);
}

function extractComponentName(filePath: string): string {
  return path.basename(filePath).replace(/\.stories\.tsx$/, '');
}

/** Try to render a single story export to static HTML. */
function renderStory(
  meta: { component?: React.ComponentType<any>; decorators?: any[] },
  story: { render?: (...args: any[]) => any; args?: Record<string, any>; decorators?: any[] },
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
  return renderToStaticMarkup(element);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  await mkdir(SNAPSHOTS_DIR, { recursive: true });

  const storyDir = path.join(PANEL_DIR, 'src');
  const allFiles = await readdir(storyDir, { recursive: true });
  const storyFiles = allFiles
    .filter((f) => f.endsWith('.stories.tsx'))
    .map((f) => path.join(storyDir, f))
    .sort();

  if (storyFiles.length === 0) {
    console.log('No story files found.');
    return;
  }

  let generated = 0;
  let skipped = 0;

  for (const filePath of storyFiles) {
    const componentName = extractComponentName(filePath);

    // Filter by component name if provided
    if (filterName && componentName.toLowerCase() !== filterName.toLowerCase()) {
      continue;
    }

    // Skip overlay stories (Web Components — can't use renderToStaticMarkup)
    if (isOverlayStory(filePath)) {
      console.log(`⚠  Skipping overlay story: ${componentName} (Web Components not supported)`);
      skipped++;
      continue;
    }

    let mod: Record<string, any>;
    try {
      mod = await import(pathToFileURL(filePath).href);
    } catch (err) {
      console.log(`⚠  Skipping ${componentName}: failed to import — ${(err as Error).message}`);
      skipped++;
      continue;
    }

    const meta = mod.default;
    if (!meta) {
      console.log(`⚠  Skipping ${componentName}: no default export (meta)`);
      skipped++;
      continue;
    }

    // Collect named exports that look like stories (PascalCase or UPPER_CASE, not 'default')
    const storyEntries = Object.entries(mod).filter(
      ([key]) => key !== 'default' && /^[A-Z]/.test(key),
    );

    if (storyEntries.length === 0) {
      console.log(`⚠  Skipping ${componentName}: no story exports found`);
      skipped++;
      continue;
    }

    const htmlParts: string[] = [];
    let storyCount = 0;

    for (const [storyName, storyExport] of storyEntries) {
      const story = storyExport as any;
      try {
        const html = renderStory(meta, story);
        if (html) {
          htmlParts.push(
            `  <!-- Story: ${storyName} -->\n  <section data-story="${storyName}" style="margin-bottom: 24px;">\n    <h3 style="font-size: 13px; color: #b3b3b3; margin: 0 0 8px 0; font-weight: 500;">${storyName}</h3>\n    ${html}\n  </section>`,
          );
          storyCount++;
        }
      } catch (err) {
        console.log(`   ⚠  Story ${componentName}/${storyName} failed: ${(err as Error).message}`);
      }
    }

    if (htmlParts.length === 0) {
      console.log(`⚠  Skipping ${componentName}: no stories rendered successfully`);
      skipped++;
      continue;
    }

    const fullHtml = wrapHtml(componentName, `${storyCount} stories`, htmlParts.join('\n'));
    const outPath = path.join(SNAPSHOTS_DIR, `${componentName}.html`);
    await writeFile(outPath, fullHtml, 'utf-8');
    console.log(`✓  ${componentName} → ${path.relative(ROOT, outPath)} (${storyCount} stories)`);
    generated++;
  }

  console.log(`\nDone: ${generated} generated, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
