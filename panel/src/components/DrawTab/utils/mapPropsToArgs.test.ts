import { describe, it, expect } from 'vitest';
import { mapPropsToArgs } from './mapPropsToArgs';
import type { ArgType } from '../types';

describe('mapPropsToArgs', () => {
  it('maps primitive string props guided by argTypes', () => {
    const fiberProps = { variant: 'primary', children: 'Submit' };
    const argTypes: Record<string, ArgType> = {
      variant: { control: 'select', options: ['primary', 'secondary'] },
      children: { control: 'text' },
    };
    const result = mapPropsToArgs(fiberProps, argTypes);
    expect(result).toEqual({ variant: 'primary', children: { type: 'text', value: 'Submit' } });
  });

  it('maps boolean and number props', () => {
    const fiberProps = { disabled: true, size: 42 };
    const argTypes: Record<string, ArgType> = {
      disabled: { control: 'boolean' },
      size: { control: 'number' },
    };
    const result = mapPropsToArgs(fiberProps, argTypes);
    expect(result).toEqual({ disabled: true, size: 42 });
  });

  it('maps serialized React elements on ReactNode fields', () => {
    const fiberProps = {
      leftIcon: { __reactElement: true, componentName: 'StarIcon', props: { size: 16 } },
    };
    const argTypes: Record<string, ArgType> = {
      leftIcon: { control: 'object', type: { name: 'ReactNode' } },
    };
    const result = mapPropsToArgs(fiberProps, argTypes);
    expect(result).toEqual({
      leftIcon: { type: 'component', componentName: 'StarIcon', storyId: '', args: { size: 16 } },
    });
  });

  it('maps string children as ReactNodeArgValue text', () => {
    const fiberProps = { children: 'Hello world' };
    const argTypes: Record<string, ArgType> = {
      children: { control: 'text' },
    };
    // children is always treated as ReactNode
    const result = mapPropsToArgs(fiberProps, argTypes);
    expect(result).toEqual({ children: { type: 'text', value: 'Hello world' } });
  });

  it('skips props not in argTypes', () => {
    const fiberProps = { variant: 'primary', onClick: 'function', unknownProp: 'foo' };
    const argTypes: Record<string, ArgType> = {
      variant: { control: 'select', options: ['primary', 'secondary'] },
    };
    const result = mapPropsToArgs(fiberProps, argTypes);
    expect(result).toEqual({ variant: 'primary' });
  });

  it('skips props with undefined values', () => {
    const fiberProps = { variant: undefined };
    const argTypes: Record<string, ArgType> = {
      variant: { control: 'select', options: ['primary', 'secondary'] },
    };
    const result = mapPropsToArgs(fiberProps, argTypes);
    expect(result).toEqual({});
  });

  it('returns empty object when fiberProps is empty', () => {
    const argTypes: Record<string, ArgType> = {
      variant: { control: 'select', options: ['primary', 'secondary'] },
    };
    const result = mapPropsToArgs({}, argTypes);
    expect(result).toEqual({});
  });

  it('returns empty object when argTypes is empty', () => {
    const fiberProps = { variant: 'primary' };
    const result = mapPropsToArgs(fiberProps, {});
    expect(result).toEqual({});
  });

  it('handles ReactNode fields with type "other" and control "object"', () => {
    const fiberProps = {
      icon: { __reactElement: true, componentName: 'HeartIcon', props: {} },
    };
    const argTypes: Record<string, ArgType> = {
      icon: { control: 'object', type: { name: 'other' } },
    };
    const result = mapPropsToArgs(fiberProps, argTypes);
    expect(result).toEqual({
      icon: { type: 'component', componentName: 'HeartIcon', storyId: '' },
    });
  });

  it('skips non-primitive, non-ReactElement values on primitive fields', () => {
    const fiberProps = { variant: { complex: 'object' } };
    const argTypes: Record<string, ArgType> = {
      variant: { control: 'select', options: ['primary', 'secondary'] },
    };
    const result = mapPropsToArgs(fiberProps, argTypes);
    expect(result).toEqual({});
  });
});
