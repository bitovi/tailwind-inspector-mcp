# Tutorial Page Content — Mock Layout

This document describes the exact content of the guided tutorial page, section by section. Each section includes the title, instruction text shown to the user, and a description of the **playground** — the interactive elements the user will interact with to complete the step.

All playground elements are parts of a single cohesive app: **Acme Project Tracker** — a lightweight issue/project management dashboard. This gives the tutorial a realistic feel where every exercise targets a recognizable piece of a real product.

---

## Page Header

A minimal top bar. No navigation — just the title and a reset link.

```
VyBit Interactive Tutorial                        [↺ Start Over]
```

---

## Section 1: Welcome to VyBit

### Title
**Welcome to VyBit**

### Instructions
> VyBit is a visual editing tool that works alongside your running app. You select elements, describe changes in plain language or tweak styles visually, and VyBit sends precise instructions to an AI coding agent that implements the changes in your source code.
>
> This tutorial will walk you through the most common features. Each section has a small exercise — try them in any order. Completed sections get a checkmark so you can track your progress.
>
> No backend is running. In the real workflow, committed changes would be picked up by an AI agent. Here, you'll see the exact MCP tool output logged to your browser's developer console.
>
> Below is a sample app — **Acme Project Tracker** — that you'll modify throughout the exercises.

### Playground
*No interactive playground.* This is a read-only introduction. All sections below are already visible and explorable.

---

## Section 2: Meet the Three Modes

### Title
**Meet the Three Modes**

### Instructions
> VyBit has three modes, controlled by the buttons at the top of the panel:
>
> **Select** — Click elements in your app to inspect and change them. This is where you'll spend most of your time. Select an element, then describe what you want changed, tweak spacing, adjust colors, or edit text directly.
>
> **Insert** — Add new content to the page. Click a spot where you want something new, then describe it, sketch it, or pick a component from your design system.
>
> **Bug Report** — Record and describe issues. Pick an element, describe what's wrong, and VyBit captures a timeline snapshot for context.
>
> You'll try all three in the exercises below.

### Playground
*No interactive playground.* This is a read-only explainer. All exercises below are available — start with whichever catches your eye.

---

## Section 3: Open the Panel

### Title
**Open the Panel**

### Instructions
> See the round button in the bottom-right corner of the page? That's the **VyBit toggle button**. Click it to open the inspector panel.
>
> The panel will slide in as a sidebar on the right side of the page.

### Playground
*No interactive playground.* The user interacts with the overlay toggle button that's already floating on the page. An animated arrow or pulsing indicator could point toward the bottom-right corner to draw attention.

**Auto-detection:** The step completes when the panel registers via BroadcastChannel (`REGISTER` with `role: 'panel'`).

---

## Section 4: Your First Change

### Title
**Your First Change**

### Instructions
> Let's make your first change. **Click the issue card below** to select it, then tell VyBit what to do.
>
> 1. Click the card below — it will highlight with a teal border
> 2. In the panel's message area, type something like: *"Make the priority tag red and add a due date field"*
> 3. Click **Queue Message** in the panel
> 4. At the bottom of the panel, click the **draft count** (e.g., "1 draft") to open the queue
> 5. Click **Commit**
>
> Open your browser's developer console (F12) to see the MCP tool call — that's exactly what an AI agent would receive.

### Playground
An issue card from the Acme Project Tracker, showing a single issue summary:

```
┌──────────────────────────────────────────┐
│  Fix Login Page Timeout          [Bug]   │
│  Users see a blank screen after 30s      │
│  on the login page.                      │
└──────────────────────────────────────────┘
```

Rendered as:
```html
<Card
  title="Fix Login Page Timeout"
  description="Users see a blank screen after 30s on the login page."
  tag="Bug"
/>
```

This is a real `<Card>` component the user can click to select in the overlay.

**Auto-detection:** `PATCH_COMMIT` message received.

---

## Section 5: Send a Voice Message

### Title
**Send a Voice Message**

