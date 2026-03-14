import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { BoxModel } from './BoxModel';
import type { LayerState, LayerName, SlotKey, SlotData } from './types';

const meta: Meta<typeof BoxModel> = {
  component: BoxModel,
  title: 'Panel/BoxModel',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, fontFamily: "'Inter', sans-serif" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BoxModel>;

/* ─── Helper: build slot data ─────────────────────────────── */
function dirSlots(vals: Partial<Record<'y' | 't' | 'r' | 'b' | 'x' | 'l', string>>) {
  return (['y', 't', 'r', 'b', 'x', 'l'] as const).map(k => ({
    key: k,
    value: vals[k] ?? null,
    placeholder: k,
  }));
}

function borderSlots(vals: Partial<Record<'y' | 't' | 'r' | 'b' | 'x' | 'l' | 'color' | 'style', string>>) {
  return [
    ...dirSlots(vals),
    { key: 'color' as const, value: vals.color ?? null, placeholder: 'color' },
    { key: 'style' as const, value: vals.style ?? null, placeholder: 'style' },
  ];
}

function outlineSlots(vals: Partial<Record<'y' | 't' | 'r' | 'b' | 'x' | 'l' | 'color' | 'style' | 'offset', string>>) {
  return [
    ...dirSlots(vals),
    { key: 'color' as const, value: vals.color ?? null, placeholder: 'color' },
    { key: 'style' as const, value: vals.style ?? null, placeholder: 'style' },
    { key: 'offset' as const, value: vals.offset ?? null, placeholder: 'offset' },
  ];
}

/* ─── Reusable layer presets ──────────────────────────────── */
const EMPTY_MARGIN: LayerState   = { layer: 'margin',  classState: 'none', shorthandValue: null, slots: dirSlots({}) };
const EMPTY_OUTLINE: LayerState  = { layer: 'outline', classState: 'none', shorthandValue: null, slots: outlineSlots({}) };
const EMPTY_BORDER: LayerState   = { layer: 'border',  classState: 'none', shorthandValue: null, slots: borderSlots({}) };
const EMPTY_PADDING: LayerState  = { layer: 'padding', classState: 'none', shorthandValue: null, slots: dirSlots({}) };
const ALL_EMPTY = [EMPTY_MARGIN, EMPTY_OUTLINE, EMPTY_BORDER, EMPTY_PADDING];

/* ══════════════════════════════════════════════════════════
   Story 1 — No classes (Rule 1)
   ══════════════════════════════════════════════════════════ */
export const NoClasses: Story = {
  args: { layers: ALL_EMPTY },
};

/* ══════════════════════════════════════════════════════════
   Story 2 — Shorthand p-2 (Rule 2)
   ══════════════════════════════════════════════════════════ */
export const ShorthandPadding: Story = {
  args: {
    layers: [
      EMPTY_MARGIN,
      EMPTY_OUTLINE,
      EMPTY_BORDER,
      { layer: 'padding', classState: 'shorthand', shorthandValue: 'p-2', slots: dirSlots({}) },
    ],
  },
};

/* ══════════════════════════════════════════════════════════
   Story 3 — Axis px-2 py-4 (Rule 3)
   ══════════════════════════════════════════════════════════ */
export const AxisPadding: Story = {
  args: {
    layers: [
      EMPTY_MARGIN,
      EMPTY_OUTLINE,
      EMPTY_BORDER,
      {
        layer: 'padding',
        classState: 'axis',
        shorthandValue: null,
        slots: dirSlots({ x: 'px-2', y: 'py-4' }),
      },
    ],
  },
};

/* ══════════════════════════════════════════════════════════
   Story 4 — Individual sides pt-10 pr-20 pb-30 pl-40 (Rule 4)
   ══════════════════════════════════════════════════════════ */
export const IndividualPadding: Story = {
  args: {
    layers: [
      EMPTY_MARGIN,
      EMPTY_OUTLINE,
      EMPTY_BORDER,
      {
        layer: 'padding',
        classState: 'individual',
        shorthandValue: null,
        slots: dirSlots({ t: 'pt-10', r: 'pr-20', b: 'pb-30', l: 'pl-40' }),
      },
    ],
  },
};

/* ══════════════════════════════════════════════════════════
   Story 5 — Mixed p-2 pt-5 (Rule 5)
   ══════════════════════════════════════════════════════════ */
export const MixedPadding: Story = {
  args: {
    layers: [
      EMPTY_MARGIN,
      EMPTY_OUTLINE,
      EMPTY_BORDER,
      {
        layer: 'padding',
        classState: 'mixed',
        shorthandValue: 'p-2',
        slots: dirSlots({ t: 'pt-5' }),
      },
    ],
  },
};

/* ══════════════════════════════════════════════════════════
   Story 6 — Multiple layers populated
   ══════════════════════════════════════════════════════════ */
export const MultipleLayersPopulated: Story = {
  args: {
    layers: [
      { layer: 'margin', classState: 'shorthand', shorthandValue: 'm-4', slots: dirSlots({}) },
      { layer: 'outline', classState: 'none', shorthandValue: null, slots: outlineSlots({ offset: 'outline-offset-2' }) },
      {
        layer: 'border',
        classState: 'individual',
        shorthandValue: null,
        slots: borderSlots({ t: 'border-t-2', b: 'border-b-2', color: 'border-red-500', style: 'border-solid' }),
      },
      { layer: 'padding', classState: 'shorthand', shorthandValue: 'p-6', slots: dirSlots({}) },
    ],
  },
};

/* ══════════════════════════════════════════════════════════
   Story 7 — Frozen (scrubber active simulation)
   ══════════════════════════════════════════════════════════ */
export const Frozen: Story = {
  args: {
    layers: [
      EMPTY_MARGIN,
      EMPTY_OUTLINE,
      EMPTY_BORDER,
      { layer: 'padding', classState: 'shorthand', shorthandValue: 'p-2', slots: dirSlots({}) },
    ],
    frozen: true,
  },
};

/* ══════════════════════════════════════════════════════════
   Story 8 — Interactive (with state, demo hover-grow live)
   ══════════════════════════════════════════════════════════ */
function InteractiveBoxModel() {
  const [lastClick, setLastClick] = useState<string>('—');

  const layers: LayerState[] = [
    { layer: 'margin', classState: 'shorthand', shorthandValue: 'm-4', slots: dirSlots({}) },
    { layer: 'outline', classState: 'none', shorthandValue: null, slots: outlineSlots({}) },
    {
      layer: 'border',
      classState: 'individual',
      shorthandValue: null,
      slots: borderSlots({ t: 'border-t-2', color: 'border-blue-500' }),
    },
    {
      layer: 'padding',
      classState: 'mixed',
      shorthandValue: 'p-2',
      slots: dirSlots({ t: 'pt-5' }),
    },
  ];

  return (
    <div>
      <BoxModel
        layers={layers}
        onSlotClick={(layer: LayerName, slot: SlotKey | 'shorthand') =>
          setLastClick(`${layer} → ${slot}`)
        }
      />
      <div
        style={{
          marginTop: 12,
          fontFamily: "'Roboto Mono', monospace",
          fontSize: 11,
          color: '#687879',
        }}
      >
        Last click: <strong>{lastClick}</strong>
      </div>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveBoxModel />,
};

/* ══════════════════════════════════════════════════════════
   Story 9 — Inline Scrubbers
   Every slot is a MiniScrubber — drag to scrub, click to open dropdown.
   t/b/y slots scrub vertically (up = increase).
   ══════════════════════════════════════════════════════════ */

/** Spacing steps for Tailwind spacing scale */
const SPACING_STEPS = ['px', '0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40', '44', '48', '52', '56', '60', '64', '72', '80', '96'];

const BORDER_WIDTH_STEPS = ['0', '2', '4', '8'];

function buildScale(prefix: string, steps: string[]): string[] {
  return steps.map(s => `${prefix}-${s}`);
}

function getSlotPrefix(layer: LayerName, slotKey: SlotKey | 'shorthand'): string {
  const prefixes: Record<LayerName, Record<string, string>> = {
    margin:  { shorthand: 'm', t: 'mt', r: 'mr', b: 'mb', l: 'ml', x: 'mx', y: 'my' },
    padding: { shorthand: 'p', t: 'pt', r: 'pr', b: 'pb', l: 'pl', x: 'px', y: 'py' },
    border:  { shorthand: 'border', t: 'border-t', r: 'border-r', b: 'border-b', l: 'border-l', x: 'border-x', y: 'border-y', color: 'border', style: 'border' },
    outline: { shorthand: 'outline', t: 'outline-t', r: 'outline-r', b: 'outline-b', l: 'outline-l', x: 'outline-x', y: 'outline-y', color: 'outline', style: 'outline', offset: 'outline-offset' },
  };
  return prefixes[layer]?.[slotKey] ?? layer;
}

function getScaleSteps(layer: LayerName, slotKey: SlotKey | 'shorthand'): string[] {
  if (slotKey === 'color' || slotKey === 'style') return [];
  if (layer === 'border' || layer === 'outline') {
    if (slotKey === 'offset') return SPACING_STEPS;
    return BORDER_WIDTH_STEPS;
  }
  return SPACING_STEPS;
}

/** Attach scaleValues to each slot based on its layer + key */
function addScaleValues(layer: LayerName, slots: SlotData[]): SlotData[] {
  return slots.map(slot => {
    const steps = getScaleSteps(layer, slot.key);
    if (steps.length === 0) return slot;
    const prefix = getSlotPrefix(layer, slot.key);
    return { ...slot, scaleValues: buildScale(prefix, steps) };
  });
}

function WithScrubberDemo() {
  const SPACING = ['px', '0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40', '44', '48', '52', '56', '60', '64', '72', '80', '96'];
  const BORDER_WIDTHS = ['0', '2', '4', '8'];
  const shorthandScales: Record<LayerName, string[]> = {
    margin:  SPACING.map(s => `m-${s}`),
    padding: SPACING.map(s => `p-${s}`),
    border:  BORDER_WIDTHS.map(s => `border-${s}`),
    outline: SPACING.map(s => `outline-${s}`),
  };
  const [layers, setLayers] = useState<LayerState[]>([
    { layer: 'margin',  classState: 'none', shorthandValue: null, shorthandScaleValues: shorthandScales.margin,  slots: addScaleValues('margin',  dirSlots({})) },
    { layer: 'outline', classState: 'none', shorthandValue: null, shorthandScaleValues: shorthandScales.outline, slots: addScaleValues('outline', outlineSlots({})) },
    { layer: 'border',  classState: 'none', shorthandValue: null, shorthandScaleValues: shorthandScales.border,  slots: addScaleValues('border',  borderSlots({})) },
    { layer: 'padding', classState: 'none', shorthandValue: null, shorthandScaleValues: shorthandScales.padding, slots: addScaleValues('padding', dirSlots({})) },
  ]);
  const [lastChange, setLastChange] = useState<string>('—');

  function handleSlotChange(layer: LayerName, slotKey: SlotKey | 'shorthand', value: string) {
    setLastChange(`${layer} → ${slotKey}: ${value}`);
    setLayers(prev => prev.map(layerState => {
      if (layerState.layer !== layer) return layerState;

      if (slotKey === 'shorthand') {
        return {
          ...layerState,
          shorthandValue: value,
          classState: layerState.slots.some(s => s.value != null) ? 'mixed' as const : 'shorthand' as const,
        };
      }

      const newSlots = layerState.slots.map(s =>
        s.key === slotKey ? { ...s, value } : s
      );
      const hasShorthand = layerState.shorthandValue != null;
      const hasAxis = newSlots.some(s => (s.key === 'x' || s.key === 'y') && s.value != null);
      const hasSide = newSlots.some(s => (s.key === 't' || s.key === 'r' || s.key === 'b' || s.key === 'l') && s.value != null);
      const hasAny = hasAxis || hasSide;
      const classState = hasShorthand && hasAny ? 'mixed' as const
        : hasShorthand ? 'shorthand' as const
        : hasAxis && !hasSide ? 'axis' as const
        : hasAny ? 'individual' as const
        : 'none' as const;

      return { ...layerState, slots: newSlots, classState };
    }));
  }

  return (
    <div>
      <BoxModel
        layers={layers}
        onSlotChange={handleSlotChange}
      />
      <div style={{
        marginTop: 12,
        fontFamily: "'Roboto Mono', monospace",
        fontSize: 11,
        color: '#687879',
      }}>
        Last change: <strong>{lastChange}</strong>
      </div>
    </div>
  );
}

export const WithScrubber: Story = {
  render: () => <WithScrubberDemo />,
};
