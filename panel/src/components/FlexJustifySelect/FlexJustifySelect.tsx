import type { CSSProperties } from 'react';
import { useState } from 'react';
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import { FocusTrapContainer } from '../FocusTrapContainer';
import { DiagramCell, BOX_BASE, BORDER, SURFACE, TEXT_MID, FONT_MONO, TEAL } from '../FlexDiagramPicker/diagram-shared';
import { JustifyDiagrams } from '../FlexDiagramPicker/JustifyDiagrams';
import { JUSTIFY_OPTIONS } from '../FlexDiagramPicker/diagrams';
import type { FlexJustifySelectProps } from './types';

export function FlexJustifySelect({
  currentValue,
  lockedValue,
  locked,
  flexDirection = 'row',
  onHover,
  onLeave,
  onClick,
  onRemove,
  onRemoveHover,
}: FlexJustifySelectProps) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => { if (!next) { setOpen(false); onLeave(); } },
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  const isThisLocked = lockedValue !== null && JUSTIFY_OPTIONS.some((o) => o.value === lockedValue);
  const foreignLocked = locked && !isThisLocked;
  const isUnset = !isThisLocked && (currentValue === null || currentValue === '');
  const displayValue = isThisLocked ? lockedValue! : (currentValue ?? '');

  const activeOption = JUSTIFY_OPTIONS.find((o) => o.value === displayValue);
  const labelText = activeOption?.label ?? '—';

  function close() {
    setOpen(false);
    onLeave();
  }

  function handleTriggerClick() {
    if (foreignLocked) return;
    setOpen((prev) => {
      if (prev) onLeave();
      return !prev;
    });
  }

  // Collapsed state: single 60×60 diagram + label
  const emptyBoxStyle: CSSProperties = {
    ...BOX_BASE,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div className="flex flex-col items-start gap-1">
      {/* Header label */}
      <span style={{ fontSize: 9, fontFamily: FONT_MONO, color: TEXT_MID, fontWeight: 500 }}>
        JUSTIFY →
      </span>

      {/* Trigger: single diagram cell */}
      <div
        ref={refs.setReference}
        className="cursor-pointer"
        role="button"
        tabIndex={foreignLocked ? -1 : 0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTriggerClick(); }}
        onClick={handleTriggerClick}
        {...getReferenceProps()}
      >
        {isUnset ? (
          // Empty state — dashed border box
          <div className="flex flex-col items-center gap-0.5">
            <div style={emptyBoxStyle}>
              <span style={{ fontSize: 9, fontFamily: FONT_MONO, color: TEXT_MID }}>
                —
              </span>
            </div>
            <span style={{ fontSize: 9, fontFamily: FONT_MONO, color: TEXT_MID }}>
              none
            </span>
          </div>
        ) : (
          // Active state — show the active diagram
          <DiagramCell
            label={labelText}
            isActive={open}
            containerStyle={activeOption?.getContainerStyle(flexDirection) ?? { flexDirection: flexDirection as CSSProperties['flexDirection'] }}
            children={(lit) => activeOption?.renderItems(flexDirection) ?? null}
          />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-[9999]"
            {...getFloatingProps()}
          >
            <FocusTrapContainer
              className="bg-bv-bg border border-bv-border rounded-lg shadow-lg p-2 flex flex-col gap-1"
              onMouseLeave={onLeave}
              onClose={close}
            >
              {/* Remove row */}
              {onRemove && (
                <div
                  className="flex items-center gap-1.5 px-1.5 py-1 text-[10px] font-mono text-bv-muted border-b border-bv-border mb-1 pb-1.5 cursor-pointer transition-colors duration-150 hover:text-bv-orange"
                  onMouseEnter={onRemoveHover}
                  onMouseLeave={onLeave}
                  onClick={() => { onRemove(); close(); }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
                    <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  remove
                </div>
              )}

              {/* Diagram grid — reuse JustifyDiagrams */}
              <JustifyDiagrams
                flexDirection={flexDirection}
                activeValue={displayValue}
                onSelect={(value) => { onClick(value); close(); }}
                onHover={onHover}
              />
            </FocusTrapContainer>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
