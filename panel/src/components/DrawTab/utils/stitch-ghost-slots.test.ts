import { describe, it, expect } from 'vitest';
import {
  stitchGhostSlots,
  argsToStorybookArgs,
  isReactNodeArgValue,
  hasComponentSlots,
  SLOT_PREFIX,
} from './stitch-ghost-slots';

// ---------------------------------------------------------------------------
// isReactNodeArgValue
// ---------------------------------------------------------------------------

describe('isReactNodeArgValue', () => {
  it('returns true for text type', () => {
    expect(isReactNodeArgValue({ type: 'text', value: 'hello' })).toBe(true);
  });

  it('returns true for component type', () => {
    expect(
      isReactNodeArgValue({
        type: 'component',
        componentName: 'Icon',
        storyId: 'icon--star',
      }),
    ).toBe(true);
  });

  it('returns false for primitives', () => {
    expect(isReactNodeArgValue('hello')).toBe(false);
    expect(isReactNodeArgValue(42)).toBe(false);
    expect(isReactNodeArgValue(null)).toBe(false);
    expect(isReactNodeArgValue(undefined)).toBe(false);
  });

  it('returns false for plain objects without type', () => {
    expect(isReactNodeArgValue({ foo: 'bar' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasComponentSlots
// ---------------------------------------------------------------------------

describe('hasComponentSlots', () => {
  it('returns true when args contain a component-type ReactNodeArgValue', () => {
    expect(
      hasComponentSlots({
        children: 'text',
        iconLeft: {
          type: 'component',
          componentName: 'Icon',
          storyId: 'icon--star',
        },
      }),
    ).toBe(true);
  });

  it('returns false when only text-type ReactNodeArgValues', () => {
    expect(
      hasComponentSlots({
        children: { type: 'text', value: 'hello' },
      }),
    ).toBe(false);
  });

  it('returns false when no ReactNodeArgValues at all', () => {
    expect(hasComponentSlots({ variant: 'primary', size: 'lg' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// argsToStorybookArgs
// ---------------------------------------------------------------------------

describe('argsToStorybookArgs', () => {
  it('passes primitive args through unchanged', () => {
    const result = argsToStorybookArgs({
      variant: 'primary',
      size: 'lg',
      disabled: false,
      count: 3,
    });
    expect(result).toEqual({
      variant: 'primary',
      size: 'lg',
      disabled: false,
      count: 3,
    });
  });

  it('converts text ReactNodeArgValue to raw string', () => {
    const result = argsToStorybookArgs({
      children: { type: 'text', value: 'Hello World' },
    });
    expect(result.children).toBe('Hello World');
  });

  it('converts component ReactNodeArgValue to ⊞marker', () => {
    const result = argsToStorybookArgs({
      iconLeft: {
        type: 'component',
        componentName: 'Icon',
        storyId: 'icon--star',
        ghostHtml: '<svg></svg>',
      },
    });
    expect(result.iconLeft).toBe(`${SLOT_PREFIX}iconLeft`);
  });

  it('handles mixed primitive and ReactNode args', () => {
    const result = argsToStorybookArgs({
      variant: 'primary',
      children: { type: 'text', value: 'Click me' },
      iconLeft: {
        type: 'component',
        componentName: 'Icon',
        storyId: 'icon--star',
      },
    });
    expect(result).toEqual({
      variant: 'primary',
      children: 'Click me',
      iconLeft: `${SLOT_PREFIX}iconLeft`,
    });
  });
});

// ---------------------------------------------------------------------------
// stitchGhostSlots
// ---------------------------------------------------------------------------

describe('stitchGhostSlots', () => {
  it('replaces a single slot marker with child ghostHtml', () => {
    const result = stitchGhostSlots(
      `<div><span>${SLOT_PREFIX}iconLeft</span></div>`,
      '.parent { color: red; }',
      {
        iconLeft: {
          type: 'component',
          componentName: 'Icon',
          storyId: 'icon--star',
          ghostHtml: '<svg class="icon">★</svg>',
          ghostCss: '.icon { width: 16px; }',
        },
      },
    );

    expect(result.ghostHtml).toBe(
      '<div><span><svg class="icon">★</svg></span></div>',
    );
    expect(result.ghostCss).toContain('.parent { color: red; }');
    expect(result.ghostCss).toContain('.icon { width: 16px; }');
  });

  it('replaces multiple slot markers in the same HTML', () => {
    const html = `<div>${SLOT_PREFIX}iconLeft<span>text</span>${SLOT_PREFIX}iconRight</div>`;
    const result = stitchGhostSlots(html, '', {
      iconLeft: {
        type: 'component',
        componentName: 'Icon',
        storyId: 'icon--star',
        ghostHtml: '<svg>L</svg>',
        ghostCss: '.left { color: blue; }',
      },
      iconRight: {
        type: 'component',
        componentName: 'Icon',
        storyId: 'icon--check',
        ghostHtml: '<svg>R</svg>',
        ghostCss: '.right { color: green; }',
      },
    });

    expect(result.ghostHtml).toBe('<div><svg>L</svg><span>text</span><svg>R</svg></div>');
    expect(result.ghostCss).toContain('.left { color: blue; }');
    expect(result.ghostCss).toContain('.right { color: green; }');
  });

  it('replaces multiple occurrences of the same marker', () => {
    const html = `<div>${SLOT_PREFIX}icon ${SLOT_PREFIX}icon</div>`;
    const result = stitchGhostSlots(html, '', {
      icon: {
        type: 'component',
        componentName: 'Icon',
        storyId: 'icon--star',
        ghostHtml: '<svg>★</svg>',
        ghostCss: '',
      },
    });
    expect(result.ghostHtml).toBe('<div><svg>★</svg> <svg>★</svg></div>');
  });

  it('leaves text-type ReactNodeArgValues alone', () => {
    const html = `<div>${SLOT_PREFIX}children</div>`;
    const result = stitchGhostSlots(html, '', {
      children: { type: 'text', value: 'Hello' },
    });
    // Text types are NOT stitched — they should have been converted by
    // argsToStorybookArgs before the ghost was rendered
    expect(result.ghostHtml).toBe(html);
  });

  it('handles missing ghostHtml gracefully', () => {
    const html = `<div>${SLOT_PREFIX}iconLeft</div>`;
    const result = stitchGhostSlots(html, '.base {}', {
      iconLeft: {
        type: 'component',
        componentName: 'Icon',
        storyId: 'icon--star',
        // No ghostHtml or ghostCss
      },
    });
    // Marker stays — no ghostHtml to replace it with
    expect(result.ghostHtml).toBe(html);
    expect(result.ghostCss).toBe('.base {}');
  });

  it('handles empty ghostCss gracefully', () => {
    const html = `<div>${SLOT_PREFIX}icon</div>`;
    const result = stitchGhostSlots(html, '.parent {}', {
      icon: {
        type: 'component',
        componentName: 'Icon',
        storyId: 'icon--star',
        ghostHtml: '<svg>★</svg>',
        ghostCss: '',
      },
    });
    expect(result.ghostCss).toBe('.parent {}');
  });

  it('merges CSS from multiple children', () => {
    const html = `${SLOT_PREFIX}a ${SLOT_PREFIX}b`;
    const result = stitchGhostSlots(html, '.base {}', {
      a: {
        type: 'component',
        componentName: 'A',
        storyId: 'a--default',
        ghostHtml: '<div>A</div>',
        ghostCss: '.a-style {}',
      },
      b: {
        type: 'component',
        componentName: 'B',
        storyId: 'b--default',
        ghostHtml: '<div>B</div>',
        ghostCss: '.b-style {}',
      },
    });
    expect(result.ghostCss).toContain('.base {}');
    expect(result.ghostCss).toContain('.a-style {}');
    expect(result.ghostCss).toContain('.b-style {}');
  });

  it('handles nested slots (up to 3 passes)', () => {
    // Child component's ghostHtml itself contains a slot marker
    const parentHtml = `<div>${SLOT_PREFIX}child</div>`;
    const result = stitchGhostSlots(parentHtml, '', {
      child: {
        type: 'component',
        componentName: 'Parent',
        storyId: 'parent--default',
        ghostHtml: `<div>Parent ${SLOT_PREFIX}grandchild</div>`,
        ghostCss: '',
      },
      grandchild: {
        type: 'component',
        componentName: 'Leaf',
        storyId: 'leaf--default',
        ghostHtml: '<span>Leaf</span>',
        ghostCss: '.leaf {}',
      },
    });

    expect(result.ghostHtml).toBe('<div><div>Parent <span>Leaf</span></div></div>');
    expect(result.ghostCss).toContain('.leaf {}');
  });

  it('returns unchanged HTML/CSS when no markers present', () => {
    const result = stitchGhostSlots(
      '<div>No markers here</div>',
      '.style {}',
      { variant: 'primary' },
    );
    expect(result.ghostHtml).toBe('<div>No markers here</div>');
    expect(result.ghostCss).toBe('.style {}');
  });

  it('ignores non-ReactNodeArgValue args', () => {
    const html = `<div>${SLOT_PREFIX}variant</div>`;
    const result = stitchGhostSlots(html, '', {
      variant: 'primary', // primitive, not a ReactNodeArgValue
    });
    // Marker stays because 'primary' is not a component-type ReactNodeArgValue
    expect(result.ghostHtml).toBe(html);
  });

  it('stops after 3 passes even with circular-like markers', () => {
    // A marker that keeps re-introducing itself (pathological case)
    const html = `<div>${SLOT_PREFIX}loop</div>`;
    const result = stitchGhostSlots(html, '', {
      loop: {
        type: 'component',
        componentName: 'Loop',
        storyId: 'loop--default',
        ghostHtml: `<div>recurse ${SLOT_PREFIX}loop</div>`,
        ghostCss: '',
      },
    });
    // After 3 passes, some markers may remain but it won't loop forever
    expect(result.ghostHtml).toContain('recurse');
  });
});
