// Express app factory

import express from "express";
import cors from "cors";
import { request as makeRequest } from "http";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";

import { getByStatus, getQueueUpdate, clearAll } from "./queue.js";
import { resolveTailwindConfig, generateCssForClasses, getTailwindVersion } from "./tailwind.js";
import { loadStoryArgTypes, detectStorybookUrl, probeStorybookUrl } from "./storybook.js";
import { loadCache, getAllCachedGhosts, setCachedGhost, invalidateAll as invalidateGhostCache } from "./ghost-cache.js";
import type { PatchStatus } from "../shared/types.js";
import type { RequestHandler } from "express";

const VALID_STATUSES = new Set<string>(['staged', 'committed', 'implementing', 'implemented', 'error']);

export function createApp(packageRoot: string, initialStorybookUrl: string | null = null): express.Express {
  const app = express();
  let storybookUrl = initialStorybookUrl;
  app.use(cors());

  // Load ghost cache from disk on startup
  loadCache();

  app.get("/overlay.js", (_req, res) => {
    const overlayPath = path.join(packageRoot, "overlay", "dist", "overlay.js");
    res.set("Cache-Control", "no-store");
    res.sendFile(overlayPath, (err) => {
      if (err) {
        console.error("[http] Failed to serve overlay.js:", err);
        if (!res.headersSent) res.status(404).end();
      }
    });
  });

  app.get("/api/info", async (_req, res) => {
    try {
      const tailwindVersion = await getTailwindVersion();
      res.json({ tailwindVersion });
    } catch (err) {
      console.error("[http] Failed to detect tailwind version:", err);
      res.status(500).json({ error: "Failed to detect Tailwind version" });
    }
  });

  app.get("/tailwind-config", async (_req, res) => {
    try {
      const config = await resolveTailwindConfig();
      res.json(config);
    } catch (err) {
      console.error("[http] Failed to resolve tailwind config:", err);
      res.status(500).json({ error: "Failed to resolve Tailwind config" });
    }
  });

  app.post("/css", express.json(), async (req, res) => {
    const { classes } = req.body as { classes?: unknown };
    if (!Array.isArray(classes) || classes.some((c) => typeof c !== "string")) {
      res.status(400).json({ error: "classes must be an array of strings" });
      return;
    }
    try {
      const css = await generateCssForClasses(classes as string[]);
      res.json({ css });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error("[http] Failed to generate CSS for classes", classes, ":", err);
      res.status(500).json({ error: "Failed to generate CSS", detail: message, stack });
    }
  });

  // --- Patch state REST endpoint ---
  app.get("/patches", (_req, res) => {
    const status = _req.query.status as string | undefined;
    if (status) {
      if (!VALID_STATUSES.has(status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` });
        return;
      }
      res.json(getByStatus(status as PatchStatus));
    } else {
      const update = getQueueUpdate();
      res.json(update);
    }
  });

  app.delete("/patches", (_req, res) => {
    clearAll();
    res.json({ ok: true });
  });

  // --- Ghost cache REST endpoints ---
  app.get('/api/ghost-cache', (_req, res) => {
    res.json(getAllCachedGhosts());
  });

  app.post('/api/ghost-cache', express.json({ limit: '1mb' }), (req, res) => {
    const { storyId, args, ghostHtml, hostStyles, storyBackground, componentName, componentPath } = req.body;
    if (!storyId || typeof ghostHtml !== 'string') {
      res.status(400).json({ error: 'storyId and ghostHtml are required' });
      return;
    }
    setCachedGhost({ storyId, args, ghostHtml, hostStyles: hostStyles ?? {}, storyBackground, componentName: componentName ?? '', componentPath });
    res.json({ ok: true });
  });

  app.delete('/api/ghost-cache', (_req, res) => {
    invalidateGhostCache();
    res.json({ ok: true });
  });

  // --- Storybook proxy (dynamic — supports late attach) ---
  const OWN_PATHS = new Set(['/panel', '/overlay.js', '/api', '/patches', '/css', '/tailwind-config']);
  const isOwnPath = (p: string) =>
    OWN_PATHS.has(p) ||
    [...OWN_PATHS].some(own => p.startsWith(own + '/')) ||
    p === '/';

  let sbProxy: RequestHandler | null = null;
  let sbAssetProxy: RequestHandler | null = null;

  function installStorybookProxy(url: string) {
    sbProxy = createProxyMiddleware({
      target: url,
      changeOrigin: true,
      pathRewrite: { '^/storybook': '' },
    });
    sbAssetProxy = createProxyMiddleware({
      target: url,
      changeOrigin: true,
      pathFilter: (pathname) => !isOwnPath(pathname),
    });
    console.error(`[storybook] Proxying /storybook + Vite asset paths → ${url}`);
  }

  if (storybookUrl) installStorybookProxy(storybookUrl);

  // Dynamic proxy routes — delegate to current proxy middleware
  app.use('/storybook', (req, res, next) => {
    if (sbProxy) return sbProxy(req, res, next);
    next();
  });

  // Catch-all asset proxy (must be registered after /api, /panel, etc.)
  // Deferred to the end via a late-bind wrapper stored here and mounted later.
  const assetProxyHandler: RequestHandler = (req, res, next) => {
    if (sbAssetProxy) return sbAssetProxy(req, res, next);
    next();
  };

  app.get('/api/storybook-status', (_req, res) => {
    res.json({ url: storybookUrl ? '/storybook' : null, directUrl: storybookUrl ?? null });
  });

  // --- Storybook reconnect ---
  app.post('/api/storybook-reconnect', express.json(), async (req, res) => {
    const { port } = req.body as { port?: number };
    let foundUrl: string | null = null;

    if (port != null) {
      const url = `http://localhost:${port}`;
      if (await probeStorybookUrl(url)) {
        foundUrl = url;
      }
    } else {
      foundUrl = await detectStorybookUrl();
    }

    if (foundUrl) {
      storybookUrl = foundUrl;
      installStorybookProxy(foundUrl);
      res.json({ ok: true, url: '/storybook', directUrl: foundUrl });
    } else {
      res.json({ ok: false });
    }
  });

  app.get('/api/storybook-argtypes', async (_req, res) => {
    if (!storybookUrl) { res.json({}); return; }
    try {
      const argTypes = await loadStoryArgTypes(storybookUrl);
      res.json(argTypes);
    } catch (err) {
      console.error('[storybook] /api/storybook-argtypes failed:', err);
      res.json({});
    }
  });

  // Single endpoint: everything the Draw tab panel needs in one request.
  app.get('/api/storybook-data', async (_req, res) => {
    if (!storybookUrl) {
      res.json({ available: false });
      return;
    }
    try {
      const [indexRes, argTypes] = await Promise.all([
        fetch(`${storybookUrl}/index.json`, { signal: AbortSignal.timeout(5000) }),
        loadStoryArgTypes(storybookUrl),
      ]);
      if (!indexRes.ok) { res.json({ available: false }); return; }
      const index = await indexRes.json();
      res.json({ available: true, directUrl: storybookUrl, index, argTypes });
    } catch (err) {
      console.error('[storybook] /api/storybook-data failed:', err);
      res.json({ available: false });
    }
  });

  // --- Serve Panel app ---
  if (process.env.PANEL_DEV) {
    const panelDevPort = Number(process.env.PANEL_DEV_PORT) || 5174;
    console.error(`[server] Panel dev mode: proxying /panel → http://localhost:${panelDevPort}`);
    app.use("/panel", (req, res) => {
      const proxyReq = makeRequest(
        {
          hostname: "localhost",
          port: panelDevPort,
          path: "/panel" + req.url,
          method: req.method,
          headers: { ...req.headers, host: `localhost:${panelDevPort}` },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode!, proxyRes.headers);
          proxyRes.pipe(res, { end: true });
        }
      );
      proxyReq.on("error", () => {
        if (!res.headersSent) res.status(502).send("Panel dev server not running on port " + panelDevPort);
      });
      req.pipe(proxyReq, { end: true });
    });
  } else {
    const panelDist = path.join(packageRoot, "panel", "dist");
    app.use("/panel", express.static(panelDist));
    app.get("/panel/*", (_req, res) => {
      res.sendFile(path.join(panelDist, "index.html"), (err) => {
        if (err && !res.headersSent) res.status(404).end();
      });
    });
  }

  // Storybook asset proxy — must come after all other routes
  app.use(assetProxyHandler);

  return app;
}
