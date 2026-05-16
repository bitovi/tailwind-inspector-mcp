/**
 * <vb-button> — Unified button web component for the overlay UI
 *
 * Attributes:
 *   structure: 'ghost' | 'filled'            (default: 'ghost')
 *   size:      'sm' | 'md'                   (default: 'md')
 *   theme:     'neutral' | 'primary' | 'danger' | 'mode'  (default: 'neutral')
 *   state:     'default' | 'armed' | 'active' | 'fulfilled' | 'disabled'  (default: 'default')
 *   icon:      SVG icon name from svg-icons.ts (optional)
 *
 * Content composition (auto-detected):
 *   - icon attr + text content  → icon+text layout (gap, horizontal padding)
 *   - icon attr + no text       → icon-only (square, no padding)
 *   - no icon + text            → text-only (text padding)
 *
 * Events:
 *   Standard 'click' events pass through from the inner <button>.
 *
 * CSS class mapping:
 *   .vb-btn                          — always present
 *   .vb-btn--ghost / .vb-btn--filled — structure
 *   .vb-btn--sm / .vb-btn--md        — size
 *   .vb-btn--neutral / etc.          — theme
 *   .vb-btn--armed / etc.            — state (omitted for 'default')
 *   .vb-btn--icon-only               — auto: icon + no text
 *   .vb-btn--text-only               — auto: no icon + text
 *   .vb-btn--icon-text               — auto: icon + text
 */

import {
  SELECT_SVG, INSERT_SVG, DRAG_GRIP_SVG, MIC_SVG,
  PENCIL_SVG, SEND_SVG, TEXT_SVG, CHEVRON_SVG, REPLACE_SVG,
  BACK_SVG, DESCRIBE_SVG,
} from '../svg-icons';

const ICON_MAP: Record<string, string> = {
  select: SELECT_SVG,
  insert: INSERT_SVG,
  grip: DRAG_GRIP_SVG,
  mic: MIC_SVG,
  pencil: PENCIL_SVG,
  send: SEND_SVG,
  text: TEXT_SVG,
  chevron: CHEVRON_SVG,
  replace: REPLACE_SVG,
  back: BACK_SVG,
  describe: DESCRIBE_SVG,
};

export type ButtonStructure = 'ghost' | 'filled';
export type ButtonSize = 'sm' | 'md';
export type ButtonTheme = 'neutral' | 'primary' | 'danger' | 'mode';
export type ButtonState = 'default' | 'armed' | 'active' | 'fulfilled' | 'disabled';

export class VbButton extends HTMLElement {
  private btn: HTMLButtonElement | null = null;
  private iconSpan: HTMLSpanElement | null = null;
  private labelSpan: HTMLSpanElement | null = null;
  private observer: MutationObserver | null = null;

  static get observedAttributes(): string[] {
    return ['structure', 'size', 'theme', 'state', 'icon'];
  }

  /* ── Attribute accessors ─────────────────────────────────────────── */

  get structure(): ButtonStructure {
    return (this.getAttribute('structure') as ButtonStructure) || 'ghost';
  }
  set structure(v: ButtonStructure) { this.setAttribute('structure', v); }

  get size(): ButtonSize {
    return (this.getAttribute('size') as ButtonSize) || 'md';
  }
  set size(v: ButtonSize) { this.setAttribute('size', v); }

  get theme(): ButtonTheme {
    return (this.getAttribute('theme') as ButtonTheme) || 'neutral';
  }
  set theme(v: ButtonTheme) { this.setAttribute('theme', v); }

  get state(): ButtonState {
    return (this.getAttribute('state') as ButtonState) || 'default';
  }
  set state(v: ButtonState) { this.setAttribute('state', v); }

  get icon(): string | null {
    return this.getAttribute('icon');
  }
  set icon(v: string | null) {
    if (v) this.setAttribute('icon', v);
    else this.removeAttribute('icon');
  }

  /* ── Lifecycle ───────────────────────────────────────────────────── */

