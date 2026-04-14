# 051 — SSE + HTTP POST Transport (Codespaces Compatibility)

## Problem

GitHub Codespaces port-forwarding tunnels have two known issues (open since April 2022, still unfixed):

1. **CORS preflight blocked**: Authenticated tunnels reject OPTIONS requests because the browser can't attach the auth cookie to a preflight. We partially worked around this by sending `text/plain` to avoid triggering preflight, plus `credentials: 'include'` on fetches.

2. **WebSocket upgrades are extremely slow**: The HTTP→WS upgrade through the Codespaces tunnel takes 30–120+ seconds, making the tool unusable. This is a fundamental tunnel limitation — no client-side workaround exists.

Regular HTTP requests (GET, POST) work fine through the tunnel. **Server-Sent Events (SSE)** also work because they are plain HTTP GET responses with `text/event-stream` content type — no upgrade handshake needed.

## Solution

Add an SSE + HTTP POST transport as a **fallback** alongside the existing WebSocket transport. Clients race both transports and use whichever connects first.

### Transport Summary

| Direction | WebSocket | SSE Transport |
|-----------|-----------|---------------|
| Server → Client | `ws.send()` | SSE (`text/event-stream`) via `GET /sse` |
| Client → Server | `ws.send()` | HTTP POST to `POST /msg` |
| Connection setup | Upgrade handshake (slow in tunnels) | Plain GET (fast) |

### Why SSE + POST instead of alternatives

- **Pure SSE (no POST)**: Can't send arbitrary messages from client to server. Would require major protocol rework.
- **HTTP long-polling**: Higher latency per message, more complex, no advantage over SSE.
- **BroadcastChannel + SSE**: Panel is same-origin with the server (served from port 3333), so it could use `BroadcastChannel` to share an SSE stream. But the overlay is cross-origin (port 5173), so it can't participate. Not worth the complexity for only helping one client.

## Architecture

### Unified Client Abstraction (already started)

`server/websocket.ts` already has:

```ts
interface MessageClient {
  send(data: string): void;
  readonly isOpen: boolean;
}

class WsClient implements MessageClient { ... }
class SseClient implements MessageClient { ... }
```

The `clientRoles` map and `broadcastTo()` function currently use raw `WebSocket` objects. They will be refactored to use `MessageClient`, so SSE and WS clients are treated identically for message routing.

### Server Changes

#### 1. Refactor `clientRoles` to use `MessageClient` (`server/websocket.ts`)

```
Before: Map<WebSocket, string>
After:  Map<MessageClient, string>
```

`broadcastTo()`, `hasOverlay()`, and the `wss.on("connection")` handler all wrap WS connections in `WsClient` before adding to the map.

#### 2. Add SSE endpoint (`server/app.ts`)

```
GET /sse?role={overlay|panel|design}
```

- Sets response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Sets CORS headers (already handled by `cors()` middleware)
- Sends `text/plain` content-type for Codespaces compatibility (SSE uses `text/event-stream` which is a simple content-type — no preflight needed, but we still need CORS `Access-Control-Allow-Origin`)
- Creates an `SseClient`, registers it with the given role via `registerSseClient()`
- Sends initial messages (same as WS `REGISTER` flow): `QUEUE_UPDATE` to panels, `OVERLAY_STATUS` to panels when overlay connects
- On `res.on('close')`, cleans up the client from `clientRoles` and broadcasts `OVERLAY_STATUS { connected: false }` if the last overlay disconnected
- Sends an SSE comment (`: keepalive`) every 15s to prevent proxy/tunnel timeouts

#### 3. Add message-receive endpoint (`server/app.ts`)

```
POST /msg
Content-Type: text/plain   (avoids CORS preflight)
Body: JSON string
```

- Parses the JSON body (text/plain → JSON rewriting middleware already exists)
- Routes the message through the **same handler logic** as the WebSocket `ws.on("message")` handler
- The handler needs to be extracted into a shared function: `handleClientMessage(client: MessageClient, role: string, msg: any)`
- Returns `200 OK` with empty body on success, `400` on parse error

#### 4. Extract message handler (`server/websocket.ts`)

The giant `ws.on("message")` switch/if block gets extracted to:

