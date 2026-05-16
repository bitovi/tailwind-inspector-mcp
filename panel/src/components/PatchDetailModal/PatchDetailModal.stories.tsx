import type { Meta, StoryObj } from '@storybook/react';
import { PatchDetailModal } from './PatchDetailModal';
import type { Commit, Patch } from '../../../../shared/types';

const meta: Meta<typeof PatchDetailModal> = {
  component: PatchDetailModal,
  title: 'Panel/PatchDetailModal',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ fontFamily: "'Inter', sans-serif", minHeight: '600px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PatchDetailModal>;

/* ─────────────────────────────────────────────────────────────
   Mock data factories
   ───────────────────────────────────────────────────────────── */

function createClassChangePatch(overrides?: Partial<Patch>): Patch {
  return {
    id: `patch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind: 'class-change',
    elementKey: 'button.submit',
    status: 'committed',
    originalClass: 'bg-blue-500',
    newClass: 'bg-red-500',
    property: 'bg',
    timestamp: new Date().toISOString(),
    pageUrl: 'http://localhost:5173/products',
    component: { name: 'SubmitButton', instanceCount: 1 },
    target: { tag: 'button', classes: 'submit btn-primary', innerText: 'Submit' },
    context: 'Form validation feedback',
    ...overrides,
  };
}

function createMessagePatch(message: string): Patch {
  return {
    id: `patch-msg-${Date.now()}`,
    kind: 'message',
    elementKey: '',
    status: 'committed',
    message,
    timestamp: new Date().toISOString(),
    pageUrl: 'http://localhost:5173',
  };
}

function createComponentDropPatch(): Patch {
  return {
    id: `patch-drop-${Date.now()}`,
    kind: 'component-drop',
    elementKey: 'div.main',
    status: 'committed',
    timestamp: new Date().toISOString(),
    pageUrl: 'http://localhost:5173',
    component: { name: 'MainContainer' },
    target: { tag: 'div', classes: 'main-content', innerText: '' },
    insertMode: 'last-child',
    ghostHtml: '<div class="card shadow-md p-4">New component</div>',
    ghostCss: '.card { background: white; border-radius: 0.5rem; }',
    componentPath: './src/components/Card.tsx',
  };
}

function createCommit(patches: Patch[]): Commit {
  return {
    id: `commit-${Date.now()}`,
    patches,
    status: 'committed',
    timestamp: new Date().toISOString(),
  };
}

/* ─────────────────────────────────────────────────────────────
   Story 1: Null state (modal closed)
   ───────────────────────────────────────────────────────────── */
export const Closed: Story = {
  args: {
    commit: null,
    remainingCount: 5,
    onClose: () => console.log('Close modal'),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 2: Single class-change patch
   ───────────────────────────────────────────────────────────── */
export const SingleClassChange: Story = {
  args: {
    commit: createCommit([
      createClassChangePatch({
        originalClass: 'text-gray-600',
        newClass: 'text-blue-600',
        property: 'text',
      }),
    ]),
    remainingCount: 3,
    onClose: () => console.log('Close modal'),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 3: Multiple related patches in one commit
   ───────────────────────────────────────────────────────────── */
export const MultiplePatches: Story = {
  args: {
    commit: createCommit([
      createClassChangePatch({
        originalClass: 'px-2',
        newClass: 'px-4',
        property: 'px',
        component: { name: 'Button' },
      }),
      createClassChangePatch({
        id: 'patch-2',
        originalClass: 'py-1',
        newClass: 'py-2',
        property: 'py',
        component: { name: 'Button' },
        target: { tag: 'button', classes: 'btn btn-sm', innerText: 'Save' },
      }),
      createClassChangePatch({
        id: 'patch-3',
        originalClass: 'rounded-sm',
        newClass: 'rounded-lg',
        property: 'rounded',
        component: { name: 'Button' },
        target: { tag: 'button', classes: 'btn btn-sm', innerText: 'Save' },
      }),
    ]),
    remainingCount: 2,
    onClose: () => console.log('Close modal'),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 4: Mixed patch types (class change + component drop + message)
   ───────────────────────────────────────────────────────────── */
export const MixedPatchTypes: Story = {
  args: {
    commit: createCommit([
      createMessagePatch('Updated button styling to match design system'),
      createClassChangePatch({
        originalClass: 'bg-gray-200',
        newClass: 'bg-bit-orange',
        property: 'bg',
        component: { name: 'ActionButton' },
      }),
      createComponentDropPatch(),
      createMessagePatch('Component added to improve user feedback'),
    ]),
    remainingCount: 0,
    onClose: () => console.log('Close modal'),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 5: Complex commit with images + markdown instructions
   ───────────────────────────────────────────────────────────── */
export const WithComplexContent: Story = {
  args: {
    commit: createCommit([
      {
        ...createClassChangePatch(),
        // In real scenario, this would be populated by buildContentParts
        // which generates markdown and image data from MCP response
      },
    ]),
    remainingCount: 7,
    onClose: () => console.log('Close modal'),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 6: Large number of remaining patches (queue scenario)
   ───────────────────────────────────────────────────────────── */
export const LargeQueue: Story = {
  args: {
    commit: createCommit([
      createClassChangePatch({
        originalClass: 'shadow-sm',
        newClass: 'shadow-lg',
        property: 'shadow',
      }),
    ]),
    remainingCount: 47,
    onClose: () => console.log('Close modal'),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 7: Error patch with error message
   ───────────────────────────────────────────────────────────── */
export const WithErrorPatch: Story = {
  args: {
    commit: createCommit([
      createClassChangePatch({
        status: 'error',
        originalClass: 'flex-col',
        newClass: 'flex-row',
        property: 'flex',
        errorMessage: 'Failed to apply change: element not found in DOM',
        component: { name: 'Layout', instanceCount: 5 },
      }),
    ]),
    remainingCount: 2,
    onClose: () => console.log('Close modal'),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 8: Empty commit edge case
   ───────────────────────────────────────────────────────────── */
export const Empty: Story = {
  args: {
    commit: createCommit([]),
    remainingCount: 10,
    onClose: () => console.log('Close modal'),
  },
};
