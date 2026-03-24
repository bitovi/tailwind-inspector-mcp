import { useState, useCallback } from 'react';
import { DesignCanvas } from '../DesignCanvas';
import type { CanvasTabProps, CanvasType } from './types';

const CANVAS_TYPES: { id: CanvasType; label: string; placeholder: string }[] = [
  { id: 'page', label: 'Page', placeholder: '/about, /dashboard/settings' },
  { id: 'component', label: 'Component', placeholder: 'LoginForm, PricingCard' },
  { id: 'composition', label: 'Composition', placeholder: 'Hero + Features + CTA' },
];

export function CanvasTab({ onStageDesign }: CanvasTabProps) {
  const [canvasType, setCanvasType] = useState<CanvasType>('page');
  const [canvasName, setCanvasName] = useState('');
  const [canvasContent, setCanvasContent] = useState('');
  const [showContent, setShowContent] = useState(false);

  const currentType = CANVAS_TYPES.find(t => t.id === canvasType) ?? CANVAS_TYPES[0];

  const handleSubmit = useCallback(
    (imageDataUrl: string, width: number, height: number) => {
      onStageDesign({
        image: imageDataUrl,
        width,
        height,
        canvasType,
        canvasName: canvasName.trim(),
        canvasContent: canvasContent.trim(),
      });
    },
    [onStageDesign, canvasType, canvasName, canvasContent],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header: type selector + name input */}
      <div className="px-2.5 py-2 border-b border-bv-border space-y-2 shrink-0">
        {/* Type segmented control */}
        <div className="flex rounded-md border border-bv-border overflow-hidden">
          {CANVAS_TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setCanvasType(t.id)}
              className={`flex-1 px-2 py-1 text-[10px] font-semibold transition-colors
                ${canvasType === t.id
                  ? 'bg-bv-teal text-white'
                  : 'bg-bv-surface text-bv-text-mid hover:bg-bv-surface-hi hover:text-bv-text'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Name input */}
        <input
          type="text"
          value={canvasName}
          onChange={e => setCanvasName(e.target.value)}
          placeholder={currentType.placeholder}
          className="w-full px-2 py-1 rounded border border-bv-border bg-bv-surface text-bv-text text-[11px] placeholder:text-bv-muted focus:outline-none focus:border-bv-teal"
        />
      </div>

      {/* Content toggle + textarea */}
      <div className="px-2.5 py-1.5 border-b border-bv-border shrink-0">
        <button
          type="button"
          onClick={() => setShowContent(!showContent)}
          className="flex items-center gap-1 text-[10px] text-bv-text-mid hover:text-bv-text transition-colors"
        >
          <span className={`inline-block transition-transform ${showContent ? 'rotate-90' : ''}`}>▸</span>
          Content / Copy
        </button>
        {showContent && (
          <textarea
            value={canvasContent}
            onChange={e => setCanvasContent(e.target.value)}
            placeholder="Describe the content: headings, body text, button labels, data to display…"
            rows={3}
            className="mt-1.5 w-full px-2 py-1.5 rounded border border-bv-border bg-bv-surface text-bv-text text-[11px] placeholder:text-bv-muted resize-y focus:outline-none focus:border-bv-teal"
          />
        )}
      </div>

      {/* Drawing canvas — fills remaining space, toolbar has the submit button */}
      <div className="flex-1 min-h-0">
        <DesignCanvas onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
