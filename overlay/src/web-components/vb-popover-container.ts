/**
 * <vb-popover-container> — Web Component wrapper for PopoverContainer
 * A fixed popover panel (top-right, non-interactive position).
 *
 * Attributes:
 *   panel-url: string — URL of the panel iframe
 *   open: boolean — Whether the container is visible
 *
 * Properties:
 *   panelUrl: string
 *   open: boolean
 *
 * Methods:
 *   open(url: string): void
 *   close(): void
 *   isOpen(): boolean
 */



export class VbPopoverContainer extends HTMLElement {
  private hostEl: HTMLDivElement | null = null;

  constructor() {
    super();
  }

  static get observedAttributes(): string[] {
    return ['panel-url', 'open'];
  }

  get panelUrl(): string {
    return this.getAttribute('panel-url') || '';
  }

  set panelUrl(url: string) {
    this.setAttribute('panel-url', url);
  }

  get isOpen(): boolean {
    return this.hasAttribute('open');
  }

  set isOpen(val: boolean) {
    if (val) {
      this.setAttribute('open', '');
    } else {
      this.removeAttribute('open');
    }
  }

  connectedCallback(): void {
    this.style.display = 'contents';
    if (this.isOpen && this.panelUrl) {
      this.openPanel();
    }
  }

  attributeChangedCallback(name: string, oldVal: string, newVal: string): void {
    if (oldVal === newVal) return;

    if (name === 'open') {
      if (newVal !== null) {
        this.openPanel();
      } else {
        this.closePanel();
      }
    } else if (name === 'panel-url' && this.isOpen) {
      this.updatePanelUrl();
    }
  }

  open(panelUrl: string): void {
    this.panelUrl = panelUrl;
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  isOpenMethod(): boolean {
    return this.isOpen;
  }

  private openPanel(): void {
    if (this.hostEl) return;

    const host = document.createElement('div');
    host.className = 'container-popover';

    const iframe = document.createElement('iframe');
    iframe.src = this.panelUrl;
    iframe.allow = 'microphone';
    host.appendChild(iframe);

    this.appendChild(host);
    this.hostEl = host;
  }

  private closePanel(): void {
    if (this.hostEl) {
      this.hostEl.remove();
      this.hostEl = null;
    }
  }

  private updatePanelUrl(): void {
    const iframe = this.querySelector('iframe');
    if (iframe) {
      iframe.src = this.panelUrl;
    }
  }
}

if (!customElements.get('vb-popover-container')) {
  customElements.define('vb-popover-container', VbPopoverContainer);
}
