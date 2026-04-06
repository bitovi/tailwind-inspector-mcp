import type { Meta, StoryObj } from '@storybook/react';
import { ReactNodeField } from './ReactNodeField';

const meta: Meta<typeof ReactNodeField> = {
  component: ReactNodeField,
  title: 'Panel/ReactNodeField',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: 16, background: '#2c2c2c', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: '#999', width: 60, flexShrink: 0, fontFamily: 'monospace' }}>iconLeft</span>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ReactNodeField>;

export const Empty: Story = {
  args: { name: 'iconLeft', value: undefined },
};

export const WithText: Story = {
  args: { name: 'children', value: { type: 'text', value: 'Active' } },
};

export const WithSvg: Story = {
  args: {
    name: 'iconLeft',
    value: {
      type: 'text',
      value: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
    },
  },
};

export const Receptive: Story = {
  args: {
    name: 'iconLeft',
    value: undefined,
    armedComponentData: {
      componentName: 'Icon',
      storyId: 'components-icon--default',
      ghostHtml: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>',
      ghostCss: '',
    },
  },
};

export const Filled: Story = {
  args: {
    name: 'iconLeft',
    value: {
      type: 'component',
      componentName: 'Icon',
      storyId: 'components-icon--default',
      args: { name: 'check', size: 'sm' },
      ghostHtml: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>',
      ghostCss: '',
    },
  },
};
