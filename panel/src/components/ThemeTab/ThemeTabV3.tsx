import { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { ColorSection } from './ColorSection';
import { TypographySectionV3 } from './TypographySectionV3';
import type { ThemeOverride } from './types';

interface ThemeTabV3Props {
  tailwindConfig: any;
  themeEdits: Map<string, ThemeOverride>;
  onThemeEdit: (tokenKey: string, override: ThemeOverride) => void;
}

export function ThemeTabV3({ tailwindConfig, themeEdits, onThemeEdit }: ThemeTabV3Props) {
  const [colorsExpanded, setColorsExpanded] = useState(true);
  const [typographyExpanded, setTypographyExpanded] = useState(true);

  const colors = tailwindConfig?.colors ?? {};
  const fontSize = tailwindConfig?.fontSize ?? {};
  const fontWeight = tailwindConfig?.fontWeight ?? {};

  const editCount = themeEdits.size;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-bv-border">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
          Tailwind v3
        </span>
        {editCount > 0 && (
          <span className="ml-auto text-[9px] text-bv-orange font-medium">
            {editCount} edit{editCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="mx-3 my-2 px-3 py-2 rounded border border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-400 leading-relaxed">
        <strong className="font-semibold">Tailwind v3 is not officially supported.</strong> Theme editing may not work correctly. Upgrade to Tailwind v4 for full support.
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
            edits={themeEdits}
            tailwindVersion={3}
            onEdit={onThemeEdit}
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
            edits={themeEdits}
            onEdit={onThemeEdit}
          />
        )}
      </div>
    </div>
  );
}
