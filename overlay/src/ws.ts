import { debugLog, debugWarn, isDebug } from "../../shared/vybit-env";

let socket: WebSocket | null = null;
let connected = false;
let connectAttempts = 0;

type MessageHandler = (data: any) => void;
const handlers: MessageHandler[] = [];

export function connect(url: string = 'ws://localhost:3333'): void {
  connectAttempts++;
  const attempt = connectAttempts;
  debugLog('tw-overlay', `ws connect() attempt #${attempt} to ${url} | readyState of previous socket: ${socket?.readyState ?? 'none'}`);

  try {
    socket = new WebSocket(url);
  } catch (err) {
    console.error(`[tw-overlay][ws] WebSocket constructor threw:`, err);
    return;
  }

  debugLog('tw-overlay', `ws WebSocket created, readyState=${socket.readyState} (0=CONNECTING)`);

  socket.addEventListener('open', () => {
    connected = true;
    debugLog('tw-overlay', `ws OPEN (attempt #${attempt}) — registering as overlay`);
    // Register as overlay so the server can route messages to us
    send({ type: 'REGISTER', role: 'overlay' });
    window.dispatchEvent(new CustomEvent('overlay-ws-connected'));
  });

  socket.addEventListener('close', (event) => {
    debugWarn('tw-overlay', `ws CLOSE (attempt #${attempt}) — code=${event.code} reason="${event.reason}" wasClean=${event.wasClean} | was connected=${connected}`);
    connected = false;
    socket = null;
    window.dispatchEvent(new CustomEvent('overlay-ws-disconnected'));
    debugLog('tw-overlay', `ws Will reconnect in 3s…`);
    setTimeout(() => connect(url), 3000);
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      debugLog('tw-overlay', `WS ← ${data.type ?? 'unknown'}`, data);
      for (const handler of handlers) {
        handler(data);
      }
    } catch (err) {
      console.error('[tw-overlay] Failed to parse message:', err);
    }
  });

  socket.addEventListener('error', (err) => {
    console.error(`[tw-overlay][ws] ERROR (attempt #${attempt}) — connected=${connected} readyState=${socket?.readyState}`, err);
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
