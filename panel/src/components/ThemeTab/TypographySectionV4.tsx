import type { ThemeOverride } from './types';

interface TypographySectionV4Props {
  fontSize: Record<string, unknown>;
  fontSizeLineHeight: Record<string, string>;
  fontWeight: Record<string, unknown>;
  edits: Map<string, ThemeOverride>;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}

const FONT_SIZE_ORDER = [
  'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
] as const;

const FONT_WEIGHT_ORDER = [
  'thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black',
] as const;

function FontSizeRow({ name, sizeValue, lineHeightValue, editedSize, editedLineHeight, onEdit }: {
  name: string;
  sizeValue: string;
  lineHeightValue: string | undefined;
  editedSize: string | undefined;
  editedLineHeight: string | undefined;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}) {
  const displaySize = editedSize ?? sizeValue;
  const displayLH = editedLineHeight ?? lineHeightValue ?? '';
  const isEdited = editedSize !== undefined || editedLineHeight !== undefined;

  return (
    <div className={`flex items-center gap-2 px-3 py-1 ${isEdited ? 'bg-bv-orange/5' : ''}`}>
      {isEdited && (
        <div className="w-1.5 h-1.5 rounded-full bg-bv-orange shrink-0" />
      )}
      <span className="text-[10px] text-bv-text-mid w-20 shrink-0 font-mono">
        text-{name}
      </span>
      <input
        type="text"
        value={displaySize}
        onChange={(e) => {
          onEdit(`fontSize-${name}`, { variable: `--text-${name}`, value: e.target.value });
        }}
        className="flex-1 min-w-0 bg-transparent text-[10px] text-bv-text font-mono border border-bv-border rounded px-1.5 py-0.5 focus:border-bv-teal focus:outline-none"
        spellCheck={false}
        title={`--text-${name}`}
      />
      {(lineHeightValue !== undefined || editedLineHeight !== undefined) && (
        <>
          <span className="text-[9px] text-bv-muted shrink-0">/</span>
          <input
            type="text"
            value={displayLH}
            onChange={(e) => {
              onEdit(`fontSizeLH-${name}`, { variable: `--text-${name}--line-height`, value: e.target.value });
            }}
            className="w-24 bg-transparent text-[10px] text-bv-text font-mono border border-bv-border rounded px-1.5 py-0.5 focus:border-bv-teal focus:outline-none"
            spellCheck={false}
            title={`--text-${name}--line-height`}
            placeholder="line-height"
          />
        </>
      )}
    </div>
  );
}

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
      <span className="text-[10px] text-bv-text-mid w-20 shrink-0 font-mono">
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

export function TypographySectionV4({ fontSize, fontSizeLineHeight, fontWeight, edits, onEdit }: TypographySectionV4Props) {
  const sizeKeys = [
    ...FONT_SIZE_ORDER.filter(k => k in fontSize),
    ...Object.keys(fontSize).filter(k => !(FONT_SIZE_ORDER as readonly string[]).includes(k)),
  ];
  const weightKeys = [
    ...FONT_WEIGHT_ORDER.filter(k => k in fontWeight),
    ...Object.keys(fontWeight).filter(k => !(FONT_WEIGHT_ORDER as readonly string[]).includes(k)),
  ];

  return (
    <div>
      {sizeKeys.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-white/2">
            <span className="text-[10px] font-semibold text-bv-text">Font Size</span>
          </div>
          {sizeKeys.map(key => (
            <FontSizeRow
              key={key}
              name={key}
              sizeValue={String(fontSize[key])}
              lineHeightValue={fontSizeLineHeight[key]}
              editedSize={edits.get(`fontSize-${key}`)?.value}
              editedLineHeight={edits.get(`fontSizeLH-${key}`)?.value}
              onEdit={onEdit}
            />
          ))}
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
                value={String(fontWeight[key])}
                editedValue={edits.get(tokenKey)?.value}
                onEdit={onEdit}
                variable={`--font-weight-${key}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
