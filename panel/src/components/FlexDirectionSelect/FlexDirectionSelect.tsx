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
import {
  BOX_BASE,
  TEAL,
  TEAL_DIM,
  BORDER,
  SURFACE,
  TEXT_MID,
  FONT_MONO,
} from '../FlexDiagramPicker/diagram-shared';
import type { FlexDirectionSelectProps, FlexDirectionValue } from './types';

const DIRECTION_OPTIONS: Array<{ value: FlexDirectionValue; label: string; arrow: string }> = [
  { value: 'flex-row',         label: 'row',         arrow: '→' },
  { value: 'flex-col',         label: 'col',         arrow: '↓' },
  { value: 'flex-row-reverse', label: 'row-reverse', arrow: '←' },
  { value: 'flex-col-reverse', label: 'col-reverse', arrow: '↑' },
];

/** SVG arrow paths for each direction, drawn in a 30×30 viewBox. */
function DirectionArrow({ direction, color }: { direction: FlexDirectionValue; color: string }) {
  const props = { stroke: color, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  // Arrow line + head for each direction
  switch (direction) {
    case 'flex-row': // →
      return (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <line x1="5" y1="15" x2="25" y2="15" {...props} />
          <polyline points="19,9 25,15 19,21" {...props} />
        </svg>
      );
    case 'flex-col': // ↓
      return (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <line x1="15" y1="5" x2="15" y2="25" {...props} />
          <polyline points="9,19 15,25 21,19" {...props} />
        </svg>
      );
    case 'flex-row-reverse': // ←
      return (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <line x1="25" y1="15" x2="5" y2="15" {...props} />
          <polyline points="11,9 5,15 11,21" {...props} />
        </svg>
      );
    case 'flex-col-reverse': // ↑
      return (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <line x1="15" y1="25" x2="15" y2="5" {...props} />
          <polyline points="9,11 15,5 21,11" {...props} />
        </svg>
      );
  }
}

export function FlexDirectionSelect({
  currentValue,
  lockedValue,
  locked,
  onHover,
  onLeave,
  onClick,
}: FlexDirectionSelectProps) {
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

  const isThisLocked = lockedValue !== null && DIRECTION_OPTIONS.some((o) => o.value === lockedValue);
  const foreignLocked = locked && !isThisLocked;
  const displayValue = isThisLocked ? lockedValue! : (currentValue ?? '');
  const activeOption = DIRECTION_OPTIONS.find((o) => o.value === displayValue);
  const isUnset = !activeOption;

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

  // ─── Trigger cell styles ─────────────────────────────────────────────
  const triggerBoxStyle: React.CSSProperties = isUnset
    ? {
        ...BOX_BASE,
        borderStyle: 'dashed',
        borderColor: open ? TEAL : BORDER,
        background: open ? TEAL_DIM : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: foreignLocked ? 'default' : 'pointer',
      }
    : {
        ...BOX_BASE,
        borderColor: open ? TEAL : BORDER,
        background: open ? TEAL_DIM : SURFACE,
        boxShadow: open ? '0 0 0 2px rgba(0,132,139,0.18)' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: foreignLocked ? 'default' : 'pointer',
      };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      {/* Header label */}
      <span style={{
        fontSize: 9,
        fontFamily: FONT_MONO,
        color: TEXT_MID,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Direction
      </span>

      {/* Trigger */}
      <div
        ref={refs.setReference}
        role="button"
        tabIndex={foreignLocked ? -1 : 0}
        aria-label="Direction"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTriggerClick(); }}
        onClick={handleTriggerClick}
        {...getReferenceProps()}
      >
        <div style={triggerBoxStyle}>
          {activeOption ? (
            <DirectionArrow direction={activeOption.value} color={open ? TEAL : TEXT_MID} />
          ) : (
            <span style={{ fontSize: 10, fontFamily: FONT_MONO, color: TEXT_MID }}>—</span>
          )}
        </div>
        <span style={{
          fontSize: 9,
          fontFamily: FONT_MONO,
          color: open ? TEAL : (activeOption ? TEXT_MID : TEXT_MID),
          fontWeight: open ? 600 : 400,
          textAlign: 'center',
          transition: 'color 150ms ease-in-out',
        }}>
          {activeOption?.label ?? '—'}
        </span>
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
              style={{
                background: '#1e1e1e',
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                padding: 8,
              }}
              onMouseLeave={onLeave}
              onClose={close}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 60px)',
                  gap: 4,
                }}
              >
                {DIRECTION_OPTIONS.map((opt) => {
                  const isActive = opt.value === displayValue;
                  return (
                    <DirectionCell
                      key={opt.value}
                      option={opt}
                      isActive={isActive}
                      onHover={() => onHover(opt.value)}
                      onClick={() => { onClick(opt.value); close(); }}
                    />
                  );
                })}
              </div>
            </FocusTrapContainer>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}

/** Single option cell in the dropdown grid. */
function DirectionCell({ option, isActive, onHover, onClick }: {
  option: { value: FlexDirectionValue; label: string };
  isActive: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const lit = isActive || hovered;

  const boxStyle: React.CSSProperties = {
    ...BOX_BASE,
    borderColor: lit ? TEAL : BORDER,
    background: lit ? TEAL_DIM : SURFACE,
    boxShadow: isActive ? '0 0 0 2px rgba(0,132,139,0.35)' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}
      onMouseEnter={() => { setHovered(true); onHover(); }}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div style={boxStyle}>
        <DirectionArrow direction={option.value} color={lit ? TEAL : TEXT_MID} />
      </div>
      <span style={{
        fontSize: 9,
        fontFamily: FONT_MONO,
        color: lit ? TEAL : TEXT_MID,
        fontWeight: lit ? 600 : 400,
        textAlign: 'center',
        transition: 'color 150ms ease-in-out',
      }}>
        {option.label}
      </span>
    </div>
  );
}
