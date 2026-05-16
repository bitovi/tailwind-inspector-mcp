import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { DirectionPicker } from './DirectionPicker';
import type { GradientDirection, BackgroundMode } from './types';

function InteractiveDirectionPicker() {
  const [direction, setDirection] = useState<GradientDirection>('r');
  const [mode, setMode] = useState<BackgroundMode>('gradient');
  const [preview, setPreview] = useState<GradientDirection | null>(null);

  return (
    <div className="flex items-start gap-6 p-6 bg-bit-bg">
      <DirectionPicker
        direction={direction}
        mode={mode}
        onHover={(dir) => setPreview(dir)}
        onLeave={() => setPreview(null)}
        onDirectionClick={(dir) => { setDirection(dir); setMode('gradient'); setPreview(null); }}
        onSolidClick={() => setMode('solid')}
      />
      <div className="text-[11px] font-mono text-bit-text-mid space-y-1">
        <div>mode: <span className="text-bit-teal font-bold">{mode}</span></div>
        <div>direction: <span className="text-bit-teal font-bold">{direction}</span></div>
        {preview && <div>preview: <span className="text-bit-orange font-bold">{preview}</span></div>}
      </div>
    </div>
  );
}

const meta: Meta<typeof DirectionPicker> = {
  component: DirectionPicker,
  title: 'Panel/DirectionPicker',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DirectionPicker>;

export const Default: Story = {
  render: () => <InteractiveDirectionPicker />,
};

export const GradientRight: Story = {
  args: {
    direction: 'r',
    mode: 'gradient',
    onHover: () => {},
    onLeave: () => {},
    onDirectionClick: () => {},
    onSolidClick: () => {},
  },
};

export const GradientDiagonal: Story = {
  args: {
    direction: 'br',
    mode: 'gradient',
    onHover: () => {},
    onLeave: () => {},
    onDirectionClick: () => {},
    onSolidClick: () => {},
  },
};

export const SolidMode: Story = {
  args: {
    direction: 'r',
    mode: 'solid',
    onHover: () => {},
    onLeave: () => {},
    onDirectionClick: () => {},
    onSolidClick: () => {},
  },
};

export const SolidModeWithColor: Story = {
  args: {
    direction: 'r',
    mode: 'solid',
    solidColorName: 'blue-500',
    onHover: () => {},
    onLeave: () => {},
    onDirectionClick: () => {},
    onSolidClick: () => {},
  },
};

export const GradientTopLeft: Story = {
  args: {
    direction: 'tl',
    mode: 'gradient',
    onHover: () => {},
    onLeave: () => {},
    onDirectionClick: () => {},
    onSolidClick: () => {},
  },
};

export const GradientBottomRight: Story = {
  args: {
    direction: 'br',
    mode: 'gradient',
    onHover: () => {},
    onLeave: () => {},
    onDirectionClick: () => {},
    onSolidClick: () => {},
  },
};

export const GradientDown: Story = {
  args: {
    direction: 'b',
    mode: 'gradient',
    onHover: () => {},
    onLeave: () => {},
    onDirectionClick: () => {},
    onSolidClick: () => {},
  },
};

export const Interactive: Story = {
  render: () => {
    const [direction, setDirection] = useState<GradientDirection>('r');
    const [mode, setMode] = useState<BackgroundMode>('gradient');
    const [preview, setPreview] = useState<GradientDirection | null>(null);

    return (
      <div className="flex flex-col items-center gap-6 p-6 bg-bit-bg min-h-screen">
        <DirectionPicker
          direction={direction}
          mode={mode}
          onHover={(dir) => setPreview(dir)}
          onLeave={() => setPreview(null)}
          onDirectionClick={(dir) => { setDirection(dir); setMode('gradient'); setPreview(null); }}
          onSolidClick={() => { setMode('solid'); setPreview(null); }}
        />
        <div className="text-[11px] font-mono text-bit-text-mid space-y-1 bg-bit-surface p-3 rounded">
          <div>mode: <span className="text-bit-teal font-bold">{mode}</span></div>
          <div>direction: <span className="text-bit-teal font-bold">{direction}</span></div>
          {preview && <div>preview: <span className="text-bit-orange font-bold">{preview}</span></div>}
        </div>
      </div>
    );
  },
};
