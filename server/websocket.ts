// WebSocket server setup

import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "http";

import { addPatch, commitPatches, getPatchUpdate } from "./queue.js";

export interface WebSocketDeps {
  broadcastPatchUpdate: () => void;
  broadcastTo: (role: string, data: object, exclude?: WebSocket) => void;
}

export function setupWebSocket(httpServer: Server): WebSocketDeps {
  const wss = new WebSocketServer({ server: httpServer });
  const clientRoles = new Map<WebSocket, string>();

  function broadcastTo(role: string, data: object, exclude?: WebSocket): void {
    const payload = JSON.stringify(data);
    for (const [client, clientRole] of clientRoles) {
      if (clientRole === role && client !== exclude && client.readyState === 1) {
        client.send(payload);
      }
    }
  }

  function broadcastPatchUpdate(): void {
    broadcastTo("panel", { type: "PATCH_UPDATE", ...getPatchUpdate() });
  }

  wss.on("connection", (ws: WebSocket) => {
    console.error("[ws] Client connected");

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));

        if (msg.type === "REGISTER") {
          const role = msg.role;
          if (role === "overlay" || role === "panel") {
            clientRoles.set(ws, role);
            console.error(`[ws] Client registered as: ${role}`);
            if (role === "panel") {
              ws.send(JSON.stringify({ type: "PATCH_UPDATE", ...getPatchUpdate() }));
            }
          }
          return;
        }

        // Route messages with a "to" field to all clients of that role
        if (msg.to) {
          broadcastTo(msg.to, msg, ws);
          return;
        }

        // Server-handled messages (no "to" field)
        if (msg.type === "PATCH_STAGED") {
          const patch = addPatch(msg.patch);
          console.error(`[ws] Patch staged: #${patch.id}`);
          broadcastPatchUpdate();
        } else if (msg.type === "PATCH_COMMIT") {
          const moved = commitPatches(msg.ids);
          console.error(`[ws] Patches committed: ${moved}`);
          broadcastPatchUpdate();
        } else if (msg.type === "PING") {
          ws.send(JSON.stringify({ type: "PONG" }));
        }
      } catch (err) {
        console.error("[ws] Bad message:", err);
      }
    });

    ws.on("close", () => {
      clientRoles.delete(ws);
      console.error("[ws] Client disconnected");
    });
  });

  return { broadcastPatchUpdate, broadcastTo };
}
