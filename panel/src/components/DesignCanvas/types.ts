import type { CanvasComponent } from '../../../../shared/types';

export type DrawingTool = 'freehand' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'text' | 'eraser' | 'select';

export const BASIC_COLORS = [
  '#000000', // black
  '#ffffff', // white
  '#9CA3AF', // gray
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#6366F1', // indigo
] as const;

/** Component armed for placement from the DrawTab */
export interface ArmedComponent {
  componentName: string;
  storyId: string;
  ghostHtml: string;
  componentPath?: string;
  args?: Record<string, unknown>;
}

export interface DesignCanvasProps {
  onSubmit: (imageDataUrl: string, width: number, height: number, canvasComponents?: CanvasComponent[]) => void;
  onClose?: () => void;
  backgroundImage?: string;  // base64 PNG data URL — locked background for screenshot annotation
  armedComponent?: ArmedComponent | null;
  onComponentPlaced?: () => void;  // called after a component is dropped on the canvas
  hideActions?: boolean;     // hide submit/close buttons from the toolbar
}
