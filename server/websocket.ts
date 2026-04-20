// WebSocket + SSE server setup

import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "http";
import type { Response as ExpressResponse } from "express";

import { addPatch, addAndCommit, commitDraft, getQueueUpdate, discardDraftPatch, discardCommit, attachMessageToPatch, updateDraftPatch } from "./queue.js";
import { generateCssForClasses, getTailwindVersion } from "./tailwind.js";
import type { Patch } from "../shared/types.js";

// --- Unified client abstraction ---
// Both WebSocket and SSE clients implement this interface so message routing works for both.
export interface MessageClient {
  send(data: string): void;
  readonly isOpen: boolean;
}

class WsClient implements MessageClient {
  constructor(private ws: WebSocket) {}
  send(data: string) { this.ws.send(data); }
  get isOpen() { return this.ws.readyState === 1; }
}

class SseClient implements MessageClient {
  readonly id: string;
  private closed = false;
  constructor(private res: ExpressResponse) {
    this.id = crypto.randomUUID();
    res.on('close', () => { this.closed = true; });
  }
  send(data: string) {
    if (!this.closed) {
      this.res.write(`data: ${data}\n\n`);
    }
  }
  get isOpen() { return !this.closed; }
}

export interface WebSocketDeps {
  broadcastPatchUpdate: () => void;
  broadcastTo: (role: string, data: object, exclude?: MessageClient) => void;
  /** Register an SSE response as a client with the given role. */
  registerSseClient: (role: string, res: ExpressResponse) => { clientId: string; cleanup: () => void };
  /** Process an incoming message from an SSE client (received via POST /msg). */
  handleSseMessage: (clientId: string, msg: any) => void;
}

