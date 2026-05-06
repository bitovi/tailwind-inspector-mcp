import { createContext, useContext, useCallback, useRef, useState, type ReactNode } from 'react';
import type { ArmedComponentData } from '../types';

// ── Types ────────────────────────────────────────────────────────────────

export interface DropTargetEntry {
  id: string;
  element: HTMLElement;
  groupName: string;
  propName: string;
  onDrop: (data: ArmedComponentData) => void;
}

interface DragState {
  isDragging: boolean;
  dragData: ArmedComponentData | null;
  dragSourceGroup: string | null;
  /** Current cursor position within the panel (clientX, clientY) */
  cursorPos: { x: number; y: number } | null;
  /** ID of the drop target currently under the cursor */
  hoveredTargetId: string | null;
}

interface DragContextValue extends DragState {
  startDrag: (data: ArmedComponentData, sourceGroup: string) => void;
  endDrag: () => void;
  cancelDrag: () => void;
  updateCursor: (x: number, y: number) => void;
  registerDropTarget: (entry: DropTargetEntry) => void;
  unregisterDropTarget: (id: string) => void;
  /** Hit-test all registered drop targets at given coordinates */
  hitTest: (x: number, y: number) => DropTargetEntry | null;
  /** Perform a drop on the currently hovered target. Returns true if drop succeeded. */
  dropOnHovered: () => boolean;
}

const DragContext = createContext<DragContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────

export function DragProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DragState>({
    isDragging: false,
    dragData: null,
    dragSourceGroup: null,
    cursorPos: null,
    hoveredTargetId: null,
  });

  const dropTargetsRef = useRef<Map<string, DropTargetEntry>>(new Map());

  const startDrag = useCallback((data: ArmedComponentData, sourceGroup: string) => {
    setState({
      isDragging: true,
      dragData: data,
      dragSourceGroup: sourceGroup,
      cursorPos: null,
      hoveredTargetId: null,
    });
  }, []);

  const endDrag = useCallback(() => {
    setState({
      isDragging: false,
      dragData: null,
      dragSourceGroup: null,
      cursorPos: null,
      hoveredTargetId: null,
    });
  }, []);

  const cancelDrag = useCallback(() => {
    setState({
      isDragging: false,
      dragData: null,
      dragSourceGroup: null,
      cursorPos: null,
      hoveredTargetId: null,
    });
  }, []);

  const hitTest = useCallback((x: number, y: number): DropTargetEntry | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;

    for (const entry of dropTargetsRef.current.values()) {
      if (entry.element.contains(el)) {
        return entry;
      }
    }
    return null;
  }, []);

  const updateCursor = useCallback((x: number, y: number) => {
    const hit = hitTest(x, y);
    setState(prev => {
      const newHovered = hit?.id ?? null;
      if (prev.cursorPos?.x === x && prev.cursorPos?.y === y && prev.hoveredTargetId === newHovered) {
        return prev;
      }
      return { ...prev, cursorPos: { x, y }, hoveredTargetId: newHovered };
    });
  }, [hitTest]);

  const registerDropTarget = useCallback((entry: DropTargetEntry) => {
    dropTargetsRef.current.set(entry.id, entry);
  }, []);

  const unregisterDropTarget = useCallback((id: string) => {
    dropTargetsRef.current.delete(id);
  }, []);

  const dropOnHovered = useCallback((): boolean => {
    const { hoveredTargetId, dragData, dragSourceGroup } = state;
    if (!hoveredTargetId || !dragData) return false;

    const target = dropTargetsRef.current.get(hoveredTargetId);
    if (!target) return false;

    // Prevent self-drop
    if (target.groupName === dragSourceGroup) return false;

    target.onDrop(dragData);
    return true;
  }, [state]);

  const value: DragContextValue = {
    ...state,
    startDrag,
    endDrag,
    cancelDrag,
    updateCursor,
    registerDropTarget,
    unregisterDropTarget,
    hitTest,
    dropOnHovered,
  };

  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────────────

const NOOP_CONTEXT: DragContextValue = {
  isDragging: false,
  dragData: null,
  dragSourceGroup: null,
  cursorPos: null,
  hoveredTargetId: null,
  startDrag: () => {},
  endDrag: () => {},
  cancelDrag: () => {},
  updateCursor: () => {},
  registerDropTarget: () => {},
  unregisterDropTarget: () => {},
  hitTest: () => null,
  dropOnHovered: () => false,
};

export function useDragContext(): DragContextValue {
  const ctx = useContext(DragContext);
  // Gracefully return no-op when used outside a DragProvider (e.g. in tests)
  return ctx ?? NOOP_CONTEXT;
}
