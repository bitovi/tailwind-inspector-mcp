import type { ThemeOverride } from './types';

interface SpacingSectionProps {
  spacingBase: string | undefined; // value of --spacing
  edits: Map<string, ThemeOverride>;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}

const PREVIEW_STEPS = [1, 2, 4, 8, 16] as const;

export function SpacingSection({ spacingBase, edits, onEdit }: SpacingSectionProps) {
  if (!spacingBase) return null;

  const editedValue = edits.get('spacing-base')?.value;
  const displayValue = editedValue ?? spacingBase;
  const isEdited = editedValue !== undefined;

  // Parse rem value for pixel preview labels
  const remVal = parseFloat(displayValue);
  const pxPer = !isNaN(remVal) ? remVal * 16 : null;

  return (
    <div>
      <div className={`flex items-center gap-2 px-3 py-1 ${isEdited ? 'bg-bv-orange/5' : ''}`}>
        {isEdited && (
          <div className="w-1.5 h-1.5 rounded-full bg-bv-orange shrink-0" />
        )}
        <span className="text-[10px] text-bv-text-mid w-20 shrink-0 font-mono">
          --spacing
        </span>
        <input
          type="text"
          value={displayValue}
          onChange={(e) => onEdit('spacing-base', { variable: '--spacing', value: e.target.value })}
          className="w-28 bg-transparent text-[10px] text-bv-text font-mono border border-bv-border rounded px-1.5 py-0.5 focus:border-bv-teal focus:outline-none"
          spellCheck={false}
        />
        {pxPer !== null && (
          <span className="text-[9px] text-bv-muted">
            1 unit = {pxPer}px
          </span>
        )}
      </div>
      {/* Scale preview bars */}
      {pxPer !== null && (
        <div className="flex items-end gap-3 px-3 py-2">
          {PREVIEW_STEPS.map(n => (
            <div key={n} className="flex flex-col items-center gap-1">
              <div
                className="bg-bv-teal/30 rounded-sm"
                style={{ width: Math.min(pxPer * n, 80), height: 8 }}
                title={`${n} × ${displayValue} = ${pxPer * n}px`}
              />
              <span className="text-[8px] text-bv-muted">{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
