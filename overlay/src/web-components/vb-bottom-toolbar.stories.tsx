import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

// Side-effect imports: register custom elements
import './vb-overlay-host';
import './vb-bottom-toolbar';

type VisualState = 'picking' | 'engaged' | 'completed' | 'dim' | null;

function ToolbarStory({ states, instanceCount }: { states?: Record<string, VisualState>; instanceCount?: number }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current as any;
    if (el && states) el.applyVisualStates(states);
  });
  return <vb-bottom-toolbar ref={ref} instance-count={instanceCount ?? 0} />;
}

/**
 * vb-bottom-toolbar — Floating bar with Select (+ adjunct) and Insert buttons.
 *
 * Visual states:
 * - **picking** (orange) — tool is active, user is in selection/insert mode
 * - **engaged** (teal) — tool has a result, element is selected/placed
 * - **dim** — other tool is active, this one is de-emphasized
 */
const meta: Meta = {
  title: 'Overlay/VbBottomToolbar',
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'desktop' },
  },
  decorators: [
    (Story) => (
      <vb-overlay-host>
        <Story />
      </vb-overlay-host>
    ),
  ],
};

export default meta;

export const Default: StoryObj = {
  render: () => <ToolbarStory />,
};

/** Select is orange — picking mode, user is actively selecting */
export const SelectPicking: StoryObj = {
  render: () => <ToolbarStory states={{ select: 'picking', insert: 'dim' }} />,
};

/** Select is teal — engaged, an element is selected */
export const SelectEngaged: StoryObj = {
  render: () => <ToolbarStory states={{ select: 'engaged', insert: 'dim' }} />,
};

/** Insert is orange — picking mode, user is choosing where to insert */
export const InsertPicking: StoryObj = {
  render: () => <ToolbarStory states={{ insert: 'picking', select: 'dim' }} />,
};

/** Insert is teal — engaged, element has been placed */
export const InsertEngaged: StoryObj = {
  render: () => <ToolbarStory states={{ insert: 'engaged', select: 'dim' }} />,
};

export const WithInstanceCount: StoryObj = {
  render: () => <ToolbarStory states={{ select: 'engaged', insert: 'dim' }} instanceCount={3} />,
};

export const Disabled: StoryObj = {
  render: () => <vb-bottom-toolbar disabled />,
};
