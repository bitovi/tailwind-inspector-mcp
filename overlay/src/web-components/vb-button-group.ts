/**
 * <vb-button-group> — Button + adjunct count badge
 * Wraps a <vb-button> with an optional count badge, connected visually.
 *
 * Attributes:
 *   count: number — count to display in the adjunct badge (0 = hidden)
 *
 * Slots:
 *   Default slot: expects a single <vb-button> as its child.
 *
 * The group forwards the child button's theme/state for visual coherence:
 *   - Reads the child <vb-button>'s `theme` and `state` attributes
 *   - Applies matching CSS classes to the group wrapper for ring/bg styling
 *
 * CSS class mapping:
 *   .vb-btn-group                — always present
 *   .vb-btn-group--<state>       — mirrors child button state
 *   .vb-btn-group--<theme>       — mirrors child button theme
 */

export class VbButtonGroup extends HTMLElement {
  private wrapper: HTMLDivElement | null = null;
  private sepEl: HTMLDivElement | null = null;
  private adjunctBtn: HTMLButtonElement | null = null;
  private observer: MutationObserver | null = null;

  static get observedAttributes(): string[] {
    return ['count'];
  }

  get count(): number {
    return parseInt(this.getAttribute('count') || '0', 10);
  }

  set count(v: number) {
    this.setAttribute('count', String(v));
  }

  connectedCallback(): void {
    this.style.display = 'contents';
    if (!this.wrapper) this.render();

    // Watch child vb-button for attribute changes (theme/state)
    this.observer = new MutationObserver(() => this.syncGroupClasses());
    this.observer.observe(this, { subtree: true, attributes: true, attributeFilter: ['theme', 'state'] });
  }

  disconnectedCallback(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (oldVal === newVal) return;
    if (name === 'count') this.updateAdjunct();
  }

  private render(): void {
    // Collect child nodes before wrapping
    const children: Node[] = [];
    while (this.firstChild) {
      children.push(this.removeChild(this.firstChild));
    }

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'vb-btn-group';

    // Re-append original children (the <vb-button>) into the wrapper
    for (const child of children) {
      this.wrapper.appendChild(child);
    }

    // Separator
    this.sepEl = document.createElement('div');
    this.sepEl.className = 'vb-btn-group__sep';
    this.wrapper.appendChild(this.sepEl);

    // Adjunct badge button
    this.adjunctBtn = document.createElement('button');
    this.adjunctBtn.type = 'button';
    this.adjunctBtn.className = 'vb-btn-group__adjunct';
    this.adjunctBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent Select button from also firing
      console.log('[vb-button-group] adjunct click — dispatching adjunct-click event');
      this.dispatchEvent(new CustomEvent('adjunct-click', { bubbles: true }));
    });
    this.wrapper.appendChild(this.adjunctBtn);

    this.appendChild(this.wrapper);
    this.updateAdjunct();
    this.syncGroupClasses();
  }

  private updateAdjunct(): void {
    if (!this.adjunctBtn || !this.sepEl) return;
    const count = this.count;
    if (count > 0) {
      this.adjunctBtn.innerHTML = `${count}<span class="vb-btn-group__plus">+</span>`;
      this.adjunctBtn.title = `${count} matching element${count !== 1 ? 's' : ''} selected`;
      this.adjunctBtn.style.display = '';
      this.sepEl.style.display = '';
    } else {
      this.adjunctBtn.style.display = 'none';
      this.sepEl.style.display = 'none';
    }
  }

  /** Sync group wrapper classes from the child <vb-button>'s theme/state. */
  syncGroupClasses(): void {
    if (!this.wrapper) return;
    const childBtn = this.querySelector('vb-button');
    const theme = childBtn?.getAttribute('theme') || 'neutral';
    const state = childBtn?.getAttribute('state') || 'default';

    // Reset classes
    this.wrapper.className = 'vb-btn-group';
    this.wrapper.classList.add(`vb-btn-group--${theme}`);
    if (state !== 'default') {
      this.wrapper.classList.add(`vb-btn-group--${state}`);
    }
  }
}

if (!customElements.get('vb-button-group')) {
  customElements.define('vb-button-group', VbButtonGroup);
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'vb-button-group': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          count?: number;
        },
        HTMLElement
      >;
    }
  }
}
