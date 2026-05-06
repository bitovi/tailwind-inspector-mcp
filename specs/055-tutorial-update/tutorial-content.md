# Tutorial Content — Draft for Review

This document shows the planned text for every step that is **changed or new**. Steps that are identical to today (1, Welcome; and other purely structural changes) are omitted unless the wording changes.

Review notes welcome on any step. When this looks good, the implementation will update `test-app/src/App.tsx`.

---

## Step 2 — Open the Panel *(rewrite)*

> See the round button in the bottom-right corner of the page? That's the **VyBit toggle button**. Click it to open the inspector panel. The panel will slide in as a sidebar on the right side of the page.

> Once open, you'll see the panel has three buttons at the top:

> <EditIcon /> **Edit** — The main working mode. Select elements, inspect their styles, send change messages, edit text, and tweak Tailwind classes from here.

> <BugReportIcon /> **Bug Report** — Record and describe issues. Pick an element, describe what's wrong, and VyBit captures a timeline snapshot for context.

> <ThemeIcon /> **Theme** — Browse and adjust your project's Tailwind design tokens — colors, spacing, font sizes — and preview changes live across the whole page.

> At the **bottom of the page**, you'll also see two toolbar buttons:

> <SelectIcon /> **Select** — Activates the pointer so you can click elements in your app to inspect and edit them.

> <InsertIcon /> **Insert** — Activates insertion mode so you can click a gap between elements to set an insertion point for new content.

> You'll use all of these in the exercises below.

---

## Step 3 — Your First Change *(Select location update)*

> Let's make your first change. **Click the issue card below** to select it, then tell VyBit what to do.

> 1. Use the **Select** button (<SelectIcon />) at the bottom of the page to enter Select mode
> 2. Click the card below — it will highlight with a teal border and a small toolbar will appear
> 3. Click **Describe change** in the toolbar — a message form appears
> 4. Type something like: *"Make the bug tag flash red"*
> 5. Click the **submit** button (<SendIcon />) to queue the message
> 6. At the bottom of the panel, click the **draft count** (e.g., "1 draft") to open the queue
> 7. Click **Commit**

> Open your browser's developer console (F12) to see the MCP tool call — that's exactly what an AI agent would receive.

---

## Step 4 — Send a Voice Message *(Select location update)*

> Sometimes it's easier to talk than type. VyBit has a microphone button for voice messages.

> 1. Use the **Select** button (<SelectIcon />) at the bottom of the page to enter Select mode
> 2. Click the **Assign** button below to select it
> 3. In the floating toolbar, click the **microphone** (<MicIcon />) button next to the message input
> 4. Speak your change — something like *"When assigning, show a spinner in the assign button and disable the button"*
> 5. Click the mic again to stop recording, then click the **submit** button (<SendIcon />)

---

## Step 5 — Edit Text In Place *(Select location update)*

> You can edit text directly on the page using the overlay toolbar.

> 1. Make sure you're in **Select** mode — use the <SelectIcon /> button at the bottom of the page if needed
> 2. Click the empty state card below to select it — it will highlight with a teal border
> 3. Click the **Edit text** button in the toolbar that appears below the selection
> 4. The text becomes editable — try changing it to something friendlier, like *"Nothing here yet — Create your first issue!"*
> 5. Click away or press Escape to finish editing

---

## Step 6 — Describe What to Add *(Insert location update)*

> Now let's **add a new field** to this form.

> 1. Use the **Insert** button (<InsertIcon />) at the bottom of the page to enter Insert mode
> 2. Hover over the form below — you'll see insertion indicators between the fields
> 3. Click the gap between **Email** and **Role** to set an **insert point**
> 4. Click **Describe change** in the toolbar — a message form appears
> 5. Type something like: *"Add a phone number field"*
> 6. Click the **submit** button (<SendIcon />)

---

## Step 7 — Sketch What to Add *(Insert location + tab name update)*

> Don't want to describe in words? Draw it instead. The signups below are just numbers — let's sketch a chart to visualize the trend.

> 1. Use the **Insert** button (<InsertIcon />) at the bottom of the page and click between **"Monthly Signups"** and **"January"** to set an insertion point
> 2. In the panel's **Components** tab, click <DrawCanvasButton /> **Draw / Screenshot Canvas**
> 3. On the canvas, sketch a bar chart — draw a few bars of different heights with labels underneath
> 4. Click **✓ Add to Drafts** to queue the drawing

---

## Step 11 — Place a Component *(was Step 8 — Insert location + drag rewrite)*

> VyBit can browse your component library and place components directly onto the page.

> 1. Use the **Insert** button (<InsertIcon />) at the bottom of the page if not already active
> 2. In the panel, you'll see the **Components** tab with your available components
> 3. **Drag** the thumbnail of a component (e.g., **Badge**) from the panel out onto the page — a semi-transparent ghost preview will follow your cursor
> 4. Drop-zone indicators (teal lines) appear as you hover over different positions — release to place the component
> 5. Alternatively, you can click a component's **Place** button and then click on the page to drop it

---

## Step 8 — Move Elements *(NEW)*

