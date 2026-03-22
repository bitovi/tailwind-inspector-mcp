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
  onArm: (ghostHtml: string) => void;
  onDisarm: () => void;
}

export function ComponentGroupItem({ group, isArmed, onArm, onDisarm }: ComponentGroupItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { bestStory, probing, argTypes, defaultArgs } = useStoryProbe(group.stories);
  const [args, setArgs] = useState<Record<string, unknown>>({});
  const ghostRef = useRef<HTMLElement>(null);
  const initialLoadDone = useRef(false);

  // Sync default args from probe into local state when probe completes
  useEffect(() => {
    if (!probing && defaultArgs) {
      setArgs(defaultArgs);
    }
  }, [probing, defaultArgs]);

  // Initial load: set the story URL once (Storybook will use its own default args).
  // Also reset when collapsed so re-expanding a new <adaptive-iframe> gets its src.
  useEffect(() => {
    if (!isExpanded) {
      initialLoadDone.current = false;
      return;
    }
    if (!ghostRef.current || !bestStory || initialLoadDone.current) return;
    initialLoadDone.current = true;
    const initialUrl = buildArgsUrl(bestStory.id, {});
    ghostRef.current.setAttribute('src', initialUrl);
  }, [bestStory, isExpanded]);

  // Subsequent args changes: send updateArgs to the existing iframe
  const handleArgsChange = useCallback((newArgs: Record<string, unknown>) => {
    setArgs(newArgs);
    if (!ghostRef.current || !bestStory) return;
    const el = ghostRef.current as unknown as AdaptiveIframe;
    if (typeof el.updateArgs === 'function') {
      el.updateArgs(bestStory.id, newArgs);
    }
  }, [bestStory]);

  // Click to arm/disarm: extract ghost HTML from the adaptive-iframe and notify parent
  const handleArmClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // prevent DrawTab's document click listener from immediately disarming
    if (isArmed) {
      onDisarm();
      return;
    }
    const el = ghostRef.current as unknown as AdaptiveIframe;
    const ghostHtml = el.getComponentHtml?.() ?? '';
    onArm(ghostHtml);
  }, [isArmed, onArm, onDisarm]);

  const hasArgs = Object.keys(argTypes).length > 0;

  return (
    <li>
      <button
        className="w-full flex items-center justify-between px-2 py-1 rounded text-[11px] text-bv-text hover:bg-bv-surface-hi transition-colors"
        onClick={() => setIsExpanded(prev => !prev)}
      >
        <span className="flex items-center gap-1.5">
          <span className="text-bv-muted text-[9px]">{isExpanded ? '▼' : '▶'}</span>
          {group.name}
        </span>
        {hasArgs && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"
            title="Supports args"
          />
        )}
      </button>
      {isExpanded && (
        <div className="ml-2 mt-1 flex flex-col gap-2">
          {probing && (
            <div className="text-[10px] text-bv-muted px-1">Loading preview…</div>
          )}
          {!probing && bestStory && (
            <>
              <div
                className={`rounded border overflow-hidden cursor-pointer transition-colors ${isArmed ? 'border-bv-teal ring-1 ring-bv-teal' : 'border-bv-border hover:border-bv-teal'}`}
                onClick={handleArmClick}
                title={isArmed ? 'Click to disarm' : 'Click to arm for placement'}
              >
                {/* @ts-expect-error — custom element not in JSX.IntrinsicElements */}
                <adaptive-iframe ref={ghostRef} style={{ pointerEvents: 'none' }} />
              </div>
              {hasArgs && (
                <div className="border-t border-bv-border pt-1.5">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-bv-muted mb-1 px-1">
                    Props
                  </div>
                  <ArgsForm
                    argTypes={argTypes}
                    args={args}
                    onArgsChange={handleArgsChange}
                  />
                </div>
              )}
            </>
          )}
          {!probing && !bestStory && (
            <div className="text-[10px] text-bv-muted px-1">No stories found.</div>
          )}
        </div>
      )}
    </li>
  );
}
