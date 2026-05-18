import type { Meta, StoryObj } from '@storybook/react';

// Side-effect import: registers <vb-design-canvas> custom element
import '.';

const meta: Meta = {
  title: 'Overlay/VbDesignCanvas',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div style={{ padding: 24 }}>
      <vb-design-canvas
        src="about:blank"
        width="100%"
        height="400px"
      />
    </div>
  ),
};

export const SmallFixed: Story = {
  render: () => (
    <div style={{ padding: 24 }}>
      <vb-design-canvas
        src="about:blank"
        width="320px"
        height="240px"
        min-height="100px"
      />
    </div>
  ),
};
