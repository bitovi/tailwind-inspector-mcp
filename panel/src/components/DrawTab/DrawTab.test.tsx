import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DrawTab } from './DrawTab';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

function renderDrawTab() {
  return render(<DrawTab />);
}

// Fixture entries
const BUTTON_PRIMARY = {
  id: 'components-button--primary',
  title: 'Components/Button',
  name: 'Primary',
};
const BUTTON_SECONDARY = {
  id: 'components-button--secondary',
  title: 'Components/Button',
  name: 'Secondary',
};
const BADGE_BLUE = {
  id: 'components-badge--blue',
  title: 'Components/Badge',
  name: 'Blue',
};

/** Sets up fetch to respond to /api/storybook-data */
function setupFetch({
  storybookAvailable = true,
  entries = {} as Record<string, unknown>,
  argTypes = {} as Record<string, unknown>,
} = {}) {
  mockFetch.mockImplementation((url: string) => {
    if (url === '/api/storybook-data') {
      return Promise.resolve({
        json: async () => ({
          available: storybookAvailable,
          directUrl: storybookAvailable ? '/storybook' : undefined,
          index: storybookAvailable ? { v: 4, entries } : undefined,
          argTypes: storybookAvailable ? argTypes : undefined,
        }),
      });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

test('shows loading state initially', () => {
  mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
  renderDrawTab();
  expect(screen.getByText('Loading components…')).toBeInTheDocument();
});

test('shows error when storybook not detected', async () => {
  setupFetch({ storybookAvailable: false });
  renderDrawTab();
  expect(await screen.findByText('Storybook not detected.')).toBeInTheDocument();
});

test('shows component list when storybook is available', async () => {
  setupFetch({
    entries: {
      [BUTTON_PRIMARY.id]: BUTTON_PRIMARY,
      [BUTTON_SECONDARY.id]: BUTTON_SECONDARY,
      [BADGE_BLUE.id]: BADGE_BLUE,
    },
  });

  renderDrawTab();

  expect(await screen.findByText('Button')).toBeInTheDocument();
  expect(screen.getByText('Badge')).toBeInTheDocument();
});

test('shows "no stories found" when entries is empty', async () => {
  setupFetch({ entries: {} });
  renderDrawTab();
  expect(await screen.findByText('No stories found.')).toBeInTheDocument();
});

describe('component cards', () => {
  test('components show Customize and Place buttons', async () => {
    setupFetch({
      entries: { [BUTTON_PRIMARY.id]: BUTTON_PRIMARY, [BUTTON_SECONDARY.id]: BUTTON_SECONDARY },
    });
    renderDrawTab();
    await screen.findByText('Button');

    expect(screen.getByText('Customize')).toBeInTheDocument();
    expect(screen.getByText('Place')).toBeInTheDocument();
  });

  test('multiple components each show their names', async () => {
    setupFetch({
      entries: { [BUTTON_PRIMARY.id]: BUTTON_PRIMARY, [BADGE_BLUE.id]: BADGE_BLUE },
    });
    renderDrawTab();
    await screen.findByText('Button');

    expect(screen.getByText('Button')).toBeInTheDocument();
    expect(screen.getByText('Badge')).toBeInTheDocument();
  });
});

describe('probe iframe', () => {
  test('starts probing with a hidden iframe for the first story', async () => {
    setupFetch({
      entries: { [BUTTON_PRIMARY.id]: BUTTON_PRIMARY },
      argTypes: {
        Button: {
          variant: { control: 'select', options: ['primary', 'secondary'] },
        },
      },
    });
    renderDrawTab();
    await screen.findByText('Button');

    await waitFor(() => {
      expect(document.querySelector('iframe[src*="components-button--primary"]')).toBeTruthy();
    });
  });

  test('shows component name while probing', async () => {
    setupFetch({
      entries: { [BUTTON_PRIMARY.id]: BUTTON_PRIMARY },
      argTypes: {},
    });
    renderDrawTab();
    await screen.findByText('Button');

    expect(screen.getByText('Button')).toBeInTheDocument();
  });
});

