import type { Meta, StoryObj } from '@storybook/react';

// Side-effect imports: register custom elements
import './vb-button';
import './vb-button-group';
import './vb-overlay-host';

const meta: Meta = {
  title: 'Overlay/VbButtonGroup',
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <vb-overlay-host>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 24 }}>
          <Story />
        </div>
      </vb-overlay-host>
    ),
  ],
};

export default meta;

/* ── Helpers ───────────────────────────────────────────────────────── */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {children}
      </div>
    </div>
  );
}

/* ── Stories ────────────────────────────────────────────────────────── */

/** Button group with a child button, no count badge */
export const Default: StoryObj = {
  render: () => (
    <vb-button-group>
      <vb-button icon="select" theme="neutral">Select</vb-button>
    </vb-button-group>
  ),
};

/** Button group with count=3 — badge visible */
export const WithCount: StoryObj = {
  render: () => (
    <vb-button-group count={3}>
      <vb-button icon="select" theme="mode" state="active">Select</vb-button>
    </vb-button-group>
  ),
};

/** Button group with a high count */
export const HighCount: StoryObj = {
  render: () => (
    <vb-button-group count={12}>
      <vb-button icon="select" theme="mode" state="active">Select</vb-button>
    </vb-button-group>
  ),
};

/** Button groups across all themes */
export const ThemeVariants: StoryObj = {
  render: () => (
    <>
      <Row label="Neutral">
        <vb-button-group count={2}>
          <vb-button icon="select" theme="neutral">Select</vb-button>
        </vb-button-group>
      </Row>
      <Row label="Primary">
        <vb-button-group count={5}>
          <vb-button icon="select" theme="primary">Select</vb-button>
        </vb-button-group>
      </Row>
      <Row label="Mode">
        <vb-button-group count={3}>
          <vb-button icon="select" theme="mode">Select</vb-button>
        </vb-button-group>
      </Row>
      <Row label="Danger">
        <vb-button-group count={1}>
          <vb-button icon="select" theme="danger">Select</vb-button>
        </vb-button-group>
      </Row>
    </>
  ),
};

/** Button groups across all states */
export const StateVariants: StoryObj = {
  render: () => (
    <>
      <Row label="Default">
        <vb-button-group count={3}>
          <vb-button icon="select" theme="mode" state="default">Select</vb-button>
        </vb-button-group>
      </Row>
      <Row label="Armed">
        <vb-button-group count={3}>
          <vb-button icon="select" theme="mode" state="armed">Select</vb-button>
        </vb-button-group>
      </Row>
      <Row label="Active">
        <vb-button-group count={3}>
          <vb-button icon="select" theme="mode" state="active">Select</vb-button>
        </vb-button-group>
      </Row>
      <Row label="Fulfilled">
        <vb-button-group count={3}>
          <vb-button icon="select" theme="mode" state="fulfilled">Select</vb-button>
        </vb-button-group>
      </Row>
    </>
  ),
};
