import type { Meta, StoryObj } from '@storybook/react';

// Side-effect imports: register custom elements
import '../../../../overlay/src/web-components/vb-overlay-host';
import '../../../../overlay/src/web-components/vb-popover-container';

/**
 * vb-popover-container — Popover panel (fixed top-right, non-interactive position)
 */
const meta: Meta = {
  title: 'Overlay/VbPopoverContainer',
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'desktop' },
  },
  decorators: [
    (Story) => (
      <vb-overlay-host>
        <Story />
      </vb-overlay-host>
    ),
  ],
};

export default meta;

export const Closed: StoryObj = {
  render: () => (
    <vb-popover-container
      panel-url="about:blank"
    />
  ),
};

export const Open: StoryObj = {
  render: () => (
    <vb-popover-container
      panel-url="about:blank"
      open
    />
  ),
};

export const WithContent: StoryObj = {
  render: () => (
    <vb-popover-container
      panel-url="data:text/html,<h1>Panel Content</h1><p>This is a sample panel.</p>"
      open
    />
  ),
};
