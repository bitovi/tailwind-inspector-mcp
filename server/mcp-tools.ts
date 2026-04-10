// MCP tool registration

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { Patch, PatchStatus, Commit } from "../shared/types.js";
import type { PatchResult } from "./queue.js";
import { buildContentParts } from "../shared/mcp-format.js";

export interface McpToolDeps {
  broadcastPatchUpdate: () => void;
  getNextCommitted: () => Commit | null;
  onCommitted: (listener: () => void) => () => void;
  reclaimImplementingCommits: () => number;
  markCommitImplementing: (commitId: string) => void;
  markCommitImplemented: (commitId: string, results: PatchResult[]) => void;
  // Legacy per-patch methods (backward compat)
  markImplementing: (ids: string[]) => number;
  markImplemented: (ids: string[]) => number;
  getByStatus: (status: PatchStatus) => Patch[];
  getCounts: () => { staged: number; committed: number; implementing: number; implemented: number };
  getQueueUpdate: () => any;
  clearAll: () => { staged: number; committed: number; implementing: number; implemented: number };
}

const KEEPALIVE_INTERVAL_MS = 60_000;

// ---------------------------------------------------------------------------
// Wait-for-committed helper (shared by get_next_change and implement_next_change)
// ---------------------------------------------------------------------------

function waitForCommitted(
  getNextCommitted: () => Commit | null,
  onCommitted: (listener: () => void) => () => void,
  extra: any,
  broadcastPatchUpdate: () => void,
): Promise<Commit> {
  return new Promise<Commit>((resolve, reject) => {
    const progressToken = extra?._meta?.progressToken;

    const keepalive = setInterval(async () => {
      if (progressToken !== undefined) {
        try {
          await extra.sendNotification({
            method: "notifications/progress",
            params: {
              progressToken,
              progress: 0,
              total: 1,
              message: "Waiting for user to commit a change...",
            },
          });
        } catch {
          // Client may have disconnected
        }
      }
    }, KEEPALIVE_INTERVAL_MS);

    const onAbort = () => {
      clearInterval(keepalive);
      unsubscribe();
      // Notify the panel that no agent is waiting anymore
      broadcastPatchUpdate();
      reject(new Error("Cancelled"));
    };
    extra?.signal?.addEventListener?.("abort", onAbort);

    const unsubscribe = onCommitted(() => {
      const next = getNextCommitted();
      if (next) {
        clearInterval(keepalive);
        extra?.signal?.removeEventListener?.("abort", onAbort);
        resolve(next);
      }
    });

    // Notify the panel that an agent is now waiting
    broadcastPatchUpdate();
  });
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerMcpTools(mcp: McpServer, deps: McpToolDeps): void {
  const {
    broadcastPatchUpdate,
    getNextCommitted,
    onCommitted,
    reclaimImplementingCommits,
    markCommitImplementing,
    markCommitImplemented,
    markImplementing,
    markImplemented,
    getByStatus,
    getCounts,
    getQueueUpdate,
    clearAll,
  } = deps;

  // --- get_next_change ---
  mcp.tool(
    "get_next_change",
    "Waits for and returns the next committed change (full commit with all patches). " +
    "Transitions the commit to 'implementing' status. " +
    "Returns only the raw commit data — no workflow instructions. " +
    "Use implement_next_change instead if you want guided implementation with auto-looping.",
    async (_extra) => {
      const extra = _extra as any;

      const reclaimed = reclaimImplementingCommits();
      if (reclaimed > 0) broadcastPatchUpdate();

      let commit = getNextCommitted();
      if (!commit) {
        commit = await waitForCommitted(getNextCommitted, onCommitted, extra, broadcastPatchUpdate);
      }

      if (extra?.signal?.aborted) {
        throw new Error('Cancelled');
      }

      markCommitImplementing(commit.id);
      broadcastPatchUpdate();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(commit, null, 2),
          },
        ],
      };
    },
  );

  // --- implement_next_change ---
  mcp.tool(
    "implement_next_change",
    "CONTINUOUS LOOP: Waits for the next committed change (a commit with class-changes and context messages), " +
    "returns implementation instructions, and REQUIRES the agent to apply all class-changes, mark them done, " +
    "then call this tool AGAIN. Messages in the commit provide context for understanding intent. " +
    "The agent MUST keep calling this tool in a loop until explicitly stopped by the user.",
    async (_extra) => {
      const extra = _extra as any;

      const reclaimed = reclaimImplementingCommits();
      if (reclaimed > 0) broadcastPatchUpdate();

      let commit = getNextCommitted();
      if (!commit) {
        commit = await waitForCommitted(getNextCommitted, onCommitted, extra, broadcastPatchUpdate);
      }

      if (extra?.signal?.aborted) {
        throw new Error('Cancelled');
      }

      markCommitImplementing(commit.id);
      broadcastPatchUpdate();

      // Count remaining committed commits (excluding this one, which is now 'implementing')
      const queueState = getQueueUpdate();
      const remaining = queueState.committedCount;

      return { content: buildContentParts(commit, remaining) };
    },
  );

  // --- mark_change_implemented ---
  mcp.tool(
    "mark_change_implemented",
    "Marks changes as implemented after the agent has applied them to source code. " +
    "Accepts either commitId + per-patch results (new) or legacy ids array. " +
    "After calling this, you MUST call implement_next_change again to continue processing.",
    {
      commitId: z.string().optional().describe("The commit ID (new commit-based flow)"),
      results: z.array(z.object({
        patchId: z.string().describe("ID of a class-change patch"),
        success: z.boolean(),
        error: z.string().optional(),
      })).optional().describe("Per-patch results (class-change patches only — skip message patches)"),
      ids: z.array(z.string()).optional().describe("Legacy: Patch IDs to mark as implemented"),
    },
    async ({ commitId, results, ids }) => {
      let moved = 0;

      if (commitId && results) {
        // New commit-based flow
        markCommitImplemented(commitId, results);
        moved = results.filter(r => r.success).length;
      } else if (ids) {
        // Legacy per-patch flow
        moved = markImplemented(ids);
      }

      broadcastPatchUpdate();

      const counts = getCounts();
      const remaining = counts.committed + counts.implementing;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              moved,
              isComplete: false,
              nextAction: "call implement_next_change NOW to process the next change",
              remainingInQueue: remaining,
            }),
          },
          {
            type: "text" as const,
            text: `✅ Marked ${moved} change(s) as implemented.\n\n` +
              `⚠️ **YOUR NEXT STEP:** Call \`implement_next_change\` NOW.\n` +
              `Do NOT stop. Do NOT summarize. Do NOT ask the user what to do.\n` +
              `${remaining > 0 ? `There are ${remaining} more change(s) to process.` : 'No more changes right now — call implement_next_change to wait for the next one.'}`,
          },
        ],
      };
    },
  );

  // --- list_changes ---
  mcp.tool(
    "list_changes",
    "Lists changes grouped by commit status. Optionally filter by a specific status.",
    { status: z.enum(["staged", "committed", "implementing", "implemented", "error"]).optional().describe("Filter by patch status") },
    async ({ status }) => {
      if (status) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(getByStatus(status), null, 2) }],
        };
      }
      const queueState = getQueueUpdate();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(queueState, null, 2) }],
      };
    },
  );

  // --- discard_all_changes ---
  mcp.tool(
    "discard_all_changes",
    "Discards all changes regardless of status",
    async () => {
      const counts = clearAll();
      broadcastPatchUpdate();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(counts) }],
      };
    },
  );

}
