import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ModeToggle } from './ModeToggle';

const meta: Meta<typeof ModeToggle> = {
  component: ModeToggle,
  title: 'Panel/ModeToggle',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ModeToggle>;

export const SelectMode: Story = {
  args: {
    mode: 'select',
  },
};

export const InsertMode: Story = {
  args: {
    mode: 'insert',
  },
};

export const BugReportMode: Story = {
  args: {
    mode: 'bug-report',
  },
};

export const NoMode: Story = {
  args: {
    mode: null,
  },
};

export const EditModeActive: Story = {
  args: {
    mode: 'select',
    isEditMode: true,
  },
};

export const EditModeInactive: Story = {
  args: {
    mode: 'bug-report',
    isEditMode: false,
  },
};

export const WithEngaged: Story = {
  args: {
    mode: 'select',
    isEngaged: true,
  },
};

export const WithPicking: Story = {
  args: {
    mode: 'select',
    isPicking: true,
  },
};

export const AllFlags: Story = {
  args: {
    mode: 'insert',
    isEditMode: true,
    isEngaged: true,
    isPicking: false,
  },
};

export const Interactive: Story = {
  render: () => {
    const [mode, setMode] = useState<any>('select');
    const [isEngaged, setIsEngaged] = useState(false);
    const [isPicking, setIsPicking] = useState(false);

    return (
      <div className="flex flex-col items-center gap-6 p-6 bg-bit-bg min-h-screen">
        <div>
          <ModeToggle
            mode={mode}
            onModeChange={setMode}
            isEngaged={isEngaged}
            isPicking={isPicking}
            isEditMode={mode !== 'bug-report' && mode !== 'theme'}
          />
        </div>
        <div className="text-[11px] font-mono text-bit-text-mid space-y-1 bg-bit-surface p-3 rounded">
          <div>mode: <span className="text-bit-teal font-bold">{mode}</span></div>
          <div>isEngaged: <span className="text-bit-teal">{String(isEngaged)}</span></div>
          <div>isPicking: <span className="text-bit-teal">{String(isPicking)}</span></div>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-[10px] rounded bg-bit-teal text-white cursor-pointer font-sans"
            onClick={() => setIsEngaged(!isEngaged)}
          >
            Toggle Engaged
          </button>
          <button
            className="px-3 py-1.5 text-[10px] rounded bg-bit-teal text-white cursor-pointer font-sans"
            onClick={() => setIsPicking(!isPicking)}
          >
            Toggle Picking
          </button>
        </div>
      </div>
    );
  },
};