export function setupWebSocket(httpServer: Server): WebSocketDeps {
  const wss = new WebSocketServer({ server: httpServer, maxPayload: 10 * 1024 * 1024, perMessageDeflate: false });
  const clientRoles = new Map<MessageClient, string>();
  const sseClients = new Map<string, SseClient>(); // clientId → SseClient
  const serverStartTime = Date.now();
  const ts = () => `[${((Date.now() - serverStartTime) / 1000).toFixed(1)}s]`;

  // Log when the HTTP server receives a WebSocket upgrade request
  httpServer.on('upgrade', (req) => {
    console.error(`${ts()} [ws] HTTP upgrade request for: ${req.url} from ${req.headers.origin ?? 'unknown origin'}`);
  });

  // Heartbeat: ping every 25s to keep Codespaces tunnel alive
  const aliveClients = new WeakSet<WebSocket>();
  const heartbeatInterval = setInterval(() => {
    for (const ws of wss.clients) {
      if (!aliveClients.has(ws)) {
        ws.terminate();
        continue;
      }
      aliveClients.delete(ws);
      ws.ping();
    }
  }, 25_000);

  function broadcastTo(role: string, data: object, exclude?: MessageClient): void {
    const payload = JSON.stringify(data);
    for (const [client, clientRole] of clientRoles) {
      if (clientRole === role && client !== exclude && client.isOpen) {
        client.send(payload);
      }
    }
  }

  function hasOverlay(): boolean {
    for (const [client, role] of clientRoles) {
      if (role === "overlay" && client.isOpen) return true;
    }
    return false;
  }

  function broadcastPatchUpdate(): void {
    broadcastTo("panel", { type: "QUEUE_UPDATE", ...getQueueUpdate() });
  }

  /** Handle registration side-effects (initial data, overlay status) */
  function handleRegister(client: MessageClient, role: string): void {
    clientRoles.set(client, role);
    console.error(`${ts()} [sse/ws] Client registered as: ${role}`);
    if (role === "panel") {
      client.send(JSON.stringify({ type: "QUEUE_UPDATE", ...getQueueUpdate() }));
      const overlayConnected = hasOverlay();
      console.error(`${ts()} [sse/ws] Sending OVERLAY_STATUS { connected: ${overlayConnected} } to new panel`);
      client.send(JSON.stringify({ type: "OVERLAY_STATUS", connected: overlayConnected }));
    } else if (role === "overlay") {
      console.error(`${ts()} [sse/ws] Broadcasting OVERLAY_STATUS { connected: true } to all panels`);
      broadcastTo("panel", { type: "OVERLAY_STATUS", connected: true });
    }
  }

  /** Handle disconnect cleanup */
  function handleDisconnect(client: MessageClient): void {
    const role = clientRoles.get(client);
    clientRoles.delete(client);
    console.error(`${ts()} [sse/ws] Client disconnected (was: ${role ?? 'unregistered'})`);
    if (role === "overlay" && !hasOverlay()) {
      broadcastTo("panel", { type: "OVERLAY_STATUS", connected: false });
    }
  }

  /** Route a parsed message from any client (WS or SSE) */
  function handleClientMessage(client: MessageClient, msg: any): void {
    // REGISTER handled separately for WS (inline) and SSE (at connect time)
    if (msg.type === "REGISTER") {
      const role = msg.role;
      if (role === "overlay" || role === "panel" || role === "design") {
        handleRegister(client, role);
      }
      return;
    }

    // Route messages with a "to" field to all clients of that role
    if (msg.to) {
      // Intercept THEME_PREVIEW for v3: server must recompile CSS
      if (msg.type === "THEME_PREVIEW" && msg.tailwindVersion === 3) {
        handleV3ThemePreview(msg.overrides ?? [], client);
        return;
      }
      broadcastTo(msg.to, msg, client);
      if ((msg.type === "COMPONENT_ARM" || msg.type === "COMPONENT_DISARM") && msg.to === "overlay") {
        broadcastTo("design", msg, client);
      }
      return;
    }

    // Server-handled messages (no "to" field)
    if (msg.type === "PATCH_STAGED") {
      const patch = addPatch({ ...msg.patch, kind: msg.patch.kind ?? 'class-change' });
      console.error(`[msg] Patch staged: #${patch.id}`);
      broadcastPatchUpdate();
    } else if (msg.type === "MESSAGE_STAGE") {
      const patch = addPatch({
        id: msg.id,
        kind: 'message',
        elementKey: msg.elementKey ?? '',
        status: 'staged',
        originalClass: '',
        newClass: '',
        property: '',
        timestamp: new Date().toISOString(),
        message: msg.message,
        component: msg.component,
        target: msg.target,
        context: msg.context,
        insertMode: msg.insertMode,
        pageUrl: msg.pageUrl,
      });
      console.error(`[msg] Message patch staged: #${patch.id}`);
      broadcastPatchUpdate();
    } else if (msg.type === "PATCH_COMMIT") {
      const commit = commitDraft(msg.ids);
      console.error(`[msg] Commit created: #${commit.id} (${commit.patches.length} patches)`);
      broadcastPatchUpdate();
    } else if (msg.type === "DISCARD_DRAFTS") {
      const ids: string[] = msg.ids ?? [];
      for (const id of ids) {
        discardDraftPatch(id);
      }
      console.error(`[msg] Discarded ${ids.length} draft patch(es)`);
      broadcastPatchUpdate();
    } else if (msg.type === "DISCARD_COMMIT") {
      const commitId: string = msg.commitId;
      if (commitId && discardCommit(commitId)) {
        console.error(`[msg] Discarded committed commit: ${commitId}`);
        broadcastPatchUpdate();
      }
    } else if (msg.type === "PING") {
      client.send(JSON.stringify({ type: "PONG" }));
    } else if (msg.type === "DESIGN_SUBMIT") {
      const patch: Patch = {
        id: crypto.randomUUID(),
        kind: 'design',
        elementKey: `${msg.target?.tag ?? ''}.${(msg.target?.classes ?? '').split(' ')[0]}`,
        status: 'staged',
        originalClass: '',
        newClass: '',
        property: 'design',
        timestamp: new Date().toISOString(),
        component: msg.componentName ? { name: msg.componentName } : undefined,
        target: msg.target,
        context: msg.context,
        image: msg.image,
        insertMode: msg.insertMode,
        canvasWidth: msg.canvasWidth,
        canvasHeight: msg.canvasHeight,
        canvasComponents: msg.canvasComponents,
      };
      addPatch(patch);
      broadcastPatchUpdate();
      broadcastTo("overlay", {
        type: "DESIGN_SUBMITTED",
        image: msg.image,
        patchId: patch.id,
      }, client);
      console.error(`[msg] Design patch staged: ${patch.id}`);
    } else if (msg.type === "DESIGN_CLOSE") {
      broadcastTo("overlay", { type: "DESIGN_CLOSE" }, client);
    } else if (msg.type === "CANVAS_MESSAGE_ATTACH") {
      const patchId: string = msg.patchId;
      const message: string = msg.message ?? '';
      if (patchId && message) {
        attachMessageToPatch(patchId, message);
        broadcastPatchUpdate();
        console.error(`[msg] Canvas message attached to patch ${patchId}`);
      }
    } else if (msg.type === "RESET_SELECTION") {
      broadcastTo("panel", { type: "RESET_SELECTION" }, client);
      console.error(`[msg] Reset selection broadcast to panels`);
    } else if (msg.type === "COMPONENT_DROPPED") {
      const patch = addPatch({ ...msg.patch, kind: msg.patch.kind ?? 'component-drop' });
      console.error(`[msg] Component-drop patch staged: #${patch.id}`);
      broadcastPatchUpdate();
    } else if (msg.type === "PATCH_UPDATE") {
      const { patchId, updates } = msg;
      if (patchId && updates) {
        const updated = updateDraftPatch(patchId, updates);
        if (updated) {
          console.error(`[msg] Draft patch updated: #${patchId}`);
          broadcastPatchUpdate();
        }
      }
    } else if (msg.type === "GHOST_UPDATE") {
      broadcastTo("overlay", msg, client);
    } else if (msg.type === "BUG_REPORT_STAGE") {
      const commit = addAndCommit({ ...msg.patch, kind: 'bug-report' });
      console.error(`[msg] Bug-report auto-committed: commit #${commit.id}`);
      broadcastPatchUpdate();
    }
  }

  // --- WebSocket connections ---
  wss.on("connection", (ws: WebSocket, req) => {
    console.error(`${ts()} [ws] Client connected from ${req.url}`);
    const client = new WsClient(ws);
    aliveClients.add(ws);
    ws.on("pong", () => { aliveClients.add(ws); });

    ws.on("message", (raw) => {
      try {
        handleClientMessage(client, JSON.parse(String(raw)));
      } catch (err) {
        console.error("[ws] Bad message:", err);
      }
    });

    ws.on("close", () => { handleDisconnect(client); });
  });

  wss.on("close", () => { clearInterval(heartbeatInterval); });

  // --- SSE client registration ---
  function registerSseClient(role: string, res: ExpressResponse): { clientId: string; cleanup: () => void } {
    const client = new SseClient(res);
    sseClients.set(client.id, client);
    handleRegister(client, role);

    // Send client ID so the browser can include it in POST /msg
    client.send(JSON.stringify({ type: "__SSE_INIT__", clientId: client.id }));

    // Keepalive comment every 15s to prevent proxy/tunnel timeouts
    const keepalive = setInterval(() => {
      if (client.isOpen) {
        res.write(': keepalive\n\n');
      }
    }, 15_000);

    const cleanup = () => {
      clearInterval(keepalive);
      sseClients.delete(client.id);
      handleDisconnect(client);
    };

    res.on('close', cleanup);

    return { clientId: client.id, cleanup };
  }

  function handleSseMessage(clientId: string, msg: any): void {
    const client = sseClients.get(clientId);
    if (!client) {
      console.error(`[sse] Unknown clientId: ${clientId}`);
      return;
    }
    handleClientMessage(client, msg);
  }

  // --- v3 theme preview: recompile CSS with overrides ---
  let v3PreviewTimer: ReturnType<typeof setTimeout> | null = null;

  async function handleV3ThemePreview(
    overrides: Array<{ variable: string; value: string }>,
    _client: MessageClient,
  ): Promise<void> {
    // Debounce server-side compilation
    if (v3PreviewTimer) clearTimeout(v3PreviewTimer);

    if (overrides.length === 0) {
      // Clear preview immediately
      broadcastTo("overlay", { type: "THEME_PREVIEW_CSS", css: "" });
      return;
    }

    v3PreviewTimer = setTimeout(async () => {
      try {
        // Build utility classes for every changed color token
        const classes: string[] = [];
        for (const { variable } of overrides) {
          // variable format: "colors.blue.500" → build classes like bg-blue-500, text-blue-500, etc.
          const match = variable.match(/^colors\.(.+)$/);
          if (match) {
            const colorPath = match[1].replace(/\./g, '-');
            for (const prefix of ['bg', 'text', 'border', 'ring', 'outline', 'divide', 'accent', 'fill', 'stroke']) {
              classes.push(`${prefix}-${colorPath}`);
            }
          }
          // fontSize: fontSize.lg → text-lg
          const fsMatch = variable.match(/^fontSize\.(.+)$/);
          if (fsMatch) classes.push(`text-${fsMatch[1]}`);
          // fontWeight: fontWeight.bold → font-bold
          const fwMatch = variable.match(/^fontWeight\.(.+)$/);
          if (fwMatch) classes.push(`font-${fwMatch[1]}`);
        }

        if (classes.length === 0) return;

        // Generate CSS with current theme (overrides are not yet applied to config —
        // v3 preview is approximate: we generate the CSS for current classes so the
        // overlay can at least see the structure. Full override compilation would
        // require modifying resolveConfig which is cached.)
        // For now, send CSS variable override style (works for projects using CSS vars)
        const rules = overrides
          .map((o) => {
            // Convert "colors.blue.500" → "--color-blue-500" for CSS var approach
            const varName = `--${o.variable.replace(/\./g, '-')}`;
            return `  ${varName}: ${o.value} !important;`;
          })
          .join("\n");
        const css = `:root {\n${rules}\n}`;
        broadcastTo("overlay", { type: "THEME_PREVIEW_CSS", css });
      } catch (err) {
        console.error("[theme] v3 preview compilation failed:", err);
      }
    }, 250);
  }

  return { broadcastPatchUpdate, broadcastTo, registerSseClient, handleSseMessage };
}
