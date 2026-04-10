// Shared fetch interceptor for the demo.
// Intercepts API calls that normally go to the Express server.
// Used by both bootstrap.ts (main page) and panel-entry.ts (panel page).

import { defaultTailwindConfig } from './default-config';

const originalFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

  // POST /css — return empty CSS (browser compiler handles it via MutationObserver)
  if (url.includes('/css') && init?.method === 'POST') {
    return new Response(JSON.stringify({ css: '' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /tailwind-config — return default Tailwind v4 theme
  if (url.includes('/tailwind-config')) {
    return new Response(JSON.stringify(defaultTailwindConfig), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /api/storybook-data — fetch index.json from the colocated static Storybook build
  if (url.includes('/api/storybook-data')) {
    try {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      const indexRes = await originalFetch(`${base}/storybook/index.json`);
      if (indexRes.ok) {
        const index = await indexRes.json();
        return new Response(JSON.stringify({
          available: true,
          directUrl: `${base}/storybook`,
          index,
          argTypes: {},
        }), { headers: { 'Content-Type': 'application/json' } });
      }
    } catch {
      // Storybook not available — fall through
    }
    return new Response(JSON.stringify({ available: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /api/storybook-status — report based on whether storybook build exists
  if (url.includes('/api/storybook-status')) {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return new Response(JSON.stringify({
      url: `${base}/storybook`,
      directUrl: `${base}/storybook`,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // POST /api/storybook-reconnect — no-op in demo
  if (url.includes('/api/storybook-reconnect')) {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return new Response(JSON.stringify({
      ok: true,
      url: `${base}/storybook`,
      directUrl: `${base}/storybook`,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // POST /api/ghost-cache — no-op in demo (no persistent cache)
  if (url.includes('/api/ghost-cache') && init?.method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /api/ghost-cache — return empty cache
  if (url.includes('/api/ghost-cache')) {
    return new Response(JSON.stringify({ entries: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return originalFetch(input, init);
};
