/**
 * <vb-sidebar-container> — Web Component wrapper for SidebarContainer
 * A fixed sidebar that restructures the page DOM to push content left.
 *
 * Attributes:
 *   panel-url: string — URL of the panel iframe
 *   open: boolean — Whether the container is visible
 *   width: string (optional) — Sidebar width in pixels (default: 380px)
 *
 * Properties:
 *   panelUrl: string
 *   open: boolean
 *   width: number
 *
 * Methods:
 *   open(url: string): void
 *   close(): void
 *   isOpen(): boolean
 */

import { captureScrollPosition } from '../preserve-scroll';

export class VbSidebarContainer extends HTMLElement {
  private hostEl: HTMLDivElement | null = null;
  private pageWrapper: HTMLElement | null = null;
  private originalBodyOverflow: string = '';
  private iframeEl: HTMLIFrameElement | null = null;
  private sidebarWidth = 380;

  constructor() {
    super();
  }

  static get observedAttributes(): string[] {
    return ['panel-url', 'open', 'width'];
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

  get sidebarWidthPx(): number {
    const w = this.getAttribute('width');
    return w ? parseInt(w, 10) : 380;
  }

  set sidebarWidthPx(val: number) {
    this.setAttribute('width', String(val));
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
    } else if (name === 'width') {
      this.sidebarWidth = parseInt(newVal || '380', 10);
      if (this.isOpen) {
        this.updateSidebarWidth();
      }
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

    // Capture scroll position before restructuring DOM
    const restoreScroll = captureScrollPosition();

    // Create page wrapper that leaves room on the right for sidebar
    this.originalBodyOverflow = document.body.style.overflow;
    const wrapper = document.createElement('div');
    wrapper.id = 'tw-page-wrapper';
    wrapper.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: ${this.sidebarWidth}px;
      bottom: 0;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      background: transparent;
      z-index: 0;
    `;

    // Move existing body children (except the overlay host) into the wrapper
    const bodyChildren = Array.from(document.body.childNodes);
    for (const node of bodyChildren) {
      const htmlEl = node as HTMLElement;
      // Keep the overlay host (if present) outside the wrapper
      if (htmlEl.id === 'tw-visual-editor-host') continue;
      wrapper.appendChild(node);
    }

    // Insert wrapper before the overlay host so overlay remains on top
    const shadowHost = document.getElementById('tw-visual-editor-host');
    if (shadowHost && shadowHost.parentNode) {
      shadowHost.parentNode.insertBefore(wrapper, shadowHost);
    } else {
      document.body.appendChild(wrapper);
    }

    // Hide body's default scrollbar
    document.body.style.overflow = 'hidden';
    this.pageWrapper = wrapper;

    // Restore scroll position on the wrapper
    restoreScroll(wrapper);

    // Create sidebar container
    const host = document.createElement('div');
    host.className = 'container-sidebar';
    host.style.width = `${this.sidebarWidth}px`;

    const iframe = document.createElement('iframe');
    iframe.src = this.panelUrl;
    iframe.allow = 'microphone';
    iframe.style.cssText = 'flex:1;border:none;width:100%;height:100%;';
    host.appendChild(iframe);
    this.iframeEl = iframe;

    this.appendChild(host);
    this.hostEl = host;
  }

  private closePanel(): void {
    if (this.hostEl) {
      this.hostEl.remove();
      this.hostEl = null;
      this.iframeEl = null;

      // Capture scroll position from wrapper before moving children back
      let restoreScrollFn: (() => void) | null = null;
      if (this.pageWrapper) {
        const wrapper = this.pageWrapper;
        const maxScroll = wrapper.scrollHeight - wrapper.clientHeight;
        const ratio = maxScroll > 0 ? wrapper.scrollTop / maxScroll : 0;
        restoreScrollFn = () => {
          requestAnimationFrame(() => {
            const scrollEl = document.scrollingElement ?? document.documentElement;
            const newMax = scrollEl.scrollHeight - scrollEl.clientHeight;
            if (newMax > 0) {
              scrollEl.scrollTop = Math.round(ratio * newMax);
            }
          });
        };

        // Move children back to body (before the overlay host)
        const children = Array.from(this.pageWrapper.childNodes);
        const shadowHost = document.getElementById('tw-visual-editor-host');
        for (const node of children) {
          if (shadowHost && shadowHost.parentNode) {
            shadowHost.parentNode.insertBefore(node, shadowHost);
          } else {
            document.body.appendChild(node);
          }
        }
        this.pageWrapper.remove();
        this.pageWrapper = null;
      }

      document.body.style.overflow = this.originalBodyOverflow || '';

      // Restore scroll position on the page
      if (restoreScrollFn) restoreScrollFn();
    }
  }

  private updatePanelUrl(): void {
    if (this.iframeEl) {
      this.iframeEl.src = this.panelUrl;
    }
  }

  private updateSidebarWidth(): void {
    if (this.hostEl) {
      this.hostEl.style.width = `${this.sidebarWidth}px`;
    }
    if (this.pageWrapper) {
      this.pageWrapper.style.right = `${this.sidebarWidth}px`;
    }
  }
}

if (!customElements.get('vb-sidebar-container')) {
  customElements.define('vb-sidebar-container', VbSidebarContainer);
}
