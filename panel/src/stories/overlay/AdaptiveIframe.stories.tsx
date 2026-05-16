import type { Meta, StoryObj } from '@storybook/react';

// Side-effect import: registers <adaptive-iframe> custom element
import '../../../../overlay/src/adaptive-iframe/adaptive-iframe';

const meta: Meta = {
  title: 'Overlay/AdaptiveIframe',
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj;

export const WithSrcdoc: Story = {
  render: () => (
    <div style={{ width: 400, height: 300, position: 'relative' }}>
      <adaptive-iframe
        srcdoc={`
          <div style="padding: 24px; font-family: sans-serif; background: #f0f4f8; height: 100%; box-sizing: border-box;">
            <h2 style="margin: 0 0 8px; color: #1a202c;">Hello from srcdoc</h2>
            <p style="margin: 0; color: #4a5568;">This content is rendered via the srcdoc attribute.</p>
          </div>
        `}
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div style={{ width: 400, height: 300, position: 'relative' }}>
      <adaptive-iframe />
    </div>
  ),
};

export const WithHtmlContent: Story = {
  render: () => (
    <div style={{ width: 400, height: 300, position: 'relative' }}>
      <adaptive-iframe
        srcdoc={`
          <div style="padding: 16px; font-family: sans-serif; background: #ffffff; height: 100%; box-sizing: border-box;">
            <div style="border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div style="background: #00848B; padding: 16px; color: white;">
                <h3 style="margin: 0; font-size: 14px; font-weight: 600;">Card Title</h3>
              </div>
              <div style="padding: 16px; background: #f7fafc;">
                <p style="margin: 0 0 12px; color: #2d3748; font-size: 13px;">
                  A mini card layout with multiple sections to verify complex HTML rendering.
                </p>
                <div style="display: flex; gap: 8px;">
                  <span style="padding: 4px 8px; border-radius: 4px; background: #F5532D; color: white; font-size: 11px;">Tag A</span>
                  <span style="padding: 4px 8px; border-radius: 4px; background: #00848B; color: white; font-size: 11px;">Tag B</span>
                </div>
              </div>
            </div>
          </div>
        `}
      />
    </div>
  ),
};
