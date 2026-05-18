import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

// Side-effect import: register custom elements
import './vb-message-input';
import './vb-overlay-host';

const meta: Meta = {
  title: 'Overlay/VbMessageInput',
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <vb-overlay-host>
        <div style={{ padding: 24 }}>
          <Story />
        </div>
      </vb-overlay-host>
    ),
  ],
};

export default meta;

/** Default — textarea + mic (if supported) + send button */
export const Default: StoryObj = {
  render: () => <vb-message-input />,
};

/** Canvas mode — no send button. Used when anchored below the draw canvas. */
export const CanvasMode: StoryObj = {
  render: () => (
    <vb-message-input show-send="false" placeholder="add context about this element…" />
  ),
};

/** Custom placeholder */
export const CustomPlaceholder: StoryObj = {
  render: () => (
    <vb-message-input placeholder="describe what you want to change…" />
  ),
};

/**
 * Interactive — fires a `message-send` event.
 * Type a message and press Enter (or the send button) to see the event logged below.
 */
export const Interactive: StoryObj = {
  render: () => {
    const ref = useRef<HTMLElement>(null);
    const [log, setLog] = useState<string[]>([]);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const handler = (e: Event) => {
        const { text, usedVoice } = (e as CustomEvent).detail;
        setLog((prev) => [`"${text}"${usedVoice ? ' (voice)' : ''}`, ...prev].slice(0, 5));
      };
      el.addEventListener('message-send', handler);
      return () => el.removeEventListener('message-send', handler);
    }, []);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <vb-message-input ref={ref} />
        <div style={{ fontSize: 11, color: 'var(--ov-text-mid, #888)' }}>
          {log.length === 0
            ? 'Type a message and press Enter…'
            : log.map((entry, i) => <div key={i}>{i === 0 ? '→ ' : '   '}{entry}</div>)}
        </div>
      </div>
    );
  },
};

/** Side-by-side comparison of both modes */
export const BothModes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Standard (with send)
        </span>
        <vb-message-input />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Canvas mode (no send)
        </span>
        <vb-message-input show-send="false" placeholder="add context about this element…" />
      </div>
    </div>
  ),
};
