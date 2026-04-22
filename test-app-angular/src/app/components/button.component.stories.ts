import type { Meta, StoryObj } from '@storybook/angular';
import { NgIf } from '@angular/common';
import { ButtonComponent } from './button.component';
import { IconComponent } from './icon.component';

const meta: Meta<ButtonComponent & { label: string; leftIcon: string; rightIcon: string }> = {
  title: 'Components/Button',
  component: ButtonComponent,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'warning'] },
    label: { control: 'text' },
  },
  render: (args) => ({
    props: args,
    template: `<app-button [variant]="variant">
      <span *ngIf="leftIcon" leftIcon>{{ leftIcon }}</span>
      {{ label }}
      <span *ngIf="rightIcon" rightIcon>{{ rightIcon }}</span>
    </app-button>`,
    moduleMetadata: { imports: [ButtonComponent, IconComponent, NgIf] },
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

export const Warning: Story = {
  args: { variant: 'warning', label: 'Delete' },
};
