import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent } from './badge.component';

const meta: Meta<BadgeComponent> = {
  title: 'Components/Badge',
  component: BadgeComponent,
  argTypes: {
    color: { control: 'select', options: ['blue', 'green', 'yellow', 'red', 'gray'] },
  },
  render: (args) => ({
    props: args,
    template: `<app-badge [color]="color">{{ label }}</app-badge>`,
  }),
};
export default meta;

type Story = StoryObj<BadgeComponent & { label: string }>;

export const Blue: Story = {
  args: { color: 'blue', label: 'New' },
};

export const Green: Story = {
  args: { color: 'green', label: 'Active' },
};

export const Yellow: Story = {
  args: { color: 'yellow', label: 'Pending' },
};

export const Red: Story = {
  args: { color: 'red', label: 'Rejected' },
};

export const Gray: Story = {
  args: { color: 'gray', label: 'Draft' },
};
