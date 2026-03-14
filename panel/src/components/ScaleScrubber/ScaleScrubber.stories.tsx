import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ScaleScrubber } from './ScaleScrubber';

const SPACING_VALUES = [
  'px-px', 'px-0', 'px-0.5', 'px-1', 'px-1.5', 'px-2', 'px-2.5', 'px-3', 'px-3.5',
  'px-4', 'px-5', 'px-6', 'px-7', 'px-8', 'px-9', 'px-10', 'px-11', 'px-12',
  'px-14', 'px-16', 'px-20', 'px-24', 'px-28', 'px-32', 'px-36', 'px-40',
  'px-44', 'px-48', 'px-52', 'px-56', 'px-60', 'px-64', 'px-72', 'px-80', 'px-96',
];

const FONT_SIZE_VALUES = [
  'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl',
  'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl',
];

const BORDER_RADIUS_VALUES = [
  'rounded-none', 'rounded-sm', 'rounded', 'rounded-md',
  'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full',
];

function InteractiveScrubber({ initialValue, values }: { initialValue: string; values: string[] }) {
  const [current, setCurrent] = useState(initialValue);
  const [staged, setStaged] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3 p-4 min-w-[360px]">
      <ScaleScrubber
        values={values}
        currentValue={current}
        lockedValue={staged}
        locked={staged !== null}
        onHover={(v) => setPreview(v)}
        onLeave={() => setPreview(null)}
        onClick={(v) => { setStaged(v); setPreview(null); }}
      />
      {staged && (
        <>
          <button
            className="px-2 py-0.5 text-[11px] rounded bg-bv-teal text-white cursor-pointer font-sans"
            onClick={() => { setCurrent(staged); setStaged(null); }}
          >
            Queue Change
          </button>
          <button
            className="px-2 py-0.5 text-[11px] rounded border border-bv-border text-bv-text-mid cursor-pointer font-sans"
            onClick={() => setStaged(null)}
          >
            Discard
          </button>
        </>
      )}
      <span className="text-[10px] text-bv-muted font-mono ml-auto">
        {preview ?? staged ?? current}
      </span>
    </div>
  );
}

function MultiScrubberDemo() {
  return (
    <div className="p-4 flex flex-col gap-1 bg-bv-bg min-w-[300px]">
      <div className="text-[9px] uppercase tracking-widest text-bv-text-mid font-semibold mb-1">
        Spacing
      </div>
      <div className="flex flex-wrap gap-1">
        <InteractiveScrubber initialValue="px-4" values={SPACING_VALUES} />
        <InteractiveScrubber initialValue="px-2" values={SPACING_VALUES.map(v => v.replace('px-', 'py-'))} />
      </div>
      <div className="text-[9px] uppercase tracking-widest text-bv-text-mid font-semibold mt-3 mb-1">
        Typography
      </div>
      <InteractiveScrubber initialValue="text-base" values={FONT_SIZE_VALUES} />
      <div className="text-[9px] uppercase tracking-widest text-bv-text-mid font-semibold mt-3 mb-1">
        Borders
      </div>
      <InteractiveScrubber initialValue="rounded-md" values={BORDER_RADIUS_VALUES} />
    </div>
  );
}

const meta: Meta<typeof ScaleScrubber> = {
  component: ScaleScrubber,
  title: 'Panel/ScaleScrubber',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ScaleScrubber>;

export const Spacing: Story = {
  render: () => <InteractiveScrubber initialValue="px-4" values={SPACING_VALUES} />,
};

export const FontSize: Story = {
  render: () => <InteractiveScrubber initialValue="text-base" values={FONT_SIZE_VALUES} />,
};

export const Staged: Story = {
  args: {
    values: SPACING_VALUES,
    currentValue: 'px-4',
    lockedValue: 'px-8',
    locked: true,
    onHover: () => {},
    onLeave: () => {},
    onClick: () => {},
  },
};

export const MultipleProperties: Story = {
  render: () => <MultiScrubberDemo />,
};
