import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useRef } from 'react';

// Side-effect imports: register custom elements
import './vb-overlay-host';
import './vb-element-drawer';

const meta: Meta = {
  title: 'Overlay/VbElementDrawer',
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <vb-overlay-host>
        <div style={{ padding: 32 }}>
          <Story />
        </div>
      </vb-overlay-host>
    ),
  ],
};

export default meta;

/* ── Helpers ───────────────────────────────────────────────────────── */

function DrawerWithEvents({
  mode,
  state,
}: {
  mode?: 'select' | 'insert';
  state?: 'menu' | 'describe';
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const log = (name: string) => (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log(`[${name}]`, detail ?? '');
    };

    const handlers = [
      ['describe-click', log('describe-click')],
      ['text-click', log('text-click')],
      ['back', log('back')],
      ['queue', log('queue')],
      ['commit', log('commit')],
    ] as const;

    for (const [evt, handler] of handlers) {
      el.addEventListener(evt, handler);
    }
    return () => {
      for (const [evt, handler] of handlers) {
        el.removeEventListener(evt, handler);
      }
    };
  }, []);

  return <vb-element-drawer ref={ref} mode={mode} state={state} />;
}

/* ── Stories ────────────────────────────────────────────────────────── */

/** State A — Default two-button menu: Describe change + Edit text */
export const Menu: StoryObj = {
  render: () => <DrawerWithEvents />,
};

/** State A — Insert mode: Describe change + Insert text */
export const MenuInsertMode: StoryObj = {
  name: 'Menu (Insert Mode)',
  render: () => <DrawerWithEvents mode="insert" />,
};

/** State B — Describe change textarea form */
export const DescribeChange: StoryObj = {
  name: 'Describe Change',
  render: () => <DrawerWithEvents state="describe" />,
};

/** Both states side-by-side */
export const AllStates: StoryObj = {
  name: 'All States',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>
          State A — Menu (Select)
        </div>
        <DrawerWithEvents />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>
          State A — Menu (Insert)
        </div>
        <DrawerWithEvents mode="insert" />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>
          State B — Describe Change
        </div>
        <DrawerWithEvents state="describe" />
      </div>
    </div>
  ),
};
