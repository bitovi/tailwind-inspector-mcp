// Demo main page — test-app + overlay, no server
// The panel runs in a separate page (panel.html) loaded via iframe/popup by the overlay containers.
import './fetch-interceptor'; // Intercept fetch calls (overlay + panel API mocks)
import './tailwind-browser'; // Registers MutationObserver for Tailwind CSS generation
import { addPatch, commitDraft, discardPatch, discardCommit, broadcastQueueUpdate, markCommitImplementing, markCommitImplemented } from './mock-queue';
import { logMcpCommit } from './mock-mcp';
import { onMessage, send } from './bus';

// ── Wire message bus to handle queue operations (acts as the "server") ──
onMessage((msg: any) => {
  // ── Queue operations ──
  if (msg.type === 'PATCH_STAGED') {
    addPatch({
      ...msg.patch,
      kind: msg.patch.kind ?? 'class-change',
      status: 'staged',
    });
    broadcastQueueUpdate();
  } else if (msg.type === 'MESSAGE_STAGE') {
    addPatch({
      id: msg.id,
      kind: 'message',
      elementKey: msg.elementKey ?? '',
      status: 'staged',
      originalClass: '',
      newClass: '',
      property: '',
      timestamp: new Date().toISOString(),
      message: msg.message,
      component: msg.component,
      target: msg.target,
      context: msg.context,
      insertMode: msg.insertMode,
      pageUrl: msg.pageUrl,
    });
    broadcastQueueUpdate();
  } else if (msg.type === 'PATCH_COMMIT') {
    const ids: string[] = msg.ids;
    const commit = commitDraft(ids);
    broadcastQueueUpdate();

    if (commit.patches.length > 0) {
      logMcpCommit(commit, 0);

      markCommitImplementing(commit.id);
      broadcastQueueUpdate();

      setTimeout(() => {
        markCommitImplemented(commit.id);
        broadcastQueueUpdate();
        console.log(
          '%c✅ Agent finished implementing commit ' + commit.id.slice(0, 8),
          'color: #2E7229; font-weight: bold',
        );
      }, 2000);
    }
  } else if (msg.type === 'DISCARD_PATCH') {
    discardPatch(msg.id);
    broadcastQueueUpdate();
  } else if (msg.type === 'DISCARD_DRAFTS') {
    const ids: string[] = msg.ids ?? [];
    for (const id of ids) {
      discardPatch(id);
    }
    broadcastQueueUpdate();
  } else if (msg.type === 'DISCARD_COMMIT') {
    discardCommit(msg.commitId);
    broadcastQueueUpdate();
  } else if (msg.type === 'DESIGN_SUBMIT') {
    const patch = addPatch({
      id: crypto.randomUUID(),
      kind: 'design',
      elementKey: `${msg.target?.tag ?? ''}.${(msg.target?.classes ?? '').split(' ')[0]}`,
      status: 'staged',
      originalClass: '',
      newClass: '',
      property: 'design',
      timestamp: new Date().toISOString(),
      component: msg.componentName ? { name: msg.componentName } : undefined,
      target: msg.target,
      context: msg.context,
      image: msg.image,
      insertMode: msg.insertMode,
      canvasWidth: msg.canvasWidth,
      canvasHeight: msg.canvasHeight,
      canvasComponents: msg.canvasComponents,
    });
    broadcastQueueUpdate();
    // Tell overlay to replace canvas iframe with static image
    send({ type: 'DESIGN_SUBMITTED', image: msg.image, patchId: patch.id });
  } else if (msg.type === 'DESIGN_CLOSE') {
    // Forward to overlay so it removes the canvas
    send({ type: 'DESIGN_CLOSE' });
  } else if (msg.type === 'REGISTER') {
    if (msg.role === 'panel') {
      queueMicrotask(() => {
        broadcastQueueUpdate();
        // Tell the panel that the overlay is connected (always true in demo — same page)
        send({ type: 'OVERLAY_STATUS', connected: true });
      });
    }
  }
});

// ── Render test app + overlay ──
async function boot() {
  const React = await import('react');
  const ReactDOM = await import('react-dom/client');

  const { default: TestApp } = await import('../test-app/src/App');
  const rootEl = document.getElementById('root')!;
  ReactDOM.createRoot(rootEl).render(React.createElement(TestApp));

  // The overlay derives SERVER_ORIGIN from <script src="...overlay.js">.
  // Inject a dummy script tag so it picks up the current origin.
  // Use a non-executable type to prevent the browser from fetching the stub URL.
  // Include import.meta.env.BASE_URL so it works on GitHub Pages with a subpath.
  const fakeScript = document.createElement('script');
  fakeScript.setAttribute('src', `${window.location.origin}${import.meta.env.BASE_URL}overlay.js`);
  fakeScript.setAttribute('type', 'text/x-vybit-stub');
  document.body.appendChild(fakeScript);

  // Ensure panel starts closed for tutorial Step 3 — but only if the user
  // hasn't already completed that step (so refresh preserves panel state).
  try {
    const progress = JSON.parse(localStorage.getItem('vybit-tutorial-progress') || '[]');
    if (!Array.isArray(progress) || !progress.includes(3)) {
      sessionStorage.removeItem('tw-inspector-panel-open');
    }
  } catch {
    sessionStorage.removeItem('tw-inspector-panel-open');
  }

  // Initialize overlay (calls init() on import, reads ./ws aliased to demo/bus.ts)
  await import('../overlay/src/index');
}

boot().catch(err => console.error('[demo] Bootstrap failed:', err));
