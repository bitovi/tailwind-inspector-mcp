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
import { BOX_BASE, BORDER, SURFACE, TEAL, TEAL_DIM, TEXT_MID, FONT_MONO } from '../FlexDiagramPicker/diagram-shared';
import type { FlexWrapSelectProps, FlexWrapValue } from './types';

const WRAP_OPTIONS = [
  { value: 'flex-nowrap' as const, label: 'no-wrap' },
  { value: 'flex-wrap' as const, label: 'wrap' },
  { value: 'flex-wrap-reverse' as const, label: 'wrap-reverse' },
];

const ARROW_PROPS = (color: string) => ({
  stroke: color,
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none' as const,
});

/**
 * SVG icon for each wrap mode, drawn in a 30×30 viewBox to match DirectionArrow.
 * Color is passed in so the trigger and dropdown can control it (TEAL vs TEXT_MID).
 */
function WrapIcon({ mode, color }: { mode: FlexWrapValue; color: string }) {
  const p = ARROW_PROPS(color);
  const dotProps = { ...p, strokeDasharray: '2 3' };

  if (mode === 'flex-nowrap') {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40">
        <line x1="3" y1="7" x2="37" y2="7" {...p} />
        <polyline points="31,1 37,7 31,13" {...p} />
      </svg>
    );
  }

  if (mode === 'flex-wrap') {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40">
        <line x1="3" y1="7" x2="37" y2="7" {...p} />
        <line x1="37" y1="7" x2="3" y2="33" {...dotProps} />
        <line x1="3" y1="33" x2="37" y2="33" {...p} />
        <polyline points="31,27 37,33 31,39" {...p} />
      </svg>
    );
  }

  // wrap-reverse
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <line x1="3" y1="33" x2="37" y2="33" {...p} />
      <line x1="37" y1="33" x2="3" y2="7" {...dotProps} />
      <line x1="3" y1="7" x2="37" y2="7" {...p} />
      <polyline points="31,1 37,7 31,13" {...p} />
    </svg>
  );
}

/** Single option cell in the dropdown grid — matches DirectionCell styling. */
function WrapCell({ option, isActive, onHover, onClick }: {
  option: { value: FlexWrapValue; label: string };
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
        <WrapIcon mode={option.value} color={lit ? TEAL : TEXT_MID} />
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

export function FlexWrapSelect({
  currentValue,
  lockedValue,
  locked,
  onHover,
  onLeave,
  onClick,
}: FlexWrapSelectProps) {
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

  const isThisLocked = lockedValue !== null && WRAP_OPTIONS.some((o) => o.value === lockedValue);
  const foreignLocked = locked && !isThisLocked;
  const isUnset = !isThisLocked && currentValue === null;
  const displayValue = isThisLocked ? lockedValue! : (currentValue ?? '');
  const activeOption = WRAP_OPTIONS.find((o) => o.value === displayValue);
  const labelText = activeOption?.label ?? 'Wrap';

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
        Wrap
      </span>

      {/* Trigger */}
      <div
        ref={refs.setReference}
        role="button"
        tabIndex={foreignLocked ? -1 : 0}
        aria-label="Wrap"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTriggerClick(); }}
        onClick={handleTriggerClick}
        {...getReferenceProps()}
      >
        {isUnset ? (
          /* Empty state — dashed border box */
          <div style={{
            ...BOX_BASE,
            borderStyle: 'dashed',
            borderColor: open ? TEAL : BORDER,
            background: open ? TEAL_DIM : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: 10, fontFamily: FONT_MONO, color: TEXT_MID }}>—</span>
          </div>
        ) : (
          <div style={{
            ...BOX_BASE,
            borderColor: open ? TEAL : BORDER,
            background: open ? TEAL_DIM : SURFACE,
            boxShadow: open ? '0 0 0 2px rgba(0,132,139,0.18)' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <WrapIcon mode={displayValue as FlexWrapValue} color={open ? TEAL : TEXT_MID} />
          </div>
        )}
        <span style={{
          fontSize: 9,
          fontFamily: FONT_MONO,
          color: open ? TEAL : TEXT_MID,
          fontWeight: open ? 600 : 400,
          textAlign: 'center',
          transition: 'color 150ms ease-in-out',
        }}>
          {labelText}
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
                className="grid gap-1"
                style={{ gridTemplateColumns: 'repeat(3, 60px)' }}
              >
                {WRAP_OPTIONS.map((opt) => {
                  const isActive = opt.value === displayValue;
                  return (
                    <WrapCell
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
