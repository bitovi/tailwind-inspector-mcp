import { useEffect, useRef } from 'react';
import type { ArgType } from '../types';
import { mapFiberPropsToArgs } from '../utils/mapFiberPropsToArgs';
import type { ComponentGhostResolver } from '../utils/mapFiberPropsToArgs';

interface UseSelectionAutoPopulateParams {
  /** Whether this component row matches the currently selected page element */
  matchedBySelection: boolean;
  /** Serialized fiber props from the selected element */
  selectionProps: Record<string, unknown> | undefined;
  /** Effective argTypes for this component (probed or from group) */
  effectiveArgTypes: Record<string, ArgType>;
  /** Component name (for dedup key) */
  groupName: string;
  /** Card lifecycle flags */
  liveReady: boolean;
  loadLiveRequested: boolean;
  /** Current args */
  args: Record<string, unknown>;
  /** Optional resolver for child component ghosts */
  resolveComponentGhost?: ComponentGhostResolver;
  /**
   * When true, selectionProps are already Storybook story args (e.g. from a
   * ghost element's componentArgs) and should be applied directly — skip
   * mapFiberPropsToArgs. Also re-applies after liveReady changes so that
   * PROBE_COMPLETE default-arg resets don't wipe the selection.
   */
  propsAreStoryArgs?: boolean;
  /** Callbacks */
  onExpand: () => void;
  onRequestLiveRefresh: () => void;
  onArgsChange: (args: Record<string, unknown>) => void;
  onScrollIntoView: () => void;
}

/**
 * Auto-expands a component row and populates its args when it matches the
 * currently selected page element. Deduplicates by component name + argTypes
 * + selection props to avoid re-applying on every render.
 */
export function useSelectionAutoPopulate({
  matchedBySelection,
  selectionProps,
  effectiveArgTypes,
  groupName,
  liveReady,
  loadLiveRequested,
  args,
  resolveComponentGhost,
  propsAreStoryArgs,
  onExpand,
  onRequestLiveRefresh,
  onArgsChange,
  onScrollIntoView,
}: UseSelectionAutoPopulateParams): void {
  const appliedKeyRef = useRef<string | null>(null);
  const expandedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!matchedBySelection) {
      appliedKeyRef.current = null;
      expandedForRef.current = null;
      return;
    }

    // Always expand + scroll when matched, even without selectionProps.
    // Dedup by groupName so we don't re-expand on every render.
    if (expandedForRef.current !== groupName) {
      expandedForRef.current = groupName;
      onExpand();
      if (!liveReady && !loadLiveRequested) {
        onRequestLiveRefresh();
      }
      onScrollIntoView();
    }

    if (!selectionProps) return;

    if (propsAreStoryArgs) {
      // Ghost element: componentArgs are already Storybook story args.
      // Apply directly without mapping. Include liveReady in dedup key so
      // we re-apply after PROBE_COMPLETE resets args to defaults.
      const matchKey = 'ghost:' + groupName + ':' + liveReady + ':' + JSON.stringify(selectionProps);
      if (appliedKeyRef.current === matchKey) return;
      appliedKeyRef.current = matchKey;

      if (Object.keys(selectionProps).length > 0) {
        onArgsChange({ ...args, ...selectionProps });
      }
      return;
    }

    // Fiber props path: need argTypes to map
    if (Object.keys(effectiveArgTypes).length === 0) return;

    // Dedup: don't re-apply for the same selection + argTypes + props combo
    const matchKey = groupName + ':' + Object.keys(effectiveArgTypes).join(',') + ':' + JSON.stringify(selectionProps);
    if (appliedKeyRef.current === matchKey) return;
    appliedKeyRef.current = matchKey;

    const mappedArgs = mapFiberPropsToArgs(selectionProps, effectiveArgTypes, resolveComponentGhost);
    if (Object.keys(mappedArgs).length > 0) {
      onArgsChange({ ...args, ...mappedArgs });
    }
  }, [matchedBySelection, selectionProps, effectiveArgTypes, groupName, liveReady, loadLiveRequested, args, resolveComponentGhost, propsAreStoryArgs, onExpand, onRequestLiveRefresh, onArgsChange, onScrollIntoView]);
}
