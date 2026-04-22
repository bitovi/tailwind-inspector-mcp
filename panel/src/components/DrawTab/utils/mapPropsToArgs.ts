import type { ArgType, SlotArgValue } from '../types';
import type { SerializedReactElement } from '../../../../../shared/types';
import { isSlotProp } from './isSlotProp';

function isSerializedReactElement(v: unknown): v is SerializedReactElement {
  return !!v && typeof v === 'object' && (v as any).__reactElement === true;
}

/** Optional resolver to look up a component's Storybook story and cached ghost */
export type ComponentGhostResolver = (componentName: string) => {
  storyId: string;
  ghostHtml?: string;
  ghostCss?: string;
  componentPath?: string;
} | null;

/**
 * Map serialized component props (from the overlay's extractComponentProps) into
 * ArgsForm-compatible values, guided by the component's argTypes.
 *
 * - Primitives that match an argType are used directly.
 * - Serialized elements on slot fields become SlotArgValue.
 * - String values on slot fields become { type: 'text', value }.
 * - Props not present in argTypes are skipped.
 */
export function mapPropsToArgs(
  props: Record<string, unknown>,
  argTypes: Record<string, ArgType>,
  resolveGhost?: ComponentGhostResolver,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, argType] of Object.entries(argTypes)) {
    const value = props[key];
    if (value === undefined) continue;

    if (isSlotProp(key, argType)) {
      // ReactNode field
      if (isSerializedReactElement(value)) {
        const ghost = resolveGhost?.(value.componentName);
        const rnv: SlotArgValue = {
          type: 'component',
          componentName: value.componentName,
          storyId: ghost?.storyId ?? '',
          componentPath: ghost?.componentPath,
          args: value.props && Object.keys(value.props).length > 0 ? value.props : undefined,
          ghostHtml: ghost?.ghostHtml,
          ghostCss: ghost?.ghostCss,
        };
        result[key] = rnv;
      } else if (typeof value === 'string') {
        const rnv: SlotArgValue = { type: 'text', value };
        result[key] = rnv;
      }
      // Skip arrays/complex children for now
    } else {
      // Primitive prop — only set if type matches what the control expects
      const t = typeof value;
      if (t === 'string' || t === 'number' || t === 'boolean') {
        result[key] = value;
      }
    }
  }

  return result;
}
