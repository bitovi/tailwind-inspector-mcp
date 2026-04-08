import { useState, useEffect, useCallback, useRef } from 'react';
import type { GhostCacheEntry } from '../../../shared/types';

interface GhostCacheResult {
  /** Look up a cached ghost by storyId and optional args. */
  getCachedGhost: (storyId: string, args?: Record<string, unknown>) => { ghostHtml: string; ghostCss?: string; storyBackground?: string; argCount?: number } | null;
  /** Submit (or refresh) a ghost in the server cache. Fire-and-forget. */
  submitToCache: (params: {
    storyId: string;
    args?: Record<string, unknown>;
    ghostHtml: string;
    ghostCss?: string;
    storyBackground?: string;
    componentName: string;
    componentPath?: string;
    argCount?: number;
  }) => void;
  loaded: boolean;
}

function argsHashKey(args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return '';
  return JSON.stringify(args, Object.keys(args).sort());
}

function cacheKey(storyId: string, args?: Record<string, unknown>): string {
  const hash = argsHashKey(args);
  return hash ? `${storyId}::${hash}` : storyId;
}

export function useGhostCache(): GhostCacheResult {
  const [loaded, setLoaded] = useState(false);
  const cacheRef = useRef(new Map<string, GhostCacheEntry>());

  // Fetch all cached ghosts on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/ghost-cache')
      .then(r => r.json())
      .then((entries: GhostCacheEntry[]) => {
        if (cancelled) return;
        const map = new Map<string, GhostCacheEntry>();
        for (const entry of entries) {
          const key = entry.argsHash
            ? `${entry.storyId}::${entry.argsHash}`
            : entry.storyId;
          map.set(key, entry);
        }
        cacheRef.current = map;
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  const getCachedGhost = useCallback((storyId: string, args?: Record<string, unknown>) => {
    const key = cacheKey(storyId, args);
    const entry = cacheRef.current.get(key);
    if (!entry) return null;
    return { ghostHtml: entry.ghostHtml, ghostCss: entry.ghostCss, storyBackground: entry.storyBackground, argCount: entry.argCount };
  }, []);

  const submitToCache = useCallback((params: {
    storyId: string;
    args?: Record<string, unknown>;
    ghostHtml: string;
    ghostCss?: string;
    storyBackground?: string;
    componentName: string;
    componentPath?: string;
    argCount?: number;
  }) => {
    const key = cacheKey(params.storyId, params.args);
    const existingEntry = cacheRef.current.get(key);
    // POST if new, or if the server entry is missing data we now have (e.g. argCount)
    const needsServerUpdate = !existingEntry || (params.argCount != null && existingEntry.argCount == null);

    // Update local cache immediately
    cacheRef.current.set(key, {
      storyId: params.storyId,
      argsHash: argsHashKey(params.args),
      ghostHtml: params.ghostHtml,
      ghostCss: params.ghostCss,
      storyBackground: params.storyBackground,
      componentName: params.componentName,
      componentPath: params.componentPath,
      argCount: params.argCount,
      extractedAt: Date.now(),
    });

    // Skip the POST if the server already has a complete entry
    if (!needsServerUpdate) return;

    // Fire-and-forget to server
    fetch('/api/ghost-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storyId: params.storyId,
        args: params.args,
        ghostHtml: params.ghostHtml,
        ghostCss: params.ghostCss,
        storyBackground: params.storyBackground,
        componentName: params.componentName,
        componentPath: params.componentPath,
        argCount: params.argCount,
      }),
    }).catch(() => {});
  }, []);

  return { getCachedGhost, submitToCache, loaded };
}
