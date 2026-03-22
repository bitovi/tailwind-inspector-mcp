import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useRef } from 'react';
import '../../../../overlay/src/adaptive-iframe';

// ---------- Wrapper component for Storybook ----------
// Storybook needs a React component; this thin wrapper renders the Web Component.
function AdaptiveIframeWrapper({ srcdoc, src }: { srcdoc?: string; src?: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (srcdoc != null) ref.current.setAttribute('srcdoc', srcdoc);
    if (src != null) ref.current.setAttribute('src', src);
  }, [srcdoc, src]);

  // @ts-expect-error — custom element not in JSX.IntrinsicElements
  return <adaptive-iframe ref={ref} />;
}

const meta: Meta<typeof AdaptiveIframeWrapper> = {
  component: AdaptiveIframeWrapper,
  title: 'Panel/AdaptiveIframe',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};
export default meta;
type Story = StoryObj<typeof AdaptiveIframeWrapper>;

// ---------- srcdoc helpers ----------
// All srcdoc templates include a border-box reset to match real Storybook rendering.

const SRCDOC_RESET = '<style>*,*::before,*::after{box-sizing:border-box}body{line-height:1.5}button,input,optgroup,select,textarea{line-height:inherit;font:inherit}</style>';

const BLOCK_CARD = `
<html><head>${SRCDOC_RESET}</head><body style="margin:0;padding:0">
  <div style="
    display:block; width:240px; padding:16px;
    background:#3b82f6; color:white;
    border-radius:8px; font-family:system-ui;
    font-size:14px; box-shadow:0 2px 8px rgba(0,0,0,0.15);
  ">
    <strong>Card Title</strong>
    <p style="margin:8px 0 0; font-size:12px; opacity:0.85;">
      A block-level card component with padding, border-radius, and shadow.
    </p>
  </div>
</body></html>`;

const INLINE_BADGE = `
<html><head>${SRCDOC_RESET}</head><body style="margin:0;padding:0">
  <span style="
    display:inline; padding:2px 8px;
    background:#dbeafe; color:#1d4ed8;
    border-radius:9999px; font-family:system-ui;
    font-size:12px; font-weight:600;
  ">New</span>
</body></html>`;

const INLINE_BLOCK_BUTTON = `
<html><head>${SRCDOC_RESET}</head><body style="margin:0;padding:0">
  <button style="
    display:inline-block; padding:8px 16px;
    background:#10b981; color:white; border:none;
    border-radius:6px; font-family:system-ui;
    font-size:14px; font-weight:500; cursor:pointer;
  ">Click me</button>
</body></html>`;

const NESTED_CONTENT = `
<html><head>${SRCDOC_RESET}</head><body style="margin:0;padding:0">
  <div style="
    display:block; width:280px; padding:16px;
    background:white; border:1px solid #e5e7eb;
    border-radius:8px; font-family:system-ui;
  ">
    <h3 style="margin:0 0 8px; font-size:16px; color:#111827;">Heading</h3>
    <p style="margin:0 0 12px; font-size:13px; color:#6b7280;">
      Paragraph with <span style="color:#3b82f6; font-weight:600;">highlighted</span> text.
    </p>
    <div style="display:flex; gap:8px;">
      <span style="padding:2px 6px; background:#f3f4f6; border-radius:4px; font-size:11px; color:#374151;">Tag A</span>
      <span style="padding:2px 6px; background:#f3f4f6; border-radius:4px; font-size:11px; color:#374151;">Tag B</span>
    </div>
  </div>
</body></html>`;

const BLOCK_AUTO_WIDTH = `
<html><head>${SRCDOC_RESET}</head><body style="margin:0;padding:0">
  <div style="
    display:block; padding:16px;
    background:#8b5cf6; color:white;
    border-radius:8px; font-family:system-ui;
    font-size:14px;
  ">
    <strong>Auto-width Card</strong>
    <p style="margin:8px 0 0; font-size:12px; opacity:0.85;">
      A block element with no explicit width — should fill its container.
    </p>
  </div>
</body></html>`;

const FLEX_AUTO_WIDTH = `
<html><head>${SRCDOC_RESET}</head><body style="margin:0;padding:0">
  <div style="
    display:flex; gap:8px; padding:12px;
    background:#f59e0b; border-radius:8px;
    font-family:system-ui; font-size:13px;
  ">
    <span style="padding:4px 10px; background:white; border-radius:4px; color:#92400e;">One</span>
    <span style="padding:4px 10px; background:white; border-radius:4px; color:#92400e;">Two</span>
    <span style="padding:4px 10px; background:white; border-radius:4px; color:#92400e;">Three</span>
  </div>
</body></html>`;

// ---------- Inline reference renderers ----------
// These render the raw HTML inline so you can compare against the ghost.

function BlockCardInline() {
  return (
    <div style={{
      display: 'block', width: 240, padding: 16, boxSizing: 'border-box',
      background: '#3b82f6', color: 'white',
      borderRadius: 8, fontFamily: 'system-ui',
      fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    }}>
      <strong>Card Title</strong>
      <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.85 }}>
        A block-level card component with padding, border-radius, and shadow.
      </p>
    </div>
  );
}

function InlineBadgeInline() {
  return (
    <span style={{
      display: 'inline', padding: '2px 8px',
      background: '#dbeafe', color: '#1d4ed8',
      borderRadius: 9999, fontFamily: 'system-ui',
      fontSize: 12, fontWeight: 600,
    }}>New</span>
  );
}

function InlineBlockButtonInline() {
  return (
    <button style={{
      display: 'inline-block', padding: '8px 16px', boxSizing: 'border-box',
      background: '#10b981', color: 'white', border: 'none',
      borderRadius: 6, fontFamily: 'system-ui',
      fontSize: 14, fontWeight: 500, cursor: 'pointer',
    }}>Click me</button>
  );
}

