import type { ModeToggleProps } from './types';

const base = 'w-[30px] h-7 rounded-[4px] border-none flex items-center justify-center cursor-pointer transition-all duration-[120ms] ease-out';
const activeStyle = 'bg-bit-teal-dark text-bit-teal shadow-[0_1px_3px_rgba(0,0,0,0.3)]';
const inactiveStyle = 'bg-transparent text-bit-muted hover:text-bit-text-mid';

export function ModeToggle({ mode, onModeChange, isPicking = false, isEngaged = false, isEditMode = false }: ModeToggleProps) {
  // "Edit" is active when mode is select, insert, or null (not bug-report/theme)
  const editActive = isEditMode;

  const handleEditClick = () => {
    if (editActive) {
      // Already in edit context — clicking again is a no-op
      return;
    }
    // Switch from bug-report/theme to edit (select by default)
    onModeChange('select');
  };

  return (
    <div className="inline-flex items-center rounded-md bg-bit-surface-hi p-0.5 gap-px">
      <button
        type="button"
        onClick={handleEditClick}
        className={`${base} ${editActive ? activeStyle : inactiveStyle}`}
        aria-pressed={editActive}
        title="Edit"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onModeChange('bug-report')}
        className={`${base} ${mode === 'bug-report' ? activeStyle : inactiveStyle}`}
        aria-pressed={mode === 'bug-report'}
        title="Report a bug"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3 3 0 0 1 6 0v1"/>
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0 1 12 0v3c0 3.3-2.7 6-6 6z"/>
          <path d="M6 11H2M22 11h-4M6 15H2M22 15h-4"/>
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onModeChange('theme')}
        className={`${base} ${mode === 'theme' ? activeStyle : inactiveStyle}`}
        aria-pressed={mode === 'theme'}
        title="Theme"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M3 11A9 8.5 0 1 0 21 11A9 8.5 0 1 0 3 11ZM6.5 16A2 2 0 1 0 10.5 16A2 2 0 1 0 6.5 16ZM6.4 7.5A1.6 1.6 0 1 0 9.6 7.5A1.6 1.6 0 1 0 6.4 7.5ZM10.4 4.5A1.6 1.6 0 1 0 13.6 4.5A1.6 1.6 0 1 0 10.4 4.5ZM14.4 7.5A1.6 1.6 0 1 0 17.6 7.5A1.6 1.6 0 1 0 14.4 7.5ZM15.9 11.5A1.6 1.6 0 1 0 19.1 11.5A1.6 1.6 0 1 0 15.9 11.5ZM14.4 15.5A1.6 1.6 0 1 0 17.6 15.5A1.6 1.6 0 1 0 14.4 15.5Z"
          />
        </svg>
      </button>
    </div>
  );
}
