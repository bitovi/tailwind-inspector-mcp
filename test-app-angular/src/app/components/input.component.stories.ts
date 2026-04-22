import type { Meta, StoryObj } from '@storybook/angular';
import { InputComponent } from './input.component';

const meta: Meta<InputComponent> = {
  title: 'Components/Input',
  component: InputComponent,
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    type: { control: 'select', options: ['text', 'email', 'number', 'tel', 'url'] },
  },
};
export default meta;

type Story = StoryObj<InputComponent>;

export const Text: Story = {
  args: { label: 'Full Name', placeholder: 'Jane Smith' },
};

export const Email: Story = {
  args: { label: 'Email Address', placeholder: 'jane@example.com', type: 'email' },
};

export const Number: Story = {
  args: { label: 'Age', placeholder: '25', type: 'number' },
};
