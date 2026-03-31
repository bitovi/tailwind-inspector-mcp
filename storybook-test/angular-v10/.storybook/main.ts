import type { StorybookConfig } from '@storybook/angular';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../../../test-app-angular/src/**/*.stories.@(ts)'],
  addons: [join(__dirname, '../../../storybook-addon')],
  framework: {
    name: '@storybook/angular',
    options: {
      projectBuildConfig: 'storybook-angular',
    },
  },
  webpackFinal: async (config) => {
    config.resolve = config.resolve || {};
    // Ensure all packages resolve from Storybook's own node_modules first,
    // preventing two copies of @angular/core from loading (one per node_modules tree).
    config.resolve.modules = [
      resolve(__dirname, '../node_modules'),
      'node_modules',
    ];
    return config;
  },
};

export default config;
