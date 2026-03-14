import { useState, useRef, useEffect } from 'react';
import type { ScaleScrubberProps } from './types';

/** Pixels of horizontal drag required before scrub mode activates */
const SCRUB_THRESHOLD = 4;
/** Pixels per one step when scrubbing */
const PX_PER_STEP = 10;

export function ScaleScrubber({
  values,
  currentValue,
  lockedValue,
  locked,
  onStart,
  onHover,
  onLeave,
  onClick,
}: ScaleScrubberProps) {
  const [open, setOpen] = useState(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const dragRef = useRef<{ startX: number; startIndex: number; didScrub: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Only treat lockedValue as "ours" if it actually appears in this scrubber's values
  const isThisLocked = lockedValue !== null && values.includes(lockedValue);

  const displayValue =
    scrubIndex !== null ? values[scrubIndex] : isThisLocked ? lockedValue! : currentValue;

  // Close on outside pointer-down
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        onLeave();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onLeave]);

  // Scroll active item into view when dropdown opens
  useEffect(() => {
    if (open && activeItemRef.current) {
      activeItemRef.current.scrollIntoView?.({ block: 'nearest' });
    }
  }, [open]);

  // A foreign lock (another property staged) fully disables this scrubber.
  // Our own lock (isThisLocked) keeps it interactive so the value can be revised.
  const foreignLocked = locked && !isThisLocked;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (foreignLocked) return;
    onStart?.();
    const activeValue = isThisLocked ? lockedValue! : currentValue;
    const currentIndex = values.indexOf(activeValue);
    dragRef.current = {
      startX: e.clientX,
      startIndex: currentIndex >= 0 ? currentIndex : 0,
      didScrub: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    if (!drag.didScrub && Math.abs(dx) > SCRUB_THRESHOLD) {
      drag.didScrub = true;
      setOpen(false);
    }
    if (drag.didScrub) {
      const steps = Math.round(dx / PX_PER_STEP);
      const idx = Math.max(0, Math.min(values.length - 1, drag.startIndex + steps));
      setScrubIndex(idx);
      onHover(values[idx]);
    }
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.didScrub && scrubIndex !== null) {
      onClick(values[scrubIndex]);
    } else if (!drag.didScrub) {
      setOpen((prev) => {
        if (prev) onLeave();
        return !prev;
      });
    }
    setScrubIndex(null);
    dragRef.current = null;
  }

  const isScrubbing = scrubIndex !== null;

  const chipStyle = isScrubbing
    ? 'border-bv-teal bg-bv-teal/9 text-bv-teal'
    : isThisLocked
    ? 'border-bv-orange bg-bv-orange/9 text-bv-orange hover:border-bv-orange-hover'
    : open
    ? 'border-bv-border bg-bv-surface-hi text-bv-text'
    : foreignLocked
    ? 'bg-bv-surface text-bv-text-mid border-transparent'
    : 'bg-bv-surface text-bv-text-mid border-transparent hover:border-bv-teal hover:bg-bv-teal/9 hover:text-bv-teal';

  return (
    <div ref={containerRef} className="relative inline-block">
      <div
        className={`group select-none px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${foreignLocked ? 'cursor-default' : 'cursor-ew-resize'} ${chipStyle}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {!foreignLocked && (
          <span className={`inline-block mr-0.5 text-[9px] transition-opacity ${isScrubbing ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>‹</span>
        )}
        {displayValue}
        {!foreignLocked && (
          <span className={`inline-block ml-0.5 text-[9px] transition-opacity ${isScrubbing ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>›</span>
        )}
      </div>

      {open && (
        <div
          className="absolute z-50 top-full left-0 mt-0.5 max-h-52 overflow-y-auto bg-bv-bg border border-bv-border rounded-md shadow-md min-w-[5rem]"
          onMouseLeave={onLeave}
        >
          {values.map((val) => {
            const isActive = val === (lockedValue ?? currentValue);
            const itemStyle = isActive
              ? 'bg-bv-teal/9 text-bv-teal'
              : 'text-bv-text-mid hover:bg-bv-surface hover:text-bv-text';
            return (
              <div
                key={val}
                ref={isActive ? activeItemRef : undefined}
                className={`px-2 py-[3px] text-[11px] font-mono cursor-pointer ${itemStyle}`}
                onMouseEnter={() => onHover(val)}
                onClick={(e) => { e.stopPropagation(); onClick(val); setOpen(false); }}
              >
                {val}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
