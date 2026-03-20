import { useRef, useEffect, forwardRef } from 'react';

export interface FocusTrapContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Called when the user escapes the container — by blurring outside it,
   * pressing Escape, or any other "close" interaction.
   * The consumer should close the menu and revert any active preview.
   */
  onClose: () => void;
}

/**
 * A focusable container that traps attention while open.
 *
 * - Auto-focuses on mount so the browser blur/focusout machinery works.
 * - Fires `onClose` when focus moves outside (blur + relatedTarget check).
 * - Fires `onClose` on Escape keydown.
 *
 * Use this as the root element of any dropdown or floating menu that needs
 * to revert a live preview when the user stops interacting.
 */
export const FocusTrapContainer = forwardRef<HTMLDivElement, FocusTrapContainerProps>(
  function FocusTrapContainer({ onClose, children, ...rest }, forwardedRef) {
  const ref = useRef<HTMLDivElement>(null);

  // Auto-focus on mount so onBlur fires when the user moves focus away.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={(node) => {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      tabIndex={-1}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.code === 'Escape') onClose();
      }}
      {...rest}
    >
      {children}
    </div>
  );
});
