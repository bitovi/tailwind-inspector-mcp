import { useState } from 'react';
import type { ThemeOverride } from './types';

interface OtherVarsSectionProps {
  otherVars: Record<string, string>;
  edits: Map<string, ThemeOverride>;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}

function VarRow({ variable, value, editedValue, onEdit }: {
  variable: string;
  value: string;
  editedValue: string | undefined;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}) {
  const displayValue = editedValue ?? value;
  const isEdited = editedValue !== undefined;
  const tokenKey = `other-${variable}`;

  return (
    <div className={`flex items-center gap-2 px-3 py-1 ${isEdited ? 'bg-bv-orange/5' : ''}`}>
      {isEdited && (
        <div className="w-1.5 h-1.5 rounded-full bg-bv-orange shrink-0" />
      )}
      <span className="text-[10px] text-bv-text-mid shrink-0 font-mono truncate max-w-[140px]" title={variable}>
        {variable}
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

export function OtherVarsSection({ otherVars, edits, onEdit }: OtherVarsSectionProps) {
  const vars = Object.entries(otherVars).sort(([a], [b]) => a.localeCompare(b));
  const [showAll, setShowAll] = useState(false);

  if (vars.length === 0) return null;

  const INITIAL_LIMIT = 20;
  const displayVars = showAll ? vars : vars.slice(0, INITIAL_LIMIT);
  const hasMore = vars.length > INITIAL_LIMIT;

  return (
    <div>
      {displayVars.map(([variable, value]) => (
        <VarRow
          key={variable}
          variable={variable}
          value={value}
          editedValue={edits.get(`other-${variable}`)?.value}
          onEdit={onEdit}
        />
      ))}
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full px-3 py-1.5 text-[10px] text-bv-teal hover:text-bv-teal/80 transition-colors text-left"
        >
          Show {vars.length - INITIAL_LIMIT} more...
        </button>
      )}
    </div>
  );
}
