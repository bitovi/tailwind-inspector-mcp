import type { Meta, StoryObj } from '@storybook/react';

// Side-effect imports: register custom elements
import '../../../../overlay/src/web-components/vb-overlay-host';
import '../../../../overlay/src/web-components/vb-modal-container';

/**
 * vb-modal-container — Draggable & resizable modal with localStorage persistence
 */
const meta: Meta = {
  title: 'Overlay/VbModalContainer',
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
    <vb-modal-container
      panel-url="about:blank"
    />
  ),
};

export const Open: StoryObj = {
  render: () => (
    <vb-modal-container
      panel-url="about:blank"
      open
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Modal is draggable by the handle and resizable from the bottom-right corner. Position and size are persisted in localStorage.',
      },
    },
  },
};

export const WithContent: StoryObj = {
  render: () => (
    <vb-modal-container
      panel-url="data:text/html,<h1>Modal Panel</h1><p>This modal can be dragged and resized.</p><p>Bounds are saved to localStorage.</p>"
      open
    />
  ),
};
