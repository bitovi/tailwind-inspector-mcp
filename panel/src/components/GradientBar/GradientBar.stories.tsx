import type { Meta, StoryObj } from '@storybook/react';
import { useState, useCallback } from 'react';
import { GradientBar } from './GradientBar';
import type { GradientStop } from './types';

function InteractiveGradientBar({ initialStops }: { initialStops: GradientStop[] }) {
  const [stops, setStops] = useState(initialStops);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextId, setNextId] = useState(10);

  const handleDrag = useCallback((stopId: string, newPos: number) => {
    setStops((prev) =>
      prev.map((s) => (s.id === stopId ? { ...s, position: newPos } : s))
    );
  }, []);

  const handleDragEnd = useCallback((_stopId: string, _pos: number) => {
    // In real app this would commit the change
  }, []);

  const handleClick = useCallback((stopId: string) => {
    setSelectedId((prev) => (prev === stopId ? null : stopId));
  }, []);

  const handleBarClick = useCallback((position: number) => {
    const newId = String(nextId);
    setNextId((n) => n + 1);
    const newStop: GradientStop = {
      id: newId,
      role: 'via',
      colorName: 'purple-500',
      hex: '#A855F7',
      position,
    };
    setStops((prev) => [...prev, newStop]);
    setSelectedId(newId);
  }, [nextId]);

  const handleRemove = useCallback((stopId: string) => {
    setStops((prev) => prev.filter((s) => s.id !== stopId));
    setSelectedId((prev) => (prev === stopId ? null : prev));
  }, []);

  const sorted = [...stops].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <div className="p-6 bg-bit-bg" style={{ width: 380 }}>
      <GradientBar
        stops={stops}
        direction="to right"
        onStopDrag={handleDrag}
        onStopDragEnd={handleDragEnd}
        onStopClick={handleClick}
        onBarClick={handleBarClick}
        onStopRemove={handleRemove}
        selectedStopId={selectedId}
      />
      <div className="mt-3 text-[10px] font-mono text-bit-text-mid">
        {sorted.map((s) => (
          <div key={s.id}>
            <span className="text-bit-teal">{s.role}</span>-{s.colorName}
            {s.position != null && ` ${s.position}%`}
            {s.id === selectedId && <span className="text-bit-orange ml-1">● selected</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const meta: Meta<typeof GradientBar> = {
  component: GradientBar,
  title: 'Panel/GradientBar',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof GradientBar>;

export const TwoStops: Story = {
  render: () => (
    <InteractiveGradientBar
      initialStops={[
        { id: '1', role: 'from', colorName: 'blue-500', hex: '#3B82F6', position: 0 },
        { id: '2', role: 'to', colorName: 'pink-500', hex: '#EC4899', position: 100 },
      ]}
    />
  ),
};

export const ThreeStopsWithPositions: Story = {
  render: () => (
    <InteractiveGradientBar
      initialStops={[
        { id: '1', role: 'from', colorName: 'indigo-500', hex: '#6366F1', position: 5 },
        { id: '2', role: 'via', colorName: 'purple-500', hex: '#A855F7', position: 50 },
        { id: '3', role: 'to', colorName: 'pink-500', hex: '#EC4899', position: 95 },
      ]}
    />
  ),
};

export const SelectedHandle: Story = {
  args: {
    stops: [
      { id: '1', role: 'from', colorName: 'indigo-500', hex: '#6366F1', position: 5 },
      { id: '2', role: 'via', colorName: 'purple-500', hex: '#A855F7', position: 50 },
      { id: '3', role: 'to', colorName: 'pink-500', hex: '#EC4899', position: 95 },
    ],
    direction: 'to right',
    selectedStopId: '1',
    onStopDrag: () => {},
    onStopDragEnd: () => {},
    onStopClick: () => {},
    onBarClick: () => {},
    onStopRemove: () => {},
  },
};

export const FourStops: Story = {
  render: () => (
    <InteractiveGradientBar
      initialStops={[
        { id: '1', role: 'from', colorName: 'red-500', hex: '#EF4444', position: 0 },
        { id: '2', role: 'via', colorName: 'yellow-300', hex: '#FDE047', position: 33 },
        { id: '3', role: 'via', colorName: 'green-500', hex: '#22C55E', position: 66 },
        { id: '4', role: 'to', colorName: 'blue-500', hex: '#3B82F6', position: 100 },
      ]}
    />
  ),
};

export const TwoStopsNaive: Story = {
  args: {
    stops: [
      { id: '1', role: 'from', colorName: 'purple-600', hex: '#9333EA', position: 0 },
      { id: '2', role: 'to', colorName: 'cyan-500', hex: '#06B6D4', position: 100 },
    ],
    direction: 'to right',
    selectedStopId: null,
    onStopDrag: () => {},
    onStopDragEnd: () => {},
    onStopClick: () => {},
    onBarClick: () => {},
    onStopRemove: () => {},
  },
};

export const ThreeStopsVertical: Story = {
  args: {
    stops: [
      { id: '1', role: 'from', colorName: 'slate-600', hex: '#475569', position: 0 },
      { id: '2', role: 'via', colorName: 'slate-400', hex: '#94A3B8', position: 50 },
      { id: '3', role: 'to', colorName: 'slate-200', hex: '#E2E8F0', position: 100 },
    ],
    direction: 'to bottom',
    selectedStopId: null,
    onStopDrag: () => {},
    onStopDragEnd: () => {},
    onStopClick: () => {},
    onBarClick: () => {},
    onStopRemove: () => {},
  },
};

export const DiagonalGradient: Story = {
  args: {
    stops: [
      { id: '1', role: 'from', colorName: 'orange-500', hex: '#F97316', position: 10 },
      { id: '2', role: 'via', colorName: 'red-500', hex: '#EF4444', position: 50 },
      { id: '3', role: 'to', colorName: 'rose-600', hex: '#E11D48', position: 90 },
    ],
    direction: 'to bottom right',
    selectedStopId: null,
    onStopDrag: () => {},
    onStopDragEnd: () => {},
    onStopClick: () => {},
    onBarClick: () => {},
    onStopRemove: () => {},
  },
};

export const NoPosition: Story = {
  args: {
    stops: [
      { id: '1', role: 'from', colorName: 'teal-500', hex: '#14B8A6', position: null },
      { id: '2', role: 'to', colorName: 'blue-500', hex: '#3B82F6', position: null },
    ],
    direction: 'to right',
    selectedStopId: null,
    onStopDrag: () => {},
    onStopDragEnd: () => {},
    onStopClick: () => {},
    onBarClick: () => {},
    onStopRemove: () => {},
  },
};
