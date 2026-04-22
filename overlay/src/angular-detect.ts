// Angular component detection utilities.
// Parallels fiber.ts for React — detects Angular component boundaries from DOM nodes.

import type { ComponentInfo } from './fiber';
import { serializeValue } from './fiber';
import type { SerializedReactElement } from '../../shared/types';

/**
 * Angular debug API — available in dev mode (not in prod builds).
 * Angular attaches `ng` to the global scope with these methods.
 */
interface NgDebugApi {
  getComponent(el: Element): any | null;
  getOwningComponent(el: Element): any | null;
  getContext(el: Element): any | null;
}

function getNgApi(): NgDebugApi | null {
  const ng = (window as any).ng;
  if (ng?.getComponent && ng?.getOwningComponent) return ng;
  return null;
}

/**
 * Check if an element is managed by Angular.
 * Works in both dev and prod: checks for __ngContext__ or _nghost-/_ngcontent- attributes.
 */
export function isAngularElement(el: Element): boolean {
  if ('__ngContext__' in el) return true;
  return Array.from(el.attributes).some(
    (a) => a.name.startsWith('_nghost-') || a.name.startsWith('_ngcontent-'),
  );
}

/**
 * Get the Angular component for a DOM element.
 * Returns ComponentInfo if the element is a component host or belongs to a component.
 *
 * Strategy:
 * 1. Dev mode: use ng.getComponent(el) or ng.getOwningComponent(el)
 * 2. Prod fallback: walk _ngcontent-* → _nghost-* to find the component host element
 */
export function findAngularComponentBoundary(el: Element): ComponentInfo | null {
  const ng = getNgApi();

  if (ng) {
    // Dev mode: try direct component first, then owning component
    const component = ng.getComponent(el) ?? ng.getOwningComponent(el);
    if (component) {
      const raw = component.constructor?.name || 'Unknown';
      // Angular's esbuild/Vite dev transform sometimes prefixes class names with "_"
      const name = raw.replace(/^_+/, '');
      return {
        componentType: component.constructor,
        componentName: name,
        componentFiber: component, // reuse field for the component instance
      };
    }
  }

  // Prod fallback: use _nghost-* / _ngcontent-* attributes
  // If el itself is a component host
  const hostAttr = findAttrStartingWith(el, '_nghost-');
  if (hostAttr) {
    return {
      componentType: el.tagName.toLowerCase(),
      componentName: formatTagAsComponentName(el.tagName),
      componentFiber: el,
    };
  }

  // Walk up to find the owning component host via _ngcontent-* → _nghost-*
  const contentAttr = findAttrStartingWith(el, '_ngcontent-');
  if (contentAttr) {
    const suffix = contentAttr.name.replace('_ngcontent-', '');
    const host = el.closest(`[_nghost-${suffix}]`);
    if (host) {
      return {
        componentType: host.tagName.toLowerCase(),
        componentName: formatTagAsComponentName(host.tagName),
        componentFiber: host,
      };
    }
  }

  return null;
}

/**
 * Find all DOM elements that belong to the same Angular component instance.
 * Uses the shared _ngcontent-* attribute suffix.
 */
export function findAngularComponentElements(hostEl: Element): Element[] {
  const hostAttr = findAttrStartingWith(hostEl, '_nghost-');
  if (!hostAttr) return [hostEl];
  const suffix = hostAttr.name.replace('_nghost-', '');
  return Array.from(document.querySelectorAll(`[_ngcontent-${suffix}]`));
}

/**
 * Find all instances of an Angular component by tag name.
 * Returns the host elements for each instance.
 */
export function findAllAngularInstances(tagOrType: any): HTMLElement[] {
  const ng = getNgApi();

  if (ng && typeof tagOrType === 'function') {
    // Dev mode: find all elements with matching component type
    // Angular custom elements always use a tag selector, so query by tag name
    // derived from the component class
    const sampleEl = document.querySelector(tagOrType.ɵcmp?.selectors?.[0]?.[0] ?? '');
    if (!sampleEl) {
      // Fallback: scan all custom elements
      return findAllAngularInstancesByClass(ng, tagOrType);
    }
    return Array.from(document.querySelectorAll(sampleEl.tagName.toLowerCase())) as HTMLElement[];
  }

  if (typeof tagOrType === 'string') {
    // Prod fallback: query by tag name
    return Array.from(document.querySelectorAll(tagOrType)) as HTMLElement[];
  }

  return [];
}

/**
 * Dev-mode scan: find all elements whose ng.getComponent() returns an instance
 * of the given class.
 */
function findAllAngularInstancesByClass(ng: NgDebugApi, componentClass: any): HTMLElement[] {
  const results: HTMLElement[] = [];
  // Scan all custom elements (Angular components use hyphenated tag names by convention)
  const allCustomElements = document.querySelectorAll('*');
  for (const el of allCustomElements) {
    const comp = ng.getComponent(el);
    if (comp instanceof componentClass) {
      results.push(el as HTMLElement);
    }
  }
  return results;
}

/**
 * Collect all DOM nodes with a given tag name inside an Angular component's template.
 * Uses _ngcontent-* attribute to scope to the component instance.
 */
