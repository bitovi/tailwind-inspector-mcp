import { describe, it, expect } from 'vitest';
import { buildGhostCacheEntry } from './buildGhostCacheEntry';

describe('buildGhostCacheEntry', () => {
  it('builds entry with argCount from argTypes', () => {
    const result = buildGhostCacheEntry({
      storyId: 'button--primary',
      ghostHtml: '<button>Click</button>',
      ghostCss: '.btn { color: red; }',
      storyBackground: '#fff',
      componentName: 'Button',
      componentPath: 'src/Button.tsx',
      argTypes: { variant: { control: 'select' }, size: { control: 'text' } },
    });
    expect(result.argCount).toBe(2);
    expect(result.storyId).toBe('button--primary');
    expect(result.componentName).toBe('Button');
  });

  it('sets argCount to undefined when argTypes is empty', () => {
    const result = buildGhostCacheEntry({
      storyId: 'icon--default',
      ghostHtml: '<svg/>',
      ghostCss: '',
      componentName: 'Icon',
      argTypes: {},
    });
    expect(result.argCount).toBeUndefined();
  });

  it('passes through optional fields', () => {
    const result = buildGhostCacheEntry({
      storyId: 'card--default',
      args: { title: 'Hello' },
      ghostHtml: '<div/>',
      ghostCss: '',
      storyBackground: 'rgba(0,0,0,0)',
      componentName: 'Card',
      componentPath: 'src/Card.tsx',
      argTypes: {},
    });
    expect(result.args).toEqual({ title: 'Hello' });
    expect(result.storyBackground).toBe('rgba(0,0,0,0)');
    expect(result.componentPath).toBe('src/Card.tsx');
  });
});
