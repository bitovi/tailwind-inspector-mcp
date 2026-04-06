import type { ArgType, ArmedComponentData } from '../../types';
import type { ReactNodeArgValue } from '../../types';
import { ReactNodeField } from '../ReactNodeField';
import type { ArgsFormProps } from './types';

const REACT_NODE_NAMES = new Set(['ReactNode', 'ReactElement', 'Element', 'JSX.Element']);

function isReactNodeProp(name: string, argType: ArgType): boolean {
  if (name === 'children') return true;
  const typeName = argType.type?.name;
  if (typeName && REACT_NODE_NAMES.has(typeName)) return true;
  // Storybook reports React.ReactNode as type "other" with control "object"
  if (typeName === 'other' && argType.control === 'object') return true;
  return false;
}

export function ArgsForm({ argTypes, args, onArgsChange, armedComponentData, onDisarm }: ArgsFormProps) {
  const entries = Object.entries(argTypes);
  if (entries.length === 0) return null;

  function handleChange(key: string, value: unknown) {
    onArgsChange({ ...args, [key]: value });
  }

  return (
    <div className="flex flex-col gap-1.5 px-1">
      {entries.map(([name, argType]) => (
        <ArgField
          key={name}
          name={name}
          argType={argType}
          value={args[name]}
          onChange={(v) => handleChange(name, v)}
          isReactNode={isReactNodeProp(name, argType)}
          armedComponentData={armedComponentData}
          onDisarm={onDisarm}
        />
      ))}
    </div>
  );
}

function ArgField({
  name,
  argType,
  value,
  onChange,
  isReactNode,
  armedComponentData,
  onDisarm,
}: {
  name: string;
  argType: ArgType;
  value: unknown;
  onChange: (value: unknown) => void;
  isReactNode: boolean;
  armedComponentData?: ArmedComponentData | null;
  onDisarm?: () => void;
}) {
  // Handle both string and object control formats
  const control = typeof argType.control === 'string'
    ? argType.control
    : typeof argType.control === 'object' && argType.control !== null
      ? (argType.control as Record<string, unknown>).type as string ?? 'text'
      : 'text';

  return (
    <label className="flex items-center gap-2 text-[10px]">
      <span className="text-bv-text-mid font-mono min-w-[60px] shrink-0">{name}</span>
      {isReactNode ? (
        <ReactNodeField
          name={name}
          value={value as ReactNodeArgValue | undefined}
          onChange={(v) => onChange(v)}
          armedComponentData={armedComponentData}
          onDisarm={onDisarm}
        />
      ) : control === 'select' && argType.options ? (
        <select
          className="flex-1 bg-bv-surface border border-bv-border rounded px-1.5 py-0.5 text-[10px] text-bv-text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        >
          {argType.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : control === 'boolean' ? (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-bv-teal"
        />
      ) : control === 'number' ? (
        <input
          type="number"
          className="flex-1 bg-bv-surface border border-bv-border rounded px-1.5 py-0.5 text-[10px] text-bv-text"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      ) : (
        <input
          type="text"
          className="flex-1 bg-bv-surface border border-bv-border rounded px-1.5 py-0.5 text-[10px] text-bv-text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
