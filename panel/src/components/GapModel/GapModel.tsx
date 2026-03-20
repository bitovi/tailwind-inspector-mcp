import { useState } from 'react';
import './GapModel.css';
import '../BoxModel/BoxModel.css';
import type { GapModelProps, GapSlotKey } from './types';
import { MiniScrubber } from '../BoxModel/components/MiniScrubber';

/** "gap-x-4" → "x-4" */
function fmtX(v: string): string {
  return v.replace(/^gap-x-/, 'x-');
}

/** "gap-y-4" → "y-4" */
function fmtY(v: string): string {
  return v.replace(/^gap-y-/, 'y-');
}

export function GapModel({
  slots,
  onSlotChange,
  onSlotHover,
  onSlotRemove,
  onSlotRemoveHover,
}: GapModelProps) {
  const [openSlot, setOpenSlot] = useState<GapSlotKey | null>(null);
  const [activeSlot, setActiveSlot] = useState<GapSlotKey | null>(null);

  const gapSlot  = slots.find(s => s.key === 'gap');
  const gapXSlot = slots.find(s => s.key === 'gap-x');
  const gapYSlot = slots.find(s => s.key === 'gap-y');

  function handleHover(slot: GapSlotKey, value: string | null) {
    setActiveSlot(value != null ? slot : null);
    onSlotHover?.(slot, value);
  }

  function handleCellEnter(slot: GapSlotKey) {
    setActiveSlot(slot);
  }

  function handleCellLeave() {
    setActiveSlot(null);
  }

  const highlightClass =
    activeSlot === 'gap-x' ? 'gm-active-x' :
    activeSlot === 'gap-y' ? 'gm-active-y' :
    activeSlot === 'gap'   ? 'gm-active-gap' : '';

  return (
    <div className="gm-root">
      <div className={`gm-grid${highlightClass ? ` ${highlightClass}` : ''}`}>

        {/* Gap highlight overlays (sit behind boxes and scrubbers) */}
        <div className="gm-col-highlight" style={{ gridArea: '1 / 2 / 4 / 3' }} />
        <div className="gm-row-highlight" style={{ gridArea: '2 / 1 / 3 / 4' }} />

        {/* Row 1: BOX | gap-x scrubber | BOX */}
        <div className="gm-box gm-box-tl" style={{ gridArea: '1 / 1' }} />

        <div className="gm-cell" style={{ gridArea: '1 / 2' }} onMouseEnter={() => handleCellEnter('gap-x')} onMouseLeave={handleCellLeave}>
          {gapXSlot?.scaleValues && (
            <MiniScrubber
              placeholder="x"
              values={gapXSlot.scaleValues}
              currentValue={gapXSlot.value}
              displayValue={gapXSlot.value ? fmtX(gapXSlot.value) : null}
              formatValue={fmtX}
              axis="x"
              disabled={openSlot !== null && openSlot !== 'gap-x'}
              onHover={(v) => handleHover('gap-x', v)}
              onLeave={() => handleHover('gap-x', null)}
              onClick={(v) => onSlotChange?.('gap-x', v)}
              onOpen={() => setOpenSlot('gap-x')}
              onClose={() => setOpenSlot(null)}
              onScrubStart={() => setOpenSlot('gap-x')}
              onScrubEnd={() => setOpenSlot(null)}
              onRemove={gapXSlot.value ? () => onSlotRemove?.('gap-x') : undefined}
              onRemoveHover={gapXSlot.value ? () => { setActiveSlot(null); onSlotRemoveHover?.('gap-x'); } : undefined}
            />
          )}
        </div>

        <div className="gm-box gm-box-tr" style={{ gridArea: '1 / 3' }} />

        {/* Row 2: gap-y scrubber | gap shorthand scrubber */}
        <div className="gm-cell" style={{ gridArea: '2 / 1' }} onMouseEnter={() => handleCellEnter('gap-y')} onMouseLeave={handleCellLeave}>
          {gapYSlot?.scaleValues && (
            <MiniScrubber
              placeholder="y"
              values={gapYSlot.scaleValues}
              currentValue={gapYSlot.value}
              displayValue={gapYSlot.value ? fmtY(gapYSlot.value) : null}
              formatValue={fmtY}
              axis="y"
              disabled={openSlot !== null && openSlot !== 'gap-y'}
              onHover={(v) => handleHover('gap-y', v)}
              onLeave={() => handleHover('gap-y', null)}
              onClick={(v) => onSlotChange?.('gap-y', v)}
              onOpen={() => setOpenSlot('gap-y')}
              onClose={() => setOpenSlot(null)}
              onScrubStart={() => setOpenSlot('gap-y')}
              onScrubEnd={() => setOpenSlot(null)}
              onRemove={gapYSlot.value ? () => onSlotRemove?.('gap-y') : undefined}
              onRemoveHover={gapYSlot.value ? () => { setActiveSlot(null); onSlotRemoveHover?.('gap-y'); } : undefined}
            />
          )}
        </div>

        <div className="gm-cell" style={{ gridArea: '2 / 2' }} onMouseEnter={() => handleCellEnter('gap')} onMouseLeave={handleCellLeave}>
          {gapSlot?.scaleValues && (
            <MiniScrubber
              placeholder="gap"
              values={gapSlot.scaleValues}
              currentValue={gapSlot.value}
              displayValue={gapSlot.value ?? null}
              axis="x"
              disabled={openSlot !== null && openSlot !== 'gap'}
              onHover={(v) => handleHover('gap', v)}
              onLeave={() => handleHover('gap', null)}
              onClick={(v) => onSlotChange?.('gap', v)}
              onOpen={() => setOpenSlot('gap')}
              onClose={() => setOpenSlot(null)}
              onScrubStart={() => setOpenSlot('gap')}
              onScrubEnd={() => setOpenSlot(null)}
              onRemove={gapSlot.value ? () => onSlotRemove?.('gap') : undefined}
              onRemoveHover={gapSlot.value ? () => { setActiveSlot(null); onSlotRemoveHover?.('gap'); } : undefined}
            />
          )}
        </div>

        {/* Row 3: BOX */}
        <div className="gm-box gm-box-bl" style={{ gridArea: '3 / 1' }} />
      </div>
    </div>
  );
}
