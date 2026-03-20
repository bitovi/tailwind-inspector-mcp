---
name: preview-className-component
description: Build panel UI components that live-preview Tailwind className changes in the user's app via WebSocket. Use when creating any control (dropdown, scrubber, color picker, toggle, etc.) that lets users hover/scrub values before committing. Covers the preview/revert/stage lifecycle, the onHover/onLeave prop contract, and the focus-trap pattern that prevents preview leaks.
---

# Skill: Building Components That Preview className Changes

## Mental Model

Every interactive control in the panel follows a three-phase lifecycle:

```
HOVER → preview (live in user's app)
LEAVE → revert  (snap back to original)
CLICK → stage   (lock the new value as a draft)
```

The control itself only calls `onHover(newClass)` and `onLeave()`. The **parent** (usually `Picker.tsx`) owns the `patchManager` and wires those callbacks to `preview()` / `revertPreview()` / `stage()`.

---

## The `onHover` / `onLeave` Prop Contract

Every control that can preview a class change must accept these two props:

```ts
onHover: (fullClass: string) => void;  // called when a candidate value is highlighted
onLeave: () => void;                   // called when interaction ends without committing
```

**`onHover`** — fire on every discrete candidate value:
- Mouse enters a swatch / list item → `onHover(fullClass)`
- Scrub moves to a new step → `onHover(fullClass)`
- Keyboard navigates to an option → `onHover(fullClass)`

**`onLeave`** — fire when the user abandons the interaction **without** clicking:
- Mouse leaves the entire control
- Dropdown closes without selecting
- Focus leaves the container
- Escape is pressed

The parent wires them:
```tsx
// In Picker.tsx (or wherever patchManager is available)
<MyControl
  onHover={(newClass) => patchManager.preview(currentClass, newClass)}
  onLeave={() => patchManager.revertPreview()}
  onClick={(newClass) => {
    handleStage(property, currentClass, newClass);
    // commitPreview() is called automatically after staging
  }}
/>
```

---

## Dropdown Controls: the Focus-Trap Pattern

Any control with a **dropdown / floating menu** must use the canonical floating menu stack:

1. **`useFloating`** — positioning, flip, shift (from `@floating-ui/react`)
2. **`FloatingPortal`** — renders outside any `overflow: hidden` ancestor, preventing clipping
3. **`FocusTrapContainer`** — auto-focuses, fires `onClose` on blur/Escape
4. **`useDismiss`** — optional, adds pointer click-outside close

