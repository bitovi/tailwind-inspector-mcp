// In-memory patch queue for the static demo
// Replaces server/queue.ts — browser-only, no Node APIs

import type { Patch, PatchSummary, Commit, CommitSummary, CommitStatus } from '../shared/types';
import { send } from './bus';

function toSummary(p: Patch): PatchSummary {
  return {
    id: p.id,
    kind: p.kind,
    elementKey: p.elementKey,
    status: p.status,
    originalClass: p.originalClass,
    newClass: p.newClass,
    property: p.property,
    timestamp: p.timestamp,
    component: p.component,
    errorMessage: p.errorMessage,
    message: p.message,
  };
}

function toCommitSummary(c: Commit): CommitSummary {
  return {
    id: c.id,
    status: c.status,
    timestamp: c.timestamp,
    patches: c.patches.map(toSummary),
  };
}

const draftPatches: Patch[] = [];
const commits: Commit[] = [];

export function addPatch(patch: Patch): Patch {
  if (draftPatches.some(p => p.id === patch.id)) return patch;

  if (patch.kind === 'class-change') {
    const existingIdx = draftPatches.findIndex(
      p => p.kind === 'class-change' && p.elementKey === patch.elementKey && p.property === patch.property && p.status === 'staged'
    );
    if (existingIdx !== -1) draftPatches.splice(existingIdx, 1);
  }
  draftPatches.push(patch);
  return patch;
}

export function commitDraft(ids: string[]): Commit {
  const idSet = new Set(ids);
  const commitPatches: Patch[] = [];

  for (let i = draftPatches.length - 1; i >= 0; i--) {
    if (idSet.has(draftPatches[i].id) && draftPatches[i].status === 'staged') {
      draftPatches[i].status = 'committed';
      commitPatches.unshift(draftPatches[i]);
      draftPatches.splice(i, 1);
    }
  }

  const commit: Commit = {
    id: crypto.randomUUID(),
    patches: commitPatches,
    status: 'committed',
    timestamp: new Date().toISOString(),
  };

  for (const p of commit.patches) {
    p.commitId = commit.id;
  }

  commits.push(commit);
  return commit;
}

export function discardPatch(id: string): void {
  const idx = draftPatches.findIndex(p => p.id === id);
  if (idx !== -1) draftPatches.splice(idx, 1);
}

export function discardAllDrafts(): void {
  draftPatches.length = 0;
}

export function discardCommit(commitId: string): void {
  const idx = commits.findIndex(c => c.id === commitId);
  if (idx !== -1) commits.splice(idx, 1);
}

export function markCommitImplementing(commitId: string): void {
  const commit = commits.find(c => c.id === commitId);
  if (!commit) return;
  commit.status = 'implementing';
  for (const p of commit.patches) {
    if (p.status === 'committed') p.status = 'implementing';
  }
}

export function markCommitImplemented(commitId: string): void {
  const commit = commits.find(c => c.id === commitId);
  if (!commit) return;
  commit.status = 'implemented';
  for (const p of commit.patches) {
    p.status = 'implemented';
  }
}

export function getQueueUpdate() {
  let committedCount = 0;
  let implementingCount = 0;
  let implementedCount = 0;
  let partialCount = 0;
  let errorCount = 0;
  for (const c of commits) {
    switch (c.status) {
      case 'committed': committedCount++; break;
      case 'implementing': implementingCount++; break;
      case 'implemented': implementedCount++; break;
      case 'partial': partialCount++; break;
      case 'error': errorCount++; break;
    }
  }

  return {
    type: 'QUEUE_UPDATE' as const,
    draftCount: draftPatches.length,
    committedCount,
    implementingCount,
    implementedCount,
    partialCount,
    errorCount,
    draft: draftPatches.map(toSummary),
    commits: commits.map(toCommitSummary),
    agentWaiting: true, // suppress "no agent" warning in demo
  };
}

export function broadcastQueueUpdate(): void {
  send(getQueueUpdate());
}
