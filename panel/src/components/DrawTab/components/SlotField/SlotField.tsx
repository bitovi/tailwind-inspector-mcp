import type { SlotFieldProps } from './types';
import type { SlotArgValue } from '../../types';

function getTextValue(value: SlotArgValue | undefined): string {
  if (!value) return '';
  // Backward-compat: existing Storybook defaultArgs may be plain strings
  if (typeof value === 'string') return value as string;
  if (value.type === 'text') return value.value;
  return '';
}

export function SlotField({ name, value, onChange, isReceptive, onArmSelf }: SlotFieldProps) {
  const isFilled = value?.type === 'component';

  function handleTextChange(raw: string) {
    onChange({ type: 'text', value: raw });
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ type: 'text', value: '' });
  }

  function handleArmClick(e: React.MouseEvent) {
    e.stopPropagation();
    onArmSelf?.();
  }

  if (isFilled && value?.type === 'component') {
    return (
      <div className="flex-1 flex items-center gap-1.5 bg-bit-surface-hi border border-bit-border rounded px-1.5 py-0.5 min-h-[24px]">
        {/* Mini ghost thumbnail */}
        {value.ghostHtml && (
          <div
            className="w-6 h-[18px] bg-white rounded shrink-0 overflow-hidden flex items-center justify-center pointer-events-none"
            dangerouslySetInnerHTML={{ __html: value.ghostHtml }}
          />
        )}
        <span className="text-[10px] font-medium text-bit-text shrink-0">{value.componentName}</span>
        <span className="text-[9px] text-bit-muted font-mono flex-1 truncate">
          {value.args && Object.keys(value.args).length > 0
            ? Object.entries(value.args)
                .slice(0, 2)
                .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                .join(' ')
            : ''}
        </span>
        <button
          type="button"
          title="Clear"
          className="w-4 h-4 rounded flex items-center justify-center text-[10px] text-bit-muted hover:bg-bit-orange/15 hover:text-bit-orange transition-colors shrink-0"
          onClick={handleClear}
        >
          ✕
        </button>
      </div>
    );
  }

  // Text input with arm button
  return (
    <div className="flex-1 flex items-center gap-1">
      <input
        type="text"
        className={`flex-1 bg-bit-surface border rounded px-1.5 py-0.5 text-[10px] text-bit-text outline-none transition-all ${
          isReceptive
            ? 'border-bit-teal bg-bit-teal/10'
            : 'border-bit-border focus:border-bit-teal'
        }`}
        value={getTextValue(value)}
        placeholder={isReceptive ? 'Pick a component →' : '(empty)'}
        readOnly={isReceptive}
        onChange={isReceptive ? undefined : (e) => handleTextChange(e.target.value)}
      />
      <button
        type="button"
        title={isReceptive ? 'Cancel' : `Set ${name} to a component`}
        className={`w-5 h-5 rounded flex items-center justify-center text-[11px] transition-all shrink-0 ${
          isReceptive
            ? 'bg-bit-teal/20 text-bit-teal border border-bit-teal'
            : 'bg-bit-surface border border-bit-border text-bit-muted hover:border-bit-teal hover:text-bit-teal'
        }`}
        onClick={handleArmClick}
      >
        ⊞
      </button>
    </div>
  );
}
