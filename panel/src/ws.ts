let socket: WebSocket | null = null;
let connected = false;
let connectAttempts = 0;

type MessageHandler = (data: any) => void;
const handlers: MessageHandler[] = [];
const connectHandlers: (() => void)[] = [];
const disconnectHandlers: (() => void)[] = [];

function getWsUrl(): string {
  return window.location.origin.replace(/^http/, 'ws');
}

export function connect(): void {
  if (socket) return; // already connected or connecting
  connectAttempts++;
  const url = getWsUrl();
  socket = new WebSocket(url);

  socket.addEventListener('open', () => {
    connected = true;
    connectAttempts = 0;
    send({ type: 'REGISTER', role: 'panel' });
    for (const h of connectHandlers) h();
  });

  socket.addEventListener('close', () => {
    connected = false;
    socket = null;
    for (const h of disconnectHandlers) h();
    const delay = Math.min(500 * Math.pow(2, connectAttempts - 1), 3000);
    setTimeout(() => connect(), delay);
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      for (const handler of handlers) {
        handler(data);
      }
    } catch (err) {
      console.error('[tw-panel] Failed to parse message:', err);
    }
  });

  socket.addEventListener('error', (err) => {
    console.error('[tw-panel] WebSocket error:', err);
  });
}

export function send(data: object): void {
  if (connected && socket) {
    socket.send(JSON.stringify(data));
  }
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
