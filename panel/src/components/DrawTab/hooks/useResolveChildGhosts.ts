import { useEffect, useRef } from 'react';
import { getSharedGhostExtractor } from './SharedGhostExtractor';
import { isSlotArgValue } from '../utils/stitch-ghost-slots';
import type { SlotArgValue } from '../types';

/**
 * Detects ReactNodeArgValue entries in `args` that have a storyId but are
 * missing ghostHtml, and triggers a ghost extraction with the child's
 * specific props. When extraction completes, calls `onArgsResolved` with
 * the updated args containing the ghost HTML.
 */
export function useResolveChildGhosts(
  args: Record<string, unknown>,
  onArgsResolved: (updatedArgs: Record<string, unknown>) => void,
): void {
  // Track which extractions are in-flight to avoid duplicate requests
  const inflightRef = useRef<Set<string>>(new Set());
  // Keep refs to latest values so async callbacks never capture stale closures
  const argsRef = useRef(args);
  argsRef.current = args;
  const callbackRef = useRef(onArgsResolved);
  callbackRef.current = onArgsResolved;

  useEffect(() => {
    const toExtract: Array<{ key: string; rnv: SlotArgValue & { type: 'component' }; extractionKey: string }> = [];

    for (const [key, value] of Object.entries(args)) {
      if (!isSlotArgValue(value)) continue;
      if (value.type !== 'component') continue;
      if (value.ghostHtml) continue; // Already resolved
      if (!value.storyId) continue; // No story to extract from

      const extractionKey = `${key}:${value.storyId}:${JSON.stringify(value.args ?? {})}`;
      if (inflightRef.current.has(extractionKey)) continue;

      inflightRef.current.add(extractionKey);
      toExtract.push({ key, rnv: value, extractionKey });
    }

    if (toExtract.length === 0) return;

    const extractor = getSharedGhostExtractor();

    for (const { key, rnv, extractionKey } of toExtract) {

      extractor.extract(rnv.storyId, rnv.args).then(data => {
        inflightRef.current.delete(extractionKey);
        // Read current args via ref to avoid stale closure
        callbackRef.current({
          ...argsRef.current,
          [key]: {
            ...rnv,
            ghostHtml: data.ghostHtml,
            ghostCss: data.ghostCss,
          },
        });
      }).catch((err) => {
        inflightRef.current.delete(extractionKey);
        console.warn(`[useResolveChildGhosts] Ghost extraction failed for ${rnv.storyId}:`, err);
      });
    }
  }, [args, onArgsResolved]);
}
