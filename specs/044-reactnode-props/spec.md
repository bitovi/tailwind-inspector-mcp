# 044 — ReactNode Prop Editing

Enable users to populate `ReactNode` props (like Badge's `iconLeft`, `children`) with either raw HTML or other configured components. Supports bottom-up composition: configure Icon → use it as Badge's `iconLeft` → use that Badge as Card's `children`. See [reactnode-props-ux.html](reactnode-props-ux.html) for visual prototypes.

## Problem

Components like Carton's `Badge` accept `ReactNode` props:

```ts
interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  roundness?: 'default' | 'round';
  children: ReactNode;       // badge label content
  iconLeft?: ReactNode;      // optional icon before label
  iconRight?: ReactNode;     // optional icon after label
  className?: string;
}
```

Today, VyBit's ArgsForm renders all props as primitives — `children` gets a text input, `iconLeft` gets nothing useful. Users can't compose components into slots.

## Goals

1. **Detect** which props accept `ReactNode` (from Storybook's existing type metadata)
2. **Two input modes** for ReactNode props: raw HTML textarea and component-from-list
3. **Bottom-up composition** — configure a child component, then assign it to a parent's slot, with no artificial nesting depth limit
4. **Live ghost preview** of the composed result via slot-marker stitching
5. **Correct JSX output** for the AI agent (nested `<Icon name="check" />` inside `<Badge>`)

---

## 1. ReactNode Detection

### What Storybook already provides

Storybook's `storyPrepared` event sends argTypes with a `type` field:

```ts
// Raw from Storybook (currently discarded during normalization)
{
  children: {
    type: { name: 'ReactNode', required: true },
    control: { type: 'text' },
  },
  iconLeft: {
    type: { name: 'ReactNode', required: false },
    control: { type: 'text' },
  },
  variant: {
    type: { name: 'enum', value: ['primary', 'secondary', ...] },
    control: { type: 'select' },
    options: ['primary', 'secondary', ...],
  },
}
```

We currently normalize argTypes into `{ control: string; options?; description?; defaultValue? }` — throwing away `type`. Fix: preserve `type?.name` through normalization.

### Detection heuristic

A prop is ReactNode-eligible if:
- `argType.type?.name` matches `'ReactNode'`, `'ReactElement'`, `'Element'`, or `'JSX.Element'`
- OR the prop key is `children` (universal fallback)

### Fallback for missing type info

Storybook's `type.name` depends on `react-docgen-typescript` running during story compilation. If a project doesn't use TypeScript or docgen is misconfigured, `type` may be absent. The `children` key fallback handles the most common case. A manual toggle button ("Treat as ReactNode") could cover the rest but is not in v1 scope.

---

## 2. ReactNode Field UI

ReactNode-eligible props render a **ReactNodeField** — a text input that can also accept an armed component. No mode tabs, no special badges. Two states:

| State | Appearance | Behavior |
|-------|------------|----------|
| **Text input** (default) | Standard text input, identical to other props | User types text or pastes HTML/SVG directly |
| **Component chip** (filled) | Mini ghost thumbnail + component name + ✕ clear | Assigned via arm-and-click; ✕ reverts to text input |

When a component is armed, ReactNode fields glow teal (**receptive** state) and accept a click to assign.

### Text input (default)

Same `<input>` as today. Accepts plain text (`"New"`) or raw HTML/SVG (`<svg>...</svg>`) — no separate HTML mode needed. The content is used directly in ghost preview (stitched into the slot) and converted to JSX for the agent via a lightweight `htmlToJsx()` transform (`class` → `className`, `style` strings → objects, self-closing tags).

### Component chip (filled)

When a component is assigned via arming, the text input is replaced by a component chip showing:
- Mini ghost thumbnail of the assigned component
- Component name
- ✕ clear button (reverts to text input)

See **Section 3: Composition UX** for the full arming + click-to-set interaction.

See [reactnode-props-ux-v2.html](reactnode-props-ux-v2.html) for visual prototypes.

---

## 3. Composition UX — Bottom-Up Assembly

### Core concept

Instead of nesting UI (recursive forms inside forms), composition works **bottom-up**:

1. Configure a child component and its props (e.g., Icon with `name="check"`)
2. That configured instance becomes available as a slot value for parent components
3. Assign it to a parent's ReactNode prop (e.g., Badge's `iconLeft`)
4. The parent's ghost updates to show the composed result
5. Repeat: the configured Badge can now be assigned to Card's `children`

The UI stays flat at every level. The data nests recursively but the user always works with the same 1-level ReactNodeField.

### Configured instances

Any component with non-default args is automatically a "configured instance" — no explicit save step. These are ephemeral (session-scoped). When a user arms a configured instance, any open ReactNode drop targets become clickable.

### Interaction: Arm → Click-to-Set

The interaction reuses the existing arm pattern but targets a **prop slot** instead of a page element:

1. User expands Badge → sees `iconLeft` as a standard text input
2. User scrolls to Icon in the component list, expands it, configures props (`name="check"`, `size="sm"`)
3. User **arms** the configured Icon (same Insert button used for page placement)
4. While armed, all visible ReactNode fields glow teal (**receptive** state) — the page *also* accepts clicks (same armed state serves both)
5. User **clicks** Badge's `iconLeft` field → Icon is assigned to that slot
6. The text input is replaced by a **component chip** (mini thumbnail + name + ✕)
7. Badge's ghost re-renders with the composed result (Icon stitched into the `iconLeft` position)
8. **Arming clears** — all fields return to normal. To assign the same component to another slot, arm again.

### Field states

| State | Appearance |
|-------|------------|
| **Text input** | Standard input field — same as any other prop |
| **Receptive** | Teal glow + placeholder "Click to set [Component]" — a component is armed |
| **Filled** | Component chip: mini ghost thumbnail + name + ✕ clear button |

Clicking ✕ on a filled field reverts to the text input.

### What it looks like

See [reactnode-props-ux-v2.html](reactnode-props-ux-v2.html) for interactive visual prototypes of:
- ReactNode field in text input and component chip states
- The arm → click-to-set composition flow
- Receptive field glow when a component is armed
- Composed ghost preview (Badge with Icon stitched in)

---

## 4. Ghost Preview Stitching

### The slot-marker strategy

Storybook's `updateArgs()` only accepts serializable values — we can't send React elements over postMessage. Workaround:

1. When args include ReactNode values, replace them with unique text markers:
   ```ts
   const SLOT_PREFIX = '\u229E';  // ⊞
   const marker = `${SLOT_PREFIX}${propName}`;
   storybookArgs[propName] = marker;  // Storybook renders "⊞iconLeft" as text
   ```
2. Storybook renders the parent component with text markers in slot positions
3. Ghost extraction captures the markers in `ghostHtml`
4. **Stitching pass:** find markers in ghostHtml, replace with the nested content's HTML
5. Merge `ghostCss` from parent + all children (deduplicate)

### Result

The stitched ghost shows a composed preview: Badge with the actual Icon SVG in the `iconLeft` slot. This flows into:
- **ShadowGhost** for the panel thumbnail/expanded preview
- **COMPONENT_ARM** message for the overlay drop zone
- **Patch** for the AI agent

---

## 5. Agent Output: Nested JSX

### `buildJsx()` updates

The existing `buildJsx()` in `server/mcp-tools.ts` currently handles flat props. For ReactNode args:

**HTML mode:** Emit the JSX-converted HTML as prop content.
```jsx
<Badge iconLeft={<svg viewBox="0 0 24 24"><path d="..." /></svg>}>
  New
</Badge>
```

**Component mode:** Emit nested component JSX with the configured props.
```jsx
<Badge iconLeft={<Icon name="check" size="sm" />}>
  New
</Badge>
```

**Recursive composition:** `buildJsx` recurses naturally.
```jsx
<Card>
  <Badge variant="primary" iconLeft={<Icon name="check" size="sm" />}>
    Active
  </Badge>
</Card>
```

The `children` prop is emitted as inner content (between open/close tags). Other ReactNode props are emitted as `prop={<Component />}` expressions.

---

## 6. Data Model

```typescript
// in panel/src/components/DrawTab/types.ts

export interface ArgType {
  control: string;
  options?: string[];
  description?: string;
  defaultValue?: unknown;
  type?: { name: string; required?: boolean };  // NEW — preserved from Storybook
}

export type ReactNodeArgValue =
  | { type: 'text'; value: string }  // plain text or raw HTML/SVG — same input
  | {
      type: 'component';
      componentName: string;
      storyId: string;
      componentPath?: string;
      args?: Record<string, unknown>;  // may recursively contain ReactNodeArgValue
      ghostHtml?: string;
      ghostCss?: string;
    };
```

In the `args` record, ReactNode props store `ReactNodeArgValue` objects instead of plain strings. The existing `Record<string, unknown>` type already accommodates this.

---

## Implementation Phases

### Phase 1: Detection + ReactNodeField UI

1. Add `type` field to `ArgType` and `ArgTypeInfo` interfaces
2. Preserve `type` through `useStoryProbe.ts` normalization
3. Create `ReactNodeField` modlet — text input that swaps to component chip
4. Wire into ArgsForm — render ReactNodeField for detected ReactNode props
5. Define `ReactNodeArgValue` type
6. `htmlToJsx()` utility for text input content (`class` → `className`, style strings → etc)
7. Update `buildJsx()` for ReactNode arg values (both text/HTML and component)

### Phase 2: Arm → Click-to-Set Flow

1. When any component is armed, all visible ReactNode fields become receptive (teal glow)
2. Clicking a receptive field assigns the armed component's ghost + args to that slot, clears arming
3. Filled fields show component chip with mini thumbnail + name + ✕ clear
4. Nested ghost extraction for the assigned sub-component

### Phase 3: Ghost Stitching Pipeline

1. Slot-marker substitution before `updateArgs()`
2. `stitchGhostSlots()` post-extraction replacement
3. CSS merging (parent + child ghostCss)
4. Stitched ghost flows to ShadowGhost, COMPONENT_ARM, and Patch

---

## Files

| File | Changes |
|------|---------|
| `panel/src/components/DrawTab/types.ts` | Add `type` to ArgType, add `ReactNodeArgValue` |
| `panel/src/components/DrawTab/hooks/useStoryProbe.ts` | Preserve `type` field during normalization |
| `panel/src/components/DrawTab/components/ArgsForm/ArgsForm.tsx` | Conditional ReactNodeField rendering |
| `panel/src/components/DrawTab/components/ReactNodeField/` | **New modlet** — text input + component chip |
| `panel/src/components/DrawTab/components/ComponentGroupItem/ComponentGroupItem.tsx` | Slot marker substitution + stitching |
| `panel/src/components/DrawTab/utils/stitch-ghost-slots.ts` | **New** — marker replacement utility |
| `server/storybook.ts` | Add `type` to `ArgTypeInfo` |
| `server/mcp-tools.ts` | `buildJsx()` nested JSX output |
| `shared/html-utils.ts` | **New** — `htmlToJsx()` conversion |
| `overlay/src/drop-zone.ts` | CSS merging for composed ghosts |

---

## Decisions

- **No custom TypeScript parsing** — Storybook already provides `type.name` in argTypes. We just preserve it during normalization.
- **No mode tabs** — ReactNode fields are plain text inputs. HTML/SVG can be pasted directly. A component chip replaces the input when assigned; ✕ clears back to text.
- **Same Insert button** for page insertion and prop-slot assignment — one armed state, dual purpose.
- **Arming clears after one assignment** — predictable. Arm again for additional slots.
- **Bottom-up composition, no depth cap** — configure child → assign to parent → repeat. The UI never nests; data nests recursively.
- **Configured instances are ephemeral** — any component with non-default args is automatically available for assignment. Session-scoped, no explicit save.
- **Slot-marker prefix `⊞` (U+229E)** — distinctive enough to avoid false matches in real component content.
- **`htmlToJsx` covers common cases only** — not a full parser. Agent instructions note edge cases may need manual JSX fixes.

## Open Questions

1. **ReactNode detection completeness** — Storybook's `type.name` depends on `react-docgen-typescript`. Missing for non-TS projects. The `children` fallback handles most cases; manual toggle could cover the rest.
2. **Slot-marker collision** — If a component legitimately renders `⊞`, stitching would break. Could use UUID-based markers for safety.
