import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { GapModel } from './GapModel';
import type { GapSlotData } from './types';

// ── Scale values ────────────────────────────────────────────────
const GAP_SCALE = [
  'gap-0', 'gap-px', 'gap-0.5',
  'gap-1', 'gap-1.5', 'gap-2', 'gap-2.5', 'gap-3', 'gap-3.5',
  'gap-4', 'gap-5', 'gap-6', 'gap-7', 'gap-8', 'gap-9', 'gap-10',
  'gap-11', 'gap-12', 'gap-14', 'gap-16', 'gap-20', 'gap-24',
  'gap-28', 'gap-32', 'gap-36', 'gap-40', 'gap-44', 'gap-48',
  'gap-52', 'gap-56', 'gap-60', 'gap-64', 'gap-72', 'gap-80', 'gap-96',
];

const GAP_X_SCALE = GAP_SCALE.map(v => v.replace('gap-', 'gap-x-'));
const GAP_Y_SCALE = GAP_SCALE.map(v => v.replace('gap-', 'gap-y-'));

function makeSlots(overrides: {
  gap?:  string | null;
  gapX?: string | null;
  gapY?: string | null;
} = {}): GapSlotData[] {
  return [
    { key: 'gap',   value: overrides.gap  ?? null, scaleValues: GAP_SCALE },
    { key: 'gap-x', value: overrides.gapX ?? null, scaleValues: GAP_X_SCALE },
    { key: 'gap-y', value: overrides.gapY ?? null, scaleValues: GAP_Y_SCALE },
  ];
}

// ── Controlled wrapper for interactive stories ───────────────────
function ControlledGapModel(props: {
  initialMode?: GapMode;
  initialGap?: string | null;
  initialGapX?: string | null;
  initialGapY?: string | null;
}) {
  const [mode, setMode] = useState<GapMode>(props.initialMode ?? 'split');
  const [gap, setGap]   = useState<string | null>(props.initialGap  ?? null);
  const [gapX, setGapX] = useState<string | null>(props.initialGapX ?? null);
  const [gapY, setGapY] = useState<string | null>(props.initialGapY ?? null);

  const slots = makeSlots({ gap, gapX, gapY });

  return (
    <GapModel
      mode={mode}
      slots={slots}
      onModeChange={setMode}
      onSlotChange={(slot, v) => {
        if (slot === 'gap')   setGap(v);
        if (slot === 'gap-x') setGapX(v);
        if (slot === 'gap-y') setGapY(v);
      }}
      onSlotRemove={(slot) => {
        if (slot === 'gap')   setGap(null);
        if (slot === 'gap-x') setGapX(null);
        if (slot === 'gap-y') setGapY(null);
      }}
    />
  );
}

const meta: Meta<typeof GapModel> = {
  component: GapModel,
  title: 'Panel/GapModel',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: 24, background: '#2c2c2c', display: 'inline-block', borderRadius: 8 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GapModel>;

/** No gap applied */
export const Empty: Story = {
  args: {
    slots: makeSlots(),
  },
};

/** gap-x-2, gap-y-6 set independently */
export const SplitValues: Story = {
  args: {
    slots: makeSlots({ gapX: 'gap-x-2', gapY: 'gap-y-6' }),
  },
};

/** Shorthand gap-4 set */
export const ShorthandValue: Story = {
  args: {
    slots: makeSlots({ gap: 'gap-4' }),
  },
};

/** Both shorthand and per-axis values set */
export const AllValues: Story = {
  args: {
    slots: makeSlots({ gap: 'gap-3', gapX: 'gap-x-2', gapY: 'gap-y-6' }),
  },
};

/** Larger value — tests text sizing */
export const LargeValue: Story = {
  args: {
    slots: makeSlots({ gap: 'gap-20' }),
  },
};

/** Fully interactive */
export const Interactive: Story = {
  render: () => (
    <ControlledGapModel
      initialGapX="gap-x-2"
      initialGapY="gap-y-6"
    />
  ),
};

/** Interactive with shorthand */
export const InteractiveShorthand: Story = {
  render: () => (
    <ControlledGapModel
      initialGap="gap-4"
    />
  ),
};
