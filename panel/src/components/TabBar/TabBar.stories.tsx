import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TabBar } from './TabBar';
import type { Tab } from './types';

const baseTabs: Tab[] = [
  { id: 'design', label: 'Design' },
  { id: 'inspect', label: 'Inspect' },
  { id: 'settings', label: 'Settings' },
];

const tabsWithDisabled: Tab[] = [
  { id: 'design', label: 'Design' },
  { id: 'inspect', label: 'Inspect' },
  { id: 'advanced', label: 'Advanced', disabled: true, tooltip: 'Pro feature' },
];

const tabsMany: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'properties', label: 'Properties' },
  { id: 'layout', label: 'Layout' },
  { id: 'spacing', label: 'Spacing' },
  { id: 'colors', label: 'Colors' },
  { id: 'effects', label: 'Effects' },
];

function InteractiveTabBar({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0].id);

  return (
    <div className="flex flex-col w-full bg-bit-surface">
      <TabBar tabs={tabs} activeTab={active} onTabChange={setActive} />
      <div className="p-4 text-[11px] text-bit-text-mid">
        <div>Active Tab: <span className="font-mono text-bit-teal font-bold">{active}</span></div>
      </div>
    </div>
  );
}

const meta: Meta<typeof TabBar> = {
  title: 'Panel/TabBar',
  component: TabBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof TabBar>;

export const Default: Story = {
  render: () => <InteractiveTabBar tabs={baseTabs} />,
};

export const FirstTabActive: Story = {
  args: {
    tabs: baseTabs,
    activeTab: 'design',
    onTabChange: () => {},
  },
};

export const MiddleTabActive: Story = {
  args: {
    tabs: baseTabs,
    activeTab: 'inspect',
    onTabChange: () => {},
  },
};

export const LastTabActive: Story = {
  args: {
    tabs: baseTabs,
    activeTab: 'settings',
    onTabChange: () => {},
  },
};

export const WithDisabledTab: Story = {
  render: () => <InteractiveTabBar tabs={tabsWithDisabled} />,
};

export const ManyTabs: Story = {
  render: () => <InteractiveTabBar tabs={tabsMany} />,
};

export const Interactive: Story = {
  render: () => {
    const [active, setActive] = useState('design');

    return (
      <div className="flex flex-col w-full bg-bit-surface">
        <TabBar
          tabs={baseTabs}
          activeTab={active}
          onTabChange={setActive}
        />
        <div className="p-4 space-y-2">
          <div className="text-[11px] text-bit-text-mid">
            Current Tab: <span className="font-mono text-bit-teal font-bold">{active}</span>
          </div>
          <div className="text-[10px] text-bit-muted">
            Click tabs to switch. Use keyboard for accessibility.
          </div>
        </div>
      </div>
    );
  },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 bg-bit-bg p-4 w-full">
      <div>
        <div className="text-[10px] font-bold text-bit-text-mid mb-2 uppercase">Default (Design active)</div>
        <div className="bg-bit-surface">
          <TabBar
            tabs={baseTabs}
            activeTab="design"
            onTabChange={() => {}}
          />
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold text-bit-text-mid mb-2 uppercase">With Disabled Tab</div>
        <div className="bg-bit-surface">
          <TabBar
            tabs={tabsWithDisabled}
            activeTab="design"
            onTabChange={() => {}}
          />
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold text-bit-text-mid mb-2 uppercase">Many Tabs (Properties active)</div>
        <div className="bg-bit-surface">
          <TabBar
            tabs={tabsMany}
            activeTab="properties"
            onTabChange={() => {}}
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};
