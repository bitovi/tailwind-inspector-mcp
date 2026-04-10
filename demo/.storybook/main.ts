import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Minimal Storybook config for the static demo.
 * Excludes the VyBit addon — ghost extraction iframes use ?vybit-ghost=1
 * which skips the overlay injection anyway, and there's no server to talk to.
 */
const config: StorybookConfig = {
  stories: ['../../test-app/src/**/*.stories.@(ts|tsx)'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
