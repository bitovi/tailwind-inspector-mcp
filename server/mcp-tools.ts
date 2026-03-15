// MCP tool registration

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { Patch, PatchStatus } from "../shared/types.js";

export interface McpToolDeps {
  broadcastPatchUpdate: () => void;
  getNextCommitted: () => Patch | null;
  onCommitted: (listener: () => void) => () => void;
  markImplementing: (ids: string[]) => number;
  markImplemented: (ids: string[]) => number;
  getByStatus: (status: PatchStatus) => Patch[];
  getCounts: () => { staged: number; committed: number; implementing: number; implemented: number };
  clearAll: () => { staged: number; committed: number; implementing: number; implemented: number };
}

const KEEPALIVE_INTERVAL_MS = 60_000;

function buildWorkflowInstructions(patch: Patch): string {
  const comp = patch.component?.name ?? 'unknown component';
  const tag = patch.target?.tag ?? 'element';
  return `# Implement Tailwind Change

## What changed
- **Component:** ${comp}
- **Element:** \`<${tag}>\`
- **Class change:** \`${patch.originalClass}\` → \`${patch.newClass}\`
- **Property:** ${patch.property}

## Steps

1. **Use a subagent** to find the component file for \`${comp}\` and apply the class change.
   Pass the subagent the embedded prompt resource \`prompt://implement-change\` from this response.

2. **After the subagent finishes**, call the MCP tool \`mark_change_implemented\` with:
   \`\`\`json
   { "ids": ["${patch.id}"] }
   \`\`\`

3. **Call \`get_next_change\`** again to continue processing the next queued change.
`;
}

function buildImplementPrompt(patch: Patch): string {
  const context = patch.context ?? '';
  return `# Implement a Tailwind CSS Class Change

You are implementing a visual change that a user made in the Tailwind Inspector.

## Change Details
- **Original class:** \`${patch.originalClass}\`
- **New class:** \`${patch.newClass}\`
- **Property:** ${patch.property}
- **Component:** ${patch.component?.name ?? 'unknown'}
- **Element tag:** \`<${patch.target?.tag ?? 'div'}>\`
- **Element classes:** \`${patch.target?.classes ?? ''}\`

## Context HTML
\`\`\`html
${context}
\`\`\`

## Instructions
1. Find the source file for the component \`${patch.component?.name ?? 'unknown'}\`.
2. Locate the element that has the class \`${patch.originalClass}\` (use the context HTML above for guidance).
3. Replace \`${patch.originalClass}\` with \`${patch.newClass}\` in the source code.
4. Save the file.
`;
}

export function registerMcpTools(mcp: McpServer, deps: McpToolDeps): void {
  const {
    broadcastPatchUpdate,
    getNextCommitted,
    onCommitted,
    markImplementing,
    markImplemented,
    getByStatus,
    getCounts,
    clearAll,
  } = deps;

  // --- get_next_change ---
  mcp.tool(
    "get_next_change",
    "Waits for and returns the next committed change for the agent to implement. " +
    "Transitions the change to 'implementing' status. Returns patch data, " +
    "workflow instructions, and an embedded prompt for subagent implementation.",
    async (_extra) => {
      // _extra is RequestHandlerExtra when no args schema is provided
      const extra = _extra as any;

      let patch = getNextCommitted();

      if (!patch) {
        // Wait for a committed patch
        patch = await new Promise<Patch>((resolve, reject) => {
          const progressToken = extra?._meta?.progressToken;

          // Keepalive progress notifications
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

          // Listen for cancellation
          const onAbort = () => {
            clearInterval(keepalive);
            unsubscribe();
            reject(new Error("Cancelled"));
          };
          extra?.signal?.addEventListener?.("abort", onAbort);

          // Listen for commit
          const unsubscribe = onCommitted(() => {
            const next = getNextCommitted();
            if (next) {
              clearInterval(keepalive);
              extra?.signal?.removeEventListener?.("abort", onAbort);
              resolve(next);
            }
          });
        });
      }

      // Transition to implementing
      markImplementing([patch.id]);
      broadcastPatchUpdate();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(patch, null, 2),
          },
          {
            type: "text" as const,
            text: buildWorkflowInstructions(patch),
          },
          {
            type: "resource" as const,
            resource: {
              uri: "prompt://implement-change",
              mimeType: "text/markdown",
              text: buildImplementPrompt(patch),
            },
          },
        ],
      };
    },
  );

  // --- mark_change_implemented ---
  mcp.tool(
    "mark_change_implemented",
    "Marks changes as implemented after the agent has applied them to source code",
    { ids: z.array(z.string()).describe("Patch IDs to mark as implemented") },
    async ({ ids }) => {
      const moved = markImplemented(ids);
      broadcastPatchUpdate();
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ moved }) }],
      };
    },
  );

  // --- list_changes ---
  mcp.tool(
    "list_changes",
    "Lists changes, optionally filtered by status. Returns all changes grouped by status if no filter is provided.",
    { status: z.enum(["staged", "committed", "implementing", "implemented"]).optional().describe("Filter by patch status") },
    async ({ status }) => {
      if (status) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(getByStatus(status), null, 2) }],
        };
      }
      const counts = getCounts();
      const all = {
        ...counts,
        patches: {
          staged: getByStatus("staged"),
          committed: getByStatus("committed"),
          implementing: getByStatus("implementing"),
          implemented: getByStatus("implemented"),
        },
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(all, null, 2) }],
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
