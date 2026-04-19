import { debugLog, debugWarn, isDebug } from "../../shared/vybit-env";

let socket: WebSocket | null = null;
let eventSource: EventSource | null = null;
let sseClientId: string | null = null;
let sseOrigin: string = '';
let transport: 'ws' | 'sse' | null = null;
let connected = false;
let connectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

type MessageHandler = (data: any) => void;
const handlers: MessageHandler[] = [];

export function connect(url: string = 'ws://localhost:3333', httpOrigin?: string): void {
  connectAttempts++;
  const attempt = connectAttempts;
  const t0 = performance.now();
  const ts = () => `+${(performance.now() - t0).toFixed(0)}ms`;
  debugLog('tw-overlay', `ws connect() attempt #${attempt} to ${url} | readyState of previous socket: ${socket?.readyState ?? 'none'} [${ts()}]`);

  // Derive HTTP origin for SSE if not provided
  if (!httpOrigin) {
    try {
      const wsUrl = new URL(url);
      httpOrigin = `${wsUrl.protocol === 'wss:' ? 'https' : 'http'}://${wsUrl.host}`;
    } catch {
      httpOrigin = 'http://localhost:3333';
    }
  }
  sseOrigin = httpOrigin;

  let settled = false;
  const settle = (winner: 'ws' | 'sse') => {
    if (settled) return;
    settled = true;
    transport = winner;
    connected = true;
    connectAttempts = 0;
    debugLog('tw-overlay', `Transport won: ${winner} [${ts()}]`);

    if (winner === 'ws' && eventSource) {
      eventSource.close();
      eventSource = null;
    } else if (winner === 'sse' && socket) {
      socket.close();
      socket = null;
    }

    if (winner === 'ws') {
      send({ type: 'REGISTER', role: 'overlay' });
    }
    // SSE registration happens server-side via ?role= query param

    window.dispatchEvent(new CustomEvent('overlay-ws-connected'));
  };

  // --- Start WebSocket ---
  try {
    socket = new WebSocket(url);
  } catch (err) {
    console.error(`[tw-overlay][ws] WebSocket constructor threw [${ts()}]:`, err);
    socket = null;
  }

  if (socket) {
    debugLog('tw-overlay', `ws WebSocket created, readyState=${socket.readyState} (0=CONNECTING) [${ts()}]`);

    socket.addEventListener('open', () => {
      debugLog('tw-overlay', `ws OPEN (attempt #${attempt}) [${ts()}]`);
      settle('ws');
    });

    socket.addEventListener('close', (event) => {
      debugWarn('tw-overlay', `ws CLOSE (attempt #${attempt}) [${ts()}] — code=${event.code} reason="${event.reason}" wasClean=${event.wasClean}`);
      if (transport === 'ws') {
        connected = false;
        transport = null;
        socket = null;
        window.dispatchEvent(new CustomEvent('overlay-ws-disconnected'));
        scheduleReconnect(url, httpOrigin!);
      }
      // If SSE already won, ignore this close
    });

    socket.addEventListener('error', (err) => {
      console.error(`[tw-overlay][ws] ERROR (attempt #${attempt}) [${ts()}]`, err);
    });

    socket.addEventListener('message', (event) => {
      if (transport !== 'ws') return;
      try {
        const data = JSON.parse(event.data);
        debugLog('tw-overlay', `WS ← ${data.type ?? 'unknown'}`, data);
        for (const handler of handlers) handler(data);
        window.dispatchEvent(new CustomEvent('vybit:message', { detail: data }));
      } catch (err) {
        console.error('[tw-overlay] Failed to parse message:', err);
      }
    });
  }

  // --- Start SSE ---
  try {
    const sseUrl = `${httpOrigin}/sse?role=overlay`;
    debugLog('tw-overlay', `SSE connecting to ${sseUrl} [${ts()}]`);
    eventSource = new EventSource(sseUrl, { withCredentials: true });
  } catch (err) {
    console.error(`[tw-overlay][sse] EventSource constructor threw [${ts()}]:`, err);
    eventSource = null;
  }

  if (eventSource) {
    eventSource.addEventListener('open', () => {
      debugLog('tw-overlay', `SSE OPEN (attempt #${attempt}) [${ts()}]`);
      settle('sse');
    });

    eventSource.addEventListener('message', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        // Capture client ID from init message
        if (data.type === '__SSE_INIT__' && data.clientId) {
          sseClientId = data.clientId;
          debugLog('tw-overlay', `SSE client ID: ${sseClientId}`);
          return;
        }
        if (transport !== 'sse') return;
        debugLog('tw-overlay', `SSE ← ${data.type ?? 'unknown'}`, data);
        for (const handler of handlers) handler(data);
        window.dispatchEvent(new CustomEvent('vybit:message', { detail: data }));
      } catch (err) {
        console.error('[tw-overlay] Failed to parse SSE message:', err);
      }
    });

    eventSource.addEventListener('error', () => {
      if (transport === 'sse') {
        // EventSource auto-reconnects, but if it fully closes we need to handle it
        if (eventSource?.readyState === EventSource.CLOSED) {
          debugWarn('tw-overlay', `SSE CLOSED (attempt #${attempt}) [${ts()}]`);
          connected = false;
          transport = null;
          eventSource = null;
          sseClientId = null;
          window.dispatchEvent(new CustomEvent('overlay-ws-disconnected'));
          scheduleReconnect(url, httpOrigin!);
        }
      }
    });
  }

  // If both fail to start, schedule reconnect
  if (!socket && !eventSource) {
    scheduleReconnect(url, httpOrigin);
  }
}

function scheduleReconnect(url: string, httpOrigin: string): void {
  const delay = Math.min(500 * Math.pow(2, connectAttempts - 1), 3000);
  debugLog('tw-overlay', `Will reconnect in ${delay}ms…`);
  reconnectTimer = setTimeout(() => connect(url, httpOrigin), delay);
}

export function send(data: object): void {
  if (!connected) {
    console.warn('[tw-overlay] Cannot send — not connected');
    if (isDebug()) {
      console.warn(`[tw-overlay] detail: transport=${transport}, connected=${connected}`, data);
      console.trace('[tw-overlay] send() call stack');
    }
    return;
  }

  if (transport === 'ws' && socket) {
    socket.send(JSON.stringify(data));
  } else if (transport === 'sse' && sseClientId) {
    const body = JSON.stringify({ clientId: sseClientId, ...data });
    fetch(`${sseOrigin}/msg`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      credentials: 'include',
      body,
    }).catch(err => {
      console.warn('[tw-overlay] POST /msg failed:', err);
    });
  }

  // Echo outgoing messages so page-level listeners (e.g. tutorial progress) can observe them
  window.dispatchEvent(new CustomEvent('vybit:message', { detail: data }));
}

export function onMessage(handler: MessageHandler): void {
  handlers.push(handler);
}

export function sendTo(role: string, data: object): void {
  debugLog('tw-overlay', `→ ${role}: ${(data as any).type ?? 'unknown'}`, data);
  send({ ...data, to: role });
}

export function isConnected(): boolean {
  return connected;
}

export function getTransport(): string | null {
  return transport;
}
