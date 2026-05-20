import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PatchPopover } from './PatchPopover';
import type { Patch, PatchSummary } from '../../../../shared/types';

const meta: Meta<typeof PatchPopover> = {
  component: PatchPopover,
  title: 'Panel/PatchPopover',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: '40px', fontFamily: "'Inter', sans-serif", minHeight: '300px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PatchPopover>;

/* ─────────────────────────────────────────────────────────────
   Mock data factories
   ───────────────────────────────────────────────────────────── */

function createClassChangePatch(overrides?: Partial<Patch>): Patch {
  return {
    id: `patch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind: 'class-change',
    elementKey: 'button.submit-btn',
    status: 'staged',
    originalClass: 'bg-blue-500',
    newClass: 'bg-red-500',
    property: 'bg',
    timestamp: new Date().toISOString(),
    pageUrl: 'http://localhost:5173',
    component: { name: 'SubmitButton', instanceCount: 1 },
    target: { tag: 'button', classes: 'submit-btn btn-primary', innerText: 'Submit' },
    context: 'Form validation feedback',
    ...overrides,
  };
}

function createComponentDropPatch(overrides?: Partial<Patch>): Patch {
  return {
    id: `patch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind: 'component-drop',
    elementKey: 'div.container',
    status: 'staged',
    timestamp: new Date().toISOString(),
    pageUrl: 'http://localhost:5173',
    component: { name: 'Container' },
    target: { tag: 'div', classes: 'container mx-auto', innerText: '' },
    insertMode: 'last-child',
    ghostHtml: '<button class="px-3 py-1 rounded bg-blue-500 text-white">Click me</button>',
    ghostCss: '.rounded { border-radius: 0.25rem; }',
    componentPath: './src/components/Button.tsx',
    ...overrides,
  };
}

function createPatchSummary(overrides?: Partial<PatchSummary>): PatchSummary {
  return {
    id: `patch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind: 'class-change',
    elementKey: 'span.label',
    status: 'staged',
    originalClass: 'text-gray-600',
    newClass: 'text-blue-600',
    property: 'text',
    timestamp: new Date().toISOString(),
    component: { name: 'Label' },
    ...overrides,
  };
}

/* ─────────────────────────────────────────────────────────────
   Story 1: No patches (inactive state)
   ───────────────────────────────────────────────────────────── */
export const Empty: Story = {
  args: {
    label: 'Pending',
    count: 0,
    items: [],
    activeColor: 'text-bit-text',
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 2: Single staged patch (text color change)
   ───────────────────────────────────────────────────────────── */
export const SingleStagedPatch: Story = {
  args: {
    label: 'Staged',
    count: 1,
    items: [
      createClassChangePatch({
        status: 'staged',
        originalClass: 'text-gray-500',
        newClass: 'text-blue-600',
        property: 'text',
        newClass: 'text-blue-600',
      }),
    ],
    activeColor: 'text-bit-orange',
    dotColor: 'bg-bit-orange',
    onCommit: () => console.log('Commit clicked'),
    onDiscard: () => console.log('Discard clicked'),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 3: Multiple staged patches (mixed types)
   ───────────────────────────────────────────────────────────── */
export const MultipleStagedPatches: Story = {
  args: {
    label: 'Staged',
    count: 3,
    items: [
      createClassChangePatch({
        status: 'staged',
        originalClass: 'px-2',
        newClass: 'px-4',
        property: 'px',
      }),
      createClassChangePatch({
        id: 'patch-2',
        status: 'staged',
        originalClass: 'py-1',
        newClass: 'py-2',
        property: 'py',
        component: { name: 'Card' },
        target: { tag: 'div', classes: 'card shadow', innerText: '' },
      }),
      createComponentDropPatch({
        status: 'staged',
      }),
    ],
    activeColor: 'text-bit-orange',
    dotColor: 'bg-bit-orange',
    onCommit: (id) => console.log('Commit patch:', id),
    onDiscard: (id) => console.log('Discard patch:', id),
    onCommitAll: () => console.log('Commit all'),
    onDiscardAll: () => console.log('Discard all'),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 4: Committed patches
   ───────────────────────────────────────────────────────────── */
export const CommittedPatches: Story = {
  args: {
    label: 'Committed',
    count: 2,
    items: [
      createClassChangePatch({
        status: 'committed',
        originalClass: 'bg-gray-100',
        newClass: 'bg-blue-50',
        property: 'bg',
        timestamp: new Date(Date.now() - 5000).toISOString(),
      }),
      createClassChangePatch({
        id: 'patch-2',
        status: 'committed',
        originalClass: 'rounded-sm',
        newClass: 'rounded-md',
        property: 'rounded',
        component: { name: 'Button' },
        timestamp: new Date(Date.now() - 3000).toISOString(),
      }),
    ],
    activeColor: 'text-bit-teal',
    dotColor: 'bg-bit-teal',
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 5: Implementing patches (agent working)
   ───────────────────────────────────────────────────────────── */
export const ImplementingPatches: Story = {
  args: {
    label: 'Implementing',
    count: 1,
    items: [
      createClassChangePatch({
        status: 'implementing',
        originalClass: 'shadow-sm',
        newClass: 'shadow-md',
        property: 'shadow',
        component: { name: 'Card', instanceCount: 3 },
      }),
    ],
    activeColor: 'text-bit-text-mid',
    dotColor: 'bg-yellow-500',
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 6: Error state patches
   ───────────────────────────────────────────────────────────── */
export const ErrorPatches: Story = {
  args: {
    label: 'Errors',
    count: 1,
    items: [
      createClassChangePatch({
        status: 'error',
        originalClass: 'flex-col',
        newClass: 'flex-row',
        property: 'flex',
        errorMessage: 'Component instance count exceeded 10. Manual intervention required.',
        component: { name: 'Layout', instanceCount: 15 },
      }),
    ],
    activeColor: 'text-red-500',
    dotColor: 'bg-red-500',
    onDiscard: (id) => console.log('Discard error patch:', id),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 7: Interactive state management
   ───────────────────────────────────────────────────────────── */
function InteractivePatchPopover() {
  const [patches, setPatches] = useState<Patch[]>([
    createClassChangePatch({ status: 'staged' }),
    createClassChangePatch({
      id: 'patch-2',
      status: 'staged',
      originalClass: 'text-sm',
      newClass: 'text-base',
      property: 'text',
      component: { name: 'Caption' },
    }),
  ]);

  const handleCommit = (id: string) => {
    setPatches(patches.map(p => p.id === id ? { ...p, status: 'committed' as const } : p));
  };

  const handleDiscard = (id: string) => {
    setPatches(patches.filter(p => p.id !== id));
  };

  const handleCommitAll = () => {
    setPatches(patches.map(p => ({ ...p, status: 'committed' as const })));
  };

  const handleDiscardAll = () => {
    setPatches([]);
  };

  return (
    <div className="space-y-6">
      <PatchPopover
        label="Staged"
        count={patches.length}
        items={patches}
        activeColor="text-bit-orange"
        dotColor="bg-bit-orange"
        onCommit={handleCommit}
        onDiscard={handleDiscard}
        onCommitAll={handleCommitAll}
        onDiscardAll={handleDiscardAll}
        onItemClick={(id) => console.log('View patch details:', id)}
      />
      <div className="text-[12px] text-bit-text-mid border-t border-bit-border pt-4">
        <div>Total patches: {patches.length}</div>
        <div>Statuses: {patches.map(p => p.status).join(', ') || 'none'}</div>
      </div>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractivePatchPopover />,
};
