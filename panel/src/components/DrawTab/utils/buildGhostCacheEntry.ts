import type { ArgType } from '../types';

export interface GhostCacheEntry {
  storyId: string;
  args?: Record<string, unknown>;
  ghostHtml: string;
  ghostCss: string;
  storyBackground?: string;
  componentName: string;
  componentPath?: string;
  argCount?: number;
}

/** Build the standard ghost cache entry object passed to onGhostExtracted. */
export function buildGhostCacheEntry(params: {
  storyId: string;
  args?: Record<string, unknown>;
  ghostHtml: string;
  ghostCss: string;
  storyBackground?: string;
  componentName: string;
  componentPath?: string;
  argTypes: Record<string, ArgType>;
}): GhostCacheEntry {
  return {
    storyId: params.storyId,
    args: params.args,
    ghostHtml: params.ghostHtml,
    ghostCss: params.ghostCss,
    storyBackground: params.storyBackground,
    componentName: params.componentName,
    componentPath: params.componentPath,
    argCount: Object.keys(params.argTypes).length || undefined,
  };
}
