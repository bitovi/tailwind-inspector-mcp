import { useCallback, useEffect, useState } from 'react';
import { ShadowGhost } from '../ShadowGhost';
import { DragProvider } from '../DrawTab/context/DragContext';
import { useDragToPlace } from '../DrawTab/hooks/useDragToPlace';
import { sendTo, onMessage } from '../../ws';
import { PRIMITIVES } from './primitives';
import type { ElementsTabProps, Primitive } from './types';

export function ElementsTab({ insertMode, onArmedChange }: ElementsTabProps) {
  const [armedId, setArmedId] = useState<string | null>(null);

  const arm = useCallback((primitive: Primitive) => {
    setArmedId(primitive.id);
    onArmedChange?.(true);
    sendTo('overlay', {
      type: 'COMPONENT_ARM',
      componentName: primitive.name,
      storyId: '',
      ghostHtml: primitive.ghostHtml,
      ghostCss: '',
      insertMode: insertMode === 'replace' ? 'replace' : undefined,
    });
  }, [insertMode, onArmedChange]);

  const disarm = useCallback(() => {
    setArmedId(null);
    onArmedChange?.(false);
    sendTo('overlay', { type: 'COMPONENT_DISARM' });
  }, [onArmedChange]);

  // Disarm when overlay confirms placement or escape
  useEffect(() => {
    return onMessage((msg) => {
      if (msg.type === 'COMPONENT_DISARMED') {
        setArmedId(null);
        onArmedChange?.(false);
      }
    });
  }, [onArmedChange]);

  return (
    <DragProvider>
    <div className="p-3 flex flex-col gap-1.5">
      <ul className="flex flex-col gap-2">
        {PRIMITIVES.map(primitive => (
          <PrimitiveRow
            key={primitive.id}
            primitive={primitive}
            isArmed={armedId === primitive.id}
            insertMode={insertMode}
            onArm={arm}
            onDisarm={disarm}
          />
        ))}
      </ul>
    </div>
    </DragProvider>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface PrimitiveRowProps {
  primitive: Primitive;
  isArmed: boolean;
  insertMode?: 'replace' | 'place';
  onArm: (p: Primitive) => void;
  onDisarm: () => void;
}

function PrimitiveRow({ primitive, isArmed, insertMode, onArm, onDisarm }: PrimitiveRowProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const getGhostData = useCallback(() => ({
    ghostHtml: primitive.ghostHtml,
    ghostCss: primitive.previewCss ?? null,
  }), [primitive]);

  const { onPointerDown: onDragPointerDown, onPointerMove: onDragPointerMove, onPointerUp: onDragPointerUp, onLostPointerCapture } = useDragToPlace({
    componentName: primitive.name,
    storyId: '',
    groupName: primitive.id,
    getGhostData,
    onDragStart: () => setIsDragActive(true),
    onDragEnd: () => setIsDragActive(false),
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isArmed) {
      onDisarm();
    } else {
      onArm(primitive);
    }
  };

  return (
    <li
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors ${
        isArmed
          ? 'border-bit-teal bg-bit-teal/10'
          : 'border-bit-border bg-bit-surface hover:border-bit-teal/50'
      }`}
    >
      {/* Thumbnail — drag handle */}
      <div
        className={`w-14 h-10 rounded overflow-hidden bg-white border border-bit-border shrink-0 flex items-center justify-center cursor-grab ${isDragActive ? 'opacity-50' : ''}`}
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onLostPointerCapture={onLostPointerCapture}
      >
        <ShadowGhost
          ghostHtml={primitive.ghostHtml}
          ghostCss={primitive.previewCss}
          style={{ transform: 'scale(0.7)', transformOrigin: 'center center', pointerEvents: 'none' }}
        />
      </div>

      {/* Name */}
      <span className="flex-1 text-[11px] font-medium text-bit-text truncate font-mono">
        {primitive.name}
      </span>

      {/* Place / Replace button */}
      <button
        type="button"
        onClick={handleClick}
        className={`h-5.5 rounded px-2 text-[10px] font-medium border cursor-pointer transition-colors ${
          isArmed
            ? 'border-bit-teal bg-bit-teal text-white'
            : 'border-bit-border bg-bit-surface-hi text-bit-text hover:border-bit-teal hover:text-bit-teal'
        }`}
      >
        {isArmed
          ? (insertMode === 'replace' ? 'Replacing' : 'Placing')
          : (insertMode === 'replace' ? 'Replace' : 'Place')}
      </button>
    </li>
  );
}
