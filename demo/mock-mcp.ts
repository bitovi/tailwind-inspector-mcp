// Console-log MCP tool calls when patches are committed.
// Uses the same shared formatting as the real MCP server so visitors
// see exactly what an AI agent receives from implement_next_change.

import type { Commit } from '../shared/types';
import { buildContentParts, printContentParts } from '../shared/mcp-format';

export function logMcpCommit(commit: Commit, remainingCount: number): void {
  console.log(
    '%c🤖 MCP tool call: implement_next_change',
    'color: #00848B; font-weight: bold; font-size: 14px',
  );
  const content = buildContentParts(commit, remainingCount);
  printContentParts(content);
}