> Elements you've placed — or any existing element — can be dragged to a new position. The same teal drop-zone indicators that guided you during placement will show you exactly where it will land.

> The priority queue below has a **Critical** issue at the bottom when it should be first. Let's fix that.

> 1. Use the **Select** button (<SelectIcon />) at the bottom of the page
> 2. Click the **Critical — Fix payment gateway timeout** row to select it
> 3. Drag it to the top of the list — drop-zone indicators will show you where it will land
> 4. Release to move it — the change is staged as a draft

> **Tip:** Press **Escape** while dragging to cancel and return the element to its original position.

---

## Step 9 — Delete Elements *(NEW)*

> Removing an element is a single keypress. VyBit hides it on the page and queues a delete change for your agent — nothing is permanently removed until the agent writes the code.

> The resolved issue card below is stale and should be cleaned up.

> 1. Use the **Select** button (<SelectIcon />) at the bottom of the page
> 2. Click the **Resolved** card below to select it
> 3. Press **Delete** or **Backspace** — the card disappears and a delete change is staged in your drafts

---

## Step 10 — Copy and Paste *(NEW)*

> VyBit lets you copy any element and paste it anywhere on the page. Cmd+D gives you an instant duplicate right after the original — no placement flow needed.

> The team roster below has two members. Let's add a third slot.

> 1. Use the **Select** button (<SelectIcon />) at the bottom of the page
> 2. Click one of the team member cards to select it
> 3. Press **Cmd+D** to instantly duplicate it right after itself
> 4. Or: press **Cmd+C** to copy, then **Cmd+V** — the drop-zone placement flow activates so you can drop the copy anywhere on the page
> 5. Your agent will fill in the new member's details

---

## Step 12 — Build with Nested Components *(was Step 9 — Insert location + drag-to-slot rewrite)*


> Some components accept other components as props. For example, the **Button** has **leftIcon** and **rightIcon** slots that accept an Icon component. You can fill these slots by dragging — just drop a component thumbnail directly onto the slot field in the panel.

> 1. Use the **Insert** button (<InsertIcon />) at the bottom of the page if not already active
> 2. In the panel's **Components** tab, find **Button** and click its **Customize** button
> 3. In the props drawer, switch the **variant** to `warning`
> 4. Find the **leftIcon** slot field — now **drag** the **Icon** component thumbnail and drop it directly onto the **leftIcon** slot. The slot will glow teal to show it's a valid drop target.
> 5. You'll see a star appear in the Button preview
> 6. Click the Button's **Place** button and drag it onto the page — or drag the thumbnail directly

---

## Step 13 — Fine-Tune the Design *(was Step 10 — Select location update)*

> VyBit isn't just for big changes — you can precisely adjust Tailwind classes too. Scrub spacing values, pick colors from a palette, adjust shadows, and see changes live as you drag.

> 1. Use the **Select** button (<SelectIcon />) at the bottom of the page
> 2. Click the purple banner below (not the text inside it) — it will show its Tailwind properties in the panel
> 3. Try any of these in the panel's **Design** tab:
>    - Drag the **padding** scrubber left or right
>    - Click a **color** chip to open the color grid — pick a new background color
>    - Adjust the **shadow** to make it bigger or smaller
>    - Change the **ring** width or color to add an outline
>    - Tweak the **border radius** to sharpen or round the corners
> 4. Every change previews live on the page — experiment freely

---

## Step 14 — Report a Bug *(was Step 11 — no change to wording)*

*No text changes. Step number only shifts from 11 → 14.*

---

## Bonus Step 15 — Explore Your Theme *(was Bonus Step 12 — no change to wording)*

*No text changes. Step number only shifts from 12 → 15.*

---

## Bonus Step 16 — Wireframe with HTML Elements *(NEW)*

> The **Elements** tab in the panel gives you plain HTML building blocks — flex rows, flex columns, and a button — that you can drag directly onto the page to rough out a layout. These aren't design-system components; they're bare HTML so the agent can adapt them to match your app's style when implementing.

> 1. Use the **Insert** button (<InsertIcon />) at the bottom of the page
> 2. In the panel, click the **Elements** tab
> 3. **Drag** one of the elements (e.g., `div.flex-row`) onto the page — drop it wherever you want a new layout slot
> 4. The agent will see the raw HTML and infer the appropriate styles from your existing page when it implements the change

> **Elements available:**
> - `div.flex-row` — a horizontal flex container with two placeholder slots
> - `div.flex-row > .flex-auto` — a horizontal flex container where slots grow to fill space evenly
> - `div.flex-col` — a vertical flex container with two placeholder slots
> - `button.inline` — a bare inline button

> **Tip:** Use these to sketch layout structure quickly, then describe what each slot should contain in a follow-up change message.

---

## totalSteps

Changes from `11` to `14` in:
- `test-app/src/App.tsx` — the `totalSteps` constant
- Progress header: "X of 14 completed"
- Completion banner: "14 steps" → updates automatically

Bonus steps (15, 16) are not counted in `totalSteps` — they remain outside the main progress counter.
