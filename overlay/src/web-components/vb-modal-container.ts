/**
 * <vb-modal-container> — Web Component wrapper for ModalContainer
 * A draggable and resizable modal panel with localStorage persistence.
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



interface ModalBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

const STORAGE_KEY = 'tw-modal-bounds';

function loadBounds(): ModalBounds {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return {
    top: 80,
    left: Math.max(0, window.innerWidth - 440),
    width: 400,
    height: 600,
  };
}

function saveBounds(bounds: ModalBounds): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bounds));
  } catch { /* ignore */ }
}

export class VbModalContainer extends HTMLElement {
  private hostEl: HTMLDivElement | null = null;
  private bounds: ModalBounds = loadBounds();
  private iframeEl: HTMLIFrameElement | null = null;

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

    this.bounds = loadBounds();

    const host = document.createElement('div');
    host.className = 'container-modal';
    this.applyBounds(host);

    // Drag handle
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = `<svg width="32" height="6" viewBox="0 0 32 6" fill="none"><rect x="0" y="0" width="32" height="2" rx="1" fill="var(--ov-text-dim)"/><rect x="0" y="4" width="32" height="2" rx="1" fill="var(--ov-text-dim)"/></svg>`;
    this.setupDrag(handle, host);
    host.appendChild(handle);

    // Iframe
    const iframe = document.createElement('iframe');
    iframe.src = this.panelUrl;
    iframe.allow = 'microphone';
    iframe.style.cssText = 'flex:1;border:none;width:100%;height:100%;';
    host.appendChild(iframe);
    this.iframeEl = iframe;

    // Resize gripper
    const gripper = document.createElement('div');
    gripper.className = 'resize-gripper';
    gripper.innerHTML = '◢';
    this.setupResize(gripper, host, iframe);
    host.appendChild(gripper);

    this.appendChild(host);
    this.hostEl = host;
  }

  private closePanel(): void {
    if (this.hostEl) {
      this.hostEl.remove();
      this.hostEl = null;
      this.iframeEl = null;
    }
  }

  private updatePanelUrl(): void {
    if (this.iframeEl) {
      this.iframeEl.src = this.panelUrl;
    }
  }

  private applyBounds(el: HTMLElement): void {
    el.style.top = `${this.bounds.top}px`;
    el.style.left = `${this.bounds.left}px`;
    el.style.width = `${this.bounds.width}px`;
    el.style.height = `${this.bounds.height}px`;
  }

  private setupDrag(handle: HTMLElement, host: HTMLElement): void {
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMove = (e: MouseEvent) => {
      this.bounds.left = startLeft + (e.clientX - startX);
      this.bounds.top = startTop + (e.clientY - startY);
      host.style.left = `${this.bounds.left}px`;
      host.style.top = `${this.bounds.top}px`;
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      saveBounds(this.bounds);
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = this.bounds.left;
      startTop = this.bounds.top;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  private setupResize(gripper: HTMLElement, host: HTMLElement, iframe: HTMLIFrameElement): void {
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;

    const onMove = (e: MouseEvent) => {
      this.bounds.width = Math.max(300, startW + (e.clientX - startX));
      this.bounds.height = Math.max(200, startH + (e.clientY - startY));
      host.style.width = `${this.bounds.width}px`;
      host.style.height = `${this.bounds.height}px`;
    };

    const onUp = () => {
      iframe.style.pointerEvents = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      saveBounds(this.bounds);
    };

    gripper.addEventListener('mousedown', (e) => {
      e.preventDefault();
      iframe.style.pointerEvents = 'none';
      startX = e.clientX;
      startY = e.clientY;
      startW = this.bounds.width;
      startH = this.bounds.height;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
}

if (!customElements.get('vb-modal-container')) {
  customElements.define('vb-modal-container', VbModalContainer);
}
