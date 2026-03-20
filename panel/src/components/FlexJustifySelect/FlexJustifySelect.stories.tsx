import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FlexJustifySelect } from './FlexJustifySelect';
import type { FlexJustifySelectProps } from './types';

const meta: Meta<typeof FlexJustifySelect> = {
  component: FlexJustifySelect,
  title: 'Panel/Flex/FlexJustifySelect',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: 40, background: '#1e1e1e', minHeight: 300 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FlexJustifySelect>;

function InteractiveWrapper(props: Partial<FlexJustifySelectProps>) {
  const [value, setValue] = useState<string | null>(props.currentValue ?? 'justify-between');
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <FlexJustifySelect
        currentValue={value}
        lockedValue={props.lockedValue ?? null}
        locked={props.locked ?? false}
        flexDirection={props.flexDirection ?? 'row'}
        onHover={(v) => { setPreview(v); props.onHover?.(v); }}
        onLeave={() => { setPreview(null); props.onLeave?.(); }}
        onClick={(v) => { setValue(v); setPreview(null); props.onClick?.(v); }}
        onRemove={props.onRemove}
        onRemoveHover={props.onRemoveHover}
      />
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>
        current: {value ?? 'null'} {preview ? `(previewing: ${preview})` : ''}
      </div>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveWrapper />,
};

export const Default: Story = {
  args: {
    currentValue: 'justify-between',
    lockedValue: null,
    locked: false,
    onHover: () => {},
    onLeave: () => {},
    onClick: () => {},
  },
};

export const Start: Story = {
  args: {
    ...Default.args,
    currentValue: 'justify-start',
  },
};

export const Center: Story = {
  args: {
    ...Default.args,
    currentValue: 'justify-center',
  },
};

export const End: Story = {
  args: {
    ...Default.args,
    currentValue: 'justify-end',
  },
};

export const Unset: Story = {
  args: {
    ...Default.args,
    currentValue: null,
  },
};

export const ColumnDirection: Story = {
  args: {
    ...Default.args,
    currentValue: 'justify-between',
    flexDirection: 'column',
  },
};

export const Locked: Story = {
  args: {
    ...Default.args,
    currentValue: 'justify-start',
    lockedValue: 'justify-center',
    locked: true,
  },
};

export const WithRemove: Story = {
  render: () => (
    <InteractiveWrapper
      onRemove={() => console.log('remove')}
      onRemoveHover={() => console.log('remove hover')}
    />
  ),
};
