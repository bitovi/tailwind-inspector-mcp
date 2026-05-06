import { useEffect, useRef, useId } from 'react';
import { useDragContext, type DropTargetEntry } from '../context/DragContext';
import type { ArmedComponentData } from '../types';

interface UseDropTargetOptions {
  /** Group name this slot belongs to (for self-drop prevention) */
  groupName: string;
  /** Prop name this slot represents */
  propName: string;
  /** Called when a component is dropped on this target */
  onDrop: (data: ArmedComponentData) => void;
  /** Whether this target should be active (e.g. only when it's a slot field) */
  enabled?: boolean;
}

export function useDropTarget({ groupName, propName, onDrop, enabled = true }: UseDropTargetOptions) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const { isDragging, dragSourceGroup, hoveredTargetId, registerDropTarget, unregisterDropTarget } = useDragContext();

  const isDropHovered = isDragging && hoveredTargetId === id && dragSourceGroup !== groupName;
  const isSelfDrag = isDragging && dragSourceGroup === groupName;

  // Register/unregister drop target when drag is active
  useEffect(() => {
    if (!isDragging || !enabled || !ref.current) return;
    // Don't register if this belongs to the drag source
    if (dragSourceGroup === groupName) return;

    const entry: DropTargetEntry = {
      id,
      element: ref.current,
      groupName,
      propName,
      onDrop,
    };
    registerDropTarget(entry);
    return () => unregisterDropTarget(id);
  }, [isDragging, enabled, id, groupName, propName, onDrop, dragSourceGroup, registerDropTarget, unregisterDropTarget]);

  return { ref, isDropHovered, isDragActive: isDragging && !isSelfDrag };
}
