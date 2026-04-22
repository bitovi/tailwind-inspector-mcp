// Unified framework detection — tries React first, then Angular, then falls back to tag name.
// This is the main entry point for component detection used by the overlay.

import { getFiber, findOwningComponent, type ComponentInfo } from './react/fiber';
import { isAngularElement, findOwningComponent as findAngularOwningComponent } from './angular/detect';

export type Framework = 'react' | 'angular' | 'unknown';

let cachedFramework: Framework | null = null;

/**
 * Detect which framework (if any) is managing the page.
 * Caches the result after the first successful detection.
 */
export function detectFramework(el?: Element): Framework {
  if (cachedFramework) return cachedFramework;

  const target = el ?? document.querySelector('[class]');
  if (!target) return 'unknown';

  if (getFiber(target)) {
    cachedFramework = 'react';
    return 'react';
  }

  if (isAngularElement(target)) {
    cachedFramework = 'angular';
    return 'angular';
  }

  return 'unknown';
}

/**
 * Detect the component boundary for a DOM element, framework-agnostic.
 * Returns ComponentInfo with componentName, componentType, and componentFiber/instance.
 * Returns null if no component boundary is found.
 */
export function detectComponent(el: Element): ComponentInfo | null {
  // Try React first
  const fiber = getFiber(el);
  if (fiber) {
    cachedFramework = 'react';
    return findOwningComponent(fiber);
  }

  // Try Angular
  if (isAngularElement(el)) {
    cachedFramework = 'angular';
    return findAngularOwningComponent(el);
  }

  return null;
}

/**
 * Get the component name for a DOM element, with fallback to tag name.
 */
export function getComponentName(el: Element): string {
  const info = detectComponent(el);
  return info?.componentName ?? el.tagName.toLowerCase();
}

/** Reset the cached framework (for testing or page navigation) */
export function resetFrameworkCache(): void {
  cachedFramework = null;
}
