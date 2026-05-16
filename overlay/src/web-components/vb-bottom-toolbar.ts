/**
 * <vb-bottom-toolbar> — Web Component for the bottom toolbar
 * Floating bar with Select (+ adjunct) and Insert buttons.
 *
 * Attributes:
 *   selected-tool: 'select' | 'insert' | null
 *   instance-count: number — count of matching elements
 *   disabled: boolean
 *
 * Events:
 *   @tool-change: detail = { tool: 'select' | 'insert' }
 *   @adjunct-click: detail = {}
 *
 * Visual States (via CSS classes on buttons):
 *   picking: orange, interactive
 *   engaged: teal, locked
 *   completed: checkmark, paste flow
 *   dim: faded when other tools active
 */

import { DRAG_GRIP_SVG } from '../svg-icons';
import './vb-button';
import './vb-button-group';

type ToolType = 'select' | 'insert';
type VisualState = 'picking' | 'engaged' | 'completed' | 'dim' | null;

/** Map legacy visual state names to vb-button state attribute values. */
const STATE_MAP: Record<string, string> = {
  picking: 'armed',
  engaged: 'active',
  completed: 'fulfilled',
  dim: 'dim',
};

export class VbBottomToolbar extends HTMLElement {
  private toolbar: HTMLDivElement | null = null;
  private selectBtnEl: HTMLElement | null = null;
  private insertBtnEl: HTMLElement | null = null;
  private selectGroupEl: HTMLElement | null = null;
  private userDragged = false;

  constructor() {
    super();
  }

  static get observedAttributes(): string[] {
    return ['selected-tool', 'instance-count', 'disabled'];
  }

  get selectedTool(): ToolType | null {
    return (this.getAttribute('selected-tool') as ToolType) || null;
  }

  set selectedTool(tool: ToolType | null) {
    if (tool) {
      this.setAttribute('selected-tool', tool);
    } else {
      this.removeAttribute('selected-tool');
    }
  }

  get instanceCount(): number {
    return parseInt(this.getAttribute('instance-count') || '0', 10);
  }

  set instanceCount(count: number) {
    this.setAttribute('instance-count', String(count));
  }

  get isDisabled(): boolean {
    return this.hasAttribute('disabled');
  }

  set isDisabled(val: boolean) {
    if (val) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  connectedCallback(): void {
    this.style.display = 'contents';
    this.render();
  }

  attributeChangedCallback(name: string, oldVal: string, newVal: string): void {
    if (oldVal === newVal) return;
    this.updateButtonStates();
  }

  show(): void {
    this.style.display = 'flex';
    this.centerToolbar();
  }

  hide(): void {
    this.style.display = 'none';
  }

  private render(): void {
    if (this.toolbar) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'bottom-toolbar';

    // Grip
    const grip = document.createElement('div');
    grip.className = 'bt-grip';
    grip.title = 'Drag to move';
    grip.innerHTML = DRAG_GRIP_SVG;
    this.setupDrag(grip, toolbar);
    toolbar.appendChild(grip);

    // Select button (inside a button group for the adjunct count)
    const selectBtn = document.createElement('vb-button') as HTMLElement;
    selectBtn.setAttribute('icon', 'select');
    selectBtn.setAttribute('theme', 'mode');
    selectBtn.setAttribute('data-tool', 'select');
    selectBtn.textContent = 'Select';
    selectBtn.title = 'Select';
    selectBtn.addEventListener('click', () => this.emitToolChange('select'));
    this.selectBtnEl = selectBtn;

    const selectGroup = document.createElement('vb-button-group') as VbButtonGroup;
    selectGroup.appendChild(selectBtn);
    selectGroup.addEventListener('adjunct-click', (e) => {
      e.stopPropagation(); // Prevent original from also reaching external listener
      this.emitAdjunctClick();
    });
    toolbar.appendChild(selectGroup);
    this.selectGroupEl = selectGroup;

    // Separator
    const sep = document.createElement('div');
    sep.className = 'bt-sep';
    toolbar.appendChild(sep);

    // Insert button
    const insertBtn = document.createElement('vb-button') as HTMLElement;
    insertBtn.setAttribute('icon', 'insert');
    insertBtn.setAttribute('theme', 'mode');
    insertBtn.setAttribute('data-tool', 'insert');
    insertBtn.textContent = 'Insert';
    insertBtn.title = 'Insert';
    insertBtn.addEventListener('click', () => this.emitToolChange('insert'));
    toolbar.appendChild(insertBtn);
    this.insertBtnEl = insertBtn;

    this.appendChild(toolbar);
    this.toolbar = toolbar;
    this.updateButtonStates();
  }

  private updateButtonStates(): void {
    if (!this.toolbar) return;

    const disabled = this.isDisabled;
    if (disabled) {
      this.selectBtnEl?.setAttribute('state', 'disabled');
      this.insertBtnEl?.setAttribute('state', 'disabled');
    }

    if (this.selectGroupEl) {
      this.selectGroupEl.setAttribute('count', String(this.instanceCount));
    }
  }

  /**
   * Apply per-tool visual states (picking/engaged/completed/dim).
   * Called by bottom-toolbar.ts to sync with the overlay state machine.
   */
  applyVisualStates(states: Record<string, VisualState>): void {
    if (!this.toolbar) return;

    // Map legacy state names to vb-button state values
    const selectState = states['select'] ? (STATE_MAP[states['select']] || 'default') : 'default';
    const insertState = states['insert'] ? (STATE_MAP[states['insert']] || 'default') : 'default';

    this.selectBtnEl?.setAttribute('state', selectState);
    this.insertBtnEl?.setAttribute('state', insertState);
  }

  /** Add/remove text-editing class on toolbar (dims all buttons). */
  setTextEditingLock(locked: boolean): void {
    if (!this.toolbar) return;
    if (locked) {
      this.toolbar.classList.add('text-editing');
    } else {
      this.toolbar.classList.remove('text-editing');
    }
  }

  private emitToolChange(tool: ToolType): void {
    this.dispatchEvent(
      new CustomEvent('tool-change', {
        detail: { tool },
        bubbles: true,
        composed: true,
      })
    );
  }

  private emitAdjunctClick(): void {
    console.log('[vb-bottom-toolbar] emitAdjunctClick called');
    this.dispatchEvent(
      new CustomEvent('adjunct-click', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private setupDrag(grip: HTMLElement, toolbar: HTMLElement): void {
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startBottom = 0;
    let isDragging = false;

    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      toolbar.style.left = `${startLeft + dx}px`;
      toolbar.style.bottom = `${startBottom - dy}px`;
      toolbar.style.transform = 'none';
    };

    const onUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    grip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      this.userDragged = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = toolbar.getBoundingClientRect();
      startLeft = rect.left;
      startBottom = window.innerHeight - rect.bottom;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  private centerToolbar(): void {
    if (!this.toolbar || this.userDragged) return;
    const wrapper = document.getElementById('tw-page-wrapper');
    let cx = window.innerWidth / 2;
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
    }
    const w = this.toolbar.offsetWidth;
    this.toolbar.style.left = `${cx - w / 2}px`;
  }
}

if (!customElements.get('vb-bottom-toolbar')) {
  customElements.define('vb-bottom-toolbar', VbBottomToolbar);
}