function NestedContentInline() {
  return (
    <div style={{
      display: 'block', width: 280, padding: 16, boxSizing: 'border-box',
      background: 'white', border: '1px solid #e5e7eb',
      borderRadius: 8, fontFamily: 'system-ui',
    }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#111827' }}>Heading</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
        Paragraph with <span style={{ color: '#3b82f6', fontWeight: 600 }}>highlighted</span> text.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ padding: '2px 6px', background: '#f3f4f6', borderRadius: 4, fontSize: 11, color: '#374151' }}>Tag A</span>
        <span style={{ padding: '2px 6px', background: '#f3f4f6', borderRadius: 4, fontSize: 11, color: '#374151' }}>Tag B</span>
      </div>
    </div>
  );
}

function BlockAutoWidthInline() {
  return (
    <div style={{
      display: 'block', padding: 16, boxSizing: 'border-box',
      background: '#8b5cf6', color: 'white',
      borderRadius: 8, fontFamily: 'system-ui', fontSize: 14,
    }}>
      <strong>Auto-width Card</strong>
      <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.85 }}>
        A block element with no explicit width — should fill its container.
      </p>
    </div>
  );
}

function FlexAutoWidthInline() {
  return (
    <div style={{
      display: 'flex', gap: 8, padding: 12, boxSizing: 'border-box',
      background: '#f59e0b', borderRadius: 8,
      fontFamily: 'system-ui', fontSize: 13,
    }}>
      <span style={{ padding: '4px 10px', background: 'white', borderRadius: 4, color: '#92400e' }}>One</span>
      <span style={{ padding: '4px 10px', background: 'white', borderRadius: 4, color: '#92400e' }}>Two</span>
      <span style={{ padding: '4px 10px', background: 'white', borderRadius: 4, color: '#92400e' }}>Three</span>
    </div>
  );
}

const sectionStyle: React.CSSProperties = { marginBottom: 24 };
const labelStyle: React.CSSProperties = {
  fontFamily: 'system-ui', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  color: '#999', marginBottom: 6,
};

// ---------- Stories ----------

export const BlockElement: Story = {
  args: { srcdoc: BLOCK_CARD },
  decorators: [
    (Story) => (
      <div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Expected (inline React)</div>
          <BlockCardInline />
        </div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Ghost (adaptive-iframe)</div>
          <Story />
        </div>
      </div>
    ),
  ],
};

export const InlineElement: Story = {
  args: { srcdoc: INLINE_BADGE },
  decorators: [
    (Story) => (
      <div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Expected (inline React)</div>
          <p style={{ fontFamily: 'system-ui', fontSize: 14, color: '#333', margin: 0 }}>
            Text before <InlineBadgeInline /> text after
          </p>
        </div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Ghost (adaptive-iframe)</div>
          <p style={{ fontFamily: 'system-ui', fontSize: 14, color: '#333', margin: 0 }}>
            Text before <Story /> text after
          </p>
        </div>
      </div>
    ),
  ],
};

export const InlineBlockElement: Story = {
  args: { srcdoc: INLINE_BLOCK_BUTTON },
  decorators: [
    (Story) => (
      <div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Expected (inline React)</div>
          <InlineBlockButtonInline />
        </div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Ghost (adaptive-iframe)</div>
          <Story />
        </div>
      </div>
    ),
  ],
};

export const MultipleInFlex: Story = {
  args: { srcdoc: INLINE_BLOCK_BUTTON },
  decorators: [
    (Story) => (
      <div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Expected (inline React)</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <InlineBlockButtonInline />
            <InlineBlockButtonInline />
            <InlineBlockButtonInline />
          </div>
        </div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Ghost (adaptive-iframe)</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Story />
            <Story />
            <Story />
          </div>
        </div>
      </div>
    ),
  ],
};

export const NestedContent: Story = {
  args: { srcdoc: NESTED_CONTENT },
  decorators: [
    (Story) => (
      <div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Expected (inline React)</div>
          <NestedContentInline />
        </div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Ghost (adaptive-iframe)</div>
          <Story />
        </div>
      </div>
    ),
  ],
};

/** Block element with NO explicit width — should fill its container, not overflow. */
export const BlockAutoWidth: Story = {
  args: { srcdoc: BLOCK_AUTO_WIDTH },
  decorators: [
    (Story) => (
      <div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Expected (inline React)</div>
          <BlockAutoWidthInline />
        </div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Ghost (adaptive-iframe)</div>
          <Story />
        </div>
      </div>
    ),
  ],
};

/** Flex container with auto width — should fill its container. */
export const FlexAutoWidth: Story = {
  args: { srcdoc: FLEX_AUTO_WIDTH },
  decorators: [
    (Story) => (
      <div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Expected (inline React)</div>
          <FlexAutoWidthInline />
        </div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Ghost (adaptive-iframe)</div>
          <Story />
        </div>
      </div>
    ),
  ],
};

/** Block auto-width in a narrow container (300px) — tests that the iframe syncs to host width. */
export const BlockAutoWidthNarrow: Story = {
  args: { srcdoc: BLOCK_AUTO_WIDTH },
  decorators: [
    (Story) => (
      <div>
        <div style={{ ...sectionStyle, width: 300 }}>
          <div style={labelStyle}>Expected (inline React) — 300px container</div>
          <BlockAutoWidthInline />
        </div>
        <div style={{ ...sectionStyle, width: 300 }}>
          <div style={labelStyle}>Ghost (adaptive-iframe) — 300px container</div>
          <Story />
        </div>
      </div>
    ),
  ],
};
