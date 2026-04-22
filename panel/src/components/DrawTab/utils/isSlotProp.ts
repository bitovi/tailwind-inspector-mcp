/**
 * Determines whether a prop should be treated as a composable slot —
 * i.e. a prop that accepts nested component content (React children,
 * ReactNode, Angular content projection, etc).
 *
 * Framework-neutral: recognises React type names (ReactNode, ReactElement,
 * Element, JSX.Element), Angular slot type ("Slot"), and the special
 * "children" prop name.
 */
import type { ArgType } from '../types';

/** Type names that indicate a prop accepts composable/nested content */
const SLOT_TYPE_NAMES = new Set([
  'ReactNode',
  'ReactElement',
  'Element',
  'JSX.Element',
  'Slot',          // Angular content projection slots
]);

export function isSlotProp(name: string, argType: ArgType): boolean {
  if (name === 'children') return true;
  const typeName = argType.type?.name;
  if (typeName && SLOT_TYPE_NAMES.has(typeName)) return true;
  // Storybook reports React.ReactNode as type "other" with control "object"
  if (typeName === 'other' && argType.control === 'object') return true;
  return false;
}
