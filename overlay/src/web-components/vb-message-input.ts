/**
 * <vb-message-input> — Floating message input web component for the overlay UI.
 * Renders as a .msg-row: textarea + optional mic + optional send button.
 *
 * Attributes:
 *   placeholder: string  (default: 'add your message')
 *   show-send:   boolean (default: true) — show the send button
 *
 * Events:
 *   @message-send: CustomEvent<{ text: string }> — fires when the user submits
 */

import './vb-button';

// Detect Web Speech API (Chrome/Edge: webkitSpeechRecognition, Safari: SpeechRecognition)
const SpeechRecognitionAPI: (new () => any) | null =
	typeof window !== 'undefined'
		? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null)
		: null;

export class VbMessageInput extends HTMLElement {
	private textarea: HTMLTextAreaElement | null = null;
	private micBtn: HTMLElement | null = null;
	private sendBtn: HTMLElement | null = null;
	private recognition: any = null;
	private usedVoice = false;

	static get observedAttributes(): string[] {
		return ['placeholder', 'show-send'];
	}

	/* ── Attribute accessors ─────────────────────────────────────────── */

	get placeholder(): string {
		return this.getAttribute('placeholder') ?? 'add your message';
	}
	set placeholder(v: string) { this.setAttribute('placeholder', v); }

	get showSend(): boolean {
		return this.getAttribute('show-send') !== 'false';
	}
	set showSend(v: boolean) { this.setAttribute('show-send', String(v)); }

	/* ── Lifecycle ───────────────────────────────────────────────────── */

	connectedCallback(): void {
		this.className = 'msg-row';
		if (!this.textarea) this.render();
	}

	attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
		if (oldVal === newVal || !this.textarea) return;
		if (name === 'placeholder') {
			this.textarea.placeholder = newVal ?? 'add your message';
		}
	}

	/* ── Public API ──────────────────────────────────────────────────── */

	/** Returns and clears the current textarea value. */
	getValue(): string {
		return this.textarea?.value.trim() ?? '';
	}

	/** Clears the textarea. */
	clear(): void {
		if (this.textarea) {
			this.textarea.value = '';
			this.textarea.style.height = 'auto';
		}
		this.usedVoice = false;
	}

	/* ── Internals ───────────────────────────────────────────────────── */

	private render(): void {
		// Textarea
		this.textarea = document.createElement('textarea');
		this.textarea.rows = 1;
		this.textarea.placeholder = this.placeholder;
		this.appendChild(this.textarea);

		// Auto-resize textarea
		this.textarea.addEventListener('input', () => {
			this.textarea!.style.height = 'auto';
			this.textarea!.style.height = this.textarea!.scrollHeight + 'px';
		});

		this.textarea.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				this.submit();
			}
			if (e.key === 'Escape') {
				this.textarea?.blur();
			}
		});

		// Mic button — only when browser supports SpeechRecognition
		if (SpeechRecognitionAPI) {
			this.micBtn = document.createElement('vb-button') as HTMLElement;
			this.micBtn.setAttribute('icon', 'mic');
			this.micBtn.setAttribute('size', 'sm');
			this.micBtn.title = 'Record voice message';
			this.appendChild(this.micBtn);

			this.micBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.toggleRecognition();
			});
		}

		// Send button
		if (this.showSend) {
			this.sendBtn = document.createElement('vb-button') as HTMLElement;
			this.sendBtn.setAttribute('icon', 'send');
			this.sendBtn.setAttribute('size', 'sm');
			this.appendChild(this.sendBtn);

			this.sendBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.submit();
			});
		}

		// Prevent clicks from bubbling to the page
		this.addEventListener('click', (e) => e.stopPropagation());
	}

	private submit(): void {
		const text = this.textarea?.value.trim() ?? '';
		if (!text) return;

		this.dispatchEvent(new CustomEvent('message-send', {
			detail: { text, usedVoice: this.usedVoice },
			bubbles: true,
		}));

		this.clear();
	}

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

customElements.define('vb-message-input', VbMessageInput);
