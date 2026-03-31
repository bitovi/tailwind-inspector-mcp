# Option A — Visual Element Selection (Post-Submit Context)

## Status

Draft — design option for discussion

---

## Problem

After a user submits a draw canvas design, the canvas freezes to a static image. There is presently no way to add a text message to explain what was drawn, because:

1. Clicks inside `<vb-design-canvas>` are completely ignored by the overlay click handler (`overlay/src/index.ts` ~L148–155)
2. `<img>`, `<canvas>`, `<video>` elements, when selected, show a mostly-empty panel with no Tailwind classes to scrub

The same problem applies to any "visual" element in the user's page — images, canvas elements, and videos have no meaningful Tailwind class surface to work with, so the panel renders an empty picker with nothing actionable.

### Current behavior

```
User draws → submits canvas → canvas freezes to <img>
User clicks frozen canvas → overlay ignores the click
→ No panel update, no message row, no way to add context
```

### Affected elements

| Element | Problem |
|---------|---------|
| `<img>` | Click works, but panel shows empty picker |
| `<canvas>` | Click works, but panel shows empty picker |
| `<video>` | Click works, but panel shows empty picker |
| `<vb-design-canvas>` (frozen) | Click ignored entirely by overlay; design canvas guard blocks it |
| `<vb-design-canvas>` (active) | Correctly ignored — iframe still present |

---

## DOM State Reference

### Frozen canvas (should now be clickable)

```html
<vb-design-canvas data-tw-design-canvas>
  <img src="frozen-drawing.png">   <!-- visible, interactive -->
</vb-design-canvas>
<original-element style="display:none">  <!-- hidden, still in DOM -->
```

### Active canvas (must still be ignored by overlay)

```html
<vb-design-canvas data-tw-design-canvas>
  <iframe src="/panel/?mode=design">  <!-- iframe present = still active -->
  <div class="resize-handle-bottom">
  <div class="resize-handle-corner">
</vb-design-canvas>
```

The distinguishing signal: a frozen canvas has **no `<iframe>` child**. An active canvas always has one.

---

## Solution Overview

Treat `<img>`, `<canvas>`, `<video>`, and frozen `<vb-design-canvas>` elements as **"visual elements"** — a special selection mode where:

- The **overlay toolbar** shows: Select + N+ + Insert + message row (hides Design / Text / Replace action buttons)
- The **panel** shows: a message-focused view instead of the Picker (Replace tab still shown)
- Users can type and stage a `kind: 'message'` patch to give the AI agent narrative context

```
Normal element selected:
  Toolbar: [Select] [N+] [Insert]  [Design] [Text] [Replace]
  Panel:   Picker with class chips

Visual element selected:
  Toolbar: [Select] [N+] [Insert]  (no action buttons)
           ┌─ "What this shows..." ──────────────── [▶] ─┐
           └────────────────────────────────────────────┘
  Panel:   Message-focused view  +  [Replace] tab
```

This uses **existing infrastructure exclusively** — `patchManager.stageMessage()` already exists in `panel/src/hooks/usePatchManager.ts` and is never called from the panel UI today.

---

## Architecture

```
overlay/src/index.ts               overlay/src/element-toolbar.ts
       │                                       │
  click guard                         showDrawButton()
  relaxed for                         isVisualElement() helper
  frozen canvas                       hides Design/Text/Replace
       │                              adds message row only
       ▼                                       │
  ELEMENT_SELECTED ─────────────────► panel/src/App.tsx
    { tag: 'vb-design-canvas' }          isVisualElement state
                                         renders MessageView
                                         instead of Picker
                                              │
                                             stageMessage()
                                              │
                                   panel/src/hooks/usePatchManager.ts
                                         kind: 'message' patch
```

---

## Implementation

### Phase 1 — Overlay: allow clicking visual elements

#### 1. Relax the design-canvas click guard

**File:** `overlay/src/index.ts` ~L148–155