### Instructions
> Sometimes it's easier to talk than type. VyBit has a microphone button for voice messages.
>
> 1. Click the action buttons below to select them
> 2. In the panel, click the **microphone icon** (🎤) next to the message input
> 3. Speak your change — something like *"Add a 'Reopen' button between Assign and Close"*
> 4. Click the mic again to stop recording, then click **Queue Message**

### Playground
The action buttons from an issue detail view:

```
[ Assign ]  [ Close Issue ]
```

Rendered as:
```html
<div class="flex gap-2">
  <Button variant="primary">Assign</Button>
  <Button variant="secondary">Close Issue</Button>
</div>
```

**Auto-detection:** `MESSAGE_STAGE` message received with voice/audio content.

---

## Section 6: Edit Text In Place

### Title
**Edit Text In Place**

### Instructions
> You can edit text directly on the page using the overlay toolbar.
>
> 1. Make sure you're in **Select** mode (click the Select button in the panel if needed)
> 2. Click the issue title below to select it — it will highlight with a teal border
> 3. In the floating toolbar that appears above it, click the **Text** button
> 4. The text becomes editable — change the title to anything you like
> 5. Click away or press Escape to finish editing

### Playground
The header of an issue detail view — a title and description that look like they need editing:

```
Fix Login Page Timeout
Issue #1042 · Opened 3 days ago by @alice
```

Rendered as:
```html
<div>
  <h2 class="text-2xl font-bold text-gray-900 mb-1">Fix Login Page Timeout</h2>
  <p class="text-sm text-gray-500">Issue #1042 · Opened 3 days ago by @alice</p>
</div>
```

**Auto-detection:** `TEXT_EDIT_DONE` message received.

---

## Section 7: Describe What to Add

### Title
**Describe What to Add**

### Instructions
> Now let's **add something new** to the project roadmap.
>
> 1. In the panel header, click the **Insert** mode button
> 2. Hover over the page — you'll see insertion indicators between elements
> 3. Click the gap between the two feature cards below to set an **insert point**
> 4. In the panel's message area, describe what to add — something like: *"Add a card for 'Security Audit' with a red tag"*
> 5. Click **Queue Message**

### Playground
Two feature cards from the project roadmap, side by side with a visible gap:

```
┌────────────────────┐       ┌────────────────────┐
│  Authentication    │       │  Payments          │
│  OAuth and SSO     │       │  Stripe            │
│  integration.      │       │  integration.      │
│           [Auth]   │       │       [Billing]    │
└────────────────────┘       └────────────────────┘
```

Rendered as:
```html
<div class="grid grid-cols-2 gap-6">
  <Card title="Authentication" description="OAuth and SSO integration." tag="Auth" />
  <Card title="Payments" description="Stripe integration." tag="Billing" />
</div>
```

In insert mode, clicking the gap between the cards sets the insert point.

**Auto-detection:** `MESSAGE_STAGE` message received with `insertMode` set.

---

## Section 8: Sketch What to Add

### Title
**Sketch What to Add**

### Instructions
> Don't want to describe in words? Draw it instead. The signups below are just numbers — let's sketch a chart to visualize the trend.
>
> 1. Switch to **Select** mode and click the stats card below to select it
> 2. In the floating toolbar, click the **Draw** button (✏️)
> 3. Choose **After** to add content below the stats
> 4. On the canvas, sketch a bar chart — draw a few bars of different heights with labels underneath
> 5. Click **Submit** to queue the drawing

### Playground
A metrics card from the project dashboard showing raw signup numbers — begging for a visualization:

```
┌──────────────────────────────────────────┐
│  Monthly Signups                         │
│                                          │
│  January    120                          │
│  February   185                          │
│  March      310                          │
│  April      275                          │
│                                          │
└──────────────────────────────────────────┘
```

