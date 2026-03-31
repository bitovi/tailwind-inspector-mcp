import type { Meta, StoryObj } from '@storybook/angular';
import { TagComponent } from './tag.component';

const meta: Meta<TagComponent> = {
  title: 'Components/Tag',
  component: TagComponent,
  argTypes: {
    color: { control: 'select', options: ['blue', 'red', 'green'] },
  },
  render: (args) => ({
    props: args,
    template: `<app-tag [color]="color">{{ label }}</app-tag>`,
  }),
};
export default meta;

type Story = StoryObj<TagComponent & { label: string }>;

export const Blue: Story = {
  args: { color: 'blue', label: 'Design' },
};

export const Red: Story = {
  args: { color: 'red', label: 'Bug' },
};

export const Green: Story = {
  args: { color: 'green', label: 'Feature' },
};