Change from ignoring ALL clicks inside `data-tw-design-canvas` to ignoring clicks only when the canvas is **active** (has an `<iframe>` child):

```typescript
// Before: ignore all clicks inside design canvas wrappers
if (
  composed.some(
    (el) => el instanceof HTMLElement && el.hasAttribute("data-tw-design-canvas"),
  )
)
  return;

// After: only ignore when canvas is still active (iframe present = drawing in progress)
const canvasWrapper = composed.find(
  (el) => el instanceof HTMLElement && el.hasAttribute("data-tw-design-canvas"),
) as HTMLElement | undefined;
if (canvasWrapper?.querySelector("iframe")) return;
```

This preserves the existing guard for active canvases while allowing clicks on frozen ones to propagate to the normal click-selection path.

#### 2. Add `tag` field to `ElementSelectedMessage`

**File:** `shared/types.ts` ~L134–141

The panel needs to know the tag name of the selected element in order to enter visual-element mode.

```typescript
// Before:
export interface ElementSelectedMessage {
  type: 'ELEMENT_SELECTED';
  to: 'panel';
  componentName: string;
  instanceCount: number;
  classes: string;
  tailwindConfig: any;
}

// After:
export interface ElementSelectedMessage {
  type: 'ELEMENT_SELECTED';
  to: 'panel';
  componentName: string;
  instanceCount: number;
  classes: string;
  tailwindConfig: any;
  tag?: string;  // lowercase tag name, e.g. 'img', 'canvas', 'vb-design-canvas'
}
```

Populate `tag` in all ELEMENT_SELECTED send sites in `overlay/src/index.ts`:

```typescript
// When building the ELEMENT_SELECTED payload, add:
tag: el.tagName.toLowerCase(),
```

For a frozen `<vb-design-canvas>`, the outer wrapper element is selected — the `tag` should be `'vb-design-canvas'` (the custom element tag name, lowercased).

#### 3. Conditionally hide action buttons for visual elements

**File:** `overlay/src/element-toolbar.ts` ~L173–248

Define a helper and use it when rendering toolbar buttons:

```typescript
const VISUAL_TAGS = new Set(['img', 'canvas', 'video']);

function isVisualElement(el: HTMLElement): boolean {
  // Custom elements: tag name contains a hyphen
  const tag = el.tagName.toLowerCase();

  // Frozen design canvas: has the wrapper attribute but no active iframe
  if (el.hasAttribute('data-tw-design-canvas')) {
    return !el.querySelector('iframe');
  }

  return VISUAL_TAGS.has(tag);
}
```

In `showDrawButton()` (or whichever function renders the action buttons), gate the Design / Text / Replace buttons:

```typescript
const isVisual = isVisualElement(targetEl);

if (!isVisual) {
  // render Design button
  // render Text button
  // render Replace button
}

// Always render: Select group, N+, Insert button, message row
```

---

### Phase 2 — Panel: message-focused view

#### 4. Detect visual element in panel

**File:** `panel/src/App.tsx` ~L173–190

```typescript
const [isVisualElement, setIsVisualElement] = useState(false);

// In ELEMENT_SELECTED handler:
const VISUAL_TAGS = new Set(['img', 'canvas', 'video', 'vb-design-canvas']);

ws.on('ELEMENT_SELECTED', (msg: ElementSelectedMessage) => {
  // ... existing handler logic ...
  setIsVisualElement(VISUAL_TAGS.has(msg.tag ?? ''));
});
```

Reset to `false` when selection is cleared or `NO_ELEMENT_SELECTED` is received.

#### 5. Render message UI instead of Picker

**File:** `panel/src/App.tsx` ~L702–730

When `isVisualElement` is true:

- Show only the **Replace** tab (no Design tab)
- Where the "Design" tab content would normally render: show a `MessageView` instead of `<Picker>`

**Panel layout for visual elements:**

