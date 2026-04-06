import { useState, useEffect } from 'react';
import { getSharedGhostExtractor, type GhostData } from './SharedGhostExtractor';

/**
 * React hook that requests ghost extraction via the shared single-iframe
 * extractor. When `enabled` is true and `storyId` is provided, the request
 * is queued. Returns the extracted ghost data once available.
 */
export function useSharedExtraction(
  storyId: string | null,
  enabled: boolean,
): {
  ghostData: GhostData | null;
  loading: boolean;
  error: string | null;
} {
  const [ghostData, setGhostData] = useState<GhostData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !storyId) return;

    let cancelled = false;
    const extractor = getSharedGhostExtractor();

    setLoading(true);
    setError(null);

    extractor.extract(storyId).then(data => {
      if (!cancelled) {
        setGhostData(data);
        setLoading(false);
      }
    }).catch(err => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      extractor.cancel(storyId);
    };
  }, [enabled, storyId]);

  return { ghostData, loading, error };
}