Rendered as:
```html
<div class="bg-white rounded-lg shadow p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Monthly Signups</h3>
  <div class="flex flex-col gap-2 text-sm">
    <div class="flex justify-between">
      <span class="text-gray-600">January</span>
      <span class="text-gray-900 font-medium">120</span>
    </div>
    <div class="flex justify-between">
      <span class="text-gray-600">February</span>
      <span class="text-gray-900 font-medium">185</span>
    </div>
    <div class="flex justify-between">
      <span class="text-gray-600">March</span>
      <span class="text-gray-900 font-medium">310</span>
    </div>
    <div class="flex justify-between">
      <span class="text-gray-600">April</span>
      <span class="text-gray-900 font-medium">275</span>
    </div>
  </div>
</div>
```

The user sketches a bar chart below it to visualize the trend.

**Auto-detection:** Design canvas submit (`QUEUE_UPDATE` with a design-kind patch).

---

## Section 9: Place a Component

### Title
**Place a Component**

### Instructions
> VyBit can browse your component library and place components directly onto the page.
>
> 1. Switch to **Insert** mode if not already active
> 2. In the panel, you'll see the **Components** tab with your available components
> 3. Find a component (e.g., **Badge**) and click its **Place** button
> 4. Hover over the page — you'll see a ghost preview of the component following your cursor
> 5. Click to drop it next to the existing status badges

### Playground
The status badges from an issue detail view — a few are already applied, with room for more:

```
Status:  [Open]  [Frontend]  [Priority: High]         ← drop one here
```

Rendered as:
```html
<div class="flex items-center gap-2">
  <span class="text-sm font-medium text-gray-700">Status:</span>
  <Badge color="green">Open</Badge>
  <Badge color="blue">Frontend</Badge>
  <Badge color="red">Priority: High</Badge>
</div>
```

**Auto-detection:** `COMPONENT_DROPPED` message received.

---

## Section 10: Build with Nested Components

### Title
**Build with Nested Components**

### Instructions
> Some components accept other components as props. For example, the Button component has **leftIcon** and **rightIcon** slots that accept an Icon component. VyBit lets you fill these slots from the component drawer.
>
> 1. In **Insert** mode, find the **Button** component in the Components tab
> 2. Click the expand arrow to open the component detail drawer
> 3. You'll see fields for the Button's props — set a label and variant
> 4. Find the **leftIcon** prop slot (it accepts a ReactNode) and click to fill it with an **Icon** component
> 5. Click **Place** and drop the composed button onto the page

### Playground
The issue action buttons from earlier, with room for a third:

```
[ Assign ]  [ Close Issue ]         ← place a new button here
```

Rendered as:
```html
<div class="flex gap-2">
  <Button variant="primary">Assign</Button>
  <Button variant="secondary">Close Issue</Button>
</div>
```

The user places a new Button with an Icon in its `leftIcon` slot — e.g., a star icon with "Favorite" label.

**Auto-detection:** `COMPONENT_DROPPED` message received (with nested component structure).

---

## Section 11: Fine-Tune the Design

### Title
**Fine-Tune the Design**

### Instructions
> VyBit isn't just for big changes — you can precisely adjust Tailwind classes too. Scrub spacing values, pick colors from a palette, adjust shadows, and see changes live as you drag.
>
> 1. Switch to **Select** mode
> 2. Click the banner below — it will show its Tailwind properties in the panel
> 3. Try any of these in the **Design** tab:
>    - Drag the **padding** scrubber left or right
>    - Click a **color** chip to open the color grid — pick a new background color
>    - Adjust the **shadow** to make it bigger or smaller
>    - Change the **ring** width or color to add an outline
>    - Tweak the **border radius** to sharpen or round the corners
> 4. Every change previews live on the page — experiment freely

### Playground
The project welcome banner — bold colors, generous spacing, a visible shadow, and a ring outline make the design properties obvious and inviting to tweak:

```
┌─────────────────────────────────────────────┐
│                                             │
│     Welcome to Acme Project Tracker         │
│     Your hub for issues, roadmaps,          │
│     and team collaboration.                 │
│                                             │
└─────────────────────────────────────────────┘
```

