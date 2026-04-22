/**
 * Angular-specific helpers for Storybook iframe interaction.
 *
 * These utilities handle the gap between Storybook's React-centric channel
 * API and Angular's change detection model:
 *
 * - `discoverAngularSlots()` — introspects `ɵcmp.ngContentSelectors` from
 *   Angular components rendered inside a same-origin Storybook iframe to
 *   synthesize argTypes for content projection slots.
 *
 * - `tryAngularDirectUpdate()` — sets story args directly on the Storybook
 *   wrapper component and triggers change detection via `ng.applyChanges()`.
 *   The standard `updateStoryArgs` postMessage doesn't trigger Angular CD,
 *   so this bypasses the channel entirely.
 */

import type { ArgType } from '../../../panel/src/components/DrawTab/types';

// ── Slot discovery ─────────────────────────────────────────────────────────

/**
 * Converts an ngContentSelector like "[leftIcon]" to a prop name like "leftIcon".
 * Skips the unnamed slot "*".
 */
export function selectorToSlotName(selector: string): string | null {
  if (selector === '*') return null;
  const attrMatch = selector.match(/^\[([^\]=]+)(?:=([^\]]+))?\]$/);
  if (attrMatch) return attrMatch[2] ?? attrMatch[1];
  // Element selector like "card-title" → camelCase
  if (/^[a-z]/.test(selector) && !selector.includes('[')) {
    return selector.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  }
  return null;
}

/**
 * Introspect a same-origin Storybook iframe for Angular components with
 * ngContentSelectors. Returns synthesized argTypes for discovered slots.
 *
 * Used by `useStoryProbe` after `storyPrepared` to augment Storybook's
 * argTypes (which never include content projection slots).
 */
export function discoverAngularSlots(iframe: HTMLIFrameElement): Record<string, ArgType> {
  const slots: Record<string, ArgType> = {};
  try {
    const iframeWin = iframe.contentWindow as any;
    const ng = iframeWin?.ng;
    if (!ng || typeof ng.getComponent !== 'function') {
      console.log('[angular-storybook] discoverAngularSlots: no ng debug API found');
      return slots;
    }

    const doc = iframe.contentDocument;
    if (!doc) return slots;

    // Find all custom elements in the iframe body (Angular components use custom element selectors)
    const allEls = doc.body?.querySelectorAll('*') ?? [];
    for (const el of allEls) {
      // Skip standard HTML elements
      if (!el.tagName.includes('-')) continue;

      const component = ng.getComponent(el);
      if (!component) continue;

      const cmpDef = component.constructor?.ɵcmp;
      const selectors: string[] | undefined = cmpDef?.ngContentSelectors;
      if (!selectors || selectors.length === 0) continue;

      console.log(`[angular-storybook] discoverAngularSlots: found ${el.tagName.toLowerCase()} with ngContentSelectors:`, selectors);

      for (const selector of selectors) {
        const slotName = selectorToSlotName(selector);
        if (!slotName) continue; // skip unnamed "*" slot
        slots[slotName] = {
          control: 'text',
          type: { name: 'Slot' },
          description: `Content projection slot: ${selector}`,
        };
        console.log(`[angular-storybook] discoverAngularSlots: synthesized argType for slot "${slotName}" from selector "${selector}"`);
      }

      // Only inspect the first component with slots (the story's root component)
      if (Object.keys(slots).length > 0) break;
    }
  } catch (err) {
    console.warn('[angular-storybook] discoverAngularSlots error:', err);
  }
  return slots;
}

// ── Direct arg update ──────────────────────────────────────────────────────

/**
 * For Angular Storybook iframes: set args directly on the Storybook wrapper
 * component and trigger change detection via `ng.applyChanges()`.
 *
 * The standard Storybook channel `updateStoryArgs` postMessage updates the
 * internal args store but doesn't trigger Angular change detection, so the
 * template never re-evaluates. This function bypasses the channel entirely.
 *
 * Returns true if Angular was detected and args were applied.
 */
export function tryAngularDirectUpdate(
  iframe: HTMLIFrameElement,
  updatedArgs: Record<string, unknown>,
): boolean {
  const win = iframe.contentWindow as any;
  const ng = win?.ng;
  if (!ng || typeof ng.getOwningComponent !== 'function') return false;

  const doc = iframe.contentDocument;
  const root = doc?.querySelector('#storybook-root');
  if (!root) return false;

  // Find the first Angular component element inside the root.
  // Skip storybook-root itself — we need a child element like <app-button>
  // whose owning component is the Storybook dynamic wrapper.
  const storybookRoot = root.querySelector('storybook-root') ?? root;
  const customEl = storybookRoot.querySelector(':not(storybook-root)');
  if (!customEl) return false;

  try {
    const wrapper = ng.getOwningComponent(customEl);
    if (!wrapper) return false;

    // Apply each arg as a property on the wrapper
    for (const [key, value] of Object.entries(updatedArgs)) {
      wrapper[key] = value;
    }

    // Trigger Angular change detection
    const hostEl = ng.getHostElement(wrapper);
    if (hostEl) {
      ng.applyChanges(hostEl);
      console.log('[angular-storybook] direct update applied', { keys: Object.keys(updatedArgs) });
      return true;
    }
  } catch (e) {
    console.warn('[angular-storybook] direct update failed', e);
  }
  return false;
}
