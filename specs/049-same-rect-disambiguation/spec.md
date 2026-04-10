# 049 — Same-Rect Element Disambiguation

## Problem

When the user clicks an element in the overlay, the click handler (`overlay/src/index.ts`) walks up the React fiber tree to find the nearest component boundary, then **replaces the clicked element's class string** with the component root element's classes. This means clicking a `<div class="bg-indigo-600 p-12">` inside a `<TutorialSection>` sends `"bg-white border-gray-200"` (the `<section>` root's classes) to the panel instead of the indigo div's classes.

The root cause is lines 298–312 of `clickHandler()`:

```ts
const rootEl = getDOMNode(boundary.componentFiber);
if (rootEl && rootEl !== targetEl) {
  const rootClassName = rootEl.className;
  if (typeof rootClassName === "string" && rootClassName) {
    classString = rootClassName;  // ← overwrites clicked element's classes
  }
}
```

This was added so clicks on inner elements (e.g. a `<span>` inside a `<Button>`) would pick up the Button's classes. But it breaks for large wrapper components where the root element is many layers above the click target.

## Solution

Two changes:

### 1. Same-rect candidate detection + disambiguation menu

On click, walk up from `e.target` comparing `getBoundingClientRect()`. Parents whose rect matches within a ~2px threshold are "same-rect" candidates — the user can't visually distinguish which one they meant to click.

- **1 candidate** → select directly (no menu, no UX change from today)
- **2+ candidates** → show a disambiguation popup so the user can pick

This replaces the old "always walk up to component root" heuristic with an explicit UI choice.

### 2. Stop overriding classString

Remove the fiber-based class override entirely. Always send the clicked/picked element's own classes. Keep component name + props extraction (useful for context in the panel header).

Show `"ComponentName › tagName"` in the panel header when the clicked element is not the component root, e.g. `"TutorialSection › div"`.

## Same-Rect Detection Algorithm

```
getSameRectCandidates(target: HTMLElement, shadowHost: HTMLElement): HTMLElement[]
  candidates = [target]
  targetRect = target.getBoundingClientRect()
  el = target.parentElement

  while el:
    if el === shadowHost or el === document.body or el === document.documentElement:
      break
    parentRect = el.getBoundingClientRect()
    if rectsMatch(targetRect, parentRect, threshold=2):
      candidates.push(el)
      el = el.parentElement
    else:
      break  // stop at first parent that doesn't match

  return candidates  // innermost first, outermost last
```

`rectsMatch` compares `top`, `left`, `width`, `height` within the threshold.

## Scenario Coverage

| Click target | Parent rect | Result |
|---|---|---|
| `<div class="bg-indigo-600 p-12">` | Body div `px-6 py-5` — bigger | 1 candidate → direct select with `bg-indigo-600` classes |
| Tight wrapper: `<div class="p-0">` wrapping `<div class="bg-indigo-600">` | Same rect | 2 candidates → picker shows both |
| `<span>` inside `<Button>` | Button has padding → bigger rect | 1 candidate (span) → direct select. Button padding area selects button. |
| Isolated `<h2>` heading | Parents all bigger | 1 candidate → direct select |

## Disambiguation Menu UI

When 2+ same-rect candidates exist, a small popup appears near the click point:

- Positioned using `@floating-ui/dom` (same pattern as existing group picker)
- Dark theme matching the overlay toolbar (`#1a1a1a` background, `rgba(255,255,255,0.06)` borders)
- Each row shows: **tag name**, **component name** (if any), and first few Tailwind classes
- Rows are indented by nesting depth (padding-left increases per level) to show parent/child hierarchy
- On hover: a preview highlight outlines that specific element (orange dashed border)
- On click: selects that element, proceeds with normal flow
- On Escape or click-outside: dismisses, no selection made
- Visual style matches the existing `.el-toolbar` dark popup (Inter font, dark bg, subtle shadow)

Example rows for the tight-wrapper case:
```
┌──────────────────────────────────────────────────┐
│  PICK AN ELEMENT                        (dark bg)│
│──────────────────────────────────────────────────│
│ ‹section› TutorialSection .rounded-lg .sha…  │  ← depth-0 (no indent)
│    ‹div›  TutorialSection .bg-indigo-600 .…  │  ← depth-1 (indented)
│  Esc to dismiss                               │
└──────────────────────────────────────────────────┘
```

See `depth-picker-prototype.html` in this folder for an interactive visual mockup.

## Implementation

### Files to Change

| File | Change |
|---|---|
| `overlay/src/depth-picker.ts` | **New file.** `getSameRectCandidates()` + `showDepthPicker()` + `dismissDepthPicker()` |
| `overlay/src/index.ts` | Extract `finalizeSelection()` from click handler. Add same-rect check before selection. Remove classString override. Update componentName to show `"Component › tag"`. |
| `overlay/src/overlay-state.ts` | Add `depthPickerEl: HTMLElement \| null` field |
| `overlay/src/styles.ts` | Add `.depth-picker`, `.depth-row`, `.depth-tag`, `.depth-component` styles |
| `overlay/src/element-toolbar.ts` | Reference only (reuse `positionWithFlip` pattern) |

### Files to Clean Up

| File | Change |
|---|---|
| `panel/src/components/GradientEditor/deriveProps.ts` | Remove debug `console.log` |
| `panel/src/hooks/useModeStateMachine/useModeStateMachine.ts` | Remove debug `console.log` |

## Verification

1. **Indigo banner (no overlap):** Click banner → no picker → panel shows `bg-indigo-600` classes, "Backgrounds" section shows indigo-600
2. **Tight wrapper (overlap):** Two same-rect divs → picker appears → pick inner → correct classes
3. **Button span:** Click button text → selects span (no picker). Click button padding → selects button.
4. **Isolated element:** Click heading → no picker → direct select. No UX regression.
5. **Escape:** Open picker → Escape → dismissed, no selection
6. **Panel tests:** `cd panel && npm test` passes
7. **Storybook:** Open panel Storybook, verify no visual regressions

## Open Questions

- Should the picker auto-select the innermost element after a short timeout if the user doesn't interact? (Probably not — keep it explicit.)
- Should we filter out elements with no classes from the picker? (Yes — if a parent has the same rect but no Tailwind classes, it's just a structural wrapper and not useful to select.)
