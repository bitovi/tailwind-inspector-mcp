import type { ThemeOverride } from './types';

interface FontFamiliesSectionProps {
  vars: Record<string, string>; // keyed by suffix: "sans", "mono", "serif", etc.
  edits: Map<string, ThemeOverride>;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}

const FAMILY_ORDER = ['sans', 'serif', 'mono', 'display', 'body'] as const;

function FamilyRow({ name, value, editedValue, onEdit }: {
  name: string;
  value: string;
  editedValue: string | undefined;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}) {
  const displayValue = editedValue ?? value;
  const isEdited = editedValue !== undefined;
  const tokenKey = `font-family-${name}`;
  const variable = `--font-${name}`;

  return (
    <div className={`flex items-start gap-2 px-3 py-1.5 ${isEdited ? 'bg-bv-orange/5' : ''}`}>
      {isEdited && (
        <div className="w-1.5 h-1.5 rounded-full bg-bv-orange shrink-0 mt-1.5" />
      )}
      <span
        className="text-[11px] text-bv-text-mid w-20 shrink-0 font-mono pt-0.5"
        title={variable}
      >
        font-{name}
      </span>
      <textarea
        value={displayValue}
        onChange={(e) => onEdit(tokenKey, { variable, value: e.target.value })}
        rows={2}
        className="flex-1 min-w-0 bg-transparent text-[10px] text-bv-text font-mono border border-bv-border rounded px-1.5 py-0.5 focus:border-bv-teal focus:outline-none resize-none"
        spellCheck={false}
        title={variable}
      />
    </div>
  );
}

export function FontFamiliesSection({ vars, edits, onEdit }: FontFamiliesSectionProps) {
  const known = FAMILY_ORDER.filter(s => s in vars);
  const unknown = Object.keys(vars).filter(s => !(FAMILY_ORDER as readonly string[]).includes(s)).sort();
  const allKeys = [...known, ...unknown];

  if (allKeys.length === 0) return null;

  return (
    <div>
      {allKeys.map(name => (
        <FamilyRow
          key={name}
          name={name}
          value={vars[name]}
          editedValue={edits.get(`font-family-${name}`)?.value}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
