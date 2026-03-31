import type { Meta, StoryObj } from '@storybook/angular';
import { CardComponent } from './card.component';
import { BadgeComponent } from './badge.component';

const meta: Meta<CardComponent> = {
  title: 'Components/Card',
  component: CardComponent,
  decorators: [
    (story) => ({
      ...story(),
      moduleMetadata: { imports: [BadgeComponent] },
    }),
  ],
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    tag: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<CardComponent>;

export const Default: Story = {
  args: {
    title: 'Card Title',
    description: 'Card description goes here.',
    tag: 'Tag',
  },
};

export const Design: Story = {
  args: {
    title: 'Design System',
    description: 'Create consistent, reusable components for your application.',
    tag: 'UI',
  },
};
