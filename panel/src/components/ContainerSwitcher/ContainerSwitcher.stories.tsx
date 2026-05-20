import type { Meta, StoryObj } from '@storybook/react';
import { ContainerSwitcher } from './ContainerSwitcher';

const meta: Meta<typeof ContainerSwitcher> = {
  title: 'Components/ContainerSwitcher',
  component: ContainerSwitcher,
};

export default meta;
type Story = StoryObj<typeof ContainerSwitcher>;

export const Default: Story = {};
