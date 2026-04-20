import type { ThemeOverride } from './types';

interface BorderRadiusSectionProps {
  vars: Record<string, string>; // keyed by suffix: "sm", "md", "lg", etc. or "" for --radius
  edits: Map<string, ThemeOverride>;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}

const RADIUS_ORDER = ['none', 'xs', 'sm', '', 'md', 'lg', 'xl', '2xl', '3xl', 'full'] as const;

function RadiusRow({ suffix, value, editedValue, onEdit }: {
  suffix: string;
  value: string;
  editedValue: string | undefined;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}) {
  const displayValue = editedValue ?? value;
  const isEdited = editedValue !== undefined;
  const tokenKey = `radius-${suffix}`;
  const variable = suffix ? `--radius-${suffix}` : '--radius';
  const label = suffix ? `rounded-${suffix}` : 'rounded';

  return (
    <div className={`flex items-center gap-2 px-3 py-1 ${isEdited ? 'bg-bv-orange/5' : ''}`}>
      {isEdited && (
        <div className="w-1.5 h-1.5 rounded-full bg-bv-orange shrink-0" />
      )}
      {/* Visual preview square */}
      <div
        className="w-5 h-5 shrink-0 border border-bv-border bg-bv-teal/20"
        style={{ borderRadius: displayValue }}
        title={variable}
      />
      <span className="text-[10px] text-bv-text-mid w-24 shrink-0 font-mono">
        {label}
      </span>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => onEdit(tokenKey, { variable, value: e.target.value })}
        className="flex-1 min-w-0 bg-transparent text-[10px] text-bv-text font-mono border border-bv-border rounded px-1.5 py-0.5 focus:border-bv-teal focus:outline-none"
        spellCheck={false}
        title={variable}
      />
    </div>
  );
}

export function BorderRadiusSection({ vars, edits, onEdit }: BorderRadiusSectionProps) {
  // Sort by RADIUS_ORDER, append any unknown suffixes at the end
  const known = RADIUS_ORDER.filter(s => s in vars);
  const unknown = Object.keys(vars).filter(s => !(RADIUS_ORDER as readonly string[]).includes(s)).sort();
  const allKeys = [...known, ...unknown];

  if (allKeys.length === 0) return null;

  return (
    <div>
      {allKeys.map(suffix => (
        <RadiusRow
          key={suffix || '__default'}
          suffix={suffix}
          value={vars[suffix]}
          editedValue={edits.get(`radius-${suffix}`)?.value}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
