import { describe, it, expect } from 'vitest';
import { serializeValue, serializeProps, extractComponentProps } from './fiber';

describe('serializeValue', () => {
  it('passes through null and undefined', () => {
    expect(serializeValue(null, 0)).toBeNull();
    expect(serializeValue(undefined, 0)).toBeUndefined();
  });

  it('passes through primitives', () => {
    expect(serializeValue('hello', 0)).toBe('hello');
    expect(serializeValue(42, 0)).toBe(42);
    expect(serializeValue(true, 0)).toBe(true);
  });

  it('returns undefined for functions', () => {
    expect(serializeValue(() => {}, 0)).toBeUndefined();
  });

  it('returns undefined for symbols', () => {
    expect(serializeValue(Symbol('test'), 0)).toBeUndefined();
  });

  it('serializes arrays recursively, filtering out undefined', () => {
    const input = ['a', () => {}, 42, null];
    expect(serializeValue(input, 0)).toEqual(['a', 42, null]);
  });

  it('returns too-deep marker when depth exceeds 4', () => {
    expect(serializeValue({ nested: true }, 5)).toEqual({ __unsupported: true, type: 'too-deep' });
  });

  it('serializes React elements with $$typeof', () => {
    const reactElement = {
      $$typeof: Symbol.for('react.element'),
      type: function Button() {},
      props: { variant: 'primary', children: 'Click' },
    };
    // Override name for test
    Object.defineProperty(reactElement.type, 'name', { value: 'Button' });
    
    const result = serializeValue(reactElement, 0) as any;
    expect(result.__reactElement).toBe(true);
    expect(result.componentName).toBe('Button');
    expect(result.props).toEqual({ variant: 'primary', children: 'Click' });
  });

  it('serializes React transitional elements', () => {
    const reactElement = {
      $$typeof: Symbol.for('react.transitional.element'),
      type: 'div',
      props: { className: 'test' },
    };
    
    const result = serializeValue(reactElement, 0) as any;
    expect(result.__reactElement).toBe(true);
    expect(result.componentName).toBe('div');
    expect(result.props).toEqual({ className: 'test' });
  });

  it('serializes plain objects recursively', () => {
    const input = { a: 'hello', b: 42, c: { nested: true } };
    expect(serializeValue(input, 0)).toEqual({ a: 'hello', b: 42, c: { nested: true } });
  });

  it('returns undefined for empty plain objects (all values filtered)', () => {
    const input = { fn: () => {}, sym: Symbol('x') };
    expect(serializeValue(input, 0)).toBeUndefined();
  });

  it('filters function values from plain objects', () => {
    const input = { name: 'test', onClick: () => {} };
    expect(serializeValue(input, 0)).toEqual({ name: 'test' });
  });
});

describe('serializeProps', () => {
  it('serializes props, skipping key and ref', () => {
    const props = { key: '1', ref: {}, variant: 'primary', size: 'lg' };
    expect(serializeProps(props)).toEqual({ variant: 'primary', size: 'lg' });
  });

  it('includes children (not skipped)', () => {
    const props = { children: 'Hello', className: 'test' };
    expect(serializeProps(props)).toEqual({ children: 'Hello', className: 'test' });
  });

  it('returns empty object for props with only key and ref', () => {
    expect(serializeProps({ key: '1', ref: {} })).toEqual({});
  });

  it('filters out function props', () => {
    const props = { label: 'Click', onClick: () => {}, variant: 'primary' };
    expect(serializeProps(props)).toEqual({ label: 'Click', variant: 'primary' });
  });

  it('respects depth parameter', () => {
    const props = { data: { nested: { deep: true } } };
    expect(serializeProps(props, 4)).toEqual({ data: { nested: { __unsupported: true, type: 'too-deep' } } });
  });
});

describe('extractComponentProps', () => {
  it('returns null for null/undefined fiber', () => {
    expect(extractComponentProps(null)).toBeNull();
    expect(extractComponentProps(undefined)).toBeNull();
  });

  it('returns null for fiber without memoizedProps', () => {
    expect(extractComponentProps({})).toBeNull();
    expect(extractComponentProps({ memoizedProps: null })).toBeNull();
  });

  it('returns null when all props are filtered out', () => {
    expect(extractComponentProps({ memoizedProps: { key: '1', ref: {} } })).toBeNull();
  });

  it('extracts serializable props from fiber', () => {
    const fiber = {
      memoizedProps: {
        variant: 'primary',
        disabled: false,
        onClick: () => {},
      },
    };
    expect(extractComponentProps(fiber)).toEqual({ variant: 'primary', disabled: false });
  });
});