export function collectAngularComponentDOMNodes(
  hostEl: Element,
  tagName: string,
): HTMLElement[] {
  const hostAttr = findAttrStartingWith(hostEl, '_nghost-');
  if (!hostAttr) {
    // No host attr — fall back to children of the element
    return Array.from(hostEl.querySelectorAll(tagName.toLowerCase())) as HTMLElement[];
  }
  const suffix = hostAttr.name.replace('_nghost-', '');
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      `${tagName.toLowerCase()}[_ngcontent-${suffix}]`,
    ),
  );
}

// ── Angular Component Props + Slot Extraction ──────

/**
 * Extract serialized props (inputs + content projection slots) from an Angular component.
 *
 * - Reads @Input() values from the live component instance via `ɵcmp.inputs`
 * - Reads `ɵcmp.ngContentSelectors` to discover content projection slots
 * - For named slots (e.g. `[leftIcon]`), scans the host element's children
 *   and serializes projected Angular components as SerializedReactElement
 * - The unnamed slot (`*`) maps to `children` (text content)
 *
 * Returns a record compatible with the panel's `mapFiberPropsToArgs()`.
 */
export function extractAngularComponentProps(
  componentInstance: any,
  hostEl: Element,
): Record<string, unknown> | null {
  if (!componentInstance) return null;

  const result: Record<string, unknown> = {};
  const cmpDef = componentInstance.constructor?.ɵcmp;

  // 1. Extract @Input() values
  if (cmpDef?.inputs) {
    const inputMap: Record<string, string | [string, string]> = cmpDef.inputs;
    for (const [publicName, mapping] of Object.entries(inputMap)) {
      // mapping can be a string (public name) or [minifiedName, publicName]
      const internalName = Array.isArray(mapping) ? mapping[0] : publicName;
      const value = componentInstance[internalName];
      if (value === undefined) continue;
      const serialized = serializeValue(value, 0);
      if (serialized !== undefined) {
        result[publicName] = serialized;
      }
    }
  }

  // 2. Extract content projection slots via ngContentSelectors
  const selectors: string[] | undefined = cmpDef?.ngContentSelectors;
  if (selectors && hostEl) {
    const ng = getNgApi();
    for (const selector of selectors) {
      if (selector === '*') {
        // Unnamed slot → children: extract text content from direct text nodes
        const textContent = getDirectTextContent(hostEl);
        if (textContent) {
          result['children'] = textContent;
        }
        continue;
      }

      // Named slot: selector is typically an attribute selector like "[leftIcon]"
      // or an element selector like "card-title"
      const slotName = selectorToSlotName(selector);
      if (!slotName) continue;

      // Find projected content matching this selector
      const projected = hostEl.querySelector(`:scope > ${cssifySelector(selector)}`);
      if (!projected) continue;

      // Check if the projected element is itself an Angular component
      if (ng) {
        const childComp = ng.getComponent(projected);
        if (childComp) {
          const childName = (childComp.constructor?.name || 'Unknown').replace(/^_+/, '');
          const childProps = extractAngularComponentProps(childComp, projected);
          const serialized: SerializedReactElement = {
            __reactElement: true,
            componentName: childName,
            props: childProps ?? undefined,
          };
          result[slotName] = serialized;
          continue;
        }
      }

      // Not an Angular component — serialize as text
      const text = projected.textContent?.trim();
      if (text) {
        result[slotName] = text;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Convert an ng-content selector to a slot name.
 * "[leftIcon]" → "leftIcon"
 * "card-title" → "cardTitle"
 * "[slot=header]" → "header"
 */
function selectorToSlotName(selector: string): string | null {
  // Attribute selector: [leftIcon] or [slot=header]
  const attrMatch = selector.match(/^\[([^\]=]+)(?:=([^\]]+))?\]$/);
  if (attrMatch) {
    return attrMatch[2] ?? attrMatch[1];
  }
  // Element selector: card-title → cardTitle
  if (/^[a-z]/.test(selector) && !selector.includes('[')) {
    return selector.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }
  // Class selector or complex selector — skip
  return null;
}

/**
 * Convert an ngContentSelector into a valid CSS selector for querySelector.
 * "[leftIcon]" is already valid CSS. "card-title" is already valid.
 */
function cssifySelector(selector: string): string {
  return selector;
}

/**
 * Get the direct text content of an element (not text from child components).
 * Collects only direct text nodes, excluding Angular component elements.
 */
function getDirectTextContent(el: Element): string {
  const parts: string[] = [];
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) parts.push(text);
    }
  }
  return parts.join(' ');
}

// ── Helpers ──────────────────────────────────────────

function findAttrStartingWith(el: Element, prefix: string): Attr | null {
  return Array.from(el.attributes).find((a) => a.name.startsWith(prefix)) ?? null;
}

/**
 * Convert an Angular tag name to a PascalCase-like component name.
 * e.g. "APP-BADGE" → "BadgeComponent", "APP-CASE-LIST" → "CaseListComponent"
 */
function formatTagAsComponentName(tagName: string): string {
  const lower = tagName.toLowerCase();
  // Strip common prefixes like "app-"
  const stripped = lower.replace(/^app-/, '');
  // PascalCase: split on hyphens, capitalize each word
  const pascal = stripped
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return pascal + 'Component';
}
