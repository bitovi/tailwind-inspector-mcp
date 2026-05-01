// ---------------------------------------------------------------------------
// Drag-drop postMessage types
// ---------------------------------------------------------------------------
// These are sent via postMessage (not WebSocket) between the panel iframe/popup
// and the overlay in the parent document. They use the __vybitDrag marker to
// distinguish them from other postMessage traffic.

/** Sent when the panel detects a drag gesture (mousedown + 5px threshold). */
export interface DragStartMessage {
  __vybitDrag: true;
  type: 'DRAG_START';
  componentName: string;
  storyId: string;
  ghostHtml?: string;
  ghostCss?: string;
  componentPath?: string;
  args?: Record<string, unknown>;
  /** Initial cursor position in screen coordinates (for popup path). */
  screenX: number;
  screenY: number;
}

/** Sent on every mousemove during drag (popup path only — iframe path uses
 *  parent document pointermove directly). */
export interface DragMoveMessage {
  __vybitDrag: true;
  type: 'DRAG_MOVE';
  screenX: number;
  screenY: number;
}

/** Sent when the panel ghost extraction completes after drag-start. */
export interface DragGhostReadyMessage {
  __vybitDrag: true;
  type: 'DRAG_GHOST_READY';
  ghostHtml: string;
  ghostCss: string;
}

/** Sent on mouseup or Escape — drag ended in the panel window. */
export interface DragEndMessage {
  __vybitDrag: true;
  type: 'DRAG_END';
  screenX: number;
  screenY: number;
  cancelled: boolean;
}

export type DragMessage =
  | DragStartMessage
  | DragMoveMessage
  | DragGhostReadyMessage
  | DragEndMessage;

export function isDragMessage(data: unknown): data is DragMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    '__vybitDrag' in data &&
    (data as Record<string, unknown>).__vybitDrag === true
  );
}
