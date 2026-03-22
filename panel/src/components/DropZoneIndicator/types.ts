export type DropPosition = 'before' | 'after' | 'first-child' | 'last-child';

export type IndicatorVariant = 'teal' | 'blue';

export interface DropZoneIndicatorProps {
  /** Bounding rect of the target element (relative to the container) */
  targetRect: DOMRect | null;
  /** Current drop position */
  position: DropPosition | null;
  /** Flex or grid axis — determines whether indicators are horizontal or vertical */
  axis: 'vertical' | 'horizontal';
  /** Visual style variant */
  variant: IndicatorVariant;
}

export interface DropZoneState {
  /** The element currently being hovered */
  activeTarget: HTMLElement | null;
  /** Where the drop would land */
  dropPosition: DropPosition | null;
  /** Layout axis of the active target's parent */
  axis: 'vertical' | 'horizontal';
}