  connectedCallback(): void {
    this.style.display = 'contents';
    if (!this.btn) this.render();

    // Watch for text content changes to re-detect content composition
    this.observer = new MutationObserver(() => this.updateContentClass());
    this.observer.observe(this, { childList: true, characterData: true, subtree: true });
  }

  disconnectedCallback(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (oldVal === newVal) return;
    if (!this.btn) return;

    if (name === 'icon') {
      this.updateIcon();
      this.updateContentClass();
    }
    this.syncClasses();
  }

  /* ── Rendering ───────────────────────────────────────────────────── */

  private render(): void {
    // Read text content from children BEFORE creating the inner button
    const labelText = this.collectAndRemoveTextNodes();

    this.btn = document.createElement('button');
    this.btn.type = 'button';

    this.iconSpan = document.createElement('span');
    this.iconSpan.className = 'vb-btn__icon';
    this.btn.appendChild(this.iconSpan);

    this.labelSpan = document.createElement('span');
    this.labelSpan.className = 'vb-btn__label';
    this.labelSpan.textContent = labelText;
    this.labelSpan.style.display = labelText ? '' : 'none';
    this.btn.appendChild(this.labelSpan);

    this.updateIcon();
    this.syncClasses();
    this.appendChild(this.btn);
  }

  /** Collect text from child text nodes and remove them from the DOM. */
  private collectAndRemoveTextNodes(): string {
    let text = '';
    const toRemove: Node[] = [];
    for (const node of this.childNodes) {
      if (node === this.btn) continue;
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
        toRemove.push(node);
      }
    }
    for (const node of toRemove) node.remove();
    return text.trim();
  }

  private updateIcon(): void {
    if (!this.iconSpan) return;
    const iconName = this.icon;
    if (iconName && ICON_MAP[iconName]) {
      this.iconSpan.innerHTML = ICON_MAP[iconName];
      this.iconSpan.style.display = '';
    } else if (iconName) {
      // Allow raw SVG passed as icon attribute value (for custom icons)
      this.iconSpan.innerHTML = '';
      this.iconSpan.style.display = 'none';
    } else {
      this.iconSpan.innerHTML = '';
      this.iconSpan.style.display = 'none';
    }
  }

  private updateLabel(): void {
    if (!this.labelSpan) return;
    const text = this.collectAndRemoveTextNodes();
    // Only update if new text was found (avoid clearing label on observer re-fires)
    if (text) {
      this.labelSpan.textContent = text;
      this.labelSpan.style.display = '';
    }
  }

  private updateContentClass(): void {
    this.updateLabel();
    this.syncClasses();
  }

  /* ── Class sync ──────────────────────────────────────────────────── */

  private syncClasses(): void {
    if (!this.btn) return;

    const hasIcon = !!(this.icon && ICON_MAP[this.icon]);
    const hasLabel = !!(this.labelSpan && this.labelSpan.style.display !== 'none');
    const state = this.state;

    const classes = ['vb-btn'];

    // Structure
    classes.push(`vb-btn--${this.structure}`);

    // Size
    classes.push(`vb-btn--${this.size}`);

    // Theme
    classes.push(`vb-btn--${this.theme}`);

    // State (omit for 'default')
    if (state !== 'default') {
      classes.push(`vb-btn--${state}`);
    }

    // Content composition
    if (hasIcon && hasLabel) {
      classes.push('vb-btn--icon-text');
    } else if (hasIcon) {
      classes.push('vb-btn--icon-only');
    } else if (hasLabel) {
      classes.push('vb-btn--text-only');
    }

    // Disabled
    this.btn.disabled = state === 'disabled';

    this.btn.className = classes.join(' ');
  }
}

/* ── Registration ──────────────────────────────────────────────────── */

if (!customElements.get('vb-button')) {
  customElements.define('vb-button', VbButton);
}

/* ── JSX type augmentation ─────────────────────────────────────────── */

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'vb-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          structure?: ButtonStructure;
          size?: ButtonSize;
          theme?: ButtonTheme;
          state?: ButtonState;
          icon?: string;
        },
        HTMLElement
      >;
    }
  }
}
