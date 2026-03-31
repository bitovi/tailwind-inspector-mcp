import { describe, test, expect } from 'vitest';
import { buildArgsUrl } from './useArgsUrl';

describe('buildArgsUrl', () => {
  test('builds basic URL without args', () => {
    expect(buildArgsUrl('components-button--primary'))
      .toBe('/storybook/iframe.html?id=components-button--primary&viewMode=story&vybit-ghost=1');
  });

  test('appends single arg', () => {
    expect(buildArgsUrl('components-button--primary', { variant: 'secondary' }))
      .toBe('/storybook/iframe.html?id=components-button--primary&viewMode=story&vybit-ghost=1&args=variant:secondary');
  });

  test('appends multiple args separated by semicolons', () => {
    const url = buildArgsUrl('components-button--primary', {
      variant: 'secondary',
      children: 'Cancel',
    });
    expect(url).toBe(
      '/storybook/iframe.html?id=components-button--primary&viewMode=story&vybit-ghost=1&args=variant:secondary;children:Cancel'
    );
  });

  test('URL-encodes special characters in values', () => {
    const url = buildArgsUrl('test--story', { label: 'Hello World' });
    expect(url).toContain('args=label:Hello%20World');
  });

  test('skips null and undefined values', () => {
    const url = buildArgsUrl('test--story', {
      color: 'red',
      size: null,
      variant: undefined,
    });
    expect(url).toBe('/storybook/iframe.html?id=test--story&viewMode=story&vybit-ghost=1&args=color:red');
  });

  test('returns URL without args param when args object is empty', () => {
    expect(buildArgsUrl('test--story', {}))
      .toBe('/storybook/iframe.html?id=test--story&viewMode=story&vybit-ghost=1');
  });

  test('uses custom base path', () => {
    expect(buildArgsUrl('test--story', {}, '/custom'))
      .toBe('/custom/iframe.html?id=test--story&viewMode=story&vybit-ghost=1');
  });
});
