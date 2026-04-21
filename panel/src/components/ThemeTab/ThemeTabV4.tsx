import { useMemo, useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { ColorSection } from './ColorSection';
import { TypographySectionV4 } from './TypographySectionV4';
import { BorderRadiusSection } from './BorderRadiusSection';
import { FontFamiliesSection } from './FontFamiliesSection';
import { SpacingSection } from './SpacingSection';
import { OtherVarsSection } from './OtherVarsSection';
import type { ThemeOverride } from './types';

interface ThemeTabV4Props {
  tailwindConfig: any;
  themeEdits: Map<string, ThemeOverride>;
  onThemeEdit: (tokenKey: string, override: ThemeOverride) => void;
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

export function ThemeTabV4({ tailwindConfig, themeEdits, onThemeEdit }: ThemeTabV4Props) {
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

  const editCount = themeEdits.size;

  const radiiCount = Object.keys(borderRadius).length;
  const fontFamiliesCount = Object.keys(fontFamilies).length;
  const otherCount = Object.keys(otherVars).length;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-bv-border">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
          Tailwind v4
        </span>
        {editCount > 0 && (
          <span className="ml-auto text-[9px] text-bv-orange font-medium">
            {editCount} edit{editCount !== 1 ? 's' : ''}
          </span>
        )}
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
            tailwindVersion={4}
            onEdit={onThemeEdit}
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
            edits={themeEdits}
            onEdit={onThemeEdit}
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
                edits={themeEdits}
                onEdit={onThemeEdit}
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
                edits={themeEdits}
                onEdit={onThemeEdit}
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
                edits={themeEdits}
                onEdit={onThemeEdit}
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
                edits={themeEdits}
                onEdit={onThemeEdit}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