```
┌─────────────────────────────────────────┐
│ [Select] ← mode toggle    div.card      │
│────────────────────────────────────────│
│ [Replace]                               │  ← only tab shown
│────────────────────────────────────────│
│                                         │
│  🖼  Design canvas                      │
│      Add a message to describe this     │
│      element for the AI agent.          │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │ What this drawing shows...       │   │
│  └──────────────────────────────────┘   │
│                          [Stage ➤]      │
│                                         │
└─────────────────────────────────────────┘
```

**`MessageView` component** (`panel/src/components/MessageView/MessageView.tsx`):

```typescript
interface MessageViewProps {
  tag: string;
  onStage: (message: string) => void;
}

export function MessageView({ tag, onStage }: MessageViewProps) {
  const [text, setText] = useState('');

  const label =
    tag === 'vb-design-canvas' ? 'Design canvas'
    : tag === 'img' ? 'Image'
    : tag === 'canvas' ? 'Canvas'
    : tag === 'video' ? 'Video'
    : 'Visual element';

  return (
    <div className="message-view">
      <p className="message-view__label">{label}</p>
      <p className="message-view__hint">
        Add a message to describe this element for the AI agent.
      </p>
      <textarea
        className="message-view__textarea"
        placeholder="What this drawing shows..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        className="message-view__send"
        disabled={!text.trim()}
        onClick={() => {
          onStage(text.trim());
          setText('');
        }}
      >
        Stage ➤
      </button>
    </div>
  );
}
```

`onStage` calls `patchManager.stageMessage(text)` — existing function, no changes needed.

---

### Phase 3 — Replace for visual elements

#### 6. `<img>`, `<canvas>`, `<video>` — standard replace

These elements work with the existing Replace flow unchanged. A `component-drop` or new `design` patch with `insertMode: 'replace'` targets them directly. No special handling required.

#### 7. Frozen `<vb-design-canvas>` — "re-replace" the original element

When the user triggers Replace on a frozen canvas, the intent is: "I want a different replacement for the original element I was replacing."

The DOM still holds the original element hidden (`display: none`). The replace flow must:

1. Find the `DesignCanvasEntry` in `state.designCanvasWrappers` for this wrapper
2. Call `handleDesignClose()` to restore the original hidden element to the DOM
3. Auto-discard the old design patch from the queue (send `PATCH_DISCARD` with the patch ID)
4. Re-select the now-restored original element
5. Proceed with the normal Replace flow targeting the original element

This logic lives in a new `handleVisualElementReplace(wrapper)` function in `overlay/src/design-canvas-manager.ts`.

#### 8. Track patch ID on canvas wrapper

To auto-discard the old design patch during re-replace, the canvas wrapper needs to store the patch ID that was assigned when the design was submitted.

**File:** `server/websocket.ts`

The server currently sends `DESIGN_SUBMITTED` without the patch ID:

```typescript
// Current:
broadcastTo("overlay", { type: "DESIGN_SUBMITTED", image: msg.image }, ws);

// Updated:
broadcastTo("overlay", { type: "DESIGN_SUBMITTED", image: msg.image, patchId: patch.id }, ws);
```

**File:** `overlay/src/design-canvas-manager.ts`

In `handleDesignSubmitted()`, store the patch ID as a data attribute on the wrapper:

```typescript
export function handleDesignSubmitted(msg: { image?: string; patchId?: string }): void {
  // ... existing freeze logic (replace iframe with img) ...

  if (msg.patchId) {
    last.setAttribute('data-tw-patch-id', msg.patchId);
  }
}
```

During re-replace, read this attribute to know which patch to discard:

```typescript
export function handleVisualElementReplace(wrapper: HTMLElement): void {
  const patchId = wrapper.getAttribute('data-tw-patch-id');

  // 1. Restore original element
  handleDesignClose(wrapper);

  // 2. Discard old design patch
  if (patchId) {
    sendToServer({ type: 'PATCH_DISCARD', patchId });
  }

  // 3. Re-select the restored original element and enter Replace mode
  // (trigger normal click-select + Replace tab open)
}
```

---

## User Flows

