import type { Meta, StoryObj } from '@storybook/react';
import { ArgsForm } from './ArgsForm';

const meta: Meta<typeof ArgsForm> = {
  component: ArgsForm,
  title: 'Panel/DrawTab/ArgsForm',
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 300, background: 'var(--color-bv-surface)', padding: 12, borderRadius: 8 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArgsForm>;

export const SelectAndText: Story = {
  args: {
    argTypes: {
      color: { control: 'select', options: ['blue', 'green', 'yellow', 'red', 'gray'] },
      children: { control: 'text' },
    },
    args: { color: 'blue', children: 'New' },
    onArgsChange: (args: Record<string, unknown>) => console.log('onArgsChange', args),
  },
};

export const BooleanAndNumber: Story = {
  args: {
    argTypes: {
      disabled: { control: 'boolean' },
      count: { control: 'number' },
      label: { control: 'text' },
    },
    args: { disabled: false, count: 3, label: 'Hello' },
    onArgsChange: (args: Record<string, unknown>) => console.log('onArgsChange', args),
  },
};

export const Empty: Story = {
  args: {
    argTypes: {},
    args: {},
    onArgsChange: () => {},
  },
};