```ts
function handleClientMessage(
  client: MessageClient,
  role: string | undefined,
  msg: any,
  deps: { broadcastTo, broadcastPatchUpdate }
): void
```

Both the WS `message` event and the `POST /msg` endpoint call this function.

#### 5. `registerSseClient` implementation (`server/websocket.ts`)

```ts
registerSseClient(role: string, res: ExpressResponse): {
  handleMessage: (msg: any) => void;
  cleanup: () => void;
}
```

- Creates `SseClient` from the response
- Adds to `clientRoles` with the given role
- Fires same registration side-effects as WS REGISTER (QUEUE_UPDATE, OVERLAY_STATUS)
- Returns `handleMessage` (calls the extracted message handler) and `cleanup` (removes from clientRoles, broadcasts overlay disconnect if needed)

### Overlay Changes (`overlay/src/ws.ts`)

#### Transport Racing

On `connect(url)`:

1. Extract the HTTP origin from the WS URL (or accept an HTTP URL directly)
2. Start **both** transports simultaneously:
   - `new WebSocket(wsUrl)` — existing logic
   - `new EventSource(`${httpOrigin}/sse?role=overlay`)` — new SSE connection
3. Whichever connects first wins:
   - WS: `socket.onopen` fires → close the `EventSource`, proceed with WS as today
   - SSE: `eventSource.onopen` fires → close the `WebSocket`, switch to SSE+POST mode
4. If both fail, use existing exponential backoff to retry

#### SSE Mode State

When SSE wins, the module switches into SSE mode:

```ts
let transport: 'ws' | 'sse' = 'ws';
let eventSource: EventSource | null = null;
let sseOrigin: string = '';  // base URL for POST /msg
```

- `send()` → if `transport === 'sse'`, fire `fetch(`${sseOrigin}/msg`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'text/plain' }, credentials: 'include' })`
- `onMessage()` handlers → wired to `eventSource.onmessage` instead of `socket.onmessage`
- `isConnected()` → check `eventSource.readyState === EventSource.OPEN`
- Reconnection: `EventSource` has built-in reconnection. If it fires `onerror` and readyState goes to `CONNECTING`, it's reconnecting automatically. If it closes entirely, fall back to the existing retry logic.
- REGISTER message: In SSE mode, the role is passed as a query param (`/sse?role=overlay`), so no explicit REGISTER message is needed. However, the first-open flow still dispatches `overlay-ws-connected` event.

#### URL Construction

Currently in `overlay/src/index.ts`:

```ts
const isProxied = SERVER_ORIGIN === window.location.origin;
const wsUrl = isProxied
  ? `${window.location.origin.replace(/^http/, "ws")}/__vybit_ws`
  : SERVER_ORIGIN.replace(/^http/, "ws");
```

Update `connect()` to also accept the HTTP origin, so the SSE transport can construct `GET /sse` and `POST /msg` URLs:

```ts
// in index.ts:
connect(wsUrl, SERVER_ORIGIN);

// ws.ts connect signature:
export function connect(wsUrl: string, httpOrigin: string): void
```

### Panel Changes (`panel/src/ws.ts`)

Same transport-racing approach as the overlay:

1. Derive HTTP origin: `window.location.origin` (panel is served from the same Express server)
2. Race `new WebSocket(wsUrl)` vs `new EventSource('/sse?role=panel')`
3. Winner takes over `send()` / message routing
4. SSE `send()` → `POST /msg` to same origin

Panel already gets the WS URL from `window.location.origin.replace(/^http/, 'ws')`. The SSE URL is simply `/sse?role=panel` (same origin, no CORS issues).

### Message Format

SSE events use the standard format:

```
data: {"type":"QUEUE_UPDATE","patches":[],"commits":[]}\n\n
```

Clients parse `event.data` as JSON, same as today's `JSON.parse(event.data)` on WebSocket messages. No protocol changes needed.

POST `/msg` sends the same JSON envelope currently sent over WebSocket:

```json
{"type":"PATCH_STAGED","patch":{...}}
{"type":"ELEMENT_SELECTED","to":"panel",...}
```

## Implementation Plan

### Phase 1: Server-side SSE infrastructure

