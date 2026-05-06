import { useDragContext } from '../context/DragContext';

/**
 * Floating drag preview shown during panel-internal drag (Phase 1).
 * Renders a small semi-transparent ghost thumbnail following the cursor.
 * Mounted at DrawTab level via the DragContext.
 */
export function DragPreview() {
  const { isDragging, dragData, cursorPos } = useDragContext();

  if (!isDragging || !cursorPos || !dragData) return null;

  return (
    <div
      className="fixed pointer-events-none z-[9999] opacity-80"
      style={{
        left: cursorPos.x + 12,
        top: cursorPos.y - 24,
      }}
    >
      <div className="flex flex-col items-center gap-0.5">
        {/* Ghost thumbnail */}
        <div className="w-[60px] h-[40px] bg-white border border-bit-teal rounded shadow-lg overflow-hidden flex items-center justify-center">
          {dragData.ghostHtml ? (
            <div
              className="pointer-events-none transform scale-[0.3] origin-center"
              dangerouslySetInnerHTML={{ __html: dragData.ghostHtml }}
            />
          ) : (
            <span className="text-[8px] text-bit-muted">{dragData.componentName}</span>
          )}
        </div>
        {/* Label */}
        <span className="text-[9px] font-medium text-bit-teal bg-bit-teal/10 px-1.5 py-0.5 rounded whitespace-nowrap">
          {dragData.componentName}
        </span>
      </div>
    </div>
  );
}
