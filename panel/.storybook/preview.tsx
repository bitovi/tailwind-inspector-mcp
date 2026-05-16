import type { Preview } from 'storybook';
import { useEffect } from 'react';
import '../src/index.css';

const preview: Preview = {
  globalTypes: {
    colorScheme: {
      description: 'Overlay color scheme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'light', title: 'Light', icon: 'sun' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    colorScheme: 'dark',
  },
  decorators: [
    (Story, context) => {
      const scheme = context.globals.colorScheme || 'dark';

      // Forward theme to any <vb-overlay-host> elements in the story
      useEffect(() => {
        document.querySelectorAll('vb-overlay-host').forEach((el) => {
          el.setAttribute('theme', scheme);
        });
      }, [scheme]);

      return (
        <div style={{ minHeight: '500px', padding: '16px' }}>
          <Story />
        </div>
      );
    },
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
