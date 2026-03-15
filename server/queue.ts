// In-memory patch queue using the PATCH protocol

import type { Patch, PatchStatus, PatchSummary } from '../shared/types.js';

function toSummary(p: Patch): PatchSummary {
  return {
    id: p.id,
    elementKey: p.elementKey,
    status: p.status,
    originalClass: p.originalClass,
    newClass: p.newClass,
    property: p.property,
    timestamp: p.timestamp,
    component: p.component,
    errorMessage: p.errorMessage,
  };
}

// All patches, keyed by status
const patches: Patch[] = [];

export function addPatch(patch: Patch): Patch {
  // Dedup: if a staged patch exists for the same elementKey+property, replace it
  const existingIdx = patches.findIndex(
    p => p.elementKey === patch.elementKey && p.property === patch.property && p.status === 'staged'
  );
  if (existingIdx !== -1) {
    patches.splice(existingIdx, 1);
  }
  patches.push(patch);
  return patch;
}

export function commitPatches(ids: string[]): number {
  const idSet = new Set(ids);
  let moved = 0;
  for (const p of patches) {
    if (idSet.has(p.id) && p.status === 'staged') {
      p.status = 'committed';
      moved++;
    }
  }
  return moved;
}

export function getByStatus(status: PatchStatus): Patch[] {
  return patches.filter(p => p.status === status);
}

export function getCounts(): { staged: number; committed: number; implementing: number; implemented: number } {
  const counts = { staged: 0, committed: 0, implementing: 0, implemented: 0 };
  for (const p of patches) {
    if (p.status in counts) {
      counts[p.status as keyof typeof counts]++;
    }
  }
  return counts;
}

/** Build the full PATCH_UPDATE payload (counts + summary arrays) */
export function getPatchUpdate() {
  const counts = getCounts();
  return {
    ...counts,
    patches: {
      staged: patches.filter(p => p.status === 'staged').map(toSummary),
      committed: patches.filter(p => p.status === 'committed').map(toSummary),
      implementing: patches.filter(p => p.status === 'implementing').map(toSummary),
      implemented: patches.filter(p => p.status === 'implemented').map(toSummary),
    },
  };
}

export function markImplementing(ids: string[]): number {
  const idSet = new Set(ids);
  let moved = 0;
  for (const p of patches) {
    if (idSet.has(p.id) && p.status === 'committed') {
      p.status = 'implementing';
      moved++;
    }
  }
  return moved;
}

export function markImplemented(ids: string[]): number {
  const idSet = new Set(ids);
  let moved = 0;
  for (const p of patches) {
    if (idSet.has(p.id) && (p.status === 'committed' || p.status === 'implementing')) {
      p.status = 'implemented';
      moved++;
    }
  }
  return moved;
}

export function clearAll(): { staged: number; committed: number; implementing: number; implemented: number } {
  const counts = getCounts();
  patches.length = 0;
  return counts;
}
