// Builds a component-drop Patch object.
// Extracted to avoid the same ~30-line block being copy-pasted across
// drop-zone.ts (×3) and drag-drop.ts (×1).

import { buildSelector, findGhostAncestor } from './drop-zone';
import { buildContext } from './context';
import { getFiber, findOwningComponent } from './react/fiber';
import type { Patch } from '../../shared/types';
import type { DropPosition } from '../../shared/drop-geometry';

export interface ComponentDropPatchOpts {
  target: HTMLElement;
  position: DropPosition | 'replace';
  componentName: string;
  storyId: string;
  ghostHtml: string;
  ghostCss?: string;
  componentPath?: string;
  componentArgs?: Record<string, unknown>;
}

/**
 * Build a `component-drop` Patch from the given parameters.
 *
 * Handles:
 * - Ghost ancestor detection (target is/contains a previously-dropped ghost)
 * - Context string construction (with ghost-aware phrasing)
 * - React fiber → parentComponent lookup
 * - All standard Patch fields
 */
export function buildComponentDropPatch(opts: ComponentDropPatchOpts): Patch {
  const { target, position, componentName, storyId, ghostHtml, ghostCss, componentPath, componentArgs } = opts;

  const targetSelector = buildSelector(target);
  const isGhostTarget = !!target.dataset.twDroppedComponent;
  const ghostTargetPatchId = target.dataset.twDroppedPatchId;
  const ghostTargetName = target.dataset.twDroppedComponent;
  const ghostAncestor = !isGhostTarget ? findGhostAncestor(target) : null;
  const effectiveGhostName = isGhostTarget ? ghostTargetName : ghostAncestor?.dataset.twDroppedComponent;
  const effectiveGhostPatchId = isGhostTarget ? ghostTargetPatchId : ghostAncestor?.dataset.twDroppedPatchId;

  const context = effectiveGhostName
    ? (position === 'replace'
        ? `Replace the <${effectiveGhostName} /> component (pending insertion from an earlier drop) with "${componentName}"`
        : `Place "${componentName}" ${position} the <${effectiveGhostName} /> component (pending insertion from an earlier drop)`)
    : buildContext(target, '', '', new Map());

  let parentComponent: { name: string } | undefined;
  const fiber = getFiber(target);
  if (fiber) {
    const boundary = findOwningComponent(fiber);
    if (boundary) parentComponent = { name: boundary.componentName };
  }

  return {
    id: crypto.randomUUID(),
    kind: 'component-drop',
    elementKey: targetSelector,
    status: 'staged',
    originalClass: '',
    newClass: '',
    property: 'component-drop',
    timestamp: new Date().toISOString(),
    component: { name: componentName },
    target: isGhostTarget
      ? { tag: ghostTargetName?.toLowerCase() ?? 'unknown', classes: '', innerText: '' }
      : {
          tag: target.tagName.toLowerCase(),
          classes: target.className,
          innerText: target.innerText.slice(0, 100),
        },
    ghostHtml,
    ghostCss: ghostCss || undefined,
    componentStoryId: storyId,
    componentPath: componentPath || undefined,
    componentArgs: componentArgs && Object.keys(componentArgs).length > 0 ? componentArgs : undefined,
    parentComponent,
    insertMode: position,
    context,
    ...(effectiveGhostPatchId ? { targetPatchId: effectiveGhostPatchId, targetComponentName: effectiveGhostName } : {}),
  };
}
