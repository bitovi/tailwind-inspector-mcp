# Storybook Plan: Full VyBit Coverage (Panel + Overlay Web Components)

## Goal

Get every VyBit UI component into Storybook so developers and AI agents can browse, test, and iterate on components in isolation. This requires:

1. **Upgrading the panel Storybook from SB8 → SB10**
2. **Adding stories for ~18 panel React components that lack them**
3. **Extracting overlay UI modules as Web Components** so they can render in the same Storybook instance

---

## Current State

### Panel Storybook (port 6006) — SB8, 16 stories

**Existing stories:**
- DesignCanvas, GradientEditor, ShadowEditor
- FlexAlign, FlexAlignSelect, FlexDirection, FlexDirectionSelect, FlexWrap
- CornerModel, PropertySection, DropZoneIndicator, DrawTab
- DrawTab sub-components: ArgsForm, ComponentGroupItem, SlotField, StoryRow

**Panel components WITHOUT stories (~18):**
- **Core UI:** BoxModel, GapModel, ScaleScrubber, TabBar, ModeToggle, ElementsTab, ThemeTab
- **Patch/change UI:** PatchPopover, PatchDetailModal
- **Flex remaining:** FlexJustify, FlexJustifySelect, FlexWrapSelect, FlexDiagramPicker, DirectionPicker
- **Other:** BugReportMode, FocusTrapContainer, ShadowGhost, GradientBar
- **Standalone files (not modletized):** ColorGrid.tsx, ContainerSwitcher.tsx, ScaleRow.tsx

### Overlay — No stories, vanilla DOM + Shadow DOM

Two Web Components already exist:
- `vb-design-canvas` — zero global coupling, proper lifecycle (gold standard template)
- `adaptive-iframe` — also self-contained

The overlay state machine is already a pure reducer with declarative effects — ideal for Web Component extraction.

### Styling architecture

| Layer | Tech | Tokens |
|-------|------|--------|
| **Panel** | Tailwind v4 `@theme` in `panel/src/index.css` | `--color-bit-*` (bg, surface, teal, orange, text, muted, etc.) |
| **Overlay** | CSS-in-JS objects + Shadow DOM `<style>` in `overlay/src/styles.ts` | `--ov-*` (teal, orange, toolbar-bg, text, etc.) |
| **Mockups** | Inline CSS + bare variables | `--bg`, `--teal`, `--text` (ad-hoc) |

---

## Phase 0: Upgrade Panel Storybook to SB10

**Why first:** SB10 has better Web Component support, improved performance, and aligns with our test environments (storybook-test/v10 already runs SB10).

**Steps:**
1. Update `panel/package.json` deps:
   - `storybook` → `^10.x`
   - `@storybook/react-vite` → `^10.x`
   - `@storybook/addon-essentials` → `^10.x`
2. Run `npx storybook@latest upgrade` from `panel/`
3. Update `panel/.storybook/main.ts` for any SB10 config changes
4. Update `panel/.storybook/preview.tsx` if decorator API changed
5. Verify all 16 existing stories still render
6. Run `npm run build-storybook` — static build succeeds

**Verification:** `cd panel && npm run storybook` — all existing stories render without errors.

---

## Phase 1: Prove the Web Component + Storybook Pattern

**Goal:** Validate that overlay Web Components render correctly in the React Storybook.

**Steps:**
1. Create `panel/src/stories/overlay/` directory for overlay Web Component stories
2. Write a story for `vb-design-canvas` (already exists as a Web Component):
   ```tsx
   // panel/src/stories/overlay/VbDesignCanvas.stories.tsx
   const meta: Meta = { title: 'Overlay/VbDesignCanvas' };
   export const Default: StoryObj = {
     render: () => <vb-design-canvas src="about:blank" width="100%" height="400px" />,
   };
   ```
3. Add TypeScript JSX declarations for custom elements (augment `JSX.IntrinsicElements`)
4. Verify the Web Component renders and resizes in Storybook

**Key insight:** React Storybook renders custom element tags directly in JSX — no framework switch needed.

---

## Phase 2: Extract Overlay Containers as Web Components

**Why:** Containers (Modal, Sidebar, Popover) already implement the `IContainer` interface with minimal global coupling. Near-ready for extraction.

| Container | Current Coupling | Web Component |
|-----------|-----------------|---------------|
| `ModalContainer` | localStorage for bounds | `<vb-modal-container panel-url="..." open>` |
| `SidebarContainer` | Reads `#tw-page-wrapper` | `<vb-sidebar-container panel-url="..." width="..." side="left">` |
| `PopoverContainer` | Fixed positioning only | `<vb-popover-container panel-url="..." open>` |

**Steps per container:**
1. Create Web Component class extending `HTMLElement` (model after `vb-design-canvas`)
2. Move DOM creation from constructor/`open()` into `connectedCallback()`
3. Replace `shadowRoot` constructor param with own Shadow DOM (`this.attachShadow()`)
4. Expose `panel-url`, `open`, `width`, `side` as observed attributes
5. Expose `open()`, `close()`, `isOpen()` as public methods
6. Write Storybook story in `panel/src/stories/overlay/`
7. Update `overlay/src/index.ts` to use the new Web Component instead of the old class
8. Verify overlay still works end-to-end

