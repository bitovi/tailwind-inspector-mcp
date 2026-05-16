/**
 * <vb-overlay-host> — Storybook/testing helper
 * Creates a shadow root with OVERLAY_CSS, mirroring the real overlay's
 * #tw-visual-editor-host. Light DOM Web Components rendered inside
 * this element get the same styles they would in production.
 *
 * Accepts a `theme` attribute ("dark" | "light") to toggle `:host(.light)` styles.
 */
import { OVERLAY_CSS } from '../styles';

export class VbOverlayHost extends HTMLElement {
  static get observedAttributes() { return ['theme']; }

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    shadow.appendChild(style);
    // Move children into shadow root so they receive OVERLAY_CSS styles
    while (this.firstChild) {
      shadow.appendChild(this.firstChild);
    }
    this.syncTheme();
  }

  attributeChangedCallback(name: string) {
    if (name === 'theme') this.syncTheme();
  }

  private syncTheme() {
    if (!this.shadowRoot) return;
    const light = this.getAttribute('theme') === 'light';
    this.shadowRoot.host.classList.toggle('light', light);
  }
}

if (!customElements.get('vb-overlay-host')) {
  customElements.define('vb-overlay-host', VbOverlayHost);
}
