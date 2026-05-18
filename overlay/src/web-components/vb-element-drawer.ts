/**
 * <vb-element-drawer> — Compact action menu for a selected element.
 *
 * Renders the "Describe change" / "Edit text" button pair (State A),
 * and optionally the describe-change textarea form (State B).
 *
 * Attributes:
 *   mode: 'select' | 'insert'  (default: 'select')
 *     — 'insert' swaps "Edit text" label to "Insert text"
 *   state: 'menu' | 'describe' (default: 'menu')
 *     — 'menu' renders the two-button pair (State A)
 *     — 'describe' renders the textarea form (State B)
 *
 * Events:
 *   @describe-click — User clicked "Describe change" (menu state)
 *   @text-click     — User clicked "Edit text" / "Insert text" (menu state)
 *   @back           — User clicked back arrow (describe state)
 *   @queue          — detail: { text: string, usedVoice: boolean }
 *   @commit         — detail: { text: string, usedVoice: boolean }
 *
 * Usage in mockup HTML:
 *   <vb-element-drawer></vb-element-drawer>
 *   <vb-element-drawer mode="insert"></vb-element-drawer>
 *   <vb-element-drawer state="describe"></vb-element-drawer>
 */

import './vb-button';

// Detect Web Speech API
const SpeechRecognitionAPI: (new () => any) | null =
	typeof window !== 'undefined'
		? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null)
		: null;

export class VbElementDrawer extends HTMLElement {
	private recognition: any = null;
	private micBtn: HTMLElement | null = null;
	private textarea: HTMLTextAreaElement | null = null;
	private usedVoice = false;

	static get observedAttributes(): string[] {
		return ['mode', 'state'];
	}

	/* ── Attribute accessors ─────────────────────────────────────────── */

	get mode(): 'select' | 'insert' {
		return (this.getAttribute('mode') as 'select' | 'insert') || 'select';
	}
	set mode(v: 'select' | 'insert') { this.setAttribute('mode', v); }

	get state(): 'menu' | 'describe' {
		return (this.getAttribute('state') as 'menu' | 'describe') || 'menu';
	}
	set state(v: 'menu' | 'describe') { this.setAttribute('state', v); }

	/* ── Lifecycle ───────────────────────────────────────────────────── */

	connectedCallback(): void {
		this.className = 'element-drawer';
		this.render();
	}

	attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
		if (oldVal === newVal) return;
		this.render();
	}

	/* ── Rendering ───────────────────────────────────────────────────── */

	private render(): void {
		this.innerHTML = '';
		this.recognition?.stop();
		this.recognition = null;
		this.micBtn = null;
		this.textarea = null;
		this.usedVoice = false;

		if (this.state === 'describe') {
			this.renderDescribe();
		} else {
			this.renderMenu();
		}
	}

	/** State A — Two-button menu */
	private renderMenu(): void {
		const pair = document.createElement('div');
		pair.className = 'ed-btn-pair';

		// Describe change button
		const describeBtn = document.createElement('vb-button') as HTMLElement;
		describeBtn.setAttribute('icon', 'describe');
		describeBtn.setAttribute('theme', 'primary');
		describeBtn.setAttribute('class', 'ed-action-btn');
		describeBtn.textContent = 'Describe change';
		describeBtn.addEventListener('click', () => {
			this.dispatchEvent(new CustomEvent('describe-click', { bubbles: true }));
		});
		pair.appendChild(describeBtn);

		// Edit/Insert text button
		const textBtn = document.createElement('vb-button') as HTMLElement;
		textBtn.setAttribute('icon', 'text');
		textBtn.setAttribute('theme', 'primary');
		textBtn.setAttribute('class', 'ed-action-btn');
		textBtn.textContent = this.mode === 'insert' ? 'Insert text' : 'Edit text';
		textBtn.addEventListener('click', () => {
			this.dispatchEvent(new CustomEvent('text-click', { bubbles: true }));
		});
		pair.appendChild(textBtn);

		this.appendChild(pair);
	}

	/** State B — Describe change textarea form */
	private renderDescribe(): void {
		const wrapper = document.createElement('div');
		wrapper.className = 'ed-describe-wrapper';

		// Textarea
		this.textarea = document.createElement('textarea');
		this.textarea.className = 'ed-textarea';
		this.textarea.placeholder = 'describe change';
		this.textarea.rows = 3;
		wrapper.appendChild(this.textarea);

		// Controls row
		const controls = document.createElement('div');
		controls.className = 'ed-controls-row';

		// Back button
		const backBtn = document.createElement('vb-button') as HTMLElement;
		backBtn.setAttribute('icon', 'back');
		backBtn.setAttribute('size', 'sm');
		backBtn.addEventListener('click', () => {
			this.dispatchEvent(new CustomEvent('back', { bubbles: true }));
		});
		controls.appendChild(backBtn);

		// Right side: mic + queue + commit
		const rightGroup = document.createElement('div');
		rightGroup.className = 'ed-controls-right';

		// Mic button (if supported)
		if (SpeechRecognitionAPI) {
			this.micBtn = document.createElement('vb-button') as HTMLElement;
			this.micBtn.setAttribute('icon', 'mic');
			this.micBtn.setAttribute('size', 'sm');
			this.micBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.toggleRecognition();
			});
			rightGroup.appendChild(this.micBtn);
		}

		// Queue button
		const queueBtn = document.createElement('vb-button') as HTMLElement;
		queueBtn.setAttribute('theme', 'danger');
		queueBtn.setAttribute('structure', 'filled');
		queueBtn.setAttribute('size', 'sm');
		queueBtn.setAttribute('class', 'ed-queue-btn');
		queueBtn.textContent = 'Queue';
		queueBtn.addEventListener('click', () => {
			const text = this.textarea?.value.trim() ?? '';
			if (!text) return;
			this.dispatchEvent(new CustomEvent('queue', {
				detail: { text, usedVoice: this.usedVoice },
				bubbles: true,
			}));
		});
		rightGroup.appendChild(queueBtn);

		// Commit button
		const commitBtn = document.createElement('vb-button') as HTMLElement;
		commitBtn.setAttribute('theme', 'primary');
		commitBtn.setAttribute('structure', 'filled');
		commitBtn.setAttribute('size', 'sm');
		commitBtn.textContent = 'Commit';
		commitBtn.addEventListener('click', () => {
			const text = this.textarea?.value.trim() ?? '';
			if (!text) return;
			this.dispatchEvent(new CustomEvent('commit', {
				detail: { text, usedVoice: this.usedVoice },
				bubbles: true,
			}));
		});
		rightGroup.appendChild(commitBtn);

		controls.appendChild(rightGroup);
		wrapper.appendChild(controls);
		this.appendChild(wrapper);

		// Auto-grow textarea
		this.textarea.addEventListener('input', () => {
			this.textarea!.style.height = 'auto';
			this.textarea!.style.height = this.textarea!.scrollHeight + 'px';
		});

		// Keyboard shortcuts
		this.textarea.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				this.dispatchEvent(new CustomEvent('back', { bubbles: true }));
			}
			if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
				e.preventDefault();
				const text = this.textarea?.value.trim() ?? '';
				if (text) {
					this.dispatchEvent(new CustomEvent('commit', {
						detail: { text, usedVoice: this.usedVoice },
						bubbles: true,
					}));
				}
			} else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				const text = this.textarea?.value.trim() ?? '';
				if (text) {
					this.dispatchEvent(new CustomEvent('queue', {
						detail: { text, usedVoice: this.usedVoice },
						bubbles: true,
					}));
				}
			}
		});

		requestAnimationFrame(() => this.textarea?.focus());
	}

	/* ── Voice recognition ───────────────────────────────────────────── */

	private toggleRecognition(): void {
		if (this.recognition) {
			this.recognition.stop();
			return;
		}

		const baseText = this.textarea?.value ?? '';
		this.recognition = new SpeechRecognitionAPI!();
		this.recognition.continuous = false;
		this.recognition.interimResults = true;
		this.recognition.lang = navigator.language || 'en-US';

		this.recognition.onresult = (event: any) => {
			let transcript = '';
			for (let i = 0; i < event.results.length; i++) {
				transcript += event.results[i][0].transcript;
			}
			const sep = baseText && !baseText.endsWith('\n') ? '\n' : '';
			if (this.textarea) {
				this.textarea.value = baseText + sep + transcript;
				this.textarea.style.height = 'auto';
				this.textarea.style.height = this.textarea.scrollHeight + 'px';
			}
			this.usedVoice = true;
		};

		this.recognition.onend = () => {
			this.micBtn?.setAttribute('state', 'default');
			this.recognition = null;
		};

		this.recognition.onerror = () => {
			this.micBtn?.setAttribute('state', 'default');
			this.recognition = null;
		};

		this.micBtn?.setAttribute('state', 'armed');
		this.recognition.start();
	}
}

customElements.define('vb-element-drawer', VbElementDrawer);
