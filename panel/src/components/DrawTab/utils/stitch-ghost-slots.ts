import type { ReactNodeArgValue } from '../types';

/** Slot prefix character U+229E (⊞) — distinctive enough to avoid false matches */
export const SLOT_PREFIX = '\u229E';

/** Returns true if a value is a ReactNodeArgValue */
export function isReactNodeArgValue(value: unknown): value is ReactNodeArgValue {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.type === 'text' || v.type === 'component';
}

/**
 * Convert args containing ReactNodeArgValue entries into Storybook-safe args.
 * - text values: pass the raw string through
 * - component values: replace with a ⊞propName slot marker
 */
export function argsToStorybookArgs(args: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (isReactNodeArgValue(value)) {
      if (value.type === 'text') {
        result[key] = value.value;
      } else {
        result[key] = `${SLOT_PREFIX}${key}`;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Check whether any arg in a record is a component-type ReactNodeArgValue */
export function hasComponentSlots(args: Record<string, unknown>): boolean {
  return Object.values(args).some(
    (v) => isReactNodeArgValue(v) && (v as ReactNodeArgValue).type === 'component',
  );
}

/**
 * Stitch component slot markers back into the parent ghost HTML.
 * For each prop with a 'component' ReactNodeArgValue, replace every occurrence of
 * the ⊞propName marker in ghostHtml with the child's ghostHtml, and merge CSS.
 * Runs up to 3 passes to resolve nested slots (e.g. a slotted component that
 * itself has slotted children).
 */
export function stitchGhostSlots(
  ghostHtml: string,
  ghostCss: string,
  args: Record<string, unknown>,
): { ghostHtml: string; ghostCss: string } {
  let html = ghostHtml;
  let css = ghostCss;
  const MAX_PASSES = 3;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    if (!html.includes(SLOT_PREFIX)) break;

    let changed = false;
    for (const [key, value] of Object.entries(args)) {
      if (!isReactNodeArgValue(value) || value.type !== 'component') continue;
      const marker = `${SLOT_PREFIX}${key}`;
      if (!html.includes(marker)) continue;
      if (value.ghostHtml) {
        html = html.split(marker).join(value.ghostHtml);
        changed = true;
      }
      if (value.ghostCss) {
        css = mergeCss(css, value.ghostCss);
      }
    }
    if (!changed) break;
  }

  return { ghostHtml: html, ghostCss: css };
}

function mergeCss(a: string, b: string): string {
  if (!b) return a;
  if (!a) return b;
  // Deduplicate by concatenating — duplicate rules are harmless and this avoids parsing
  return `${a}\n${b}`;
}
