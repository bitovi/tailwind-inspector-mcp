import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ThemeTab } from './ThemeTab';
import type { ThemeOverride } from './types';

const meta: Meta<typeof ThemeTab> = {
  component: ThemeTab,
  title: 'Panel/ThemeTab',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        style={{
          maxHeight: '500px',
          overflow: 'auto',
          fontFamily: "'Inter', sans-serif",
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ThemeTab>;

/* ─────────────────────────────────────────────────────────────
   Mock Tailwind config factories
   ───────────────────────────────────────────────────────────── */

const mockTailwindConfigV3 = {
  colors: {
    transparent: 'transparent',
    black: '#000000',
    white: '#ffffff',
    gray: {
      '50': '#f9fafb',
      '100': '#f3f4f6',
      '200': '#e5e7eb',
      '300': '#d1d5db',
      '400': '#9ca3af',
      '500': '#6b7280',
      '600': '#4b5563',
      '700': '#374151',
      '800': '#1f2937',
      '900': '#111827',
    },
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
    },
    red: {
      '50': '#fef2f2',
      '100': '#fee2e2',
      '200': '#fecaca',
      '300': '#fca5a5',
      '400': '#f87171',
      '500': '#ef4444',
      '600': '#dc2626',
      '700': '#b91c1c',
      '800': '#991b1b',
      '900': '#7f1d1d',
    },
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
  },
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  spacing: {
    '0': '0px',
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '6': '1.5rem',
  },
  borderRadius: {
    none: '0px',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    full: '9999px',
  },
};

const mockTailwindConfigV4 = {
  ...mockTailwindConfigV3,
  // V4 adds CSS variable support
};

/* ─────────────────────────────────────────────────────────────
   Story 1: V3 - Default state, no edits
   ───────────────────────────────────────────────────────────── */
export const V3Default: Story = {
  args: {
    tailwindConfig: mockTailwindConfigV3,
    tailwindVersion: 3,
    themeEdits: new Map(),
    onThemeEdit: (tokenKey, override) => console.log('Edit:', tokenKey, override),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 2: V3 - With some theme edits applied
   ───────────────────────────────────────────────────────────── */
export const V3WithEdits: Story = {
  args: {
    tailwindConfig: mockTailwindConfigV3,
    tailwindVersion: 3,
    themeEdits: new Map([
      ['colors.blue.500', { variable: '--color-blue-500', value: '#ff6b6b' }],
      ['fontSize.base', { variable: '--font-size-base', value: '1.125rem', lineHeight: '1.75rem' }],
    ]),
    onThemeEdit: (tokenKey, override) => console.log('Edit:', tokenKey, override),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 3: V4 - Default state with CSS variables
   ───────────────────────────────────────────────────────────── */
export const V4Default: Story = {
  args: {
    tailwindConfig: mockTailwindConfigV4,
    tailwindVersion: 4,
    themeEdits: new Map(),
    onThemeEdit: (tokenKey, override) => console.log('Edit:', tokenKey, override),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 4: V4 - With CSS variable overrides
   ───────────────────────────────────────────────────────────── */
export const V4WithOverrides: Story = {
  args: {
    tailwindConfig: mockTailwindConfigV4,
    tailwindVersion: 4,
    themeEdits: new Map([
      ['colors.red.500', { variable: '--red-500', value: '#ff3333' }],
      ['colors.blue.600', { variable: '--blue-600', value: '#0052cc' }],
      ['fontSize.lg', { variable: '--text-lg', value: '1.25rem' }],
    ]),
    onThemeEdit: (tokenKey, override) => console.log('Edit:', tokenKey, override),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 5: Interactive V3 - live editing
   ───────────────────────────────────────────────────────────── */
function InteractiveV3Theme() {
  const [edits, setEdits] = useState<Map<string, ThemeOverride>>(
    new Map([['colors.blue.500', { variable: '--color-blue-500', value: '#3b82f6' }]])
  );

  const handleEdit = (tokenKey: string, override: ThemeOverride) => {
    const newEdits = new Map(edits);
    newEdits.set(tokenKey, override);
    setEdits(newEdits);
  };

  return (
    <div>
      <ThemeTab
        tailwindConfig={mockTailwindConfigV3}
        tailwindVersion={3}
        themeEdits={edits}
        onThemeEdit={handleEdit}
      />
      <div className="border-t border-bit-border p-3 text-[11px] text-bit-text-mid">
        <div>Total edits: {edits.size}</div>
        <div className="mt-1 space-y-0.5">
          {Array.from(edits.entries()).map(([key, override]) => (
            <div key={key} className="font-mono">
              {key}: {override.value}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const V3Interactive: Story = {
  render: () => <InteractiveV3Theme />,
};

/* ─────────────────────────────────────────────────────────────
   Story 6: Interactive V4 - CSS variable editing
   ───────────────────────────────────────────────────────────── */
function InteractiveV4Theme() {
  const [edits, setEdits] = useState<Map<string, ThemeOverride>>(new Map());

  const handleEdit = (tokenKey: string, override: ThemeOverride) => {
    const newEdits = new Map(edits);
    newEdits.set(tokenKey, override);
    setEdits(newEdits);
  };

  return (
    <div>
      <ThemeTab
        tailwindConfig={mockTailwindConfigV4}
        tailwindVersion={4}
        themeEdits={edits}
        onThemeEdit={handleEdit}
      />
      <div className="border-t border-bit-border p-3 text-[11px] text-bit-text-mid">
        <div>CSS variables set: {edits.size}</div>
        <div className="mt-1 space-y-0.5">
          {Array.from(edits.entries()).map(([key, override]) => (
            <div key={key} className="font-mono">
              {override.variable} = {override.value}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const V4Interactive: Story = {
  render: () => <InteractiveV4Theme />,
};

/* ─────────────────────────────────────────────────────────────
   Story 7: Minimal config (few theme options)
   ───────────────────────────────────────────────────────────── */
const minimalConfig = {
  colors: {
    black: '#000000',
    white: '#ffffff',
    primary: '#3b82f6',
  },
  fontSize: {
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
  },
  spacing: {
    '0': '0px',
    '2': '0.5rem',
    '4': '1rem',
  },
  borderRadius: {
    none: '0px',
    md: '0.375rem',
    full: '9999px',
  },
};

export const MinimalConfig: Story = {
  args: {
    tailwindConfig: minimalConfig,
    tailwindVersion: 4,
    themeEdits: new Map(),
    onThemeEdit: (tokenKey, override) => console.log('Edit:', tokenKey, override),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 8: Large config (extensive theme)
   ───────────────────────────────────────────────────────────── */
const largeConfig = {
  colors: {
    slate: {
      '50': '#f8fafc',
      '100': '#f1f5f9',
      '200': '#e2e8f0',
      '300': '#cbd5e1',
      '400': '#94a3b8',
      '500': '#64748b',
      '600': '#475569',
      '700': '#334155',
      '800': '#1e293b',
      '900': '#0f172a',
    },
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
    },
    green: {
      '50': '#f0fdf4',
      '100': '#dcfce7',
      '200': '#bbf7d0',
      '300': '#86efac',
      '400': '#4ade80',
      '500': '#22c55e',
      '600': '#16a34a',
      '700': '#15803d',
      '800': '#166534',
      '900': '#145231',
    },
    amber: {
      '50': '#fffbeb',
      '100': '#fef3c7',
      '200': '#fde68a',
      '300': '#fcd34d',
      '400': '#fbbf24',
      '500': '#f59e0b',
      '600': '#d97706',
      '700': '#b45309',
      '800': '#92400e',
      '900': '#78350f',
    },
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
  },
  spacing: {
    '0': '0px',
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '6': '1.5rem',
    '8': '2rem',
    '10': '2.5rem',
    '12': '3rem',
  },
};

export const LargeConfig: Story = {
  args: {
    tailwindConfig: largeConfig,
    tailwindVersion: 4,
    themeEdits: new Map(),
    onThemeEdit: (tokenKey, override) => console.log('Edit:', tokenKey, override),
  },
};
