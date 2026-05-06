import React from 'react';
import { getScaleValues } from './getScaleValues';

interface ScaleRowProps {
  prefix: string;
  scaleName: string | null;
  currentClass: string;
  tailwindConfig: any;
  locked: boolean;
  lockedValue: string | null;
  onHover: (fullClass: string) => void;
  onLeave: () => void;
  onClick: (fullClass: string) => void;
}

export function ScaleRow({ prefix, scaleName, currentClass, tailwindConfig, locked, lockedValue, onHover, onLeave, onClick }: ScaleRowProps) {
  const scaleValues = getScaleValues(prefix, scaleName, tailwindConfig);
  if (scaleValues.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-[3px] my-2 p-2 bg-bit-surface border border-bit-border rounded-md"
      onMouseLeave={() => { if (!locked) onLeave(); }}
    >
      {scaleValues.map((val) => (
        <ScaleChip
          key={val}
          value={val}
          isCurrent={val === currentClass}
          isLocked={lockedValue === val}
          locked={locked}
          onMouseEnter={() => { if (!locked) onHover(val); }}
          onClick={() => onClick(val)}
        />
      ))}
    </div>
  );
}

interface ScaleChipProps {
  value: string;
  isCurrent: boolean;
  isLocked: boolean;
  locked: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}

function ScaleChip({ value, isCurrent, isLocked, locked, onMouseEnter, onClick }: ScaleChipProps) {
  const base = 'px-1.5 py-0.5 rounded bg-bit-surface-hi text-bit-text-mid cursor-pointer text-[10.5px] font-mono border border-transparent transition-colors';
  const hover = locked ? '' : 'hover:border-bit-teal hover:bg-bit-teal/9 hover:text-bit-teal';
  const current = isCurrent ? 'border-bit-teal bg-bit-teal/9 text-bit-teal' : '';
  const preview = isLocked ? 'border-bit-orange bg-bit-orange/9 text-bit-orange' : '';

  return (
    <div
      className={`${base} ${hover} ${current} ${preview}`}
      onMouseEnter={onMouseEnter}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {value}
    </div>
  );
}

