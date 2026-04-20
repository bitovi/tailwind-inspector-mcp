import { useCallback, useEffect, useMemo, useState } from 'react';
import { sendTo } from '../../ws';
import { SectionHeader } from './SectionHeader';
import { ColorSection } from './ColorSection';
import { TypographySectionV4 } from './TypographySectionV4';
import { BorderRadiusSection } from './BorderRadiusSection';
import { FontFamiliesSection } from './FontFamiliesSection';
import { SpacingSection } from './SpacingSection';
import { OtherVarsSection } from './OtherVarsSection';
import { hexToOklch } from './color-utils';
import type { ThemeOverride } from './types';

interface ThemeTabV4Props {
  tailwindConfig: any;
  onStageThemeChange: (description: string) => void;
}

/** Prefixes we bucket into named sections — everything else goes to "Other". */
const KNOWN_PREFIXES = ['--color-', '--text-', '--font-weight-', '--font-', '--radius-', '--radius', '--spacing', '--default-'];

function groupVars(vars: Record<string, string>) {
  const colors: Record<string, Record<string, string>> = {};
  const fontSize: Record<string, string> = {};
  const fontSizeLineHeight: Record<string, string> = {};
  const fontWeight: Record<string, string> = {};
  const borderRadius: Record<string, string> = {};
  const fontFamilies: Record<string, string> = {};
  let spacingBase: string | undefined;
  const other: Record<string, string> = {};

  for (const [prop, value] of Object.entries(vars)) {
    if (prop.startsWith('--color-')) {
      const name = prop.slice('--color-'.length);
      const dashIdx = name.lastIndexOf('-');
      if (dashIdx > 0 && /^\d+$/.test(name.slice(dashIdx + 1))) {
        const hue = name.slice(0, dashIdx);
        const shade = name.slice(dashIdx + 1);
        if (!colors[hue]) colors[hue] = {};
        colors[hue][shade] = value;
      } else {
        colors[name] = value as any;
      }
    } else if (prop.startsWith('--text-')) {
      const name = prop.slice('--text-'.length);
      const lhMatch = name.match(/^(.+)--line-height$/);
      if (lhMatch) {
        fontSizeLineHeight[lhMatch[1]] = value;
      } else {
        fontSize[name] = value;
      }
    } else if (prop.startsWith('--font-weight-')) {
      fontWeight[prop.slice('--font-weight-'.length)] = value;
    } else if (prop.startsWith('--font-') && !prop.startsWith('--font-weight-')) {
      // e.g. --font-sans, --font-mono, --font-serif (skip --default-font-family)
      fontFamilies[prop.slice('--font-'.length)] = value;
    } else if (prop === '--radius' || prop.startsWith('--radius-')) {
      borderRadius[prop === '--radius' ? '' : prop.slice('--radius-'.length)] = value;
    } else if (prop === '--spacing') {
      spacingBase = value;
    } else if (!KNOWN_PREFIXES.some(p => prop.startsWith(p))) {
      other[prop] = value;
    }
  }

  return { colors, fontSize, fontSizeLineHeight, fontWeight, borderRadius, fontFamilies, spacingBase, other };
}

