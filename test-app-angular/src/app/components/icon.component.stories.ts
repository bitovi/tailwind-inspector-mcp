import type { Meta, StoryObj } from '@storybook/angular';
import { IconComponent } from './icon.component';

const meta: Meta<IconComponent> = {
  title: 'Components/Icon',
  component: IconComponent,
  argTypes: {
    name: { control: 'select', options: ['star', 'heart', 'arrow-right', 'arrow-left', 'check', 'plus'] },
    size: { control: 'number' },
  },
};
export default meta;

type Story = StoryObj<IconComponent>;

export const Star: Story = {
  args: { name: 'star', size: 16 },
};

export const Heart: Story = {
  args: { name: 'heart', size: 16 },
};

export const ArrowRight: Story = {
  args: { name: 'arrow-right', size: 16 },
};

export const Check: Story = {
  args: { name: 'check', size: 16 },
};

export const Plus: Story = {
  args: { name: 'plus', size: 16 },
};
