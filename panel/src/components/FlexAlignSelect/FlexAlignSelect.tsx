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
import { ALIGN_OPTIONS } from '../FlexDiagramPicker/diagrams';
import {
  DiagramCell,
  BOX_BASE,
  TEAL,
  BORDER,
  SURFACE,
  TEXT_MID,
  FONT_MONO,
} from '../FlexDiagramPicker/diagram-shared';
import type { FlexAlignSelectProps } from './types';

export function FlexAlignSelect({
  currentValue,
  lockedValue,
  locked,
  flexDirection = 'row',
  onHover,
  onLeave,
  onClick,
  onRemove,
  onRemoveHover,
}: FlexAlignSelectProps) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => {
      if (!next) { setOpen(false); onLeave(); }
    },
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  const isThisLocked = lockedValue !== null && ALIGN_OPTIONS.some((o) => o.value === lockedValue);
  const foreignLocked = locked && !isThisLocked;
  const isUnset = !isThisLocked && (currentValue === null || currentValue === '');
  const displayValue = isThisLocked ? lockedValue! : (currentValue ?? '');

  const activeOpt = ALIGN_OPTIONS.find((o) => o.value === displayValue);
  const labelText = activeOpt?.label ?? '—';
  const fd = flexDirection as CSSProperties['flexDirection'];

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

  // Collapsed: 60×60 diagram box for the active value
  const triggerBoxStyle: CSSProperties = isUnset
    ? {
        ...BOX_BASE,
        borderStyle: 'dashed',
        borderColor: BORDER,
        background: SURFACE,
        cursor: foreignLocked ? 'default' : 'pointer',
        alignItems: 'center',
        justifyContent: 'center',
      }
    : {
        ...BOX_BASE,
        borderColor: open ? TEAL : BORDER,
        background: open ? 'rgba(0,132,139,0.09)' : SURFACE,
        cursor: foreignLocked ? 'default' : 'pointer',
        ...(activeOpt ? activeOpt.getContainerStyle(flexDirection) : {}),
      };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {/* Header label */}
      <span style={{
        fontSize: 9,
        fontFamily: FONT_MONO,
        color: TEXT_MID,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Align ↓
      </span>

      {/* Collapsed trigger */}
      <div
        ref={refs.setReference}
        role="button"
        tabIndex={foreignLocked ? -1 : 0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTriggerClick(); }}
        onClick={handleTriggerClick}
        {...getReferenceProps()}
      >
        <div style={triggerBoxStyle}>
          {isUnset
            ? <span style={{ fontSize: 9, fontFamily: FONT_MONO, color: TEXT_MID }}>—</span>
            : activeOpt?.renderItems(flexDirection)
          }
        </div>
      </div>

      {/* Value label */}
      <span style={{
        fontSize: 9,
        fontFamily: FONT_MONO,
        color: open ? TEAL : TEXT_MID,
        fontWeight: open ? 600 : 400,
        textAlign: 'center',
        transition: 'color 150ms ease-in-out',
      }}>
        {isUnset ? '—' : labelText}
      </span>

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

              {/* Diagram grid — 5 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 60px)', gap: 4 }}>
                {ALIGN_OPTIONS.map((opt) => (
                  <DiagramCell
                    key={opt.value}
                    label={opt.label}
                    isActive={opt.value === displayValue}
                    containerStyle={{ flexDirection: fd, ...opt.getContainerStyle(flexDirection) }}
                    onHover={() => onHover(opt.value)}
                    onClick={() => { onClick(opt.value); close(); }}
                  >
                    {(lit) => opt.renderItems(flexDirection)}
                  </DiagramCell>
                ))}
              </div>
            </FocusTrapContainer>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
