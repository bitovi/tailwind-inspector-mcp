import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ScaleRow } from './ScaleRow';

const tailwindConfig = {
  spacing: {
    '0': '0',
    'px': '1px',
    '0.5': '0.125rem',
    '1': '0.25rem',
    '1.5': '0.375rem',
    '2': '0.5rem',
    '2.5': '0.625rem',
    '3': '0.75rem',
    '3.5': '0.875rem',
    '4': '1rem',
    '5': '1.25rem',
    '6': '1.5rem',
    '7': '1.75rem',
    '8': '2rem',
    '9': '2.25rem',
    '10': '2.5rem',
    '11': '2.75rem',
    '12': '3rem',
  },
};

function InteractiveScaleRow() {
  const [current, setCurrent] = useState<string>('px-4');
  const [locked, setLocked] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 p-4 min-w-[360px]">
      <ScaleRow
        prefix="px-"
        scaleName="spacing"
        currentClass={current}
        tailwindConfig={tailwindConfig}
        locked={locked !== null}
        lockedValue={locked}
        onHover={(v) => setPreview(v)}
        onLeave={() => setPreview(null)}
        onClick={(v) => { setLocked(v); setPreview(null); }}
      />
      <div className="text-[12px] text-bit-text-mid space-y-1">
        <div>Current: <span className="font-mono text-bit-text">{current}</span></div>
        <div>Locked: <span className="font-mono text-bit-text">{locked || 'none'}</span></div>
        <div>Preview: <span className="font-mono text-bit-text">{preview || 'none'}</span></div>
      </div>
      {locked && (
        <button
          className="px-2 py-0.5 text-[11px] rounded bg-bit-teal text-white cursor-pointer font-sans"
          onClick={() => { setCurrent(locked); setLocked(null); }}
        >
          Commit Change
        </button>
      )}
    </div>
  );
}

const meta: Meta<typeof ScaleRow> = {
  title: 'Components/ScaleRow',
  component: ScaleRow,
};

export default meta;
type Story = StoryObj<typeof ScaleRow>;

export const Default: Story = {
  render: () => <InteractiveScaleRow />,
};