Rendered as:
```html
<div class="bg-indigo-600 text-white rounded-2xl p-12 text-center shadow-xl ring-4 ring-indigo-300">
  <h3 class="text-2xl font-bold mb-2">Welcome to Acme Project Tracker</h3>
  <p class="text-indigo-200">Your hub for issues, roadmaps, and team collaboration.</p>
</div>
```

The banner uses a single container div (no extra wrapper) so users can click it cleanly. The `p-12` padding, `bg-indigo-600` color, `rounded-2xl` radius, `shadow-xl` shadow, and `ring-4 ring-indigo-300` ring give five obvious properties to play with.

**Auto-detection:** `PATCH_STAGED` message received for a `class-change` kind patch.

---

## Section 12: Report a Bug

### Title
**Report a Bug**

### Instructions
> Found something broken? VyBit's Bug Report mode captures element context, console errors, network failures, and a visual timeline so the AI agent knows exactly what to fix.
>
> 1. First, click **"Refresh Invoice"** below — it will trigger a failed API call and a console error
> 2. In the panel header, switch to **Bug Report** mode
> 3. The timeline will show the errors that just happened — you'll see network and console error badges
> 4. Click the element below that looks "wrong"
> 5. Describe the bug — e.g., *"This price should not be negative and the refresh button is broken"*
> 6. Submit the bug report

### Playground
The billing section of the project tracker with an obviously broken line item:

```
┌──────────────────────────────────────────┐
│  Billing — Invoice #1042                 │
│                                          │
│  Pro Plan (monthly)        $49.00        │
│  Extra seats (3)           $30.00        │
│  Overage charges      ▸  $-14,000.00 ◂  │
│                                          │
│  Total                   -$13,921.00     │
└──────────────────────────────────────────┘
```

Rendered as:
```html
<div class="bg-white rounded-lg shadow p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Billing — Invoice #1042</h3>
  <div class="flex flex-col gap-2 text-sm">
    <div class="flex justify-between">
      <span class="text-gray-600">Pro Plan (monthly)</span>
      <span class="text-gray-900 font-medium">$49.00</span>
    </div>
    <div class="flex justify-between">
      <span class="text-gray-600">Extra seats (3)</span>
      <span class="text-gray-900 font-medium">$30.00</span>
    </div>
    <div class="flex justify-between">
      <span class="text-red-600 font-semibold">Overage charges</span>
      <span class="text-red-600 font-bold">$-14,000.00</span>
    </div>
    <hr class="my-2 border-gray-200" />
    <div class="flex justify-between">
      <span class="text-gray-900 font-semibold">Total</span>
      <span class="text-red-600 font-bold text-base">-$13,921.00</span>
    </div>
  </div>
  <button class="mt-4 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700">
    Refresh Invoice
  </button>
</div>
```

The absurd negative overage charge is the obvious visual "bug". The **Refresh Invoice** button fires a `console.error` and a failed `fetch` to `/api/billing/invoice/1042/refresh`, populating the Bug Report timeline with console-error and network-error badges so the user can see how VyBit captures runtime context.

**Auto-detection:** `BUG_REPORT_STAGE` message received.

---

## Section: Tutorial Complete

### Title
**You did it!**

### Instructions
> You've explored every major VyBit feature:
>
> ✓ Selecting elements and sending change messages
> ✓ Voice messages
> ✓ Inline text editing
> ✓ Describing new content to insert
> ✓ Sketching layouts
> ✓ Placing design system components
> ✓ Composing nested components
> ✓ Fine-tuning Tailwind styles
> ✓ Reporting bugs
>
> In a real project, every committed change triggers the MCP `implement_next_change` tool. Your AI agent (Copilot, Cursor, Claude, etc.) receives the change description, context, and instructions — then writes the code.
>
> **Ready to try it for real?**
> → [Install VyBit](https://github.com/bitovi/vybit) and connect it to your project

### Playground
*No interactive playground.* A celebratory completion state with a link to the GitHub repo and a **"↺ Start Over"** button to reset the tutorial.
