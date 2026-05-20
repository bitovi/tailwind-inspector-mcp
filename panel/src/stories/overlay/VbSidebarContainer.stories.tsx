import type { Meta, StoryObj } from '@storybook/react';

// Side-effect imports: register custom elements
import '../../../../overlay/src/web-components/vb-overlay-host';
import '../../../../overlay/src/web-components/vb-sidebar-container';

/**
 * vb-sidebar-container — Sidebar that restructures page to push content left
 */
const meta: Meta = {
  title: 'Overlay/VbSidebarContainer',
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'desktop' },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: '100%',
          height: '600px',
          background: '#e8e8e8',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Fake page content */}
        <div
          style={{
            padding: '20px',
            background: '#fff',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <h1>Page Content</h1>
          <p>This page content will be pushed left when the sidebar opens.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit...</p>
          {Array.from({ length: 10 }).map((_, i) => (
            <p key={i}>Paragraph {i + 1}</p>
          ))}
        </div>
        <vb-overlay-host>
          <Story />
        </vb-overlay-host>
      </div>
    ),
  ],
};

export default meta;

export const Closed: StoryObj = {
  render: () => (
    <vb-sidebar-container
      panel-url="about:blank"
    />
  ),
};

export const Open: StoryObj = {
  render: () => (
    <vb-sidebar-container
      panel-url="about:blank"
      open
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Sidebar restructures the page DOM to create a #tw-page-wrapper, pushing page content left and making the sidebar scroll-independent.',
      },
    },
  },
};

export const WithContent: StoryObj = {
  render: () => (
    <vb-sidebar-container
      panel-url="data:text/html,<h1>Sidebar Panel</h1><p>This sidebar pushes the page content to the left.</p>"
      open
    />
  ),
};
