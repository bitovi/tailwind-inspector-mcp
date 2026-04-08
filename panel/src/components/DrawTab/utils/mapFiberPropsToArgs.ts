import type { ArgType, ReactNodeArgValue } from '../types';
import type { SerializedReactElement } from '../../../../../shared/types';

const REACT_NODE_NAMES = new Set(['ReactNode', 'ReactElement', 'Element', 'JSX.Element']);

function isReactNodeProp(name: string, argType: ArgType): boolean {
  if (name === 'children') return true;
  const typeName = argType.type?.name;
  if (typeName && REACT_NODE_NAMES.has(typeName)) return true;
  if (typeName === 'other' && argType.control === 'object') return true;
  return false;
}

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
 * Map serialized fiber props (from the overlay's extractComponentProps) into
 * ArgsForm-compatible values, guided by the component's argTypes.
 *
 * - Primitives that match an argType are used directly.
 * - Serialized React elements on ReactNode fields become ReactNodeArgValue.
 * - String values on ReactNode fields become { type: 'text', value }.
 * - Props not present in argTypes are skipped.
 */
export function mapFiberPropsToArgs(
  fiberProps: Record<string, unknown>,
  argTypes: Record<string, ArgType>,
  resolveGhost?: ComponentGhostResolver,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, argType] of Object.entries(argTypes)) {
    const value = fiberProps[key];
    if (value === undefined) continue;

    if (isReactNodeProp(key, argType)) {
      // ReactNode field
      if (isSerializedReactElement(value)) {
        const ghost = resolveGhost?.(value.componentName);
        const rnv: ReactNodeArgValue = {
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
        const rnv: ReactNodeArgValue = { type: 'text', value };
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
