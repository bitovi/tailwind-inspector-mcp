import { useEffect, useRef } from 'react';
import { useDragContext } from '../context/DragContext';

const HOVER_DWELL_MS = 500;

interface UseHoverExpandOptions {
  /** Ref to the component row element to watch for hover */
  rowRef: React.RefObject<HTMLElement | null>;
  /** Whether this row is already expanded */
  isExpanded: boolean;
  /** The group name of this row (for self-drag prevention) */
  groupName: string;
  /** Called when dwell time is reached — should expand the customize drawer */
  onExpand: () => void;
}

/**
 * Hook that auto-expands a ComponentGroupItem's customize drawer when the user
 * hovers over it for 500ms during an active drag operation.
 * Does NOT expand the drag source's own row (self-drop prevention).
 */
export function useHoverExpand({ rowRef, isExpanded, groupName, onExpand }: UseHoverExpandOptions) {
  const { isDragging, dragSourceGroup, cursorPos } = useDragContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringRef = useRef(false);

  useEffect(() => {
    // Only active during drag, when not already expanded, and not the drag source
    if (!isDragging || isExpanded || dragSourceGroup === groupName || !cursorPos || !rowRef.current) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      isHoveringRef.current = false;
      return;
    }

    const rect = rowRef.current.getBoundingClientRect();
    const isInside =
      cursorPos.x >= rect.left &&
      cursorPos.x <= rect.right &&
      cursorPos.y >= rect.top &&
      cursorPos.y <= rect.bottom;

    if (isInside && !isHoveringRef.current) {
      // Cursor just entered this row
      isHoveringRef.current = true;
      timerRef.current = setTimeout(() => {
        onExpand();
        timerRef.current = null;
      }, HOVER_DWELL_MS);
    } else if (!isInside && isHoveringRef.current) {
      // Cursor left this row
      isHoveringRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isDragging, dragSourceGroup, groupName, isExpanded, cursorPos, onExpand, rowRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Return whether this row is being hovered during drag (for visual hint)
  const isHoverDwelling = isDragging && isHoveringRef.current && !isExpanded && dragSourceGroup !== groupName;
  return { isHoverDwelling };
}
