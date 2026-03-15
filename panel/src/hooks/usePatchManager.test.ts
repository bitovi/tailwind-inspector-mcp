import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePatchManager } from './usePatchManager';

// Mock the ws module
vi.mock('../ws', () => ({
  sendTo: vi.fn(),
  send: vi.fn(),
}));

import { sendTo, send } from '../ws';

// Stub crypto.randomUUID for deterministic tests
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `uuid-${++uuidCounter}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  uuidCounter = 0;
});

describe('usePatchManager', () => {
  it('starts with empty patches and zero counts', () => {
    const { result } = renderHook(() => usePatchManager());
    expect(result.current.patches).toEqual([]);
    expect(result.current.counts).toEqual({ staged: 0, committed: 0, implementing: 0, implemented: 0 });
  });

  describe('preview / revertPreview', () => {
    it('sends PATCH_PREVIEW to overlay', () => {
      const { result } = renderHook(() => usePatchManager());
      act(() => result.current.preview('py-2', 'py-4'));
      expect(sendTo).toHaveBeenCalledWith('overlay', { type: 'PATCH_PREVIEW', oldClass: 'py-2', newClass: 'py-4' });
    });

    it('sends PATCH_REVERT to overlay', () => {
      const { result } = renderHook(() => usePatchManager());
      act(() => result.current.revertPreview());
      expect(sendTo).toHaveBeenCalledWith('overlay', { type: 'PATCH_REVERT' });
    });
  });

  describe('stage', () => {
    it('adds a staged patch and sends PATCH_STAGE to overlay', () => {
      const { result } = renderHook(() => usePatchManager());

      act(() => result.current.stage('Card::div/0', 'py-', 'py-2', 'py-4'));

      expect(result.current.patches).toHaveLength(1);
      expect(result.current.patches[0]).toMatchObject({
        id: 'uuid-1',
        elementKey: 'Card::div/0',
        status: 'staged',
        originalClass: 'py-2',
        newClass: 'py-4',
        property: 'py-',
      });
      expect(result.current.counts.staged).toBe(1);

      expect(sendTo).toHaveBeenCalledWith('overlay', {
        type: 'PATCH_STAGE',
        id: 'uuid-1',
        oldClass: 'py-2',
        newClass: 'py-4',
        property: 'py-',
      });
    });

    it('deduplicates by (elementKey, property) — replaces existing', () => {
      const { result } = renderHook(() => usePatchManager());

      act(() => result.current.stage('Card::div/0', 'py-', 'py-2', 'py-4'));
      act(() => result.current.stage('Card::div/0', 'py-', 'py-2', 'py-6'));

      expect(result.current.patches).toHaveLength(1);
      expect(result.current.patches[0].newClass).toBe('py-6');
      expect(result.current.patches[0].id).toBe('uuid-2'); // new UUID
      expect(result.current.counts.staged).toBe(1);
    });

    it('self-removes when newClass === originalClass', () => {
      const { result } = renderHook(() => usePatchManager());

      act(() => result.current.stage('Card::div/0', 'py-', 'py-2', 'py-4'));
      expect(result.current.patches).toHaveLength(1);

      act(() => result.current.stage('Card::div/0', 'py-', 'py-2', 'py-2'));
      expect(result.current.patches).toHaveLength(0);
      expect(result.current.counts.staged).toBe(0);
      expect(sendTo).toHaveBeenLastCalledWith('overlay', { type: 'PATCH_REVERT' });
    });

    it('allows multiple patches for different properties', () => {
      const { result } = renderHook(() => usePatchManager());

      act(() => result.current.stage('Card::div/0', 'py-', 'py-2', 'py-4'));
      act(() => result.current.stage('Card::div/0', 'px-', 'px-2', 'px-6'));

      expect(result.current.patches).toHaveLength(2);
      expect(result.current.counts.staged).toBe(2);
    });
  });

  describe('commitAll', () => {
    it('sends PATCH_COMMIT with all staged IDs and marks local patches committed', () => {
      const { result } = renderHook(() => usePatchManager());

      act(() => result.current.stage('Card::div/0', 'py-', 'py-2', 'py-4'));
      act(() => result.current.stage('Card::div/0', 'px-', 'px-2', 'px-6'));

      act(() => result.current.commitAll());

      expect(send).toHaveBeenCalledWith({ type: 'PATCH_COMMIT', ids: ['uuid-1', 'uuid-2'] });
      expect(result.current.patches.every(p => p.status === 'committed')).toBe(true);
      expect(result.current.counts.staged).toBe(0);
    });

    it('does nothing when no staged patches exist', () => {
      const { result } = renderHook(() => usePatchManager());
      act(() => result.current.commitAll());
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('discard', () => {
    it('removes a single patch by id and reverts preview', () => {
      const { result } = renderHook(() => usePatchManager());

      act(() => result.current.stage('Card::div/0', 'py-', 'py-2', 'py-4'));
      act(() => result.current.stage('Card::div/0', 'px-', 'px-2', 'px-6'));

      act(() => result.current.discard('uuid-1'));

      expect(result.current.patches).toHaveLength(1);
      expect(result.current.patches[0].id).toBe('uuid-2');
      expect(sendTo).toHaveBeenLastCalledWith('overlay', { type: 'PATCH_REVERT' });
    });
  });

  describe('discardAll', () => {
    it('clears all patches and reverts preview', () => {
      const { result } = renderHook(() => usePatchManager());

      act(() => result.current.stage('Card::div/0', 'py-', 'py-2', 'py-4'));
      act(() => result.current.stage('Card::div/0', 'px-', 'px-2', 'px-6'));

      act(() => result.current.discardAll());

      expect(result.current.patches).toHaveLength(0);
      expect(result.current.counts.staged).toBe(0);
      expect(sendTo).toHaveBeenLastCalledWith('overlay', { type: 'PATCH_REVERT' });
    });
  });

  describe('reset', () => {
    it('clears all patches without sending WS messages', () => {
      const { result } = renderHook(() => usePatchManager());

      act(() => result.current.stage('Card::div/0', 'py-', 'py-2', 'py-4'));
      vi.clearAllMocks();

      act(() => result.current.reset());

      expect(result.current.patches).toHaveLength(0);
      expect(sendTo).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('handlePatchUpdate', () => {
    const emptyPatches = { staged: [], committed: [], implementing: [], implemented: [] };

    it('updates server-side counts', () => {
      const { result } = renderHook(() => usePatchManager());

      act(() => result.current.handlePatchUpdate({ staged: 0, committed: 3, implementing: 1, implemented: 5, patches: emptyPatches }));

      expect(result.current.counts).toEqual({ staged: 0, committed: 3, implementing: 1, implemented: 5 });
    });

    it('merges local staged count with server counts', () => {
      const { result } = renderHook(() => usePatchManager());

      act(() => result.current.stage('Card::div/0', 'py-', 'py-2', 'py-4'));
      act(() => result.current.handlePatchUpdate({ staged: 0, committed: 2, implementing: 0, implemented: 1, patches: emptyPatches }));

      expect(result.current.counts).toEqual({ staged: 1, committed: 2, implementing: 0, implemented: 1 });
    });

    it('stores server patch summaries', () => {
      const { result } = renderHook(() => usePatchManager());

      const committedPatch = {
        id: 'server-1', elementKey: 'Card::div/0', status: 'committed' as const,
        originalClass: 'py-2', newClass: 'py-4', property: 'py-', timestamp: '2026-01-01T00:00:00Z',
      };
      act(() => result.current.handlePatchUpdate({
        staged: 0, committed: 1, implementing: 0, implemented: 0,
        patches: { staged: [], committed: [committedPatch], implementing: [], implemented: [] },
      }));

      expect(result.current.serverPatches.committed).toHaveLength(1);
      expect(result.current.serverPatches.committed[0].id).toBe('server-1');
    });
  });
});
