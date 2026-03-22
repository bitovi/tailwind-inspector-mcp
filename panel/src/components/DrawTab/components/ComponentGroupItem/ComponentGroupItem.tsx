import { useState, useEffect, useRef, useCallback } from 'react';
import type { ComponentGroup } from '../../types';
import { useStoryProbe } from '../../hooks/useStoryProbe';
import { buildArgsUrl } from '../../hooks/useArgsUrl';
import { ArgsForm } from '../ArgsForm';
import type { AdaptiveIframe } from '../../../../../../overlay/src/adaptive-iframe/adaptive-iframe';
import '../../../../../../overlay/src/adaptive-iframe';

interface ComponentGroupItemProps {
  group: ComponentGroup;
  isArmed: boolean;
  onArm: (ghostHtml: string, args?: Record<string, unknown>) => void;
  onDisarm: () => void;
}

export function ComponentGroupItem({ group, isArmed, onArm, onDisarm }: ComponentGroupItemProps) {
  const { bestStory, probing, argTypes, defaultArgs } = useStoryProbe(group.stories);
  const [args, setArgs] = useState<Record<string, unknown>>({});
  const [showProps, setShowProps] = useState(false);
  const ghostRef = useRef<HTMLElement>(null);
  const initialLoadDone = useRef(false);

  // Sync default args from probe into local state when probe completes
  useEffect(() => {
    if (!probing && defaultArgs) {
      setArgs(defaultArgs);
    }
  }, [probing, defaultArgs]);

  // Set the story URL once when ready
  useEffect(() => {
    if (!ghostRef.current || !bestStory || initialLoadDone.current) return;
    initialLoadDone.current = true;
    const initialUrl = buildArgsUrl(bestStory.id, {});
    ghostRef.current.setAttribute('src', initialUrl);
  }, [bestStory]);

  // Subsequent args changes: send updateArgs to the existing iframe
  const handleArgsChange = useCallback((newArgs: Record<string, unknown>) => {
    setArgs(newArgs);
    if (!ghostRef.current || !bestStory) return;
    const el = ghostRef.current as unknown as AdaptiveIframe;
    if (typeof el.updateArgs === 'function') {
      el.updateArgs(bestStory.id, newArgs);
    }
  }, [bestStory]);

  // Click card to arm/disarm
  const handleArmClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // prevent DrawTab's document click listener from immediately disarming
    if (isArmed) {
      onDisarm();
      return;
    }
    const el = ghostRef.current as unknown as AdaptiveIframe;
    const ghostHtml = el.getComponentHtml?.() ?? '';
    onArm(ghostHtml, args);
  }, [isArmed, onArm, onDisarm, args]);

  const hasArgs = Object.keys(argTypes).length > 0;

  return (
    <li
      className={`group rounded border overflow-hidden cursor-pointer transition-[border-color,box-shadow] ${
        isArmed
          ? 'border-bv-teal shadow-[0_0_0_2px_var(--color-bv-teal),0_0_12px_rgba(0,132,139,0.2)]'
          : 'border-bv-border hover:border-[#555]'
      }`}
      onClick={handleArmClick}
    >
      {/* Preview area */}
      <div className={`flex items-center justify-center min-h-14 overflow-hidden ${isArmed ? 'bg-[rgba(0,132,139,0.06)]' : 'bg-bv-surface'}`}>
        {probing && (
          <span className="text-[10px] text-bv-muted">Loading preview…</span>
        )}
        {!probing && bestStory && (
          // @ts-expect-error — custom element not in JSX.IntrinsicElements
          <adaptive-iframe ref={ghostRef} style={{ pointerEvents: 'none' }} />
        )}
        {!probing && !bestStory && (
          <span className="text-[10px] text-bv-muted">No stories found.</span>
        )}
      </div>

      {/* Footer: name ↔ placement hint + optional gear */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-bv-border bg-bv-bg">
        {isArmed ? (
          <span className="text-[11px] font-medium text-bv-teal">Click the page to place</span>
        ) : (
          <span className="text-[11px] font-semibold text-bv-text">{group.name}</span>
        )}
        {hasArgs && (
          <button
            className={`w-5.5 h-5.5 rounded flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 ${
              showProps ? 'opacity-100 bg-bv-surface-hi text-bv-text' : 'text-bv-muted hover:bg-bv-surface-hi hover:text-bv-text'
            }`}
            title="Customize props"
            onClick={(e) => { e.stopPropagation(); setShowProps(prev => !prev); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
        )}
      </div>

      {/* Props drawer — hidden until gear is clicked */}
      {showProps && hasArgs && (
        <div className="px-2.5 py-2 border-t border-bv-border bg-bv-surface" onClick={(e) => e.stopPropagation()}>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-bv-muted mb-1.5">Props</div>
          <ArgsForm
            argTypes={argTypes}
            args={args}
            onArgsChange={handleArgsChange}
          />
        </div>
      )}
    </li>
  );
}
