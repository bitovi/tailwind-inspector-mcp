export interface ShadowGhostProps {
  /** Raw ghost HTML with original class names preserved. */
  ghostHtml: string;
  /** Collected CSS from iframe stylesheets (Tailwind + component CSS). */
  ghostCss: string;
  /** Optional inline styles for the host wrapper element. */
  style?: React.CSSProperties;
  /** Optional className for the host wrapper element. */
  className?: string;
}
