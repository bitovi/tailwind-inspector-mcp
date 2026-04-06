import type { Meta, StoryObj } from '@storybook/react';
import { Icon } from './Icon';

const meta: Meta<typeof Icon> = {
  title: 'Components/Icon',
  component: Icon,
  argTypes: {
    name: { control: 'select', options: ['star', 'heart', 'arrow-right', 'arrow-left', 'check', 'plus'] },
    size: { control: 'number' },
  },
};
export default meta;

export const Star: StoryObj<typeof Icon> = {
  args: { name: 'star', size: 16 },
};

export const Heart: StoryObj<typeof Icon> = {
  args: { name: 'heart', size: 16 },
};

export const ArrowRight: StoryObj<typeof Icon> = {
  args: { name: 'arrow-right', size: 16 },
};

export const Check: StoryObj<typeof Icon> = {
  args: { name: 'check', size: 16 },
};

export const Plus: StoryObj<typeof Icon> = {
  args: { name: 'plus', size: 16 },
};
