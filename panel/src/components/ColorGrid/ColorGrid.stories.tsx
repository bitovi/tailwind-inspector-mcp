import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ColorGrid } from './ColorGrid';

const testColors = {
  black: '#000000',
  white: '#ffffff',
  transparent: 'transparent',
  red: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d' },
  blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
  green: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#145231' },
};

function InteractiveColorGrid() {
  const [current, setCurrent] = useState<string>('blue-500');
  const [locked, setLocked] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 p-4 min-w-[360px]">
      <ColorGrid
        prefix="bg-"
        currentValue={current}
        colors={testColors}
        locked={locked !== null}
        lockedValue={locked}
        onHover={(v) => setPreview(v)}
        onLeave={() => setPreview(null)}
        onClick={(v) => { setLocked(v); setPreview(null); }}
        onRemove={() => { setCurrent(''); setLocked(null); }}
        onRemoveHover={() => setPreview('')}
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

const meta: Meta<typeof ColorGrid> = {
  title: 'Panel/ColorGrid',
  component: ColorGrid,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ColorGrid>;

export const Default: Story = {
  render: () => <InteractiveColorGrid />,
};

export const BackgroundGradient: Story = {
  args: {
    prefix: 'from-',
    currentValue: 'red-500',
    colors: testColors,
    locked: false,
    lockedValue: null,
    onHover: () => {},
    onLeave: () => {},
    onClick: () => {},
  },
};

export const Locked: Story = {
  render: () => {
    const [locked] = useState<string>('bg-blue-500');
    const [preview] = useState<string | null>(null);

    return (
      <div className="flex flex-col gap-4 p-4 min-w-[360px]">
        <ColorGrid
          prefix="bg-"
          currentValue="bg-green-500"
          colors={testColors}
          locked={true}
          lockedValue={locked}
          onHover={() => {}}
          onLeave={() => {}}
          onClick={() => {}}
        />
        <div className="text-[12px] text-bit-text-mid">
          Locked to: <span className="font-mono text-bit-text">{locked}</span>
        </div>
      </div>
    );
  },
};

export const WithRemoveButton: Story = {
  render: () => {
    const [current, setCurrent] = useState<string>('blue-500');
    const [locked, setLocked] = useState<string | null>(null);

    return (
      <div className="flex flex-col gap-4 p-4 min-w-[360px]">
        <ColorGrid
          prefix="bg-"
          currentValue={current}
          colors={testColors}
          locked={locked !== null}
          lockedValue={locked}
          onHover={() => {}}
          onLeave={() => {}}
          onClick={(v) => setLocked(v)}
          onRemove={() => { setCurrent(''); setLocked(null); }}
          onRemoveHover={() => {}}
        />
        <button
          className="w-fit px-2 py-0.5 text-[11px] rounded bg-bit-orange text-white cursor-pointer font-sans"
          onClick={() => { setCurrent('blue-500'); setLocked(null); }}
        >
          Reset
        </button>
      </div>
    );
  },
};
