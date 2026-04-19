let socket: WebSocket | null = null;
let eventSource: EventSource | null = null;
let sseClientId: string | null = null;
let transport: 'ws' | 'sse' | null = null;
let connected = false;
let connectAttempts = 0;

type MessageHandler = (data: any) => void;
const handlers: MessageHandler[] = [];
const connectHandlers: (() => void)[] = [];
const disconnectHandlers: (() => void)[] = [];

function getWsUrl(): string {
  return window.location.origin.replace(/^http/, 'ws');
}

function getHttpOrigin(): string {
  return window.location.origin;
}

export function connect(): void {
  if (socket || eventSource) return; // already connected or connecting
  connectAttempts++;
  const wsUrl = getWsUrl();
  const httpOrigin = getHttpOrigin();

  let settled = false;
  const settle = (winner: 'ws' | 'sse') => {
    if (settled) return;
    settled = true;
    transport = winner;
    connected = true;
    connectAttempts = 0;

    if (winner === 'ws' && eventSource) {
      eventSource.close();
      eventSource = null;
    } else if (winner === 'sse' && socket) {
      socket.close();
      socket = null;
    }

    if (winner === 'ws') {
      sendRaw({ type: 'REGISTER', role: 'panel' });
    }
    // SSE registration happens server-side via ?role= query param

    for (const h of connectHandlers) h();
  };

  // --- Start WebSocket ---
  try {
    socket = new WebSocket(wsUrl);
  } catch {
    socket = null;
  }

  if (socket) {
    socket.addEventListener('open', () => { settle('ws'); });

    socket.addEventListener('close', () => {
      if (transport === 'ws') {
        connected = false;
        transport = null;
        socket = null;
        for (const h of disconnectHandlers) h();
        scheduleReconnect();
      }
    });

    socket.addEventListener('message', (event) => {
      if (transport !== 'ws') return;
      try {
        const data = JSON.parse(event.data);
        for (const handler of handlers) handler(data);
      } catch (err) {
        console.error('[tw-panel] Failed to parse message:', err);
      }
    });

    socket.addEventListener('error', (err) => {
      console.error('[tw-panel] WebSocket error:', err);
    });
  }

  // --- Start SSE ---
  try {
    eventSource = new EventSource(`${httpOrigin}/sse?role=panel`, { withCredentials: true });
  } catch {
    eventSource = null;
  }

  if (eventSource) {
    eventSource.addEventListener('open', () => { settle('sse'); });

    eventSource.addEventListener('message', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === '__SSE_INIT__' && data.clientId) {
          sseClientId = data.clientId;
          return;
        }
        if (transport !== 'sse') return;
        for (const handler of handlers) handler(data);
      } catch (err) {
        console.error('[tw-panel] Failed to parse SSE message:', err);
      }
    });

    eventSource.addEventListener('error', () => {
      if (transport === 'sse' && eventSource?.readyState === EventSource.CLOSED) {
        connected = false;
        transport = null;
        eventSource = null;
        sseClientId = null;
        for (const h of disconnectHandlers) h();
        scheduleReconnect();
      }
    });
  }

  if (!socket && !eventSource) {
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  const delay = Math.min(500 * Math.pow(2, connectAttempts - 1), 3000);
  setTimeout(() => connect(), delay);
}

/** Low-level send — used for REGISTER before transport is fully settled */
function sendRaw(data: object): void {
  if (transport === 'ws' && socket) {
    socket.send(JSON.stringify(data));
  } else if (transport === 'sse' && sseClientId) {
    const body = JSON.stringify({ clientId: sseClientId, ...data });
    fetch(`${getHttpOrigin()}/msg`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      credentials: 'include',
      body,
    }).catch(() => {});
  }

  // Bridge outgoing messages to the parent window so page-level listeners
  // (e.g. tutorial progress) can observe panel activity.
  if (window.parent !== window) {
    try { window.parent.postMessage({ __vybit: true, ...data }, '*'); } catch {}
  }
}

export function send(data: object): void {
  if (!connected) return;
  sendRaw(data);
}

export function sendTo(role: string, data: object): void {
  send({ ...data, to: role });
}

export function onMessage(handler: MessageHandler): () => void {
  handlers.push(handler);
  return () => { const i = handlers.indexOf(handler); if (i !== -1) handlers.splice(i, 1); };
}

export function onConnect(handler: () => void): () => void {
  connectHandlers.push(handler);
  return () => { const i = connectHandlers.indexOf(handler); if (i !== -1) connectHandlers.splice(i, 1); };
}

export function onDisconnect(handler: () => void): () => void {
  disconnectHandlers.push(handler);
  return () => { const i = disconnectHandlers.indexOf(handler); if (i !== -1) disconnectHandlers.splice(i, 1); };
}

export function isConnected(): boolean {
  return connected;
}

export function getTransport(): string | null {
  return transport;
}
