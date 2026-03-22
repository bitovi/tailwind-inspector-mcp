// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  extractStyles,
  applyStylesToHost,
  injectChildStyles,
  STYLE_PROPERTIES,
  CHILD_STYLE_PROPERTIES,
} from './style-cloner';

function mockElement(styles: Record<string, string>): Element {
  const el = document.createElement('div');
  // Override getComputedStyle for this element
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue(prop: string) {
      return styles[prop] ?? '';
    },
  } as CSSStyleDeclaration);
  return el;
}

describe('extractStyles', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('reads all STYLE_PROPERTIES from computed style', () => {
    const expected: Record<string, string> = {};
    for (const prop of STYLE_PROPERTIES) {
      expected[prop] = `value-of-${prop}`;
    }
    const el = mockElement(expected);

    const result = extractStyles(el);

    for (const prop of STYLE_PROPERTIES) {
      expect(result[prop]).toBe(`value-of-${prop}`);
    }
  });

  test('returns empty strings for properties not set', () => {
    const el = mockElement({});
    const result = extractStyles(el);

    for (const prop of STYLE_PROPERTIES) {
      expect(result[prop]).toBe('');
    }
  });

  test('includes display, width, height, color, font-size', () => {
    const el = mockElement({
      display: 'flex',
      width: '200px',
      height: '100px',
      color: 'rgb(0, 0, 0)',
      'font-size': '16px',
    });

    const result = extractStyles(el);
    expect(result['display']).toBe('flex');
    expect(result['width']).toBe('200px');
    expect(result['height']).toBe('100px');
    expect(result['color']).toBe('rgb(0, 0, 0)');
    expect(result['font-size']).toBe('16px');
  });
});

describe('applyStylesToHost', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('sets inline styles on host element', () => {
    const host = document.createElement('div');
    applyStylesToHost(host, {
      width: '200px',
      height: '100px',
      'background-color': 'red',
    });

    expect(host.style.getPropertyValue('width')).toBe('200px');
    expect(host.style.getPropertyValue('background-color')).toBe('red');
  });

  test('skips height so ghost content drives it naturally', () => {
    const host = document.createElement('div');
    applyStylesToHost(host, { height: '100px', width: '200px' });

    expect(host.style.getPropertyValue('height')).toBe('');
    expect(host.style.getPropertyValue('width')).toBe('200px');
  });

  test('preserves display: inline as-is', () => {
    const host = document.createElement('div');
    applyStylesToHost(host, { display: 'inline' });

    expect(host.style.getPropertyValue('display')).toBe('inline');
  });

  test('preserves display: block as-is', () => {
    const host = document.createElement('div');
    applyStylesToHost(host, { display: 'block' });

    expect(host.style.getPropertyValue('display')).toBe('block');
  });

  test('preserves display: flex as-is', () => {
    const host = document.createElement('div');
    applyStylesToHost(host, { display: 'flex' });

    expect(host.style.getPropertyValue('display')).toBe('flex');
  });
});

describe('injectChildStyles', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('applies computed styles to cloned element', () => {
    const source = document.createElement('span');
    source.textContent = 'hello';
    document.body.appendChild(source);

    const clone = document.createElement('span');
    clone.textContent = 'hello';

    // Mock getComputedStyle for the source
    const mockStyles: Record<string, string> = {
      color: 'rgb(255, 0, 0)',
      'font-size': '14px',
      display: 'inline',
    };
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue(prop: string) {
        return mockStyles[prop] ?? '';
      },
    } as CSSStyleDeclaration);

    injectChildStyles(source, clone);

    expect(clone.style.getPropertyValue('color')).toBe('rgb(255, 0, 0)');
    expect(clone.style.getPropertyValue('font-size')).toBe('14px');
    expect(clone.style.getPropertyValue('display')).toBe('inline');

    document.body.removeChild(source);
  });

  test('recurses into child elements', () => {
    const source = document.createElement('div');
    const sourceChild = document.createElement('span');
    sourceChild.textContent = 'child';
    source.appendChild(sourceChild);

    const clone = document.createElement('div');
    const cloneChild = document.createElement('span');
    cloneChild.textContent = 'child';
    clone.appendChild(cloneChild);

    const mockStyles: Record<string, string> = { color: 'blue' };
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue(prop: string) {
        return mockStyles[prop] ?? '';
      },
    } as CSSStyleDeclaration);

    injectChildStyles(source, clone);

    expect(cloneChild.style.getPropertyValue('color')).toBe('blue');
  });

  test('handles null source gracefully', () => {
    expect(() => injectChildStyles(null, document.createElement('div'))).not.toThrow();
  });

  test('handles null clone gracefully', () => {
    expect(() => injectChildStyles(document.createElement('div'), null)).not.toThrow();
  });
});