1. **Extract message handler** from `websocket.ts` `ws.on("message")` into a standalone `handleClientMessage()` function
2. **Refactor `clientRoles`** from `Map<WebSocket, string>` to `Map<MessageClient, string>`
3. **Update `broadcastTo()`** and `hasOverlay()` to use `MessageClient`
4. **Wrap WS connections** in `WsClient` at registration time
5. **Implement `registerSseClient()`** — creates `SseClient`, adds to `clientRoles`, fires registration side-effects
6. **Add `GET /sse`** endpoint in `app.ts` — validates role, calls `registerSseClient`, sets up keepalive interval, cleanup on close
7. **Add `POST /msg`** endpoint in `app.ts` — parses body, looks up sender's `SseClient` by a client ID, calls `handleClientMessage()`

### Phase 2: Client-side SSE transport

8. **Overlay `ws.ts`** — add transport racing (WS vs SSE), SSE-mode `send()` via POST, SSE-mode message handling
9. **Overlay `index.ts`** — pass HTTP origin to `connect()`
10. **Panel `ws.ts`** — same transport racing and SSE-mode send

### Phase 3: Testing & hardening

11. **Manual test locally** — verify pure-WS still works when SSE is available (WS should win the race locally)
12. **Manual test in Codespaces** — verify SSE wins the race, full patch flow works
13. **Add transport indicator** — log which transport won (helpful for debugging)
14. **Keepalive tuning** — ensure the 15s SSE keepalive and 25s WS heartbeat are sufficient for tunnel proxies

## Client Identity for POST `/msg`

When a client sends a message over WebSocket, the server knows which `MessageClient` sent it (it's the socket the message arrived on). With SSE+POST, the server needs to match an incoming POST to the correct `SseClient`.

**Approach**: Assign each SSE client a unique ID at connection time. Return it in the first SSE event:

```
data: {"type":"__SSE_INIT__","clientId":"abc123"}\n\n
```

The client includes this ID in every POST:

```json
POST /msg
{"clientId":"abc123","type":"PATCH_STAGED","patch":{...}}
```

Server looks up the `SseClient` by `clientId` in a `Map<string, SseClient>` to find the sender for `broadcastTo(exclude)` and role lookup.

## Edge Cases

- **SSE reconnect**: `EventSource` auto-reconnects on disconnection. On reconnect, the server creates a new `SseClient` for the same role. The old one is cleaned up via `res.on('close')`. The client gets a new `clientId` — it should update its stored ID from the next `__SSE_INIT__` event.
- **POST failure**: If a POST to `/msg` fails (network error), log a warning. Don't queue/retry — this matches WS behavior (fire-and-forget `ws.send()`).
- **Mixed transports**: One client could be WS, another SSE. `broadcastTo()` doesn't care — it calls `client.send()` on all matching-role clients. This works because `MessageClient` is the common interface.
- **CORS on SSE**: `EventSource` does not support custom headers. Use `withCredentials: true` in the constructor for Codespaces auth cookies. The endpoint URL carries the role as a query param, which is fine since role names are not sensitive.
- **Panel served from server origin**: The panel is at `http://localhost:3333/panel/`, same origin as the SSE endpoint — no CORS issues. The overlay at `http://localhost:5173` is cross-origin, but our existing `cors({ origin: true, credentials: true })` config handles it.

## Files Changed

| File | Change |
|------|--------|
| `server/websocket.ts` | Refactor `clientRoles` to `MessageClient`, extract `handleClientMessage()`, implement `registerSseClient()` |
| `server/app.ts` | Add `GET /sse` and `POST /msg` endpoints |
| `overlay/src/ws.ts` | Transport racing, SSE-mode send/receive, accept `httpOrigin` param |
| `overlay/src/index.ts` | Pass `SERVER_ORIGIN` as `httpOrigin` to `connect()` |
| `panel/src/ws.ts` | Transport racing, SSE-mode send/receive |

## Non-Goals

- **Remove WebSocket entirely**: WS remains the primary transport. SSE is a fallback for restricted environments.
- **Shared worker / BroadcastChannel**: Not worth the complexity. Both overlay and panel independently connect to the server.
- **Retry/queue for POST failures**: Match current WS fire-and-forget semantics.
- **Binary message support**: All messages are JSON strings today. No change needed.
