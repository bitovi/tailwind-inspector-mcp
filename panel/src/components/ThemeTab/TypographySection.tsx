import type { ThemeOverride } from './types';

interface TypographySectionProps {
  fontSize: Record<string, unknown>;
  fontWeight: Record<string, unknown>;
  edits: Map<string, ThemeOverride>;
  tailwindVersion: 3 | 4;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}

const FONT_SIZE_ORDER = [
  'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
] as const;

const FONT_WEIGHT_ORDER = [
  'thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black',
] as const;

function TokenRow({ label, tokenKey, value, editedValue, onEdit, variable }: {
  label: string;
  tokenKey: string;
  value: string;
  editedValue: string | undefined;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
  variable: string;
}) {
  const displayValue = editedValue ?? value;
  const isEdited = editedValue !== undefined;

  return (
    <div className={`flex items-center gap-2 px-3 py-1 ${isEdited ? 'bg-bv-orange/5' : ''}`}>
      {isEdited && (
        <div className="w-1.5 h-1.5 rounded-full bg-bv-orange shrink-0" />
      )}
      <span className="text-[10px] text-bv-text-mid w-24 shrink-0 font-mono">
        {label}
      </span>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => {
          onEdit(tokenKey, { variable, value: e.target.value });
        }}
        className="flex-1 min-w-0 bg-transparent text-[10px] text-bv-text font-mono border border-bv-border rounded px-1.5 py-0.5 focus:border-bv-teal focus:outline-none"
        spellCheck={false}
      />
    </div>
  );
}

export function TypographySection({ fontSize, fontWeight, edits, tailwindVersion, onEdit }: TypographySectionProps) {
  const sizeKeys = FONT_SIZE_ORDER.filter(k => k in fontSize);
  const weightKeys = FONT_WEIGHT_ORDER.filter(k => k in fontWeight);

  function getVariable(category: 'fontSize' | 'fontWeight', key: string): string {
    if (tailwindVersion === 4) {
      return category === 'fontSize' ? `--text-${key}` : `--font-weight-${key}`;
    }
    return category === 'fontSize' ? `fontSize.${key}` : `fontWeight.${key}`;
  }

  function resolveValue(raw: unknown): string {
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) return String(raw[0]);
    return String(raw);
  }

  return (
    <div>
      {sizeKeys.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-white/2">
            <span className="text-[10px] font-semibold text-bv-text">Font Size</span>
          </div>
          {sizeKeys.map(key => {
            const tokenKey = `fontSize-${key}`;
            return (
              <TokenRow
                key={key}
                label={`text-${key}`}
                tokenKey={tokenKey}
                value={resolveValue(fontSize[key])}
                editedValue={edits.get(tokenKey)?.value}
                onEdit={onEdit}
                variable={getVariable('fontSize', key)}
              />
            );
          })}
        </div>
      )}
      {weightKeys.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-white/2">
            <span className="text-[10px] font-semibold text-bv-text">Font Weight</span>
          </div>
          {weightKeys.map(key => {
            const tokenKey = `fontWeight-${key}`;
            return (
              <TokenRow
                key={key}
                label={`font-${key}`}
                tokenKey={tokenKey}
                value={resolveValue(fontWeight[key])}
                editedValue={edits.get(tokenKey)?.value}
                onEdit={onEdit}
                variable={getVariable('fontWeight', key)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
