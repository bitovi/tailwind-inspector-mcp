interface SectionHeaderProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
}

export function SectionHeader({ title, expanded, onToggle, badge }: SectionHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/3 transition-colors"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="currentColor"
        className={`text-bv-text-mid shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
      >
        <path d="M3 1l4 4-4 4" />
      </svg>
      <span className="text-[11px] font-semibold text-bv-text uppercase tracking-wider">
        {title}
      </span>
      {badge && (
        <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded bg-bv-teal/15 text-bv-teal">
          {badge}
        </span>
      )}
    </button>
  );
}
