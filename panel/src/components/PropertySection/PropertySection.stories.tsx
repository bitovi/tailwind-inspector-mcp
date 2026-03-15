import type { Meta, StoryObj } from '@storybook/react';
import { PropertySection } from './PropertySection';
import type { AvailableProperty } from './types';

const typographyProperties: AvailableProperty[] = [
  { name: 'Text color', prefixHint: 'text-{color}', prefix: 'text-color' },
  { name: 'Text align', prefixHint: 'text-{align}', prefix: 'text-align' },
  { name: 'Line height', prefixHint: 'leading-*', prefix: 'leading' },
  { name: 'Letter spacing', prefixHint: 'tracking-*', prefix: 'tracking' },
];

const backgroundProperties: AvailableProperty[] = [
  { name: 'Background color', prefixHint: 'bg-{color}', prefix: 'bg' },
  { name: 'Background opacity', prefixHint: 'bg-opacity-*', prefix: 'bg-opacity' },
];

const sizingProperties: AvailableProperty[] = [
  { name: 'Width', prefixHint: 'w-*', prefix: 'w' },
  { name: 'Height', prefixHint: 'h-*', prefix: 'h' },
  { name: 'Min width', prefixHint: 'min-w-*', prefix: 'min-w' },
  { name: 'Max width', prefixHint: 'max-w-*', prefix: 'max-w' },
  { name: 'Min height', prefixHint: 'min-h-*', prefix: 'min-h' },
  { name: 'Max height', prefixHint: 'max-h-*', prefix: 'max-h' },
];

/** Mock chip for story demos */
function Chip({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <span
      className={`group inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border cursor-ew-resize select-none transition-colors ${
        active
          ? 'bg-bv-surface text-bv-text-mid border-transparent hover:border-bv-teal hover:bg-bv-teal/9 hover:text-bv-teal'
          : 'bg-bv-surface text-bv-text-mid border-transparent hover:border-bv-teal hover:text-bv-teal'
      }`}
    >
      <span className="inline-block mr-0.5 text-[9px] opacity-0 group-hover:opacity-50 transition-opacity">‹</span>
      {label}
      <span className="inline-block ml-0.5 text-[9px] opacity-0 group-hover:opacity-50 transition-opacity">›</span>
      <span className="text-[9px] text-bv-muted opacity-0 group-hover:opacity-100 hover:text-bv-orange ml-0.5 transition-opacity">×</span>
    </span>
  );
}

const meta: Meta<typeof PropertySection> = {
  component: PropertySection,
  title: 'Panel/PropertySection',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[280px] bg-bv-surface p-3 rounded-lg font-[family-name:var(--font-ui)]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PropertySection>;

export const WithClasses: Story = {
  args: {
    label: 'Typography',
    availableProperties: typographyProperties,
  },
  render: (args) => (
    <PropertySection {...args}>
      <Chip label="text-lg" />
      <Chip label="font-bold" />
    </PropertySection>
  ),
};

export const Empty: Story = {
  args: {
    label: 'Backgrounds',
    availableProperties: backgroundProperties,
    isEmpty: true,
  },
};

export const SizingWithOneClass: Story = {
  args: {
    label: 'Sizing',
    availableProperties: sizingProperties,
  },
  render: (args) => (
    <PropertySection {...args}>
      <Chip label="w-64" />
    </PropertySection>
  ),
};

export const NoAddButton: Story = {
  args: {
    label: 'Effects',
  },
  render: (args) => (
    <PropertySection {...args}>
      <Chip label="shadow-md" active={false} />
      <Chip label="opacity-80" active={false} />
    </PropertySection>
  ),
};

export const ManyChips: Story = {
  args: {
    label: 'Typography',
    availableProperties: typographyProperties,
  },
  render: (args) => (
    <PropertySection {...args}>
      <Chip label="text-lg" />
      <Chip label="font-bold" />
      <Chip label="text-blue-500" active={false} />
      <Chip label="text-center" active={false} />
      <Chip label="leading-relaxed" active={false} />
      <Chip label="tracking-wide" active={false} />
    </PropertySection>
  ),
};