export function ThemeTabV4({ tailwindConfig, onStageThemeChange }: ThemeTabV4Props) {
  const [edits, setEdits] = useState<Map<string, ThemeOverride>>(new Map());
  const [colorsExpanded, setColorsExpanded] = useState(true);
  const [typographyExpanded, setTypographyExpanded] = useState(true);
  const [spacingExpanded, setSpacingExpanded] = useState(true);
  const [radiiExpanded, setRadiiExpanded] = useState(true);
  const [fontFamiliesExpanded, setFontFamiliesExpanded] = useState(true);
  const [otherExpanded, setOtherExpanded] = useState(false);

  // Support both overlay-sourced flat vars map and legacy server-shaped config
  const { colors, fontSize, fontSizeLineHeight, fontWeight, borderRadius, fontFamilies, spacingBase, other: otherVars } = useMemo(() => {
    if (tailwindConfig?.vars) return groupVars(tailwindConfig.vars);
    return {
      colors: tailwindConfig?.colors ?? {},
      fontSize: tailwindConfig?.fontSize ?? {},
      fontSizeLineHeight: tailwindConfig?.fontSizeLineHeight ?? {},
      fontWeight: tailwindConfig?.fontWeight ?? {},
      borderRadius: {} as Record<string, string>,
      fontFamilies: {} as Record<string, string>,
      spacingBase: undefined as string | undefined,
      other: tailwindConfig?.otherVars ?? {},
    };
  }, [tailwindConfig]);

  const editCount = edits.size;
  const overrides = useMemo(() => Array.from(edits.values()), [edits]);

  useEffect(() => {
    sendTo('overlay', { type: 'THEME_PREVIEW', overrides, tailwindVersion: 4 });
  }, [overrides]);

  useEffect(() => {
    return () => {
      sendTo('overlay', { type: 'THEME_PREVIEW', overrides: [], tailwindVersion: 4 });
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
    const radiusEdits: ThemeOverride[] = [];
    const fontFamilyEdits: ThemeOverride[] = [];
    const spacingEdits: ThemeOverride[] = [];
    const otherEdits: ThemeOverride[] = [];

    for (const [key, override] of edits) {
      if (key.startsWith('fontSizeLH-')) fontSizeLHEdits.push(override);
      else if (key.startsWith('fontSize-')) fontSizeEdits.push(override);
      else if (key.startsWith('fontWeight-')) fontWeightEdits.push(override);
      else if (key.startsWith('radius-')) radiusEdits.push(override);
      else if (key.startsWith('font-family-')) fontFamilyEdits.push(override);
      else if (key === 'spacing-base') spacingEdits.push(override);
      else if (key.startsWith('other-')) otherEdits.push(override);
      else colorEdits.push(override);
    }

    const lines: string[] = [];
    lines.push('Update the following Tailwind v4 theme values in the CSS @theme block:');

    if (colorEdits.length > 0) {
      lines.push('\n/* Colors */');
      for (const edit of colorEdits) lines.push(`  ${edit.variable}: ${hexToOklch(edit.value)};`);
    }
    if (fontSizeEdits.length > 0) {
      lines.push('\n/* Font Sizes */');
      for (const edit of fontSizeEdits) lines.push(`  ${edit.variable}: ${edit.value};`);
    }
    if (fontSizeLHEdits.length > 0) {
      lines.push('\n/* Font Size Line Heights */');
      for (const edit of fontSizeLHEdits) lines.push(`  ${edit.variable}: ${edit.value};`);
    }
    if (fontWeightEdits.length > 0) {
      lines.push('\n/* Font Weights */');
      for (const edit of fontWeightEdits) lines.push(`  ${edit.variable}: ${edit.value};`);
    }
    if (spacingEdits.length > 0) {
      lines.push('\n/* Spacing */');
      for (const edit of spacingEdits) lines.push(`  ${edit.variable}: ${edit.value};`);
    }
    if (radiusEdits.length > 0) {
      lines.push('\n/* Border Radius */');
      for (const edit of radiusEdits) lines.push(`  ${edit.variable}: ${edit.value};`);
    }
    if (fontFamilyEdits.length > 0) {
      lines.push('\n/* Font Families */');
      for (const edit of fontFamilyEdits) lines.push(`  ${edit.variable}: ${edit.value};`);
    }
    if (otherEdits.length > 0) {
      lines.push('\n/* Other Variables */');
      for (const edit of otherEdits) lines.push(`  ${edit.variable}: ${edit.value};`);
    }

    onStageThemeChange(lines.join('\n'));
    setEdits(new Map());
  }

  const radiiCount = Object.keys(borderRadius).length;
  const fontFamiliesCount = Object.keys(fontFamilies).length;
  const otherCount = Object.keys(otherVars).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-bv-border">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
          Tailwind v4
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
            tailwindVersion={4}
            onEdit={handleEdit}
          />
        )}

        <SectionHeader
          title="Typography"
          expanded={typographyExpanded}
          onToggle={() => setTypographyExpanded(!typographyExpanded)}
        />
        {typographyExpanded && (
          <TypographySectionV4
            fontSize={fontSize}
            fontSizeLineHeight={fontSizeLineHeight}
            fontWeight={fontWeight}
            edits={edits}
            onEdit={handleEdit}
          />
        )}

        {spacingBase && (
          <>
            <SectionHeader
              title="Spacing"
              expanded={spacingExpanded}
              onToggle={() => setSpacingExpanded(!spacingExpanded)}
            />
            {spacingExpanded && (
              <SpacingSection
                spacingBase={spacingBase}
                edits={edits}
                onEdit={handleEdit}
              />
            )}
          </>
        )}

        {radiiCount > 0 && (
          <>
            <SectionHeader
              title="Border Radius"
              expanded={radiiExpanded}
              onToggle={() => setRadiiExpanded(!radiiExpanded)}
            />
            {radiiExpanded && (
              <BorderRadiusSection
                vars={borderRadius}
                edits={edits}
                onEdit={handleEdit}
              />
            )}
          </>
        )}

        {fontFamiliesCount > 0 && (
          <>
            <SectionHeader
              title="Font Families"
              expanded={fontFamiliesExpanded}
              onToggle={() => setFontFamiliesExpanded(!fontFamiliesExpanded)}
            />
            {fontFamiliesExpanded && (
              <FontFamiliesSection
                vars={fontFamilies}
                edits={edits}
                onEdit={handleEdit}
              />
            )}
          </>
        )}

        {otherCount > 0 && (
          <>
            <SectionHeader
              title="Other Variables"
              expanded={otherExpanded}
              onToggle={() => setOtherExpanded(!otherExpanded)}
              badge={String(otherCount)}
            />
            {otherExpanded && (
              <OtherVarsSection
                otherVars={otherVars}
                edits={edits}
                onEdit={handleEdit}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
