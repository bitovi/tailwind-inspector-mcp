import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    type: { control: 'select', options: ['text', 'email', 'number', 'tel', 'url'] },
  },
};
export default meta;

export const Text: StoryObj<typeof Input> = {
  args: { label: 'Full Name', placeholder: 'Jane Smith' },
};

export const Email: StoryObj<typeof Input> = {
  args: { label: 'Email Address', placeholder: 'jane@example.com', type: 'email' },
};

export const Number: StoryObj<typeof Input> = {
  args: { label: 'Age', placeholder: '25', type: 'number' },
};
