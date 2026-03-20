import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { FlexWrapSelect } from './FlexWrapSelect';
import type { FlexWrapValue } from './types';

const meta: Meta<typeof FlexWrapSelect> = {
  title: 'Panel/Flex/FlexWrapSelect',
  component: FlexWrapSelect,
  decorators: [(Story) => <div style={{ padding: 40, background: '#EAECED' }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof FlexWrapSelect>;

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState<FlexWrapValue | null>('flex-nowrap');
    const [preview, setPreview] = useState<FlexWrapValue | null>(null);
    const display = preview ?? value;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FlexWrapSelect
          currentValue={display}
          lockedValue={null}
          locked={false}
          onHover={(v) => setPreview(v)}
          onLeave={() => setPreview(null)}
          onClick={(v) => { setValue(v); setPreview(null); }}
        />
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>
          value: {value} &nbsp;|&nbsp; preview: {String(preview)}
        </div>
      </div>
    );
  },
};

export const Default: Story = {
  args: {
    currentValue: 'flex-nowrap',
    lockedValue: null,
    locked: false,
    onHover: () => {},
    onLeave: () => {},
    onClick: () => {},
  },
};

export const Wrap: Story = {
  args: {
    currentValue: 'flex-wrap',
    lockedValue: null,
    locked: false,
    onHover: () => {},
    onLeave: () => {},
    onClick: () => {},
  },
};

export const WrapReverse: Story = {
  args: {
    currentValue: 'flex-wrap-reverse',
    lockedValue: null,
    locked: false,
    onHover: () => {},
    onLeave: () => {},
    onClick: () => {},
  },
};

export const Locked: Story = {
  args: {
    currentValue: 'flex-nowrap',
    lockedValue: 'flex-wrap',
    locked: true,
    onHover: () => {},
    onLeave: () => {},
    onClick: () => {},
  },
};

export const Unset: Story = {
  args: {
    currentValue: null,
    lockedValue: null,
    locked: false,
    onHover: () => {},
    onLeave: () => {},
    onClick: () => {},
  },
};
