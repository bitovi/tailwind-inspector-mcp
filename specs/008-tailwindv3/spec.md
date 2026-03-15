# 008 — Tailwind v3 Support

## Goal

Support Tailwind CSS v3 projects alongside the existing v4 support. The server auto-detects which version the target project uses and selects the appropriate compilation and theme-extraction strategy. No user configuration required.

## Background

This project originally supported Tailwind v3 in its first commit ([7bf2510](https://github.com/bitovi/tailwind-inspector-mcp/commit/7bf251097811bbc1708c2f55bcf77b93cff64ad1)). That implementation used `resolveConfig()` + PostCSS for CSS generation. When the project moved to v4, that code was replaced with v4's `compile()` / `build()` API. This spec reintroduces v3 support via an adapter pattern so both versions coexist.

## Version Detection

The server already resolves the target project's `tailwindcss` via `createRequire(process.cwd())`. Detection reads the installed package's version:

```typescript
import { readFileSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";

async function detectTailwindVersion(): Promise<3 | 4> {
  const cwd = process.cwd();
  const req = createRequire(resolve(cwd, "package.json"));
  const pkgPath = req.resolve("tailwindcss/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const major = parseInt(pkg.version.split(".")[0], 10);
  return major >= 4 ? 4 : 3;
}
```

This runs once at startup. Since the server must be started from the target project's directory (e.g., `cd test-app && node --import tsx ../server/index.ts`), `cwd` always points at the correct `node_modules`.

## Architecture: Adapter Pattern

### Interface

```typescript
// server/tailwind-adapter.ts

interface TailwindThemeSubset {
  spacing: Record<string, string>;
  colors: Record<string, unknown>;
  fontSize: Record<string, unknown>;
  fontWeight: Record<string, unknown>;
  borderRadius: Record<string, string>;
}

interface TailwindAdapter {
  readonly version: 3 | 4;
  resolveTailwindConfig(): Promise<TailwindThemeSubset>;
  generateCssForClasses(classes: string[]): Promise<string>;
}
```

### File Structure

```
server/
  tailwind.ts              → adapter factory + detectVersion()
  tailwind-v3.ts           → TailwindV3Adapter
  tailwind-v4.ts           → TailwindV4Adapter (current code, extracted)
  tailwind-adapter.ts      → TailwindAdapter interface + TailwindThemeSubset type
```

`server/tailwind.ts` becomes the entry point that detects the version and delegates:

```typescript
// server/tailwind.ts
import type { TailwindAdapter } from "./tailwind-adapter.js";

let adapter: TailwindAdapter | null = null;

async function getAdapter(): Promise<TailwindAdapter> {
  if (adapter) return adapter;
  const version = await detectTailwindVersion();
  if (version === 3) {
    const { TailwindV3Adapter } = await import("./tailwind-v3.js");
    adapter = new TailwindV3Adapter();
  } else {
    const { TailwindV4Adapter } = await import("./tailwind-v4.js");
    adapter = new TailwindV4Adapter();
  }
  console.error(`[tailwind] Using Tailwind v${version} adapter`);
  return adapter;
}

export async function resolveTailwindConfig() {
  return (await getAdapter()).resolveTailwindConfig();
}

export async function generateCssForClasses(classes: string[]) {
  return (await getAdapter()).generateCssForClasses(classes);
}
```

### V4 Adapter (extract current code)

Move the current `server/tailwind.ts` implementation into `server/tailwind-v4.ts`. No logic changes — just wrapped in a class implementing `TailwindAdapter`.

### V3 Adapter (port from original commit)

```typescript
// server/tailwind-v3.ts — key differences from v4

class TailwindV3Adapter implements TailwindAdapter {
  readonly version = 3 as const;

  async resolveTailwindConfig(): Promise<TailwindThemeSubset> {
    // 1. Look for tailwind.config.js or .ts in cwd
    // 2. Use tailwindcss/resolveConfig to merge with defaults
    // 3. Return theme.spacing, theme.colors, etc.
    // 4. Fall back to hardcoded defaultTheme if no config found
  }

  async generateCssForClasses(classes: string[]): Promise<string> {
    // 1. Load tailwindcss as a PostCSS plugin
    // 2. Process "@tailwind utilities;" with safelist: classes, content: []
    // 3. Return the generated CSS string
  }
}
```

Key v3 details:
- **Config**: `resolveConfig(userConfig)` from `tailwindcss/resolveConfig`
- **CSS generation**: `postcss([tailwindPlugin({ ...config, content: [], safelist: classes })]).process("@tailwind utilities;")`
- **Fallback**: Hardcoded `defaultTheme` with standard v3 scale values (hex colors, rem spacing, etc.)

## What Does NOT Change

The adapter pattern keeps all version differences contained in the server. These layers are already version-agnostic:

| Layer | Why it works for both |
|-------|----------------------|
| **`class-parser.ts`** | Parses by prefix (`px-`, `bg-`, etc.) — same in v3 and v4 |
| **Panel UI** | Reads `TailwindThemeSubset` JSON — doesn't care how it was produced |
| **`getScaleValues.ts`** | Reads keys from the theme config object — works with either version's data |
| **`ColorGrid`** | Reads `colors` from theme config — hex (v3) or oklch (v4), both render fine |
| **Overlay** | Fetches `/css` and `/tailwind-config` endpoints — protocol is the same |
| **Patcher** | Swaps class names on DOM nodes — class names are the same across versions |
| **MCP tools** | Work with patches — no Tailwind awareness |
| **WebSocket messages** | Carry class strings and config JSON — version-unaware |

### Minor class differences

A few v4-only utilities (like `size-*`) won't exist in v3. This is naturally handled:
- `class-parser.ts` will still parse `size-4` → but the class won't do anything in a v3 project
- `getScaleValues` derives available values from the theme JSON — if the v3 theme doesn't include them, they won't appear in the panel

No special-casing needed in the panel.

## New Endpoint: `/api/info`

Expose version metadata so the panel (or any client) can know what it's working with:

```typescript
app.get("/api/info", async (_req, res) => {
  const adapter = await getAdapter();
  res.json({
    tailwindVersion: adapter.version,
  });
});
```

This is optional for Phase 1 — the panel doesn't need it today since `TailwindThemeSubset` is the same shape. It's a future escape hatch if version-specific UI behavior is ever needed.

## Test App: `test-app-v3/`

A new test app mirroring `test-app/` but using Tailwind v3:

```
test-app-v3/
  package.json           ← tailwindcss@^3.4, postcss, autoprefixer
  tailwind.config.js     ← standard v3 config
  postcss.config.js      ← tailwindcss + autoprefixer
  vite.config.ts         ← @vitejs/plugin-react (no @tailwindcss/vite)
  index.html
  tsconfig.json
  src/
    App.tsx              ← same components as test-app
    main.tsx
    index.css            ← @tailwind base; @tailwind components; @tailwind utilities;
    components/          ← copied from test-app/src/components/
  e2e/                   ← E2E tests (shared or copied from test-app/e2e/)
```

### Key `package.json` differences

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "@vitejs/plugin-react": "^6.0.1",
    "vite": "^8.0.0"
  }
}
```

### VS Code Tasks

```jsonc
{
  "label": "Server v3 (port 3334)",
  "type": "shell",
  "command": "PORT=3334 npx tsx watch ../server/index.ts",
  "options": { "cwd": "${workspaceFolder}/test-app-v3" },
  "isBackground": true
},
{
  "label": "Test App v3 (port 5174)",
  "type": "shell",
  "command": "npx vite --port 5174",
  "options": { "cwd": "${workspaceFolder}/test-app-v3" },
  "isBackground": true
}
```

## Dependencies

The v3 adapter needs `postcss` at runtime. Options:

1. **Add `postcss` to the root `package.json` dependencies** — simplest, small package, already an indirect dependency of many tools
2. **Dynamic import with graceful error** — try `import("postcss")` and throw a clear error ("postcss is required for Tailwind v3 projects") if missing

Recommendation: **Option 1** — just include it. It's 50KB, widely used, and avoids a confusing runtime error.

## Implementation Phases

### Phase 1: Adapter Refactor

1. Create `server/tailwind-adapter.ts` — interface + shared types
2. Move current v4 code from `server/tailwind.ts` → `server/tailwind-v4.ts`
3. Rewrite `server/tailwind.ts` as the adapter factory with version detection
4. Verify all existing tests pass (no behavior change)

### Phase 2: V3 Adapter

1. Create `server/tailwind-v3.ts` implementing `TailwindAdapter`
2. Port `resolveTailwindConfig()` from original commit (resolveConfig + defaultTheme fallback)
3. Port `generateCssForClasses()` from original commit (PostCSS + safelist)
4. Add `postcss` to root dependencies
5. Add unit tests for the v3 adapter

### Phase 3: Test App v3

1. Scaffold `test-app-v3/` with v3 dependencies
2. Copy components from `test-app/src/`
3. Create `tailwind.config.js`, `postcss.config.js`, v3-style `index.css`
4. Verify the server starts and `/tailwind-config` returns valid theme
5. Verify `/css` endpoint generates correct CSS

### Phase 4: E2E Parity

1. Run existing E2E tests against `test-app-v3` (with adjusted port/config)
2. Fix any failures — likely just minor class-name or theme-value differences
3. Consider a shared E2E test suite parameterized by base URL

## Open Questions

1. **Shared test-app components?** — Should `test-app-v3/src/components/` be a copy or a symlink/import from `test-app`? Copying is simpler for independence; shared means identical markup for both.

2. **v3 without `tailwind.config`?** — The original code had a full `defaultTheme` fallback. Worth keeping for projects that rely on Tailwind's default config without an explicit file.

3. **`@apply` and plugins** — The v3 `generateCssForClasses` uses `content: [], safelist: classes`. This skips file scanning but also means `@apply` in user CSS isn't processed. This matches the v4 behavior (we only generate utility CSS), so it should be fine.

4. **v3.4 vs v3.0** — The `resolveConfig` API has been stable across v3.x. We should target v3.3+ since that's what's widely deployed.
