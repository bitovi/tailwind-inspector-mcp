interface CanvasFooterProps {
  onSubmit: () => void;
  onClose?: () => void;
}

export function CanvasFooter({ onSubmit, onClose }: CanvasFooterProps) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 bg-bit-bg border-t border-bit-border text-[10px] shrink-0">
      <div className="flex gap-1.5">
        {onClose && (
          <button
            onClick={onClose}
            className="px-2.5 py-0.5 rounded border border-bit-border bg-bit-bg text-bit-muted text-[10px] font-medium cursor-pointer hover:bg-bit-orange/10 hover:border-bit-orange hover:text-bit-orange transition-all"
          >
            ✕ Close
          </button>
        )}
      </div>
      <button
        onClick={onSubmit}
        className="px-2.5 py-0.5 rounded border border-bit-teal bg-bit-teal text-white text-[10px] font-medium cursor-pointer hover:bg-bit-teal/80 transition-all"
      >
        ✓ Queue as Change
      </button>
    </div>
  );
}
