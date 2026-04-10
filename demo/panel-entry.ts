// Panel page entry point — mounts the React panel app
// Communication with the main page (overlay) happens via BroadcastChannel (demo/bus.ts)
import './fetch-interceptor'; // Intercept fetch calls (storybook-data, ghost-cache, etc.)
import './panel.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../panel/src/App';

// Prevent the overlay from activating inside the panel page
(window as any).__VYBIT_PANEL__ = true;

ReactDOM.createRoot(document.getElementById('root')!).render(
  React.createElement(React.StrictMode, null, React.createElement(App)),
);
