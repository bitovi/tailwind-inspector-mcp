import { useState, useCallback, useRef } from 'react';
import type { Patch, PatchStatus, PatchSummary } from '../../../shared/types';
import { sendTo, send } from '../ws';

export interface PatchCounts {
  staged: number;
  committed: number;
  implementing: number;
  implemented: number;
}

export interface ServerPatches {
  staged: PatchSummary[];
  committed: PatchSummary[];
  implementing: PatchSummary[];
  implemented: PatchSummary[];
}

export interface PatchManager {
  /** All patches for the current element (staged only — committed patches live on the server) */
  patches: Patch[];
  /** Counts across all statuses (staged is local, rest from server) */
  counts: PatchCounts;
  /** Server-side patch summaries by status */
  serverPatches: ServerPatches;
  /** Live-preview a class swap in the overlay */
  preview: (oldClass: string, newClass: string) => void;
  /** Revert any active preview in the overlay */
  revertPreview: () => void;
  /** Stage a change — upserts by (elementKey, property). Removes if newClass === originalClass. */
  stage: (elementKey: string, property: string, originalClass: string, newClass: string) => void;
  /** Commit all staged patches to the server */
  commitAll: () => void;
  /** Discard a single staged patch by id */
  discard: (id: string) => void;
  /** Discard all staged patches */
  discardAll: () => void;
  /** Reset all local state (on element change) */
  reset: () => void;
  /** Handle a PATCH_UPDATE message from the server */
  handlePatchUpdate: (data: {
    staged: number; committed: number; implementing: number; implemented: number;
    patches: ServerPatches;
  }) => void;
}

export function usePatchManager(): PatchManager {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [serverCounts, setServerCounts] = useState({ staged: 0, committed: 0, implementing: 0, implemented: 0 });
  const [serverPatches, setServerPatches] = useState<ServerPatches>({ staged: [], committed: [], implementing: [], implemented: [] });
  const patchesRef = useRef(patches);
  patchesRef.current = patches;

  const preview = useCallback((oldClass: string, newClass: string) => {
    sendTo('overlay', { type: 'PATCH_PREVIEW', oldClass, newClass });
  }, []);

  const revertPreview = useCallback(() => {
    sendTo('overlay', { type: 'PATCH_REVERT' });
  }, []);

  const stage = useCallback((elementKey: string, property: string, originalClass: string, newClass: string) => {
    // Self-removal: if reverting to original, remove the patch
    if (newClass === originalClass) {
      setPatches(prev => prev.filter(p => !(p.elementKey === elementKey && p.property === property)));
      sendTo('overlay', { type: 'PATCH_REVERT' });
      return;
    }

    const id = crypto.randomUUID();

    setPatches(prev => {
      // Dedup: remove existing patch for same element+property
      const filtered = prev.filter(p => !(p.elementKey === elementKey && p.property === property));
      const patch: Patch = {
        id,
        elementKey,
        status: 'staged',
        originalClass,
        newClass,
        property,
        timestamp: new Date().toISOString(),
      };
      return [...filtered, patch];
    });

    // Tell the overlay to stage (it will fill in context and send PATCH_STAGED to server)
    sendTo('overlay', {
      type: 'PATCH_STAGE',
      id,
      oldClass: originalClass,
      newClass,
      property,
    });
  }, []);

  const commitAll = useCallback(() => {
    const current = patchesRef.current;
    const stagedIds = current.filter(p => p.status === 'staged').map(p => p.id);
    if (stagedIds.length === 0) return;

    // Send commit to server
    send({ type: 'PATCH_COMMIT', ids: stagedIds });

    // Move local patches to committed
    setPatches(prev =>
      prev.map(p => stagedIds.includes(p.id) ? { ...p, status: 'committed' as PatchStatus } : p)
    );
  }, []);

  const discard = useCallback((id: string) => {
    setPatches(prev => prev.filter(p => p.id !== id));
    sendTo('overlay', { type: 'PATCH_REVERT' });
  }, []);

  const discardAll = useCallback(() => {
    setPatches([]);
    sendTo('overlay', { type: 'PATCH_REVERT' });
  }, []);

  const reset = useCallback(() => {
    setPatches([]);
  }, []);

  const handlePatchUpdate = useCallback((data: {
    staged: number; committed: number; implementing: number; implemented: number;
    patches: ServerPatches;
  }) => {
    setServerCounts({ staged: data.staged, committed: data.committed, implementing: data.implementing, implemented: data.implemented });
    setServerPatches(data.patches);
  }, []);

  const stagedCount = patches.filter(p => p.status === 'staged').length;

  const counts: PatchCounts = {
    staged: stagedCount,
    committed: serverCounts.committed,
    implementing: serverCounts.implementing,
    implemented: serverCounts.implemented,
  };

  return {
    patches,
    counts,
    serverPatches,
    preview,
    revertPreview,
    stage,
    commitAll,
    discard,
    discardAll,
    reset,
    handlePatchUpdate,
  };
}