**Estimated effort:** ~1 day per container.

---

## Phase 3: Extract Bottom Toolbar as Web Component

**Why:** The bottom toolbar is the easiest toolbar to extract — moderate coupling, clear input/output contract.

**Current architecture:**
- Reads: `state.currentEquivalentNodes` (instance count), `getState().toolbar` (visual state)
- Creates: Fixed bottom-center bar with tool buttons (Select, Insert, Text)
- Emits: `onToolChange(tool)`, `onAdjunctClick()`

**Web Component design:**
```
<vb-bottom-toolbar
  selected-tool="select"
  instance-count="3"
  disabled
/>

Events: @tool-change, @adjunct-click
```

**Steps:**
1. Create `overlay/src/bottom-toolbar/vb-bottom-toolbar.ts` Web Component
2. Move button creation into Shadow DOM with scoped styles
3. Replace `state.*` reads with observed attributes
4. Replace callback injection with `CustomEvent` dispatching
5. Write Storybook story showing all tool states
6. Update `effect-executor.ts` to set Web Component attributes instead of calling imperative functions
7. Update `overlay/src/index.ts` to mount the Web Component
8. Verify overlay behavior unchanged via E2E tests

**Estimated effort:** 1-2 days.

---

## Phase 4: Panel Component Stories (Parallel with Overlay Work)

### Phase 4a: Modletize standalone components
Move `ColorGrid.tsx`, `ContainerSwitcher.tsx`, `ScaleRow.tsx` into proper modlet folders with `index.ts` re-exports. Update all imports.

### Phase 4b: Stories for leaf/simple components (parallel)
ScaleScrubber, ColorGrid, GradientBar, DirectionPicker, TabBar, ModeToggle — minimal dependencies.

### Phase 4c: Stories for composed components
BoxModel, GapModel, FlexJustify, FlexJustifySelect, FlexWrapSelect, FlexDiagramPicker, ShadowGhost.

### Phase 4d: Stories for stateful/connected components
PatchPopover, PatchDetailModal, ElementsTab, ThemeTab (V3 + V4 variants), BugReportMode, FocusTrapContainer — need mock data for patches, elements, themes.

### Phase 4e: Top-level integration stories (stretch)
Picker.tsx, App.tsx — heavy mocking required, diminishing returns.

---

## Phase 5: Extract Element Toolbar + Drawer (Higher Effort)

**Element toolbar** — decompose into 3 focused Web Components:
- `<vb-element-toolbar>` — tool buttons + positioning
- `<vb-message-input>` — textarea + mic
- `<vb-group-picker>` — component group popover

**Element drawer** — extract as `<vb-element-drawer>`:
- Props: `target-component-name`, `mode` (describe/text/edit)
- Events: `@describe-submitted`, `@text-submitted`, `@state-changed`
- Replace direct WebSocket calls with custom events

**Pattern:** Effect executor dispatches state machine actions when it hears custom events from Web Components. Web Components never call WebSocket directly.

---

## Architecture Pattern

```
State Machine (pure reducer)
  → Effect Executor (bridge layer)
    → BEFORE: calls imperative functions like updateToolbar(visual)
    → AFTER:  sets Web Component props: toolbar.setAttribute('visual-state', ...)

Web Component
  → Renders based on attributes/properties
  → Emits CustomEvents on user interaction
  → Effect executor listens → dispatches state machine actions
```

This keeps Web Components fully testable in Storybook with zero server dependencies.

---

## Overlay Style Extraction

The overlay's styles live in `overlay/src/styles.ts` as:
- `OVERLAY_CSS` — 1000+ lines of Shadow DOM CSS with `--ov-*` tokens
- `css()` helper — converts camelCase style objects to inline CSS strings
- Individual modules add inline styles for positioning

**For Web Components:** Each extracted Web Component gets its own Shadow DOM with the relevant subset of `OVERLAY_CSS` tokens. Shared tokens are defined in a common `overlay/src/styles/tokens.css` file that each Web Component imports.

---

## Verification Checklist

- [ ] SB10 upgrade: all 16 existing stories render
- [ ] `vb-design-canvas` story renders in Storybook
- [ ] Each extracted Web Component renders in Storybook
- [ ] Each extracted Web Component works in the live overlay (E2E tests pass)
- [ ] `cd panel && npm run build-storybook` succeeds
- [ ] `cd panel && npm test` passes
- [ ] Interactive stories work (drag, tool switching, color picking)

---

## Open Questions

1. **TypeScript JSX declarations** — Augment `JSX.IntrinsicElements` for custom elements? Or use a `.d.ts` file?
2. **Shared overlay tokens** — Extract `--ov-*` tokens into a standalone CSS file importable by both Web Components and mockups?
3. **Web Component testing** — Vitest for unit tests on Web Components, or rely on Storybook interaction tests?
