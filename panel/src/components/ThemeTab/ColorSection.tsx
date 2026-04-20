import { useRef, useState } from 'react';
import { HUE_ORDER, SHADE_ORDER } from '../../../../overlay/src/tailwind/scales';
import { resolveToHex } from './color-utils';
import type { ThemeOverride } from './types';

interface ColorSectionProps {
  colors: Record<string, unknown>;
  edits: Map<string, ThemeOverride>;
  tailwindVersion: 3 | 4;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}

interface ShadeRowProps {
  hue: string;
  shade: string;
  value: string;
  editedValue: string | undefined;
  tailwindVersion: 3 | 4;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}

function ShadeRow({ hue, shade, value, editedValue, tailwindVersion, onEdit }: ShadeRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = editedValue ?? value;
  const hexValue = resolveToHex(displayValue);
  const isEdited = editedValue !== undefined;
  const tokenKey = `${hue}-${shade}`;
  const variable = tailwindVersion === 4
    ? `--color-${hue}-${shade}`
    : `colors.${hue}.${shade}`;

  function handleColorInput(newHex: string) {
    onEdit(tokenKey, { variable, value: newHex });
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1 ${isEdited ? 'bg-bv-orange/5' : ''}`}>
      {isEdited && (
        <div className="w-1.5 h-1.5 rounded-full bg-bv-orange shrink-0" />
      )}
      <label
        className="relative w-6 h-6 rounded border border-white/10 shrink-0 cursor-pointer"
        style={{ backgroundColor: hexValue }}
        title={`Pick color for ${hue}-${shade}`}
      >
        <input
          ref={inputRef}
          type="color"
          value={hexValue}
          onChange={(e) => handleColorInput(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={`Color picker for ${hue}-${shade}`}
        />
      </label>
      <span className="text-[10px] text-bv-text-mid w-24 shrink-0 font-mono">
        {hue}-{shade}
      </span>
      <input
        type="text"
        value={hexValue}
        onChange={(e) => {
          const v = e.target.value;
          if (/^#[0-9a-fA-F]{6}$/.test(v)) {
            handleColorInput(v);
          }
        }}
        className="flex-1 min-w-0 bg-transparent text-[10px] text-bv-text font-mono border border-bv-border rounded px-1.5 py-0.5 focus:border-bv-teal focus:outline-none"
        spellCheck={false}
      />
    </div>
  );
}

function HueGroup({ hue, shades, edits, tailwindVersion, onEdit }: {
  hue: string;
  shades: Record<string, string>;
  edits: Map<string, ThemeOverride>;
  tailwindVersion: 3 | 4;
  onEdit: (tokenKey: string, override: ThemeOverride) => void;
}) {
  const editedCount = SHADE_ORDER.filter(s => edits.has(`${hue}-${s}`)).length;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pl-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-white/2 hover:bg-white/4 transition-colors text-left"
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 10 10"
          fill="currentColor"
          className={`text-bv-text-mid shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M3 1l4 4-4 4" />
        </svg>
        <span className="text-[10px] font-semibold text-bv-text capitalize">{hue}</span>
        {editedCount > 0 && (
          <span className="text-[9px] text-bv-orange font-medium">
            {editedCount} edited
          </span>
        )}
        <div className="ml-auto flex gap-0.5">
          {SHADE_ORDER.map(shade => {
            const value = shades[shade];
            if (!value) return null;
            const editOverride = edits.get(`${hue}-${shade}`);
            const displayValue = editOverride?.value ?? value;
            return (
              <div
                key={shade}
                className={`w-3 h-3 rounded-sm ${editOverride ? 'ring-1 ring-bv-orange' : ''}`}
                style={{ backgroundColor: resolveToHex(displayValue) }}
                title={`${hue}-${shade}`}
              />
            );
          })}
        </div>
      </button>
      {expanded && SHADE_ORDER.map(shade => {
        const value = shades[shade];
        if (!value) return null;
        return (
          <ShadeRow
            key={shade}
            hue={hue}
            shade={shade}
            value={value}
            editedValue={edits.get(`${hue}-${shade}`)?.value}
            tailwindVersion={tailwindVersion}
            onEdit={onEdit}
          />
        );
      })}
    </div>
  );
}

export function ColorSection({ colors, edits, tailwindVersion, onEdit }: ColorSectionProps) {
  // Separate standard hues (in HUE_ORDER) from custom color groups
  const standardHues: string[] = [];
  const customHues: string[] = [];

  for (const key of Object.keys(colors)) {
    if (typeof colors[key] !== 'object' || colors[key] === null) continue;
    if ((HUE_ORDER as readonly string[]).includes(key)) {
      standardHues.push(key);
    } else {
      customHues.push(key);
    }
  }

  // Sort standard hues by HUE_ORDER
  standardHues.sort((a, b) =>
    (HUE_ORDER as readonly string[]).indexOf(a) - (HUE_ORDER as readonly string[]).indexOf(b)
  );

  const allHues = [...standardHues, ...customHues];

  if (allHues.length === 0) {
    return (
      <div className="px-3 py-4 text-[11px] text-bv-muted text-center">
        No color tokens found in theme
      </div>
    );
  }

  return (
    <div className="divide-y divide-bv-border/50">
      {allHues.map(hue => (
        <HueGroup
          key={hue}
          hue={hue}
          shades={colors[hue] as Record<string, string>}
          edits={edits}
          tailwindVersion={tailwindVersion}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
