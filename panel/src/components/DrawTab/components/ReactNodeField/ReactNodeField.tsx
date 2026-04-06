import type { ReactNodeFieldProps } from './types';
import type { ReactNodeArgValue } from '../../types';

function getTextValue(value: ReactNodeArgValue | undefined): string {
  if (!value) return '';
  // Backward-compat: existing Storybook defaultArgs may be plain strings
  if (typeof value === 'string') return value as string;
  if (value.type === 'text') return value.value;
  return '';
}

export function ReactNodeField({ name, value, onChange, armedComponentData, onDisarm }: ReactNodeFieldProps) {
  const isArmed = !!armedComponentData;
  const isFilled = value?.type === 'component';

  function handleTextChange(raw: string) {
    onChange({ type: 'text', value: raw });
  }

  function handleAssign(e: React.MouseEvent) {
    if (!armedComponentData) return;
    // Stop propagation so the global disarm handler on document doesn't fire.
    // (The props editor wrapper already stops propagation, but belt-and-suspenders.)
    e.stopPropagation();
    onChange({
      type: 'component',
      componentName: armedComponentData.componentName,
      storyId: armedComponentData.storyId,
      componentPath: armedComponentData.componentPath,
      args: armedComponentData.args,
      ghostHtml: armedComponentData.ghostHtml,
      ghostCss: armedComponentData.ghostCss,
    });
    onDisarm?.();
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ type: 'text', value: '' });
  }

  if (isFilled && value?.type === 'component') {
    return (
      <div className="flex-1 flex items-center gap-1.5 bg-bv-surface-hi border border-bv-border rounded px-1.5 py-0.5 min-h-[24px]">
        {/* Mini ghost thumbnail */}
        {value.ghostHtml && (
          <div
            className="w-6 h-[18px] bg-bv-surface rounded shrink-0 overflow-hidden flex items-center justify-center pointer-events-none"
            dangerouslySetInnerHTML={{ __html: value.ghostHtml }}
          />
        )}
        <span className="text-[10px] font-medium text-bv-text shrink-0">{value.componentName}</span>
        <span className="text-[9px] text-bv-muted font-mono flex-1 truncate">
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
          className="w-4 h-4 rounded flex items-center justify-center text-[10px] text-bv-muted hover:bg-bv-orange/15 hover:text-bv-orange transition-colors shrink-0"
          onClick={handleClear}
        >
          ✕
        </button>
      </div>
    );
  }

  // Text input — receptive when armed
  return (
    <input
      type="text"
      className={`flex-1 bg-bv-surface border rounded px-1.5 py-0.5 text-[10px] text-bv-text outline-none transition-all ${
        isArmed
          ? 'border-bv-teal bg-bv-teal/10 animate-[receptive-pulse_2s_ease-in-out_infinite] cursor-pointer'
          : 'border-bv-border focus:border-bv-teal'
      }`}
      value={getTextValue(value)}
      placeholder={isArmed ? `Click to set ${armedComponentData!.componentName}` : '(empty)'}
      readOnly={isArmed}
      onChange={isArmed ? undefined : (e) => handleTextChange(e.target.value)}
      onClick={isArmed ? handleAssign : undefined}
    />
  );
}
