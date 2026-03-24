// Tailwind adapter factory — auto-detects v3 vs v4 from the target project's
// installed tailwindcss version and delegates to the appropriate adapter.

import { readFileSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";
import type { TailwindAdapter, TailwindThemeSubset } from "./tailwind-adapter.js";

export type { TailwindThemeSubset };

let adapterCache: TailwindAdapter | null = null;

/**
 * Detect which major version of tailwindcss is installed in the target project.
 */
function detectTailwindVersion(): 3 | 4 {
  const cwd = process.cwd();
  const req = createRequire(resolve(cwd, "package.json"));
  const pkgPath = req.resolve("tailwindcss/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const major = parseInt(pkg.version.split(".")[0], 10);
  return major >= 4 ? 4 : 3;
}

async function getAdapter(): Promise<TailwindAdapter> {
  if (adapterCache) return adapterCache;
  const version = detectTailwindVersion();
  if (version === 3) {
    const { TailwindV3Adapter } = await import("./tailwind-v3.js");
    adapterCache = new TailwindV3Adapter();
  } else {
    const { TailwindV4Adapter } = await import("./tailwind-v4.js");
    adapterCache = new TailwindV4Adapter();
  }
  return adapterCache;
}

/** Expose the detected version for the /api/info endpoint. */
export async function getTailwindVersion(): Promise<3 | 4> {
  return (await getAdapter()).version;
}

export async function resolveTailwindConfig(): Promise<TailwindThemeSubset> {
  return (await getAdapter()).resolveTailwindConfig();
}

export async function generateCssForClasses(classes: string[]): Promise<string> {
  return (await getAdapter()).generateCssForClasses(classes);
}

/**
 * Synchronous pre-flight check: can we find tailwindcss from the current cwd?
 * Used at startup to give an early, actionable error before the server binds.
 */
export function checkTailwindAvailable(): { ok: true } | { ok: false; error: string } {
  try {
    const cwd = process.cwd();
    const req = createRequire(resolve(cwd, "package.json"));
    req.resolve("tailwindcss/package.json");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
