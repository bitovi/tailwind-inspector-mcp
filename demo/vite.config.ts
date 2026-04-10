import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

const root = path.resolve(__dirname, '..');

/**
 * Rewrite /panel and /panel/ to /panel.html in dev mode.
 * The overlay opens iframes/popups to `${origin}/panel`.
 */
function panelRewrite(): Plugin {
  return {
    name: 'demo-panel-rewrite',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        // Match /panel, /panel/, and /panel/?mode=design etc.
        const [pathname, query] = (req.url ?? '').split('?');
        if (pathname === '/panel' || pathname === '/panel/') {
          req.url = '/panel.html' + (query ? '?' + query : '');
        }
        // Also intercept /overlay.js (the fake script tag) — return empty JS
        if (req.url === '/overlay.js') {
          _res.setHeader('Content-Type', 'application/javascript');
          _res.end('// demo stub');
          return;
        }
        next();
      });
    },
  };
}

/**
 * Replace overlay/src/ws.ts and panel/src/ws.ts with demo/bus.ts.
 * Also patch the overlay's SERVER_ORIGIN to include the base path
 * (needed for GitHub Pages deploys with a subpath).
 */
function wsAlias(): Plugin {
  const busPath = path.resolve(__dirname, 'bus.ts');
  const overlayWs = path.resolve(root, 'overlay/src/ws.ts');
  const panelWs = path.resolve(root, 'panel/src/ws.ts');
  const overlayIndex = path.resolve(root, 'overlay/src/index.ts');
  return {
    name: 'demo-ws-alias',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null;
      // Match any relative import ending in /ws or /ws.ts (e.g. ./ws, ../ws, ../../ws)
      if (/^\.\.?\//.test(source) && /\/ws(\.ts)?$|^\.\/ws(\.ts)?$/.test(source)) {
        const dir = path.dirname(importer);
        const resolved = path.resolve(dir, source.replace(/\.ts$/, '') + '.ts');
        if (resolved === overlayWs || resolved === panelWs) {
          return busPath;
        }
      }
      return null;
    },
    transform(code, id) {
      // Patch overlay's getServerOrigin to include base path for GH Pages
      if (id === overlayIndex || id === overlayIndex + '?v=' || id.startsWith(overlayIndex)) {
        return code.replace(
          'const SERVER_ORIGIN = getServerOrigin();',
          `const SERVER_ORIGIN = getServerOrigin().replace(/\\/$/, '') + (typeof __DEMO_BASE_URL__ !== 'undefined' ? __DEMO_BASE_URL__.replace(/\\/$/, '') : '');`,
        );
      }
      return undefined;
    },
  };
}

const base = process.env.BASE_URL || '/';
const storybookBase = `${base}storybook`.replace(/\/\//g, '/');

/**
 * After build, copy dist/panel.html → dist/panel/index.html so that
 * `/panel/?mode=design` resolves on static hosts (GitHub Pages, http-server).
 */
/**
 * On non-watch builds, clean dist/ while preserving storybook/ subdirectory.
 */
function cleanDist(): Plugin {
  return {
    name: 'demo-clean-dist',
    buildStart() {
      const isWatch = process.argv.includes('--watch');
      if (!isWatch) {
        const distDir = path.resolve(__dirname, 'dist');
        if (fs.existsSync(distDir)) {
          for (const entry of fs.readdirSync(distDir)) {
            if (entry !== 'storybook') {
              fs.rmSync(path.join(distDir, entry), { recursive: true, force: true });
            }
          }
        }
      }
    },
  };
}
function panelDirectory(): Plugin {
  return {
    name: 'demo-panel-directory',
    closeBundle() {
      const src = path.resolve(__dirname, 'dist/panel.html');
      const destDir = path.resolve(__dirname, 'dist/panel');
      if (fs.existsSync(src)) {
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, path.join(destDir, 'index.html'));
      }
    },
  };
}
export default defineConfig({
  root: __dirname,
  base,
  plugins: [cleanDist(), wsAlias(), panelRewrite(), panelDirectory(), react(), tailwindcss()],
  define: {
    // Inject the base URL so the overlay can construct the correct panel URL.
    // The overlay reads SERVER_ORIGIN to build panelUrl = `${SERVER_ORIGIN}/panel`.
    // On GitHub Pages the panel lives at `${base}/panel.html`, not `/panel.html`.
    '__DEMO_BASE_URL__': JSON.stringify(base),
    '__STORYBOOK_BASE__': JSON.stringify(storybookBase),
  },
  build: {
    outDir: 'dist',
      emptyOutDir: false, // cleanDist plugin handles selective cleanup
    minify: false, // Preserve component names for better demo UX
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        panel: path.resolve(__dirname, 'panel.html'),
      },
    },
  },
});
