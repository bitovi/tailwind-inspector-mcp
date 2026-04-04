import { useRef, useEffect } from 'react';
import type { ShadowGhostProps } from './types';

/**
 * Renders ghost HTML + CSS inside a shadow DOM for full CSS isolation.
 *
 * SECURITY NOTE: ghostHtml and ghostCss originate from our same-origin
 * Storybook proxy iframe.  If these values ever come from untrusted sources,
 * they must be sanitised before passing to this component.
 */
export function ShadowGhost({ ghostHtml, ghostCss, style, className }: ShadowGhostProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const shadow = hostRef.current.shadowRoot ?? hostRef.current.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${ghostCss}</style><div style="pointer-events:none">${ghostHtml}</div>`;
  }, [ghostHtml, ghostCss]);

  return <div ref={hostRef} style={style} className={className} />;
}
