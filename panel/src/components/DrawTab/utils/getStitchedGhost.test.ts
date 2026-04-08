import { describe, it, expect, vi } from 'vitest';
import { getStitchedGhost } from './getStitchedGhost';

// Mock stitch-ghost-slots
vi.mock('./stitch-ghost-slots', () => ({
  stitchGhostSlots: (html: string, css: string, _args: Record<string, unknown>) => ({ ghostHtml: html, ghostCss: css }),
}));

describe('getStitchedGhost', () => {
  it('prefers live values over cached', () => {
    const result = getStitchedGhost('live-html', 'live-css', 'cached-html', 'cached-css', {});
    expect(result).toEqual({ ghostHtml: 'live-html', ghostCss: 'live-css' });
  });

  it('falls back to cached values when live is null', () => {
    const result = getStitchedGhost(null, null, 'cached-html', 'cached-css', {});
    expect(result).toEqual({ ghostHtml: 'cached-html', ghostCss: 'cached-css' });
  });

  it('returns empty strings when all sources are empty', () => {
    const result = getStitchedGhost(null, null, undefined, undefined, {});
    expect(result).toEqual({ ghostHtml: '', ghostCss: '' });
  });
});
