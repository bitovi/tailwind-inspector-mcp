import type { Preview } from '@storybook/react';
import '../src/index.css';

const preview: Preview = {
  decorators: [
    (Story) => (
      <div style={{ minHeight: '500px', padding: '16px' }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'panel',
      values: [
        { name: 'panel', value: '#FFFFFF' },
        { name: 'dark', value: '#1a1a1a' },
      ],
    },
  },
};

export default preview;
