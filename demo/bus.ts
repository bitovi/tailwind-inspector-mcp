// Cross-window message bus using BroadcastChannel
// Replaces both overlay/src/ws.ts and panel/src/ws.ts
// Works across iframes, popups, and tabs on the same origin.

type MessageHandler = (data: any) => void;

const CHANNEL_NAME = 'vybit-demo';
const channel = new BroadcastChannel(CHANNEL_NAME);

const handlers = new Set<MessageHandler>();
const connectHandlers = new Set<() => void>();
const disconnectHandlers = new Set<() => void>();

let _connected = false;

// Receive messages from other windows/iframes
channel.onmessage = (event) => {
  const data = event.data;
  for (const handler of handlers) handler(data);
  window.dispatchEvent(new CustomEvent('vybit:message', { detail: data }));
};

export function connect(_url?: string): void {
  if (_connected) return;
  _connected = true;
  // Fire connect handlers async to match WS behavior
  queueMicrotask(() => {
    for (const h of connectHandlers) h();
    // Dispatch the same event the real ws.ts fires so the overlay starts
    // recording (needed for bug-report event capture in the demo).
    window.dispatchEvent(new CustomEvent('overlay-ws-connected'));
  });
}

export function send(data: object): void {
  // Post to all other windows on the channel.
  // Use try-catch because structured clone may fail on non-cloneable data
  // (e.g., React fiber objects in componentProps).
  try {
    channel.postMessage(data);
  } catch (err) {
    // Fall back to JSON round-trip to strip non-cloneable values
    try {
      channel.postMessage(JSON.parse(JSON.stringify(data)));
    } catch {
      console.warn('[vybit-bus] Failed to post message:', (err as Error).message);
    }
  }
  // Also deliver locally (BroadcastChannel doesn't echo to sender)
  queueMicrotask(() => {
    for (const handler of handlers) handler(data);
    window.dispatchEvent(new CustomEvent('vybit:message', { detail: data }));
  });
}

export function sendTo(role: string, data: object): void {
  // Unlike send(), sendTo does NOT echo locally — in the real WS system
  // the server routes targeted messages only to the specified role.
  // BroadcastChannel already delivers to other windows (not sender), so
  // skipping local echo prevents the sender from processing its own message.
  const msg = { ...data, to: role };
  try {
    channel.postMessage(msg);
  } catch (err) {
    try {
      channel.postMessage(JSON.parse(JSON.stringify(msg)));
    } catch {
      console.warn('[vybit-bus] Failed to post message:', (err as Error).message);
    }
  }
}

export function onMessage(handler: MessageHandler): () => void {
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}

export function onConnect(handler: () => void): () => void {
  connectHandlers.add(handler);
  return () => { connectHandlers.delete(handler); };
}

export function onDisconnect(handler: () => void): () => void {
  disconnectHandlers.add(handler);
  return () => { disconnectHandlers.delete(handler); };
}

export function isConnected(): boolean {
  return _connected;
}
