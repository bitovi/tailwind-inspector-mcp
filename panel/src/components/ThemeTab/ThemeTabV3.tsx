import { useCallback, useEffect, useMemo, useState } from 'react';
import { sendTo } from '../../ws';
import { SectionHeader } from './SectionHeader';
import { ColorSection } from './ColorSection';
import { TypographySectionV3 } from './TypographySectionV3';
import type { ThemeOverride } from './types';

interface ThemeTabV3Props {
  tailwindConfig: any;
  onStageThemeChange: (description: string) => void;
}

export function ThemeTabV3({ tailwindConfig, onStageThemeChange }: ThemeTabV3Props) {
  const [edits, setEdits] = useState<Map<string, ThemeOverride>>(new Map());
  const [colorsExpanded, setColorsExpanded] = useState(true);
  const [typographyExpanded, setTypographyExpanded] = useState(true);

  const colors = tailwindConfig?.colors ?? {};
  const fontSize = tailwindConfig?.fontSize ?? {};
  const fontWeight = tailwindConfig?.fontWeight ?? {};

  const editCount = edits.size;
  const overrides = useMemo(() => Array.from(edits.values()), [edits]);

  useEffect(() => {
    sendTo('overlay', { type: 'THEME_PREVIEW', overrides, tailwindVersion: 3 });
  }, [overrides]);

  useEffect(() => {
    return () => {
      sendTo('overlay', { type: 'THEME_PREVIEW', overrides: [], tailwindVersion: 3 });
    };
  }, []);

  const handleEdit = useCallback((tokenKey: string, override: ThemeOverride) => {
    setEdits(prev => {
      const next = new Map(prev);
      next.set(tokenKey, override);
      return next;
    });
  }, []);

  function handleRevertAll() {
    setEdits(new Map());
  }

  function handleStageAll() {
    if (editCount === 0) return;

    const colorEdits: ThemeOverride[] = [];
    const fontSizeEdits: ThemeOverride[] = [];
    const fontSizeLHEdits: ThemeOverride[] = [];
    const fontWeightEdits: ThemeOverride[] = [];

    for (const [key, override] of edits) {
      if (key.startsWith('fontSizeLH-')) {
        fontSizeLHEdits.push(override);
      } else if (key.startsWith('fontSize-')) {
        fontSizeEdits.push(override);
      } else if (key.startsWith('fontWeight-')) {
        fontWeightEdits.push(override);
      } else {
        colorEdits.push(override);
      }
    }

    const lines: string[] = [];
    lines.push('Update the following Tailwind v3 theme values in tailwind.config.js:');

    if (colorEdits.length > 0) {
      lines.push('');
      lines.push('// Colors (theme.extend.colors)');
      for (const edit of colorEdits) {
        lines.push(`  theme.${edit.variable}: '${edit.value}'`);
      }
    }
    if (fontSizeEdits.length > 0 || fontSizeLHEdits.length > 0) {
      lines.push('');
      lines.push('// Font Sizes (theme.extend.fontSize)');

      // Merge size + lineHeight edits by fontSize key
      const merged = new Map<string, { size?: string; lineHeight?: string }>();
      for (const edit of fontSizeEdits) {
        // variable is "fontSize.{key}"
        const key = edit.variable.replace('fontSize.', '');
        const existing = merged.get(key) ?? {};
        existing.size = edit.value;
        if (edit.lineHeight) existing.lineHeight = edit.lineHeight;
        merged.set(key, existing);
      }
      for (const edit of fontSizeLHEdits) {
        const key = edit.variable.replace('fontSize.', '');
        const existing = merged.get(key) ?? {};
        if (edit.lineHeight) existing.lineHeight = edit.lineHeight;
        if (edit.value) existing.size = edit.value;
        merged.set(key, existing);
      }

      for (const [key, vals] of merged) {
        if (vals.lineHeight) {
          lines.push(`  fontSize.${key}: ['${vals.size ?? ''}', { lineHeight: '${vals.lineHeight}' }]`);
        } else {
          lines.push(`  fontSize.${key}: '${vals.size}'`);
        }
      }
    }
    if (fontWeightEdits.length > 0) {
      lines.push('');
      lines.push('// Font Weights (theme.extend.fontWeight)');
      for (const edit of fontWeightEdits) {
        lines.push(`  theme.${edit.variable}: '${edit.value}'`);
      }
    }

    onStageThemeChange(lines.join('\n'));
    setEdits(new Map());
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-bv-border">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
          Tailwind v3
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {editCount > 0 && (
            <>
              <span className="text-[9px] text-bv-orange font-medium">
                {editCount} edit{editCount !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleRevertAll}
                className="text-[10px] px-2 py-0.5 rounded border border-bv-border text-bv-text-mid hover:text-bv-text hover:border-bv-text-mid transition-colors"
              >
                Revert
              </button>
              <button
                onClick={handleStageAll}
                className="text-[10px] px-2 py-0.5 rounded bg-bv-teal text-white font-medium hover:bg-bv-teal/80 transition-colors"
              >
                Stage
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <SectionHeader
          title="Colors"
          expanded={colorsExpanded}
          onToggle={() => setColorsExpanded(!colorsExpanded)}
        />
        {colorsExpanded && (
          <ColorSection
            colors={colors}
            edits={edits}
            tailwindVersion={3}
            onEdit={handleEdit}
          />
        )}

        <SectionHeader
          title="Typography"
          expanded={typographyExpanded}
          onToggle={() => setTypographyExpanded(!typographyExpanded)}
        />
        {typographyExpanded && (
          <TypographySectionV3
            fontSize={fontSize}
            fontWeight={fontWeight}
            edits={edits}
            onEdit={handleEdit}
          />
        )}
      </div>
    </div>
  );
}
