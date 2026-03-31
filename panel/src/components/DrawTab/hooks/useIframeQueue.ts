import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Maximum number of iframes (probes + adaptive) that may load simultaneously.
 *
 * Kept at 1 because Angular Storybook loads many JS chunks per iframe and all
 * requests share the browser's 6-connection HTTP/1.1 pool for the proxy host.
 * Running multiple iframes at once saturates that pool and causes "Pending"
 * stalls. With concurrency=1 the single active iframe gets all 6 connections.
 */
export const IFRAME_QUEUE_CONCURRENCY = 1;

// ── Unified queue — shared by probes AND adaptive iframes ────────────────────
// Both useProbeSlot and useIframeSlot draw from this pool so the total number
// of simultaneously loading iframes never exceeds IFRAME_QUEUE_CONCURRENCY.
let running = 0;
const waiters: Array<() => void> = [];

function acquireSlot(): Promise<() => void> {
  return new Promise(resolve => {
    const attempt = () => {
      if (running < IFRAME_QUEUE_CONCURRENCY) {
        running++;
        resolve(releaseSlotInternal);
      } else {
        waiters.push(attempt);
      }
    };
    attempt();
  });
}

function releaseSlotInternal() {
  running = Math.max(0, running - 1);
  const next = waiters.shift();
  next?.();
}

export function useProbeSlot(enabled: boolean): { canProbe: boolean; releaseProbeSlot: () => void } {
  const [canProbe, setCanProbe] = useState(false);
  const releaseRef = useRef<(() => void) | null>(null);
  const enqueuedRef = useRef(false);

  useEffect(() => {
    if (!enabled || enqueuedRef.current) return;
    enqueuedRef.current = true;

    let cancelled = false;
    acquireSlot().then(releaseFn => {
      if (cancelled) { releaseFn(); return; }
      releaseRef.current = releaseFn;
      setCanProbe(true);
    });

    return () => {
      cancelled = true;
      if (releaseRef.current) {
        releaseRef.current();
        releaseRef.current = null;
      }
      setCanProbe(false);
      enqueuedRef.current = false;
    };
  }, [enabled]);

  const releaseProbeSlot = useCallback(() => {
    if (releaseRef.current) {
      releaseRef.current();
      releaseRef.current = null;
    }
  }, []);

  return { canProbe, releaseProbeSlot };
}

/**
 * Acquires a slot in the global iframe load queue when `enabled` becomes true.
 * Returns `{ canLoad, releaseSlot }`.
 *
 * - `canLoad` is true once a slot is granted (stays true after release so the
 *   rendered preview remains visible after loading finishes).
 * - Call `releaseSlot()` when the iframe finishes loading (success or error).
 */
export function useIframeSlot(enabled: boolean): { canLoad: boolean; releaseSlot: () => void } {
  const [canLoad, setCanLoad] = useState(false);
  const releaseRef = useRef<(() => void) | null>(null);
  // One-way latch: once we've entered the queue, don't re-enter on re-renders.
  const enqueuedRef = useRef(false);

  useEffect(() => {
    if (!enabled || enqueuedRef.current) return;
    enqueuedRef.current = true;

    let cancelled = false;
    acquireSlot().then(releaseFn => {
      if (cancelled) { releaseFn(); return; }
      releaseRef.current = releaseFn;
      setCanLoad(true);
    });

    return () => {
      cancelled = true;
      // Release slot if the component unmounts while still loading.
      if (releaseRef.current) {
        releaseRef.current();
        releaseRef.current = null;
      }
    };
  }, [enabled]);

  const releaseSlot = useCallback(() => {
    if (releaseRef.current) {
      releaseRef.current();
      releaseRef.current = null;
      // Don't set canLoad = false — the preview should stay visible after loading.
    }
  }, []);

  return { canLoad, releaseSlot };
}
