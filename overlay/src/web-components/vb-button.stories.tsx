import type { Meta, StoryObj } from '@storybook/react';

// Side-effect import: register custom elements
import './vb-button';
import './vb-button-group';
import './vb-overlay-host';

type Structure = 'ghost' | 'filled';
type Size = 'sm' | 'md';
type Theme = 'neutral' | 'primary' | 'danger' | 'mode';
type State = 'default' | 'armed' | 'active' | 'fulfilled' | 'disabled';

const meta: Meta = {
  title: 'Overlay/VbButton',
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

function Btn(props: {
  structure?: Structure;
  size?: Size;
  theme?: Theme;
  state?: State;
  icon?: string;
  children?: string;
}) {
  return (
    <vb-button
      structure={props.structure}
      size={props.size}
      theme={props.theme}
      state={props.state}
      icon={props.icon}
    >
      {props.children}
    </vb-button>
  );
}

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

/** All content compositions side-by-side */
export const ContentCompositions: StoryObj = {
  render: () => (
    <>
      <Row label="Icon + Text">
        <Btn icon="select" theme="neutral">Select</Btn>
        <Btn icon="insert" theme="neutral">Insert</Btn>
        <Btn icon="pencil" theme="primary" structure="filled">Describe</Btn>
      </Row>
      <Row label="Icon Only">
        <Btn icon="mic" size="sm" theme="neutral" />
        <Btn icon="select" theme="neutral" />
        <Btn icon="grip" theme="neutral" />
      </Row>
      <Row label="Text Only">
        <Btn theme="primary" structure="filled">Queue</Btn>
        <Btn theme="danger" structure="filled">Commit</Btn>
        <Btn theme="danger" structure="ghost">Discard</Btn>
      </Row>
    </>
  ),
};

/** Ghost structure — all themes */
export const Ghost: StoryObj = {
  render: () => (
    <>
      <Row label="Neutral">
        <Btn icon="select" structure="ghost" theme="neutral">Select</Btn>
      </Row>
      <Row label="Primary">
        <Btn icon="select" structure="ghost" theme="primary">Select</Btn>
      </Row>
      <Row label="Danger">
        <Btn structure="ghost" theme="danger">Discard</Btn>
      </Row>
      <Row label="Mode">
        <Btn icon="select" structure="ghost" theme="mode">Select</Btn>
      </Row>
    </>
  ),
};

/** Filled structure — primary + danger */
export const Filled: StoryObj = {
  render: () => (
    <>
      <Row label="Primary filled">
        <Btn structure="filled" theme="primary">Queue</Btn>
        <Btn icon="pencil" structure="filled" theme="primary">Describe change</Btn>
      </Row>
      <Row label="Danger filled">
        <Btn structure="filled" theme="danger">Commit</Btn>
      </Row>
    </>
  ),
};

/** Size comparison */
export const Sizes: StoryObj = {
  render: () => (
    <>
      <Row label="MD (28px)">
        <Btn icon="select" size="md" theme="neutral">Select</Btn>
        <Btn icon="select" size="md" theme="neutral" />
        <Btn size="md" theme="primary" structure="filled">Queue</Btn>
      </Row>
      <Row label="SM (22px)">
        <Btn icon="mic" size="sm" theme="neutral" />
        <Btn icon="select" size="sm" theme="neutral" />
        <Btn size="sm" theme="primary" structure="filled">Queue</Btn>
      </Row>
    </>
  ),
};

/** Mode theme — all states */
export const ModeStates: StoryObj = {
  name: 'Theme: Mode (all states)',
  render: () => (
    <>
      <Row label="Default">
        <Btn icon="select" theme="mode">Select</Btn>
        <Btn icon="insert" theme="mode">Insert</Btn>
      </Row>
      <Row label="Armed (orange)">
        <Btn icon="select" theme="mode" state="armed">Select</Btn>
        <Btn icon="insert" theme="mode" state="armed">Insert</Btn>
      </Row>
      <Row label="Active (teal ring)">
        <Btn icon="select" theme="mode" state="active">Select</Btn>
        <Btn icon="insert" theme="mode" state="active">Insert</Btn>
      </Row>
      <Row label="Fulfilled (green)">
        <Btn icon="select" theme="mode" state="fulfilled">Select</Btn>
        <Btn icon="insert" theme="mode" state="fulfilled">Insert</Btn>
      </Row>
      <Row label="Disabled (dim)">
        <Btn icon="select" theme="mode" state="disabled">Select</Btn>
        <Btn icon="insert" theme="mode" state="disabled">Insert</Btn>
      </Row>
    </>
  ),
};

/** Primary theme — all states */
export const PrimaryStates: StoryObj = {
  name: 'Theme: Primary (all states)',
  render: () => (
    <>
      <Row label="Default ghost">
        <Btn icon="pencil" theme="primary" structure="ghost">Describe</Btn>
      </Row>
      <Row label="Default filled">
        <Btn theme="primary" structure="filled">Queue</Btn>
      </Row>
      <Row label="Armed">
        <Btn theme="primary" structure="filled" state="armed">Queue</Btn>
      </Row>
      <Row label="Disabled">
        <Btn theme="primary" structure="filled" state="disabled">Queue</Btn>
      </Row>
    </>
  ),
};

/** Danger theme — all states */
export const DangerStates: StoryObj = {
  name: 'Theme: Danger (all states)',
  render: () => (
    <>
      <Row label="Ghost default">
        <Btn theme="danger" structure="ghost">Discard</Btn>
      </Row>
      <Row label="Filled default">
        <Btn theme="danger" structure="filled">Commit</Btn>
      </Row>
      <Row label="Armed (mic pulse)">
        <Btn icon="mic" size="sm" theme="danger" state="armed" />
      </Row>
      <Row label="Disabled">
        <Btn theme="danger" structure="filled" state="disabled">Commit</Btn>
      </Row>
    </>
  ),
};

/** Mapping to existing buttons — visual comparison reference */
export const ButtonInventory: StoryObj = {
  name: 'Full Inventory',
  render: () => {
    const STATES = ['default', 'armed', 'active', 'fulfilled', 'disabled'] as const;

    const cellStyle: React.CSSProperties = {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 6, padding: '8px 4px', minHeight: 36,
    };
    const headerStyle: React.CSSProperties = {
      fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase',
      letterSpacing: '0.6px', textAlign: 'center', padding: '4px 4px 8px',
    };
    const rowLabelStyle: React.CSSProperties = {
      fontSize: 10, fontWeight: 600, color: '#888', textAlign: 'right',
      padding: '8px 8px 8px 0', whiteSpace: 'nowrap',
    };
    const gridStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: '130px repeat(5, 1fr)',
      gap: 0,
      width: '100%',
    };
    const sepStyle: React.CSSProperties = {
      gridColumn: '1 / -1', height: 1,
      background: 'rgba(255,255,255,0.06)', margin: '2px 0',
    };
    const STATE_DESCRIPTIONS: Record<string, string> = {
      default:   'Idle — no interaction',
      armed:     'Pressed — behavior is ongoing (e.g. crosshair active)',
      active:    'Task done — target locked (e.g. element selected)',
      fulfilled: 'Task done + doing something related — button should not be re-clicked',
      disabled:  'Cannot interact',
    };

    type RowDef = {
      label: string;
      structure?: Structure;
      size?: Size;
      theme: Theme;
      icon: string;
      text: string;
    };

    const rows: RowDef[] = [
      { label: 'mode / ghost',       theme: 'mode',    icon: 'select', text: 'Select', structure: 'ghost' },
      { label: 'primary / filled',   theme: 'primary', icon: 'pencil', text: 'Queue',  structure: 'filled' },
      { label: 'primary / ghost',    theme: 'primary', icon: 'select', text: 'Select', structure: 'ghost' },
      { label: 'danger / filled',    theme: 'danger',  icon: 'mic',    text: 'Commit', structure: 'filled' },
      { label: 'danger / ghost',     theme: 'danger',  icon: 'select', text: 'Discard',structure: 'ghost' },
      { label: 'neutral / ghost',    theme: 'neutral', icon: 'select', text: 'Select', structure: 'ghost' },
      { label: 'neutral / ghost sm', theme: 'neutral', icon: 'mic',    text: 'Back',   structure: 'ghost', size: 'sm' },
    ];

    return (
      <div style={gridStyle}>
        {/* Header row */}
        <div />
        {STATES.map(s => (
          <div key={s} style={{ ...headerStyle, display: 'flex', flexDirection: 'column', gap: 3, padding: '4px 4px 8px' }}>
            <span>{s}</span>
            <span style={{ fontSize: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#555', lineHeight: 1.3 }}>
              {STATE_DESCRIPTIONS[s]}
            </span>
          </div>
        ))}

        {rows.map((row, i) => (
          <div key={i} style={{ display: 'contents' }}>
            {i > 0 && <div style={sepStyle} />}
            <div style={rowLabelStyle}>{row.label}</div>
            {STATES.map(state => (
              <div key={state} style={cellStyle}>
                <Btn icon={row.icon} structure={row.structure} size={row.size} theme={row.theme} state={state as State}>{row.text}</Btn>
                <Btn icon={row.icon} structure={row.structure} size={row.size} theme={row.theme} state={state as State} />
                <Btn structure={row.structure} size={row.size} theme={row.theme} state={state as State}>{row.text}</Btn>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  },
};

/* ── Button Group stories ──────────────────────────────────────────── */

/** Button group — mode theme across all states */
export const ButtonGroup: StoryObj = {
  name: 'Button Group',
  render: () => (
    <>
      <Row label="Default (no count)">
        <vb-button-group>
          <Btn icon="select" theme="mode">Select</Btn>
        </vb-button-group>
      </Row>
      <Row label="With count">
        <vb-button-group count={3}>
          <Btn icon="select" theme="mode">Select</Btn>
        </vb-button-group>
      </Row>
      <Row label="Armed + count">
        <vb-button-group count={2}>
          <Btn icon="select" theme="mode" state="armed">Select</Btn>
        </vb-button-group>
      </Row>
      <Row label="Active + count">
        <vb-button-group count={5}>
          <Btn icon="select" theme="mode" state="active">Select</Btn>
        </vb-button-group>
      </Row>
      <Row label="Fulfilled + count">
        <vb-button-group count={1}>
          <Btn icon="select" theme="mode" state="fulfilled">Select</Btn>
        </vb-button-group>
      </Row>
      <Row label="Disabled + count">
        <vb-button-group count={3}>
          <Btn icon="select" theme="mode" state="disabled">Select</Btn>
        </vb-button-group>
      </Row>
    </>
  ),
};
