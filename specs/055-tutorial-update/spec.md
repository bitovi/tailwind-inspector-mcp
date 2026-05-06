# 055 — Tutorial Update: New UI Labels + Move/Delete/Copy-Paste Steps

## Goal

Update the guided tutorial page to match the current UI and add three new exercises that teach moving, deleting, and copy-pasting elements.

---

## Background

Since the tutorial was written, several things changed:

1. **Panel header buttons changed** — was "Select / Insert / Bug Report", now "Edit / Bug Report / Theme"
2. **Select and Insert moved** to the bottom overlay toolbar (outside the panel)
3. **Drag-from-thumbnail** is now the primary way to place components (not click-to-arm)
4. **Drag-to-slot** is now the way to fill component props (Set Prop button being removed)
5. **Move, delete, and copy-paste** are all fully implemented and need tutorial coverage

---

## Files Changed

- `test-app/src/App.tsx` — all tutorial step content + `totalSteps` constant
- `e2e/tutorial-helpers.ts` — updated later (separate pass after manual verification)

---

## Step Renumbering

| Old # | New # | Title | Change |
|-------|-------|-------|--------|
| 1 | 1 | Welcome to VyBit | No change |
| 2 | 2 | Open the Panel | Rewrite button descriptions |
| 3 | 3 | Your First Change | Update Select location |
| 4 | 4 | Send a Voice Message | Update Select location |
| 5 | 5 | Edit Text In Place | Update Select location |
| 6 | 6 | Describe What to Add | Update Insert location |
| 7 | 7 | Sketch What to Add | Update Insert location + tab name |
| — | **8** | **Move Elements** | ✨ New |
| — | **9** | **Delete Elements** | ✨ New |
| — | **10** | **Copy and Paste** | ✨ New |
| 8 | 11 | Place a Component | Update Insert location + rewrite for drag |
| 9 | 12 | Build with Nested Components | Update Insert + rewrite for drag-to-slot |
| 10 | 13 | Fine-Tune the Design | Update Select location |
| 11 | 14 | Report a Bug | No change |
| 12 (bonus) | 15 (bonus) | Explore Your Theme | No change |
| — | **16 (bonus)** | **Wireframe with HTML Elements** | ✨ New |

`totalSteps`: 11 → 14

---

## Changes Per Step

### Step 2 — Open the Panel
- Remove old three-button list (Select / Insert / Bug Report)
- Explain the panel has **Edit**, **Bug Report**, and **Theme** buttons at the top
- Add: Select and Insert are at the **bottom of the page** in the overlay toolbar, not in the panel
- Update inline icon components to match: SelectIcon/InsertIcon render correctly already (teal on dark), just the surrounding text needs updating

### Steps 3, 4, 5, 13
- "In the panel, click the Select button" → "Use the **Select** button at the bottom of the page"

### Steps 6, 7, 11, 12
- "In the panel header, click the Insert button" → "Use the **Insert** button at the bottom of the page"

### Step 7
- "panel's **Place** tab" → "panel's **Components** tab"

### Step 11 — Place a Component (drag rewrite)
- Old: Click **Place** button → cursor becomes crosshair → click to drop
- New: **Drag** the component thumbnail from the panel to the page; drop-zone indicators guide placement; Place button remains as a fallback option

### New Step 8 — Move Elements
- **Playground**: A row of priority labels in the wrong order — user drags one to fix it
- User flow: Select tool → click element to select → drag it → drop-zone indicators → release
- Note: same drop-zone indicators as placement

### New Step 9 — Delete Elements
- **Playground**: A single "Closed" issue card that should be removed
- User flow: Select tool → click to select → press Delete or Backspace → element is hidden, patch staged
- Note: nothing is permanently deleted until the agent runs

### New Step 10 — Copy and Paste
- **Playground**: Two team member cards; user copies one to add a third slot
- User flow (paste): Select → Cmd+C → Cmd+V → drop-zone flow → place
- User flow (duplicate): Select → Cmd+D → copy appears immediately after

### Step 12 — Build with Nested Components (drag-to-slot rewrite)
- Old: ⊞ button → list switches to Set Prop mode → click Set Prop button
- New: Drag a component thumbnail; while inside the panel, slot fields on other component cards light up → drop on the slot to fill it
- Remove all mention of ⊞ button and Set Prop — that flow is being removed

---

## Playground Elements

### Step 8 — Move Elements
A "Priority Queue" card with three priority label badges in the wrong order. The label "Critical" is last when it should be first.

```tsx
<div className="bg-white rounded-lg shadow p-4">
  <h3 className="text-sm font-semibold text-gray-700 mb-3">Issue Priority Queue</h3>
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
      <Badge color="yellow">Medium</Badge>
      <span className="text-sm text-gray-700">Improve dashboard load time</span>
    </div>
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
      <Badge color="blue">Low</Badge>
      <span className="text-sm text-gray-700">Update onboarding copy</span>
    </div>
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
      <Badge color="red">Critical</Badge>
      <span className="text-sm text-gray-700">Fix payment gateway timeout</span>
    </div>
  </div>
</div>
```

### Step 9 — Delete Elements
A resolved/closed issue card that's cluttering the board and should be removed.

```tsx
<div className="bg-gray-50 border border-gray-200 rounded-lg p-4 opacity-60">
  <div className="flex items-center justify-between mb-1">
    <span className="text-sm font-medium text-gray-500 line-through">Migrate to new auth provider</span>
    <Badge color="green">Resolved</Badge>
  </div>
  <p className="text-xs text-gray-400">Closed 14 days ago · No longer relevant</p>
</div>
```

### Step 10 — Copy and Paste
A compact team roster with two members. User copies one card to create a third slot.

```tsx
<div className="bg-white rounded-lg shadow p-4">
  <h3 className="text-sm font-semibold text-gray-700 mb-3">Project Team</h3>
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
      <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold">AL</div>
      <div>
        <p className="text-sm font-medium text-gray-900">Alice Lim</p>
        <p className="text-xs text-gray-500">Engineering Lead</p>
      </div>
    </div>
    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">MR</div>
      <div>
        <p className="text-sm font-medium text-gray-900">Marco Reyes</p>
        <p className="text-xs text-gray-500">Product Designer</p>
      </div>
    </div>
  </div>
</div>
```

### New Bonus Step 16 — Wireframe with HTML Elements
- **Playground**: An empty whitespace section between two existing cards — user drops a flex-row element to scaffold a new layout
- User flow: Insert mode → Elements tab → drag a primitive (e.g., `div.flex-row`) to the page
- Note: agent will match page styles when implementing; these are intentionally unstyled

---

## E2E Tests (deferred)

After the tutorial content is manually verified, update `e2e/tutorial-helpers.ts`:

- Fix `clickSelectElementButton()`: remove all 3 old fallbacks, replace with overlay shadow DOM `[data-tool="select"]`
- Fix `clickInsert()`: remove panel-frame lookup, use overlay shadow DOM `[data-tool="insert"]`
- Update `TOTAL_STEPS = 14`
- Add `SECTION_TITLES` entries for steps 9–11
- Add `doStep9`, `doStep10`, `doStep11` implementations
