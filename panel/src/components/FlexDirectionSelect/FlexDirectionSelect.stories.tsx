import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FlexDirectionSelect } from './FlexDirectionSelect';
import type { FlexDirectionValue } from './types';

const meta: Meta<typeof FlexDirectionSelect> = {
  title: 'Panel/Flex/FlexDirectionSelect',
  component: FlexDirectionSelect,
  decorators: [
    (Story) => (
      <div style={{ padding: 40, background: '#1e1e1e', minHeight: 200 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof FlexDirectionSelect>;

function Interactive({ initial = 'flex-row' as FlexDirectionValue | null }) {
  const [value, setValue] = useState<FlexDirectionValue | null>(initial);
  const [preview, setPreview] = useState<FlexDirectionValue | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <FlexDirectionSelect
        currentValue={preview ?? value}
        lockedValue={null}
        locked={false}
        onHover={(v) => setPreview(v)}
        onLeave={() => setPreview(null)}
        onClick={(v) => { setValue(v); setPreview(null); }}
      />
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#999' }}>
        Selected: {value ?? 'none'} {preview ? `(previewing: ${preview})` : ''}
      </span>
    </div>
  );
}

export const Default: Story = {
  render: () => <Interactive initial="flex-row" />,
};

export const Col: Story = {
  render: () => <Interactive initial="flex-col" />,
};

export const RowReverse: Story = {
  render: () => <Interactive initial="flex-row-reverse" />,
};

export const Unset: Story = {
  render: () => <Interactive initial={null} />,
};

export const Locked: Story = {
  args: {
    currentValue: 'flex-row',
    lockedValue: 'flex-col',
    locked: true,
    onHover: () => {},
    onLeave: () => {},
    onClick: () => {},
  },
};

export const ForeignLocked: Story = {
  args: {
    currentValue: 'flex-row',
    lockedValue: null,
    locked: true,
    onHover: () => {},
    onLeave: () => {},
    onClick: () => {},
  },
};