### Flow A — Post-submit context message

```
1. User draws on canvas
2. User clicks "Queue as Change" → canvas freezes to static image
3. User clicks frozen canvas
   → overlay: canvas wrapper selected (no iframe, so click allowed)
   → ELEMENT_SELECTED sent with tag: 'vb-design-canvas'
4. Panel switches to MessageView; overlay toolbar shows message row only
5. User types: "This replaces the hero section with a new 3-column layout"
6. User clicks Stage ➤
   → patchManager.stageMessage() called
   → kind: 'message' patch staged, scoped to the component
7. User commits
   → AI agent receives design image + narrative together in implement_next_change
```

### Flow B — Re-replace frozen canvas

```
1. User submitted design canvas (canvas frozen to static image)
2. User clicks frozen canvas → visual element selected
3. User clicks Replace tab in panel
   → DrawTab opens in replace mode
4. User picks a component from the component list
   → overlay recognizes canvas wrapper has data-tw-patch-id
   → old design patch auto-discarded (PATCH_DISCARD sent)
   → original hidden element restored to DOM (handleDesignClose)
   → component drop proceeds targeting original element
5. New component-drop patch replaces old design patch in the queue
```

---

## Affected Files

| File | Change |
|------|--------|
| `overlay/src/index.ts` | Relax click guard (L148–155); populate `tag` in all ELEMENT_SELECTED sends |
| `overlay/src/element-toolbar.ts` | Add `isVisualElement()` helper; conditionally suppress action buttons |
| `overlay/src/design-canvas-manager.ts` | Store `patchId` on wrapper; `handleVisualElementReplace()` for re-replace |
| `shared/types.ts` | Add `tag?: string` to `ElementSelectedMessage` |
| `panel/src/App.tsx` | Detect visual element from `tag`; filter tabs; render `MessageView` |
| `panel/src/components/MessageView/` | New modlet: `MessageView.tsx`, `index.ts`, `MessageView.test.tsx` |
| `server/websocket.ts` | Include `patchId` in `DESIGN_SUBMITTED` broadcast |

---

## Pros & Cons

### Pros

- **General solution** — any `<img>`, `<canvas>`, or `<video>` becomes useful, not just design canvases
- **No new infrastructure** — uses existing message staging (`kind: 'message'` patches), existing WS message types, existing `patchManager.stageMessage()`
- **Natural replacement pattern** — a frozen canvas behaves like any other visual element
- **Post-submit context** — user finishes drawing, reviews it, then describes it deliberately
- **Replace for non-canvas visuals is free** — no extra work; standard replace path handles `<img>` directly
- **Panel is already correct** — Replace tab behavior requires minimal changes to App.tsx

### Cons

- **Two-step context flow** — user must submit the canvas first, then re-click to add a message (cannot add context while drawing)
- **Empty Replace tab** — for frozen canvases when no Storybook is running, the Replace tab shows a "no components found" state
- **Re-replace complexity** — restoring the original element + discarding the old patch + re-selecting is the most intricate part; requires careful sequencing to avoid DOM mismatches
- **Tag propagation** — `tag` must be added to `ElementSelectedMessage` and populated in all ELEMENT_SELECTED send sites; easy to miss one

---

## Comparison with Option B

| Concern | Option A (this spec) | Option B (floating row) |
|---------|----------------------|------------------------|
| When context is written | After submission | While drawing |
| Infrastructure changes | `shared/types.ts`, 3 overlay files, panel | 2 overlay files only |
| Panel changes | Yes (MessageView, tab filter) | None |
| Re-replace support | Yes (full flow) | No (would need Option A) |
| Works for `<img>`, `<video>` | Yes | No (canvas-only) |
| Complexity | Medium (re-replace is tricky) | Low-medium (ResizeObserver positioning) |

Option A and Option B are **complementary**, not mutually exclusive. A combined implementation would use Option B's floating row for during-drawing context and Option A's visual-element selection for post-submit context and non-canvas visuals.
