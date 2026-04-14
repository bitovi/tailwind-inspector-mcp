import { debugLog, debugWarn, isDebug } from "../../shared/vybit-env";

let socket: WebSocket | null = null;
let connected = false;
let connectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

type MessageHandler = (data: any) => void;
const handlers: MessageHandler[] = [];

export function connect(url: string = 'ws://localhost:3333'): void {
  connectAttempts++;
  const attempt = connectAttempts;
  const t0 = performance.now();
  const ts = () => `+${(performance.now() - t0).toFixed(0)}ms`;
  debugLog('tw-overlay', `ws connect() attempt #${attempt} to ${url} | readyState of previous socket: ${socket?.readyState ?? 'none'} [${ts()}]`);

  try {
    socket = new WebSocket(url);
  } catch (err) {
    console.error(`[tw-overlay][ws] WebSocket constructor threw [${ts()}]:`, err);
    return;
  }

  debugLog('tw-overlay', `ws WebSocket created, readyState=${socket.readyState} (0=CONNECTING) [${ts()}]`);

  socket.addEventListener('open', () => {
    connected = true;
    connectAttempts = 0; // Reset backoff on successful connection
    debugLog('tw-overlay', `ws OPEN (attempt #${attempt}) [${ts()}] — registering as overlay`);
    // Register as overlay so the server can route messages to us
    send({ type: 'REGISTER', role: 'overlay' });
    window.dispatchEvent(new CustomEvent('overlay-ws-connected'));
  });

  socket.addEventListener('close', (event) => {
    debugWarn('tw-overlay', `ws CLOSE (attempt #${attempt}) [${ts()}] — code=${event.code} reason="${event.reason}" wasClean=${event.wasClean} | was connected=${connected}`);
    connected = false;
    socket = null;
    window.dispatchEvent(new CustomEvent('overlay-ws-disconnected'));
    // Exponential backoff: 500ms, 1s, 2s, 3s (cap)
    const delay = Math.min(500 * Math.pow(2, connectAttempts - 1), 3000);
    debugLog('tw-overlay', `ws Will reconnect in ${delay}ms… [${ts()}]`);
    reconnectTimer = setTimeout(() => connect(url), delay);
  });

  socket.addEventListener('error', (err) => {
    console.error(`[tw-overlay][ws] ERROR (attempt #${attempt}) [${ts()}] — connected=${connected} readyState=${socket?.readyState}`, err);
  });

  let firstMessage = true;
  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (firstMessage) {
        debugLog('tw-overlay', `WS ← first message: ${data.type ?? 'unknown'} [${ts()}]`);
        firstMessage = false;
      }
      debugLog('tw-overlay', `WS ← ${data.type ?? 'unknown'}`, data);
      for (const handler of handlers) {
        handler(data);
      }
    } catch (err) {
      console.error('[tw-overlay] Failed to parse message:', err);
    }
  });
}

export function send(data: object): void {
  if (connected && socket) {
    socket.send(JSON.stringify(data));
  } else {
    console.warn('[tw-overlay] Cannot send — not connected');
    if (isDebug()) {
      console.warn(`[tw-overlay] detail: connected=${connected}, socket=${!!socket}, readyState=${socket?.readyState ?? 'null'}`, data);
      console.trace('[tw-overlay] send() call stack');
    }
  }
}

export function onMessage(handler: MessageHandler): void {
  handlers.push(handler);
}

export function sendTo(role: string, data: object): void {
  debugLog('tw-overlay', `WS → ${role}: ${(data as any).type ?? 'unknown'}`, data);
  send({ ...data, to: role });
}

export function isConnected(): boolean {
  return connected;
}
