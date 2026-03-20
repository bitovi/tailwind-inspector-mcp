import { useState, useRef, useEffect } from 'react';
import { useFloating, offset, flip, shift, autoUpdate, FloatingPortal } from '@floating-ui/react';
import type { MiniScrubberProps } from './types';
import { FocusTrapContainer } from '../../../../components/FocusTrapContainer';

const SCRUB_THRESHOLD = 4;
const PX_PER_STEP = 10;

export function MiniScrubber({
  placeholder,
  values,
  currentValue,
  displayValue,
  formatValue,
  axis = 'x',
  disabled,
  onHover,
  onLeave,
  onClick,
  onScrubStart,
  onScrubEnd,
  onOpen,
  onClose,
  onRemove,
  onRemoveHover,
}: MiniScrubberProps) {
  const [open, setOpen] = useState(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startIndex: number;
    didScrub: boolean;
  } | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  const { refs, floatingStyles } = useFloating({
    open,
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [offset(4), flip(), shift({ padding: 4 })],
    whileElementsMounted: autoUpdate,
  });

  const hasVal = currentValue != null;
  const currentIndex = currentValue ? values.indexOf(currentValue) : -1;

  // Text shown on the chip
  const scrubValue = scrubIndex !== null ? values[scrubIndex] : null;
  const chipText = scrubValue
    ? (formatValue ? formatValue(scrubValue) : scrubValue)
    : (displayValue ?? placeholder);

  // Scroll active item into view when dropdown opens
  useEffect(() => {
    if (open && activeItemRef.current) {
      activeItemRef.current.scrollIntoView?.({ block: 'nearest' });
    }
  }, [open]);

  function handlePointerDown(e: React.PointerEvent) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const idx = currentIndex >= 0 ? currentIndex : 0;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startIndex: idx,
      didScrub: false,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    const delta = axis === 'y'
      ? -(e.clientY - drag.startY)   // up = increase
      : (e.clientX - drag.startX);   // right = increase

    if (!drag.didScrub && Math.abs(delta) > SCRUB_THRESHOLD) {
      drag.didScrub = true;
      setOpen(false);
      onScrubStart?.();
    }

    if (drag.didScrub) {
      const steps = Math.round(delta / PX_PER_STEP);
      const idx = Math.max(0, Math.min(values.length - 1, drag.startIndex + steps));
      setScrubIndex(idx);
      onHover?.(values[idx]);
    }
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.didScrub && scrubIndex !== null) {
      onClick?.(values[scrubIndex]);
      setScrubIndex(null);
      dragRef.current = null;
      onScrubEnd?.();
    } else if (!drag.didScrub) {
      setScrubIndex(null);
      dragRef.current = null;
      setOpen(prev => {
        if (prev) {
          onClose?.();
          onLeave?.();
          return false;
        }
        onOpen?.();
        return true;
      });
    }
  }

  const isScrubbing = scrubIndex !== null;
  const isActive = hasVal || isScrubbing;
  const className = [
    'bm-slot',
    isActive ? 'bm-has-val' : '',
    isScrubbing ? 'bm-scrubbing' : '',
  ].filter(Boolean).join(' ');

  const cursor = disabled ? 'default' : axis === 'y' ? 'ns-resize' : 'ew-resize';

  return (
    <span
      ref={(node) => {
        (containerRef as React.MutableRefObject<HTMLSpanElement | null>).current = node;
        refs.setReference(node);
      }}
      className={className}
      style={{ position: 'relative', cursor }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      {chipText}

      {open && (
        <FloatingPortal>
          <FocusTrapContainer
            ref={refs.setFloating}
            style={floatingStyles}
            className="bm-mini-dropdown"
            onClick={e => e.stopPropagation()}
            onMouseLeave={() => onLeave?.()}
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
            onClose={() => { setOpen(false); onClose?.(); onLeave?.(); }}
          >
            {onRemove && (
              <div
                className="bm-mini-dropdown-item bm-mini-dropdown-remove"
                tabIndex={-1}
                onMouseEnter={onRemoveHover}
                onMouseDown={e => { e.preventDefault(); onRemove(); setOpen(false); onClose?.(); }}
              >
                <svg viewBox="0 0 10 10" width="8" height="8" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', flexShrink: 0 }}>
                  <line x1="1" y1="1" x2="9" y2="9" stroke="#F5532D" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="9" y1="1" x2="1" y2="9" stroke="#F5532D" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                remove
              </div>
            )}
            {values.map(val => {
              const isActiveItem = val === currentValue;
              return (
                <div
                  key={val}
                  ref={isActiveItem ? activeItemRef : undefined}
                  tabIndex={-1}
                  className={`bm-mini-dropdown-item${isActiveItem ? ' bm-active' : ''}`}
                  onMouseEnter={() => onHover?.(val)}
                  onMouseDown={e => {
                    e.preventDefault();
                    onClick?.(val);
                    setOpen(false);
                    onClose?.();
                  }}
                  onClick={e => {
                    if (e.detail === 0) {
                      e.stopPropagation();
                      onClick?.(val);
                      setOpen(false);
                      onClose?.();
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onClick?.(val);
                      setOpen(false);
                      onClose?.();
                    }
                  }}
                >
                  {val}
                </div>
              );
            })}
          </FocusTrapContainer>
        </FloatingPortal>
      )}
    </span>
  );
}
