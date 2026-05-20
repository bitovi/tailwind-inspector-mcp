import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ElementsTab } from './ElementsTab';
import type { Primitive } from './types';

const meta: Meta<typeof ElementsTab> = {
  component: ElementsTab,
  title: 'Panel/ElementsTab',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 300, fontFamily: "'Inter', sans-serif", backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '8px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ElementsTab>;

/* ─────────────────────────────────────────────────────────────
   Mock primitive factories
   ───────────────────────────────────────────────────────────── */

const CHILD_CLASSES = 'p-1 text-sm rounded border border-dashed border-black';

function createPrimitive(overrides?: Partial<Primitive>): Primitive {
  return {
    id: `primitive-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: 'div.flex-row',
    ghostHtml: `<div class="flex flex-row gap-2"><div class="${CHILD_CLASSES}">01</div><div class="${CHILD_CLASSES}">02</div></div>`,
    previewCss: `
      .flex { display: flex; }
      .flex-row { flex-direction: row; }
      .gap-2 { gap: 0.5rem; }
      .p-1 { padding: 0.25rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .rounded { border-radius: 0.25rem; }
      .border { border-width: 1px; }
      .border-dashed { border-style: dashed; }
      .border-black { border-color: black; }
    `,
    ...overrides,
  };
}

/* Mock PRIMITIVES for isolated story testing */
const mockPrimitives: Primitive[] = [
  {
    id: 'div-flex-row',
    name: 'div.flex-row',
    ghostHtml: `<div class="flex flex-row gap-2"><div class="${CHILD_CLASSES}">01</div><div class="${CHILD_CLASSES}">02</div></div>`,
    previewCss: `
      .flex { display: flex; }
      .flex-row { flex-direction: row; }
      .gap-2 { gap: 0.5rem; }
      .p-1 { padding: 0.25rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .rounded { border-radius: 0.25rem; }
      .border { border-width: 1px; }
      .border-dashed { border-style: dashed; }
      .border-black { border-color: black; }
    `,
  },
  {
    id: 'div-flex-col',
    name: 'div.flex-col',
    ghostHtml: `<div class="flex flex-col gap-2"><div class="${CHILD_CLASSES}">01</div><div class="${CHILD_CLASSES}">02</div></div>`,
    previewCss: `
      .flex { display: flex; }
      .flex-col { flex-direction: column; }
      .gap-2 { gap: 0.5rem; }
      .p-1 { padding: 0.25rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .rounded { border-radius: 0.25rem; }
      .border { border-width: 1px; }
      .border-dashed { border-style: dashed; }
      .border-black { border-color: black; }
    `,
  },
  {
    id: 'button-inline',
    name: 'button.inline',
    ghostHtml: `<button class="inline p-1 text-sm rounded border border-dashed border-black bg-[#e5e7eb]">button</button>`,
    previewCss: `
      .inline { display: inline; }
      .p-1 { padding: 0.25rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .rounded { border-radius: 0.25rem; }
      .border { border-width: 1px; }
      .border-dashed { border-style: dashed; }
      .border-black { border-color: black; }
      .bg-\\[\\#e5e7eb\\] { background-color: #e5e7eb; }
    `,
  },
];

/* ─────────────────────────────────────────────────────────────
   Story 1: Default place mode with all primitives
   ───────────────────────────────────────────────────────────── */
export const DefaultPlaceMode: Story = {
  args: {
    insertMode: 'place',
    onArmedChange: (armed) => console.log('Armed:', armed),
  },
  decorators: [
    (Story) => {
      // Mock the PRIMITIVES export for this story
      return <Story />;
    },
  ],
};

/* ─────────────────────────────────────────────────────────────
   Story 2: Replace mode (different button labels)
   ───────────────────────────────────────────────────────────── */
export const ReplaceMode: Story = {
  args: {
    insertMode: 'replace',
    onArmedChange: (armed) => console.log('Armed:', armed),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 3: Interactive state - armed component
   ───────────────────────────────────────────────────────────── */

function InteractiveElementsTab() {
  const [armedId, setArmedId] = useState<string | null>(null);
  const [insertMode, setInsertMode] = useState<'place' | 'replace'>('place');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          className={`px-2 py-1 text-[11px] rounded ${
            insertMode === 'place'
              ? 'bg-bit-teal text-white'
              : 'bg-bit-surface-hi text-bit-text border border-bit-border'
          }`}
          onClick={() => setInsertMode('place')}
        >
          Place
        </button>
        <button
          className={`px-2 py-1 text-[11px] rounded ${
            insertMode === 'replace'
              ? 'bg-bit-teal text-white'
              : 'bg-bit-surface-hi text-bit-text border border-bit-border'
          }`}
          onClick={() => setInsertMode('replace')}
        >
          Replace
        </button>
      </div>

      <ElementsTab
        insertMode={insertMode}
        onArmedChange={(armed) => {
          console.log('Armed changed:', armed);
        }}
      />

      <div className="text-[11px] text-bit-text-mid border-t border-bit-border pt-2">
        <div>Current mode: <span className="font-mono text-bit-text">{insertMode}</span></div>
        {armedId && <div>Armed: <span className="font-mono text-bit-text">{armedId}</span></div>}
      </div>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveElementsTab />,
};

/* ─────────────────────────────────────────────────────────────
   Story 4: Element selection workflow
   ───────────────────────────────────────────────────────────── */
function SelectionWorkflowComponent() {
  const [selectedPrimitive, setSelectedPrimitive] = useState<string | null>(null);
  const [committed, setCommitted] = useState<string[]>([]);

  return (
    <div className="space-y-3">
      <ElementsTab
        insertMode="place"
        onArmedChange={(armed) => {
          console.log('Armed:', armed);
        }}
      />
      <div className="text-[11px] text-bit-text-mid space-y-1">
        <div>Selected: <span className="font-mono text-bit-text">{selectedPrimitive || 'none'}</span></div>
        <div>Committed count: <span className="font-mono text-bit-text">{committed.length}</span></div>
      </div>
    </div>
  );
}

export const SelectionWorkflow: Story = {
  render: () => <SelectionWorkflowComponent />,
};

/* ─────────────────────────────────────────────────────────────
   Story 5: No action callback (read-only)
   ───────────────────────────────────────────────────────────── */
export const ReadOnly: Story = {
  args: {
    insertMode: 'place',
    // No onArmedChange callback provided
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 6: Disabled state simulation (all buttons disabled)
   ───────────────────────────────────────────────────────────── */
export const Disabled: Story = {
  args: {
    insertMode: 'place',
    onArmedChange: undefined,
  },
  render: (args) => (
    <div className="opacity-50 pointer-events-none">
      <ElementsTab {...args} />
    </div>
  ),
};
