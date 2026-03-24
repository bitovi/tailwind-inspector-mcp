export type CanvasType = 'page' | 'component' | 'composition';

export interface CanvasTabProps {
  onStageDesign: (data: {
    image: string;
    width: number;
    height: number;
    canvasType: CanvasType;
    canvasName: string;
    canvasContent: string;
  }) => void;
}
