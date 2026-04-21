import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeTab } from './ThemeTab';
import type { ThemeOverride } from './types';

// Mock the ws module
vi.mock('../../ws', () => ({
  sendTo: vi.fn(),
  send: vi.fn(),
}));

const mockTailwindConfig = {
  tailwindVersion: 4 as const,
  colors: {
    blue: {
      '50': '#eff6ff',
      '100': '#dbeafe',
      '200': '#bfdbfe',
      '300': '#93c5fd',
      '400': '#60a5fa',
      '500': '#3b82f6',
      '600': '#2563eb',
      '700': '#1d4ed8',
      '800': '#1e40af',
      '900': '#1e3a8a',
      '950': '#172554',
    },
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
  },
  fontWeight: {
    normal: '400',
    bold: '700',
  },
  spacing: {},
  borderRadius: {},
};

test('renders color and typography sections', () => {
  render(
    <ThemeTab
      tailwindConfig={mockTailwindConfig}
      tailwindVersion={4}
      themeEdits={new Map()}
      onThemeEdit={vi.fn()}
    />
  );

  expect(screen.getByText('Colors')).toBeInTheDocument();
  expect(screen.getByText('Typography')).toBeInTheDocument();
  expect(screen.getByText('Tailwind v4')).toBeInTheDocument();
});

test('renders color hue groups', () => {
  render(
    <ThemeTab
      tailwindConfig={mockTailwindConfig}
      tailwindVersion={4}
      themeEdits={new Map()}
      onThemeEdit={vi.fn()}
    />
  );

  expect(screen.getByText('blue')).toBeInTheDocument();
});

test('renders font size rows', () => {
  render(
    <ThemeTab
      tailwindConfig={mockTailwindConfig}
      tailwindVersion={4}
      themeEdits={new Map()}
      onThemeEdit={vi.fn()}
    />
  );

  expect(screen.getByText('text-xs')).toBeInTheDocument();
  expect(screen.getByText('text-lg')).toBeInTheDocument();
});

test('calls onThemeEdit when a color is changed', () => {
  const onThemeEdit = vi.fn();
  render(
    <ThemeTab
      tailwindConfig={mockTailwindConfig}
      tailwindVersion={4}
      themeEdits={new Map()}
      onThemeEdit={onThemeEdit}
    />
  );

  // Expand the blue hue group first (collapsed by default)
  fireEvent.click(screen.getByText('blue'));

  // Edit a color via the hex input
  const hexInputs = screen.getAllByDisplayValue('#3b82f6');
  fireEvent.change(hexInputs[0], { target: { value: '#ff0000' } });

  expect(onThemeEdit).toHaveBeenCalledTimes(1);
  const [tokenKey, override] = onThemeEdit.mock.calls[0];
  expect(tokenKey).toBe('blue-500');
  expect(override.variable).toBe('--color-blue-500');
  expect(override.value).toBe('#ff0000');
});

test('shows edit count when themeEdits has entries', () => {
  const edits = new Map<string, ThemeOverride>([
    ['blue-500', { variable: '--color-blue-500', value: '#ff0000' }],
  ]);
  render(
    <ThemeTab
      tailwindConfig={mockTailwindConfig}
      tailwindVersion={4}
      themeEdits={edits}
      onThemeEdit={vi.fn()}
    />
  );

  expect(screen.getByText('1 edit')).toBeInTheDocument();
});

test('shows v3 version badge', () => {
  render(
    <ThemeTab
      tailwindConfig={{ ...mockTailwindConfig, tailwindVersion: 3 }}
      tailwindVersion={3}
      themeEdits={new Map()}
      onThemeEdit={vi.fn()}
    />
  );

  expect(screen.getByText('Tailwind v3')).toBeInTheDocument();
});

test('handles empty theme config gracefully', () => {
  render(
    <ThemeTab
      tailwindConfig={{ colors: {}, fontSize: {}, fontWeight: {}, spacing: {}, borderRadius: {} }}
      tailwindVersion={4}
      themeEdits={new Map()}
      onThemeEdit={vi.fn()}
    />
  );

  expect(screen.getByText('No color tokens found in theme')).toBeInTheDocument();
});

test('hue groups are collapsed by default and expand on click', () => {
  render(
    <ThemeTab
      tailwindConfig={mockTailwindConfig}
      tailwindVersion={4}
      themeEdits={new Map()}
      onThemeEdit={vi.fn()}
    />
  );

  // Hue name is visible but shade rows are not
  expect(screen.getByText('blue')).toBeInTheDocument();
  expect(screen.queryByText('blue-500')).not.toBeInTheDocument();

  // Click to expand
  fireEvent.click(screen.getByText('blue'));
  expect(screen.getByText('blue-500')).toBeInTheDocument();

  // Click again to collapse
  fireEvent.click(screen.getByText('blue'));
  expect(screen.queryByText('blue-500')).not.toBeInTheDocument();
});
