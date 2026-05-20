import { Injectable, signal, computed } from '@angular/core';

const STORAGE_KEY = 'vybit-tutorial-progress';

interface ServerMessage {
  __vybit?: boolean;
  type: string;
  role?: string;
  connected?: boolean;
  insertMode?: string;
  inputMethod?: string;
  elementKey?: string;
  patch?: {
    kind?: string;
    componentArgs?: Record<string, unknown>;
    componentStoryId?: string;
    component?: { name?: string };
  };
}

@Injectable({ providedIn: 'root' })
export class TutorialProgressService {
  private _completedSteps = signal<Set<number>>(new Set());

  get completedSteps(): Set<number> { return this._completedSteps(); }

  readonly completedCount = computed(() =>
    [...this._completedSteps()].filter(s => s <= 14).length,
  );

  constructor() {
    this.loadProgress();
    this.listenForMessages();
  }

  completeStep(step: number): void {
    const current = this._completedSteps();
    if (current.has(step)) return;
    const next = new Set(current);
    next.add(step);
    this._completedSteps.set(next);
    this.saveProgress();
  }

  resetProgress(): void {
    this._completedSteps.set(new Set<number>());
    this.saveProgress();
  }

  private loadProgress(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this._completedSteps.set(new Set(arr));
        }
      }
    } catch { /* ignore */ }
  }

  private saveProgress(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this._completedSteps()]));
    } catch { /* ignore */ }
  }

  private processMessage(msg: ServerMessage): void {
    if (!msg?.type) return;

    switch (msg.type) {
      case 'REGISTER':
        if (msg.role === 'panel') this.completeStep(2);
        break;
      case 'OVERLAY_STATUS':
        if (msg.connected) this.completeStep(2);
        break;
      case 'PATCH_COMMIT':
        this.completeStep(3);
        break;
      case 'MESSAGE_STAGE':
        if (msg.insertMode) this.completeStep(6);
        if (msg.inputMethod === 'voice') this.completeStep(4);
        if (msg.elementKey === 'theme') this.completeStep(15);
        break;
      case 'TEXT_EDIT_DONE':
        this.completeStep(5);
        break;
      case 'COMPONENT_DROPPED': {
        if (msg.patch?.componentStoryId) {
          this.completeStep(11);  // Place a Component (from Storybook)
        } else {
          this.completeStep(10);  // Copy and Paste (duplicate/paste, no storyId)
        }
        const args = msg.patch?.componentArgs;
        const hasNested = args != null && Object.values(args).some(
          (v) => v != null && typeof v === 'object' && (v as Record<string, unknown>)['type'] === 'component'
        );
        if (hasNested) this.completeStep(12);
        break;
      }
      case 'PATCH_STAGED':
        if ((msg.patch?.kind ?? 'class-change') === 'class-change') this.completeStep(13);
        if (msg.patch?.kind === 'design') this.completeStep(7);
        if (msg.patch?.kind === 'delete-element') this.completeStep(9);
        if (msg.patch?.kind === 'move-element') this.completeStep(8);
        break;
      case 'BUG_REPORT_STAGE':
        this.completeStep(14);
        break;
      case 'DESIGN_SUBMIT':
        this.completeStep(7);
        break;
      case 'DISAMBIGUATOR_SHOWN':
        this.completeStep(17);
        break;
    }
  }

  private listenForMessages(): void {
    window.addEventListener('vybit:message', (e: Event) => {
      this.processMessage((e as CustomEvent<ServerMessage>).detail);
    });

    window.addEventListener('message', (e: MessageEvent) => {
      if (e.data?.__vybit) {
        this.processMessage(e.data as ServerMessage);
      }
    });
  }
}
