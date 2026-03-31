import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';

const meta: Meta<ButtonComponent> = {
  title: 'Components/Button',
  component: ButtonComponent,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary'] },
  },
  render: (args) => ({
    props: args,
    template: `<app-button [variant]="variant">{{ label }}</app-button>`,
  }),
};
export default meta;

type Story = StoryObj<ButtonComponent & { label: string }>;

export const Primary: Story = {
  args: { variant: 'primary', label: 'Click me' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', label: 'Cancel' },
};
