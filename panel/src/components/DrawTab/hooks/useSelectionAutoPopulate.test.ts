import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSelectionAutoPopulate } from './useSelectionAutoPopulate';

// Mock mapPropsToArgs
vi.mock('../utils/mapPropsToArgs', () => ({
  mapPropsToArgs: vi.fn(
    (fiberProps: Record<string, unknown>, _argTypes: Record<string, unknown>, _resolver?: unknown) => {
      // Simple passthrough: return all fiberProps keys
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fiberProps)) {
        if (v !== undefined) result[k] = v;
      }
      return result;
    },
  ),
}));

describe('useSelectionAutoPopulate', () => {
  const baseParams = {
    matchedBySelection: false,
    selectionProps: undefined as Record<string, unknown> | undefined,
    effectiveArgTypes: {} as Record<string, any>,
    groupName: 'Button',
    liveReady: false,
    loadLiveRequested: false,
    args: {},
    onExpand: vi.fn(),
    onRequestLiveRefresh: vi.fn(),
    onArgsChange: vi.fn(),
    onScrollIntoView: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when not matched', () => {
    renderHook(() => useSelectionAutoPopulate(baseParams));
    expect(baseParams.onExpand).not.toHaveBeenCalled();
  });

  it('expands even when argTypes are empty (no args populated)', () => {
    const onExpand = vi.fn();
    const onArgsChange = vi.fn();
    const onScrollIntoView = vi.fn();
    renderHook(() =>
      useSelectionAutoPopulate({
        ...baseParams,
        matchedBySelection: true,
        selectionProps: { variant: 'primary' },
        onExpand,
        onArgsChange,
        onScrollIntoView,
      }),
    );
    expect(onExpand).toHaveBeenCalledOnce();
    expect(onScrollIntoView).toHaveBeenCalledOnce();
    // Args not populated because argTypes is empty
    expect(onArgsChange).not.toHaveBeenCalled();
  });

  it('expands even without selectionProps', () => {
    const onExpand = vi.fn();
    const onArgsChange = vi.fn();
    const onScrollIntoView = vi.fn();
    renderHook(() =>
      useSelectionAutoPopulate({
        ...baseParams,
        matchedBySelection: true,
        selectionProps: undefined,
        onExpand,
        onArgsChange,
        onScrollIntoView,
      }),
    );
    expect(onExpand).toHaveBeenCalledOnce();
    expect(onScrollIntoView).toHaveBeenCalledOnce();
    expect(onArgsChange).not.toHaveBeenCalled();
  });

  it('auto-expands and applies args when matched with argTypes', () => {
    const onExpand = vi.fn();
    const onRequestLiveRefresh = vi.fn();
    const onArgsChange = vi.fn();
    const onScrollIntoView = vi.fn();

    renderHook(() =>
      useSelectionAutoPopulate({
        ...baseParams,
        matchedBySelection: true,
        selectionProps: { variant: 'primary' },
        effectiveArgTypes: { variant: { control: 'select' } },
        onExpand,
        onRequestLiveRefresh,
        onArgsChange,
        onScrollIntoView,
      }),
    );

    expect(onExpand).toHaveBeenCalledOnce();
    expect(onRequestLiveRefresh).toHaveBeenCalledOnce();
    expect(onArgsChange).toHaveBeenCalledWith({ variant: 'primary' });
    expect(onScrollIntoView).toHaveBeenCalledOnce();
  });

  it('does not re-apply when called with same props', () => {
    const onExpand = vi.fn();
    const params = {
      ...baseParams,
      matchedBySelection: true,
      selectionProps: { variant: 'primary' },
      effectiveArgTypes: { variant: { control: 'select' } },
      onExpand,
    };

    const { rerender } = renderHook(
      (props) => useSelectionAutoPopulate(props),
      { initialProps: params },
    );

    expect(onExpand).toHaveBeenCalledTimes(1);

    rerender(params);
    // Still only called once — dedup prevents re-apply
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('re-applies args when selectionProps change', () => {
    const onExpand = vi.fn();
    const onArgsChange = vi.fn();
    const params1 = {
      ...baseParams,
      matchedBySelection: true,
      selectionProps: { variant: 'primary' },
      effectiveArgTypes: { variant: { control: 'select' } },
      onExpand,
      onArgsChange,
    };

    const { rerender } = renderHook(
      (props) => useSelectionAutoPopulate(props),
      { initialProps: params1 },
    );
    // Expand fires once
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onArgsChange).toHaveBeenCalledTimes(1);

    const params2 = { ...params1, selectionProps: { variant: 'secondary' } };
    rerender(params2);
    // Expand not re-fired (same groupName), but args re-applied
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onArgsChange).toHaveBeenCalledTimes(2);
  });

  it('skips onRequestLiveRefresh when already live', () => {
    const onRequestLiveRefresh = vi.fn();
    renderHook(() =>
      useSelectionAutoPopulate({
        ...baseParams,
        matchedBySelection: true,
        selectionProps: { variant: 'primary' },
        effectiveArgTypes: { variant: { control: 'select' } },
        liveReady: true,
        onRequestLiveRefresh,
      }),
    );
    expect(onRequestLiveRefresh).not.toHaveBeenCalled();
  });

  it('resets when matchedBySelection becomes false', () => {
    const onExpand = vi.fn();
    const onArgsChange = vi.fn();
    const params: typeof baseParams = {
      ...baseParams,
      matchedBySelection: true,
      selectionProps: { variant: 'primary' },
      effectiveArgTypes: { variant: { control: 'select' } },
      onExpand,
      onArgsChange,
    };

    const { rerender } = renderHook(
      (props) => useSelectionAutoPopulate(props),
      { initialProps: params },
    );
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onArgsChange).toHaveBeenCalledTimes(1);

    // Deselect
    rerender({ ...params, matchedBySelection: false, selectionProps: undefined });

    // Re-select with same props — should expand + apply args again because refs were reset
    rerender(params);
    expect(onExpand).toHaveBeenCalledTimes(2);
    expect(onArgsChange).toHaveBeenCalledTimes(2);
  });

  describe('propsAreStoryArgs (ghost element path)', () => {
    it('applies story args directly without mapping, even without argTypes', () => {
      const onArgsChange = vi.fn();
      const onExpand = vi.fn();
      renderHook(() =>
        useSelectionAutoPopulate({
          ...baseParams,
          matchedBySelection: true,
          selectionProps: { variant: 'primary', label: 'Click me' },
          effectiveArgTypes: {},  // no argTypes yet — normally this blocks
          propsAreStoryArgs: true,
          onExpand,
          onArgsChange,
        }),
      );
      expect(onExpand).toHaveBeenCalledOnce();
      // Args applied even without argTypes
      expect(onArgsChange).toHaveBeenCalledWith({ variant: 'primary', label: 'Click me' });
    });

    it('re-applies after liveReady changes (survives PROBE_COMPLETE reset)', () => {
      const onArgsChange = vi.fn();
      const params = {
        ...baseParams,
        matchedBySelection: true,
        selectionProps: { variant: 'primary' },
        propsAreStoryArgs: true,
        liveReady: false,
        onArgsChange,
      };

      const { rerender } = renderHook(
        (props) => useSelectionAutoPopulate(props),
        { initialProps: params },
      );
      expect(onArgsChange).toHaveBeenCalledTimes(1);

      // Simulate PROBE_COMPLETE resetting args to defaults + liveReady=true
      rerender({ ...params, liveReady: true, args: { variant: 'default' } });
      // Should re-apply because liveReady changed (dedup key includes liveReady)
      expect(onArgsChange).toHaveBeenCalledTimes(2);
      expect(onArgsChange).toHaveBeenLastCalledWith({ variant: 'primary' });
    });

    it('does not call mapPropsToArgs', async () => {
      const mod = await import('../utils/mapPropsToArgs');
      const spy = vi.mocked(mod.mapPropsToArgs);
      spy.mockClear();

      renderHook(() =>
        useSelectionAutoPopulate({
          ...baseParams,
          matchedBySelection: true,
          selectionProps: { variant: 'primary' },
          effectiveArgTypes: { variant: { control: 'select' } },
          propsAreStoryArgs: true,
        }),
      );
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
