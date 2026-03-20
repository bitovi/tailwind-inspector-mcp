import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { FlexAlignSelect } from './FlexAlignSelect';
import type { FlexDirectionCss } from './types';

function Interactive() {
  const [value, setValue] = useState<string | null>('items-baseline');
  const [dir, setDir] = useState<FlexDirectionCss>('row');

  return (
    <div className="p-6 bg-bv-bg flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label className="text-[10px] font-mono text-bv-muted uppercase">Direction</label>
        <select
          className="bg-bv-surface text-bv-text text-[11px] font-mono border border-bv-border rounded px-1.5 py-0.5"
          value={dir}
          onChange={(e) => setDir(e.target.value as FlexDirectionCss)}
        >
          <option value="row">row</option>
          <option value="column">column</option>
          <option value="row-reverse">row-reverse</option>
          <option value="column-reverse">column-reverse</option>
        </select>
      </div>

      <FlexAlignSelect
        currentValue={value}
        lockedValue={null}
        locked={false}
        flexDirection={dir}
        onHover={() => {}}
        onLeave={() => {}}
        onClick={setValue}
        onRemove={() => setValue(null)}
      />
      <span className="text-[11px] font-mono text-bv-teal">{value ?? '(none)'}</span>
    </div>
  );
}

const meta: Meta<typeof FlexAlignSelect> = {
  component: FlexAlignSelect,
  title: 'Panel/Flex/FlexAlignSelect',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FlexAlignSelect>;

const noop = () => {};

export const InteractiveStory: Story = {
  name: 'Interactive',
  render: () => <Interactive />,
};

export const Default: Story = {
  args: {
    currentValue: 'items-baseline',
    lockedValue: null,
    locked: false,
    onHover: noop,
    onLeave: noop,
    onClick: noop,
  },
};

export const Start: Story = {
  args: {
    currentValue: 'items-start',
    lockedValue: null,
    locked: false,
    onHover: noop,
    onLeave: noop,
    onClick: noop,
  },
};

export const Center: Story = {
  args: {
    currentValue: 'items-center',
    lockedValue: null,
    locked: false,
    onHover: noop,
    onLeave: noop,
    onClick: noop,
  },
};

export const Stretch: Story = {
  args: {
    currentValue: 'items-stretch',
    lockedValue: null,
    locked: false,
    onHover: noop,
    onLeave: noop,
    onClick: noop,
  },
};

export const Unset: Story = {
  args: {
    currentValue: null,
    lockedValue: null,
    locked: false,
    onHover: noop,
    onLeave: noop,
    onClick: noop,
  },
};

export const ColumnDirection: Story = {
  args: {
    currentValue: 'items-center',
    lockedValue: null,
    locked: false,
    flexDirection: 'column',
    onHover: noop,
    onLeave: noop,
    onClick: noop,
  },
};

export const Locked: Story = {
  args: {
    currentValue: 'items-start',
    lockedValue: 'items-center',
    locked: true,
    onHover: noop,
    onLeave: noop,
    onClick: noop,
  },
};

export const WithRemove: Story = {
  args: {
    currentValue: 'items-baseline',
    lockedValue: null,
    locked: false,
    onHover: noop,
    onLeave: noop,
    onClick: noop,
    onRemove: noop,
  },
};
