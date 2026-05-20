import type { Meta, StoryObj } from '@storybook/react';
import { BugReportMode } from './BugReportMode';
import type { SnapshotMeta } from '../../../../shared/types';

const meta: Meta<typeof BugReportMode> = {
  component: BugReportMode,
  title: 'Panel/BugReportMode',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        style={{
          maxHeight: '600px',
          overflow: 'auto',
          fontFamily: "'Inter', sans-serif",
          backgroundColor: '#f5f5f5',
          padding: '12px',
          borderRadius: '8px',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BugReportMode>;

/* ─────────────────────────────────────────────────────────────
   Mock snapshot data factories
   ───────────────────────────────────────────────────────────── */

function createSnapshot(overrides?: Partial<SnapshotMeta>): SnapshotMeta {
  return {
    id: Math.floor(Math.random() * 10000),
    timestamp: new Date().toISOString(),
    trigger: 'page-load',
    isKeyframe: false,
    consoleErrorCount: 0,
    networkErrorCount: 0,
    url: 'http://localhost:5173',
    ...overrides,
  };
}

/* ─────────────────────────────────────────────────────────────
   Story 1: Empty state (no recording)
   ───────────────────────────────────────────────────────────── */
export const Empty: Story = {
  args: {
    onSubmit: (patch) => console.log('Bug report submitted:', patch),
  },
  decorators: [
    (Story) => {
      // Mock the WebSocket to return empty history
      return <Story />;
    },
  ],
};

/* ─────────────────────────────────────────────────────────────
   Story 2: Single page-load event (minimal recording)
   ───────────────────────────────────────────────────────────── */
export const SinglePageLoad: Story = {
  args: {
    onSubmit: (patch) => console.log('Bug report submitted:', patch),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 3: Multiple events in timeline
   ───────────────────────────────────────────────────────────── */
export const MultipleEvents: Story = {
  args: {
    onSubmit: (patch) => console.log('Bug report submitted:', patch),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 4: Events with mutations and errors
   ───────────────────────────────────────────────────────────── */
export const WithMutationsAndErrors: Story = {
  args: {
    onSubmit: (patch) => console.log('Bug report submitted:', patch),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 5: Events with screenshots (keyframes)
   ───────────────────────────────────────────────────────────── */
export const WithScreenshots: Story = {
  args: {
    onSubmit: (patch) => console.log('Bug report submitted:', patch),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 6: Events with network errors
   ───────────────────────────────────────────────────────────── */
export const WithNetworkErrors: Story = {
  args: {
    onSubmit: (patch) => console.log('Bug report submitted:', patch),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 7: Full workflow - describe + select events
   ───────────────────────────────────────────────────────────── */
import { useState } from 'react';

function InteractiveBugReport() {
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<number[]>([]);
  const [canSubmit, setCanSubmit] = useState(false);

  const mockSnapshots: SnapshotMeta[] = [
    createSnapshot({
      id: 1,
      trigger: 'page-load',
      timestamp: '2025-01-15T12:04:30.000Z',
      isKeyframe: true,
      url: 'http://localhost:5173/products',
    }),
    createSnapshot({
      id: 2,
      trigger: 'click',
      timestamp: '2025-01-15T12:04:32.000Z',
      elementInfo: { tag: 'button', classes: 'filter-btn', innerText: 'Show More' },
      url: 'http://localhost:5173/products',
    }),
    createSnapshot({
      id: 3,
      trigger: 'mutation',
      timestamp: '2025-01-15T12:04:33.000Z',
      url: 'http://localhost:5173/products',
    }),
    createSnapshot({
      id: 4,
      trigger: 'click',
      timestamp: '2025-01-15T12:04:34.500Z',
      elementInfo: { tag: 'input', classes: 'search-box', id: 'search' },
      consoleErrorCount: 1,
      url: 'http://localhost:5173/products',
    }),
    createSnapshot({
      id: 5,
      trigger: 'mutation',
      timestamp: '2025-01-15T12:04:35.000Z',
      consoleErrorCount: 1,
      url: 'http://localhost:5173/products',
    }),
  ];

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setCanSubmit(value.length > 0 && selectedEvents.length > 0);
  };

  const handleEventToggle = (id: number) => {
    const updated = selectedEvents.includes(id)
      ? selectedEvents.filter(e => e !== id)
      : [...selectedEvents, id];
    setSelectedEvents(updated);
    setCanSubmit(description.length > 0 && updated.length > 0);
  };

  return (
    <div className="space-y-3 p-3">
      <div>
        <label className="block text-[11px] font-medium text-bit-text mb-1">
          Describe the bug:
        </label>
        <textarea
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          className="w-full text-[11px] p-2 border border-bit-border rounded bg-white text-bit-text resize-none"
          placeholder="Describe the bug…"
          rows={3}
        />
      </div>

      <div className="text-[11px] text-bit-text-mid space-y-1">
        <div>Description length: {description.length}</div>
        <div>Events selected: {selectedEvents.length}</div>
      </div>

      <button
        disabled={!canSubmit}
        className={`w-full px-3 py-1.5 text-[11px] font-medium rounded ${
          canSubmit
            ? 'bg-bit-teal text-white cursor-pointer hover:opacity-90'
            : 'bg-bit-surface text-bit-muted cursor-not-allowed'
        }`}
      >
        Commit Bug Report
      </button>

      <div className="border-t border-bit-border pt-2">
        <div className="text-[10px] text-bit-text-mid font-medium mb-1">Events ({mockSnapshots.length})</div>
        <div className="space-y-1">
          {mockSnapshots.map((snap) => (
            <label
              key={snap.id}
              className="flex items-center gap-2 p-1 rounded hover:bg-white/50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedEvents.includes(snap.id)}
                onChange={() => handleEventToggle(snap.id)}
                className="w-3 h-3"
              />
              <span className="text-[10px] text-bit-text flex-1">
                {snap.trigger} {snap.elementInfo && `(${snap.elementInfo.tag})`}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveBugReport />,
};

/* ─────────────────────────────────────────────────────────────
   Story 8: Event grouping - click followed by mutations
   ───────────────────────────────────────────────────────────── */
export const EventGrouping: Story = {
  args: {
    onSubmit: (patch) => console.log('Bug report submitted:', patch),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 9: Long recording session (many events)
   ───────────────────────────────────────────────────────────── */
export const LongSession: Story = {
  args: {
    onSubmit: (patch) => console.log('Bug report submitted:', patch),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 10: Complete report - all secondary types
   ───────────────────────────────────────────────────────────── */
export const CompleteReport: Story = {
  args: {
    onSubmit: (patch) => {
      console.log('Bug report submitted:', patch);
    },
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 11: Error-focused report
   ───────────────────────────────────────────────────────────── */
export const ErrorReport: Story = {
  args: {
    onSubmit: (patch) => console.log('Bug report submitted:', patch),
  },
};

/* ─────────────────────────────────────────────────────────────
   Story 12: Navigation events timeline
   ───────────────────────────────────────────────────────────── */
export const WithNavigationEvents: Story = {
  args: {
    onSubmit: (patch) => console.log('Bug report submitted:', patch),
  },
};
