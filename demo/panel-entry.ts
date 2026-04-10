// Panel page entry point — mounts the React panel app
// Communication with the main page (overlay) happens via BroadcastChannel (demo/bus.ts)
import './fetch-interceptor'; // Intercept fetch calls (storybook-data, ghost-cache, etc.)
import './panel.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../panel/src/App';
import { onConnect, send } from './bus';

// Prevent the overlay from activating inside the panel page
(window as any).__VYBIT_PANEL__ = true;

// In the real WS system, panel/src/ws.ts sends REGISTER inside the WebSocket
// open handler. The demo bus alias replaces that file, so we send it here.
onConnect(() => {
  send({ type: 'REGISTER', role: 'panel' });
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  React.createElement(React.StrictMode, null, React.createElement(App)),
);
