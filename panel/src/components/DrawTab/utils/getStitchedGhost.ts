import { stitchGhostSlots } from './stitch-ghost-slots';

/** Resolve the current ghost HTML/CSS from live state or cached values, then stitch slots. */
export function getStitchedGhost(
  liveGhostHtml: string | null,
  liveGhostCss: string | null,
  cachedGhostHtml: string | undefined,
  cachedGhostCss: string | undefined,
  args: Record<string, unknown>,
): { ghostHtml: string; ghostCss: string } {
  const rawGhostHtml = liveGhostHtml ?? cachedGhostHtml ?? '';
  const rawGhostCss = liveGhostCss ?? cachedGhostCss ?? '';
  return stitchGhostSlots(rawGhostHtml, rawGhostCss, args);
}
