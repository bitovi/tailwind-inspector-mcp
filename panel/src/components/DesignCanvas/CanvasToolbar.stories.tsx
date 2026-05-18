import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { CanvasToolbar } from './CanvasToolbar';
import type { DrawingTool } from './types';

const meta: Meta<typeof CanvasToolbar> = {
  title: 'Components/DesignCanvas/CanvasToolbar',
  component: CanvasToolbar,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof CanvasToolbar>;

function InteractiveToolbar() {
  const [activeTool, setActiveTool] = useState<DrawingTool>('freehand');
  const [fillColor, setFillColor] = useState('#3B82F6');
  const [strokeColor, setStrokeColor] = useState('#000000');

  return (
    <div style={{ maxWidth: 700 }}>
      <CanvasToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        fillColor={fillColor}
        onFillChange={setFillColor}
        strokeColor={strokeColor}
        onStrokeChange={setStrokeColor}
        canUndo={true}
        canRedo={false}
        onUndo={() => console.log('undo')}
        onRedo={() => console.log('redo')}
        onClear={() => console.log('clear')}
        onSubmit={() => console.log('submit')}
        onClose={() => console.log('close')}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <InteractiveToolbar />,
};

export const AllDisabled: Story = {
  render: () => (
    <div style={{ maxWidth: 700 }}>
      <CanvasToolbar
        activeTool="select"
        onToolChange={() => {}}
        fillColor="transparent"
        onFillChange={() => {}}
        strokeColor="#000000"
        onStrokeChange={() => {}}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        onClear={() => {}}
      />
    </div>
  ),
};

export const WithoutCloseSubmit: Story = {
  render: () => (
    <div style={{ maxWidth: 700 }}>
      <CanvasToolbar
        activeTool="rectangle"
        onToolChange={() => {}}
        fillColor="#EF4444"
        onFillChange={() => {}}
        strokeColor="#000000"
        onStrokeChange={() => {}}
        canUndo={true}
        canRedo={true}
        onUndo={() => {}}
        onRedo={() => {}}
        onClear={() => {}}
      />
    </div>
  ),
};