**Never use `position: absolute` with `top-full`** — it clips inside `overflow: hidden` containers (e.g. `PropertySection`'s collapse wrapper).  
**Never use `createPortal` with manual position calculation** — use `useFloating` instead.  
**Never use `document.addEventListener('mousedown')`** — misses keyboard navigation, alt-tab, window switches.

### Canonical dropdown pattern

```tsx
import {
  useFloating, offset, flip, shift, autoUpdate,
  FloatingPortal, useDismiss, useInteractions,
} from '@floating-ui/react';
import { FocusTrapContainer } from '../FocusTrapContainer';

const { refs, floatingStyles, context } = useFloating({
  open,
  strategy: 'fixed',
  placement: 'bottom-start',
  middleware: [offset(2), flip(), shift({ padding: 4 })],
  whileElementsMounted: autoUpdate,
});
const dismiss = useDismiss(context);         // optional: click-outside
const { getFloatingProps } = useInteractions([dismiss]);

// Anchor the reference to the trigger element:
<button ref={refs.setReference} onClick={() => setOpen(o => !o)}>
  {displayValue}
</button>

{open && (
  <FloatingPortal>
    <FocusTrapContainer
      ref={refs.setFloating}
      style={floatingStyles}
      className="z-50 ..."
      onPointerDown={e => e.stopPropagation()}
      onMouseLeave={onLeave}
      onClose={() => { setOpen(false); onLeave(); }}
      {...getFloatingProps()}
    >
      {items}
    </FocusTrapContainer>
  </FloatingPortal>
)}
```

### `FocusTrapContainer` — the shared primitive

```tsx
import { FocusTrapContainer } from '../FocusTrapContainer';
```

`FocusTrapContainer` is a `forwardRef` `<div>` that:
- Accepts all standard `HTMLDivElement` props (className, style, onMouseLeave, etc.) + an external `ref` (for `refs.setFloating`)
- Auto-focuses itself on mount with `preventScroll: true` so blur events are tracked without scrolling the panel
- Calls `onClose` when focus leaves the container (`onBlur` + `relatedTarget` check)
- Calls `onClose` when Escape is pressed

`onClose` should close the menu AND call `onLeave()` to revert any active preview.

> **Critical: `onPointerDown` event isolation**  
> Always add `onPointerDown={e => e.stopPropagation()}` to the `FocusTrapContainer`. Without this, pointer events from dropdown items bubble through the React tree to the parent chip's `onPointerDown` handler, which calls `e.preventDefault()` and suppresses `onClick` from firing on menu items.

### Reference implementations

| Control | File | Notes |
|---------|------|-------|
| ScaleScrubber | `panel/src/components/ScaleScrubber/ScaleScrubber.tsx` | Canonical: `useFloating` + `FloatingPortal` + `FocusTrapContainer` |
| FlexDiagramPicker | `panel/src/components/FlexDiagramPicker/FlexDiagramPicker.tsx` | Canonical + `useDismiss` |
| FlexAlignSelect | `panel/src/components/FlexAlignSelect/FlexAlignSelect.tsx` | Canonical + `useDismiss` |
| MiniScrubber | `panel/src/components/BoxModel/components/MiniScrubber/MiniScrubber.tsx` | Canonical: `useFloating` + `FloatingPortal` + `FocusTrapContainer` |
| FocusTrapContainer | `panel/src/components/FocusTrapContainer/FocusTrapContainer.tsx` | The shared primitive |

---

## Hover-Only Controls (No Dropdown)

Controls that preview on hover but don't have a discrete open/close state (e.g., a color swatch grid) only need `onMouseEnter` / `onMouseLeave` — no focus trap is necessary:

```tsx
<div onMouseLeave={onLeave}>
  {swatches.map((swatch) => (
    <div
      key={swatch.value}
      onMouseEnter={() => onHover(swatch.fullClass)}
      onClick={() => onClick(swatch.fullClass)}
    />
  ))}
</div>
```

---

## Floating UI Color Pickers (Floating Portal)

When using Floating UI (`useFloating` + `useDismiss`), the `onOpenChange` callback is the single cleanup hook. **Always call `revertPreview()` when the picker closes**:

```tsx
const { context } = useFloating({
  open: pickerOpen,
  onOpenChange: (open) => {
    if (!open) {
      setPickerOpen(false);
      patchManager.revertPreview();   // ← required, closes without commit = revert
    }
  },
});
```

---

## The `patchManager` API (quick reference)

Accessed via `usePatchManager()` in `Picker.tsx` and passed down as callbacks:

| Method | When to call |
|--------|-------------|
| `preview(oldClass, newClass)` | User hovers a candidate — sends `PATCH_PREVIEW` over WS |
| `revertPreview()` | User leaves without committing — sends `PATCH_REVERT` over WS |
| `stage(elementKey, property, oldClass, newClass)` | User confirms a value — queues a draft patch |

`preview` is idempotent and safe to call on every mouse-enter/scrub step.
`revertPreview` is a no-op if no preview is active.

---

## `resolvePropertyState` — Wiring Controls That Render Unconditionally

> **⚠️ MANDATORY for any control wired in Picker.tsx that always renders** (i.e. not inside `classes.map()`). Skipping this causes staged changes to silently revert.

Some controls always render regardless of whether the element already has a class for that property (e.g., `FlexJustify`, `FlexAlign`, `GapModel`). This means the `token` from `parsedClasses` may be `undefined` even though a staged patch for that property already exists.

**Always use `resolvePropertyState` when a control renders unconditionally.** It merges `parsedClasses` with `stagedPatches` to give you a single stable set of values to wire to `onHover`, `onClick`, and `onRemove`:

```ts
// In Picker.tsx, after stagedPatches is computed:
function resolvePropertyState(property: string, token: ParsedToken | undefined) {
  const staged = stagedPatches.find(p => p.property === property);
  const originalClass = token?.fullClass ?? staged?.originalClass ?? '';
  const effectiveClass = staged?.newClass ?? token?.fullClass ?? '';
  const hasValue = effectiveClass !== '';
  return { originalClass, effectiveClass, hasValue };
}
```

| Field | Meaning | Use for |
|-------|---------|---------|
| `originalClass` | Class on the element **before** any staging — the stable anchor for the server's find-replace | `stage(property, originalClass, newValue)` and `onRemove` |
| `effectiveClass` | What is currently "showing" in the live DOM (staged value if present, else original) | `preview(effectiveClass, newValue)` — must match what's in the DOM, not the source |
| `hasValue` | Whether there is currently any value to show or remove | Conditionally providing `onRemove` |

> **Key rule:** `onHover`/`onRemoveHover` use `effectiveClass` (DOM truth). `onClick`/`onRemove` use `originalClass` (source truth).
>
> After staging a change the DOM has the new class committed. If `onHover` still uses `originalClass`, `remove(originalClass)` becomes a no-op and the next hovered class stacks on top instead of replacing — producing duplicate conflicting classes on the element.

**Wire-up pattern:**

```tsx
const justify = resolvePropertyState('justify-content', justifyToken);

<FlexJustify
  currentValue={justifyToken?.fullClass ?? null}
  lockedValue={justify.effectiveClass !== justify.originalClass ? justify.effectiveClass : null}
  onHover={(v) => patchManager.preview(justify.effectiveClass, v)}   // effectiveClass = DOM truth
  onLeave={handleRevert}
  onClick={(v) => handleStage('justify-content', justify.originalClass, v)}   // originalClass = source truth
  onRemove={justify.hasValue ? () => handleStage('justify-content', justify.originalClass, '') : undefined}
  onRemoveHover={justify.hasValue ? () => patchManager.preview(justify.effectiveClass, '') : undefined}
/>
```

**Controls that need this:** Any control that renders even when the property is not yet set on the element — so the user can *add* the property by clicking. `FlexJustify`, `FlexAlign`, `FlexWrap`, `FlexDirection` all follow this pattern.

**Controls that don't need this:** Controls inside `classes.map(cls => ...)` — they only render *because* `cls` exists, so `cls.fullClass` is always the correct stable anchor.

---

## Checklist for New Preview Controls

- [ ] Accept `onHover: (fullClass: string) => void` and `onLeave: () => void` props
- [ ] If dropdown: implement focus-trap (`tabIndex={-1}`, `onBlur` + `relatedTarget`, `onKeyDown` for Escape, `useEffect` auto-focus)
- [ ] If hover-only: add `onMouseLeave` on the container
- [ ] Never call `patchManager` directly — let the parent wire callbacks
- [ ] `onClick` always calls the parent's stage handler (not `onHover`)
- [ ] If using Floating UI `useDismiss`: add `revertPreview()` inside `onOpenChange`
- [ ] `onLeave` is called on every non-commit close path (mouse leave, blur, Escape, dismiss)

---

## Reference Implementations

| Control | File | Pattern |
|---------|------|---------|
| ScaleScrubber | `panel/src/components/ScaleScrubber/ScaleScrubber.tsx` | Drag-to-scrub + dropdown with focus trap |
| MiniScrubber | `panel/src/components/BoxModel/components/MiniScrubber/MiniScrubber.tsx` | Portal dropdown with focus trap |
| ColorGrid | `panel/src/components/ColorGrid.tsx` | Hover-only swatch grid |
| Picker.tsx | `panel/src/Picker.tsx` | Wires `patchManager` to all controls; Floating UI color pickers |
