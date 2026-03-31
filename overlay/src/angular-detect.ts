// Angular component detection utilities.
// Parallels fiber.ts for React — detects Angular component boundaries from DOM nodes.

import type { ComponentInfo } from './fiber';

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
