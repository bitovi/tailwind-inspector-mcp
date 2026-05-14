# 060 — Agent Prototyping & Option Selection

## Problem

Today the VyBit agent loop is single-track: the user queues a change, the agent implements it, and moves on. There's no mechanism for the agent to **propose multiple options** and let the user pick the best one before committing to implementation.

This is a significant gap. Many design tasks are exploratory — "make this hero section more modern", "try a different layout for the sidebar", "suggest some color schemes." The right answer isn't known upfront; the user wants to see options and choose.

Superpowers (obra/superpowers) solves this with a `brainstorming` skill that proposes 2-3 approaches, a `visual-companion` that renders HTML mockups in-browser for the user to click-select, and `subagent-driven-development` that can dispatch parallel agents to build variants. VyBit can adopt a similar approach: the agent generates complete HTML mockup files, writes them to `.vybit/prototypes/`, and the panel presents them for the user to compare and choose.

## Goals

1. **Agent can propose options.** The MCP response can instruct the agent to generate 2+ prototype variants and present them for user selection.
2. **User sees options visually.** Prototypes are presented in a way that makes comparison easy — either in the panel, in the page, or both.
3. **User picks a winner.** The selected prototype feeds back into the agent loop as the next thing to implement.
4. **Local storage.** VyBit gets a `.vybit/` directory for persisting prototypes, session state, and future extensibility.
5. **No new MCP tools.** The existing `implement_next_change` loop is preserved, but the response vocabulary is expanded so the agent can receive different _kinds_ of instructions (not just "implement this class change").

## Non-Goals (for now)

- Parallel subagent execution (one agent generating options sequentially is fine for v1)
- Version control / undo of prototype selections
- Prototype persistence across server restarts (in-memory is fine for v1; `.vybit/` is the future home)

---

## Key Design Decisions

### 1. `.vybit/` local storage directory

VyBit needs a project-local storage directory for prototypes and (eventually) session data, preferences, and cached state.

```
<project-root>/
  .vybit/
    prototypes/          ← prototype HTML/artifacts
    sessions/            ← future: session logs
    config.json          ← future: project-level VyBit config
```

**Location resolution** (same precedence as project root):
1. `--vybit-dir` CLI flag
2. `VYBIT_DIR` env var
3. `<cwd>/.vybit/`

The server creates `.vybit/` on first use (lazy). It should be added to `.gitignore` by default.

**Open question:** Should VyBit auto-append `.vybit/` to the project's `.gitignore`, or just warn?

### 2. Expanding the MCP response vocabulary (no new tools)

Currently `implement_next_change` returns commits with instructions that always say "implement these class changes." The agent is trained to loop: implement → mark done → call again.

Rather than adding new MCP tools, we expand the commit/instruction vocabulary so the agent receives **different action types**:

| Action | Today | New |
|--------|-------|-----|
| `implement` | Apply class changes to source files | unchanged |
| `prototype` | — | Generate N variants, write to `.vybit/prototypes/`, report back |
| `choose` | — | Present options to user, wait for selection |

This means the MCP tool name could evolve. Options:

**Option A: Keep `implement_next_change`, expand instruction text.**
The agent already follows free-text instructions. We just change what the instructions say. Least disruption but the tool name becomes misleading.

**Option B: Rename to `get_next_instruction` (or `follow_next_instruction`).**
Clearer semantics — the tool returns an instruction that might be "implement", "prototype", or "choose." Breaking change for existing agent configs.

**Option C: Add alias, deprecate old name.**
Register both `implement_next_change` and `follow_next_instruction`. Old name still works. Migrate docs to new name.

**Recommendation:** Option C. The alias approach avoids breaking existing setups while signaling the broader capability.

### 3. Where prototypes are shown — page vs panel vs both

This is the biggest UX question. There are several possible approaches:

### 3. How the user triggers prototyping

The user needs a way to say "show me options" instead of "just do it." This trigger needs to exist in two places where users currently describe work: the **element drawer** (message input) and the **draw canvas**.

#### Current button layout

**Element drawer** (overlay, below selected element):
- State A: `[Describe change]` `[Edit text]`
- State B (after clicking Describe change): textarea + `[← back]` `[🎤]` `[Queue]` `[Commit]`

**Draw canvas** (panel, design tab footer):
- `[✕ Close]` ... `[✓ Queue as Change]`

#### Button name candidates

| Name | Pros | Cons |
|------|------|------|
| **Prototype** | Clear, distinct from Queue/Commit | Technical-sounding |
| **Show Options** | User-friendly, describes the outcome | Vague |
| **Explore** | Implies creative exploration | Abstract |
| **Try Ideas** | Friendly, action-oriented | Unusual as button label |
| **Suggest** | Familiar from AI tools | Passive |
| **Draft Options** | Conveys "not final" + "multiple" | Wordy |

**Recommendation: "Explore"** — short, action-oriented, distinct from Queue/Commit. Pairs naturally with "select" as the follow-up. Alternative: **"Show Options"** for maximum clarity.

#### Where the button goes

**Element drawer — State B (describe change textarea)**

Add "Explore" as a third button alongside Queue and Commit. All three share the same textarea input — the text becomes the prototyping request.

```
┌─────────────────────────────────────┐
│ describe change                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ ←   🎤  [Explore] [Queue] [Commit] │
└─────────────────────────────────────┘
```

- **Queue** = stage for later commit (existing)
- **Commit** = stage + immediately commit for agent (existing)
- **Explore** = commit as a prototype request → agent generates HTML mockup options

"Explore" uses a distinct color (purple/violet? or bit-orange?) to differentiate from the teal Queue/Commit buttons.

**Draw canvas — CanvasFooter**

Add "Explore" alongside the existing "Queue as Change":

```
┌─────────────────────────────────────────────────┐
│ ✕ Close          [Explore Ideas] [Queue Change] │
└─────────────────────────────────────────────────┘
```

For the canvas, "Explore Ideas" submits the canvas snapshot as a prototype request — the agent uses the drawing/screenshot as a visual reference to generate HTML mockup options.

#### What "Explore" does technically

1. Creates a message patch (same as Queue/Commit) but with a new flag: `prototype: true`
2. Auto-commits it (like Commit — no staging, the user wants to see results now)
3. The server recognizes the `prototype` flag and adjusts the MCP response when the agent picks it up
4. Panel shows a "Generating options..." state while waiting

### 4. Where prototypes are shown — the Prototype Picker

Several approaches for displaying the HTML mockup options:

#### Picker Idea A: Panel thumbnail cards with full-screen expand

The panel renders a `PrototypePicker` component showing thumbnail previews. Clicking a thumbnail opens it in a larger view.

```
┌──────────────────────────────────┐
│ Panel                            │
│ ┌──────────┐ ┌──────────┐       │
│ │ Option A  │ │ Option B  │      │
│ │ [thumb]   │ │ [thumb]   │      │
│ │           │ │           │      │
│ └──────────┘ └──────────┘       │
│ ┌──────────┐                     │
│ │ Option C  │  ← click to       │
│ │ [thumb]   │    expand          │
│ └──────────┘                     │
│         [Select A] [Select B]    │
└──────────────────────────────────┘
```

**Pros:** Works within existing panel architecture. Compact overview.
**Cons:** Thumbnails are small. Expanding one at a time makes comparison harder.

#### Picker Idea B: Side-by-side iframe viewer

A dedicated view that renders full HTML mockups side-by-side via iframes.

```
┌─────────────────────────────────────────────────┐
│ Prototype Viewer                                │
│ ┌─────────────────────┐ ┌─────────────────────┐│
│ │                      │ │                      ││
│ │   Mockup A (iframe)  │ │   Mockup B (iframe)  ││
│ │                      │ │                      ││
│ └─────────────────────┘ └─────────────────────┘│
│                                                  │
│        [Select A]  [Select B]  [Select C]        │
└─────────────────────────────────────────────────┘
```

**Pros:** Full-fidelity side-by-side comparison.
**Cons:** Requires a new view/route. Iframe complexity.

#### Picker Idea C: Carousel viewer with prev/next

Single-mockup-at-a-time with navigation arrows.

```
┌─────────────────────────────────────────────┐
│ Prototype Viewer                            │
│   ┌─────────────────────────────────────┐   │
│   │                                     │   │
│   │   Mockup B (iframe, full-width)     │   │
│   │                                     │   │
│   └─────────────────────────────────────┘   │
│  ◀  Option 2 of 3  ▶    [Select This]    │
└─────────────────────────────────────────────┘
```

**Pros:** Simple to build. Each mockup gets full viewport.
**Cons:** Can't compare side-by-side without switching.

#### Picker Idea D: Page-takeover with option tabs

Replaces the user's app page entirely, with a tab bar to switch between options.

```
┌──────────────────────────────────────────────────────┐
│ [A: Modern Minimal] [B: Bold Gradient] [C: Playful]  │
│ ═══════════════════                                   │
│   ┌─────────────────────────────────────────────┐     │
│   │                                             │     │
│   │         Full mockup rendered here            │     │
│   │         (full page width & height)           │     │
│   │                                             │     │
│   └─────────────────────────────────────────────┘     │
│  [None of these]               [✓ Select "A"]        │
└──────────────────────────────────────────────────────┘
```

**Pros:** Most realistic — full-page mockups at actual viewport size. Tab switching is fast.
**Cons:** Disrupts the current app view. Needs "return to app" flow.

#### Picker Idea E: Panel split — list left, preview right

Narrow option list on the left, larger iframe preview on the right.

```
┌──────────────────────────────────────────────┐
│ ┌────────┐ ┌──────────────────────────────┐  │
│ │ A ●    │ │                              │  │
│ │ Modern │ │   Full mockup preview        │  │
│ ├────────┤ │   (iframe)                   │  │
│ │ B      │ │                              │  │
│ │ Bold   │ │                              │  │
│ ├────────┤ └──────────────────────────────┘  │
│ │ C      │                                   │
│ │ Play.. │ [None of these] [✓ Select "A"]   │
│ └────────┘                                   │
└──────────────────────────────────────────────┘
```

**Pros:** All options visible while viewing one in detail.
**Cons:** Panel needs to be wide enough. May not work in sidebar mode.

#### Picker Idea F: Overlay lightbox

Full-screen overlay (like an image lightbox) that dims the user's app and shows mockups on top. Carousel inside the lightbox.

```
┌──────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░ ┌──────────────────────────────────────────┐ ░░░░ │
│ ░░ │  ◀  Option 2 of 3  ▶                    │ ░░░░ │
│ ░░ │                                          │ ░░░░ │
│ ░░ │   Full mockup (iframe or injected HTML)  │ ░░░░ │
│ ░░ │                                          │ ░░░░ │
│ ░░ ├──────────────────────────────────────────┤ ░░░░ │
│ ░░ │  "Bold Gradient" — Vibrant colors...     │ ░░░░ │
│ ░░ │  [None of these]     [✓ Select This]    │ ░░░░ │
│ ░░ └──────────────────────────────────────────┘ ░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────────────────────┘
```

**Pros:** Full attention on the mockup. Doesn't navigate away. Familiar pattern (lightbox).
**Cons:** Overlay-on-overlay can feel heavy. Must coexist with VyBit's existing shadow DOM overlay.

**Recommendation:** Start with **Picker Idea C (carousel)** as the simplest MVP. The carousel could render inside the panel (replacing current content while prototypes are pending) or as a lightbox overlay (Idea F). The server already serves static files — adding a route for `.vybit/prototypes/` HTML files is straightforward.

---

## Prototype Type: HTML Mockup

For v1, prototypes are **complete HTML files** generated by the agent. Each file is a self-contained page that the user can view in an iframe or full-screen.

The agent has full creative freedom: the mockup can be a whole page layout, a single component rendered in isolation, a design comp with inline styles, or anything else expressible as HTML. The mockup files live in `.vybit/prototypes/<commitId>/` alongside a `manifest.json` that describes the options.

Future prototype types (class-bundle overlays, component variant code, theme overrides) can be added later by extending the manifest schema.

---

## Data Flow

### Prototype lifecycle

```
1. User commits a "request" patch (kind: 'message' with a prototype hint)
   e.g. "Make this hero section more modern — show me 3 options"

2. Agent calls implement_next_change → receives commit with instructions:
   {
     action: "prototype",
     request: "Make hero section more modern",
     elementKey: "...",
     count: 3,
     instructions: "Generate 3 HTML mockup files showing different directions.
       Write each as a complete HTML file to .vybit/prototypes/<commitId>/.
       Create a manifest.json describing all options.
       When done, call mark_change_implemented with the prototype manifest path."
   }

3. Agent generates 3 HTML mockup files, writes to .vybit/prototypes/:
   .vybit/prototypes/<commitId>/
     manifest.json       ← { options: [...], request, elementKey }
     option-a.html        ← complete HTML mockup
     option-b.html
     option-c.html

4. Agent calls mark_change_implemented with:
   { commitId, results: [{ patchId, success: true }],
     prototypes: { sessionId, manifestPath } }

5. Server reads manifest, pushes PROTOTYPE_OPTIONS message to panel via WS

6. Panel renders PrototypePicker UI
   - User views mockups in a carousel/viewer (iframes loading HTML from server)
   - User clicks to select winner

7. Panel sends PROTOTYPE_SELECTED message to server
   - Server creates a new committed patch (or commit) from the selected option
   - Agent picks it up on next implement_next_change loop iteration
   - Instructions say: "implement" (normal flow)

8. Agent implements the selected option in source code
```

### WebSocket messages (new)

```typescript
// Server → Panel: present options to user
interface PrototypeOptionsMessage {
  type: 'PROTOTYPE_OPTIONS';
  to: 'panel';
  sessionId: string;
  request: string;            // original user request text
  elementKey: string;
  options: PrototypeOption[];
}

interface PrototypeOption {
  id: string;
  label: string;              // "Option A", "Modern Minimal", etc.
  description: string;
  htmlPath: string;            // relative to .vybit/prototypes/, e.g. "<commitId>/option-a.html"
  thumbnailDataUrl?: string;   // optional agent-generated screenshot for thumbnail cards
}

// Panel → Server: user selected an option
interface PrototypeSelectedMessage {
  type: 'PROTOTYPE_SELECTED';
  sessionId: string;
  selectedOptionId: string;
}
```

---

## MCP Response Format Changes

### Current `implement_next_change` response (simplified)

```
ACTION: IMPLEMENT THESE CHANGES
[class-change details...]
After implementing, call mark_change_implemented(...)
Then call implement_next_change again.
```

### New: prototype action response

```
ACTION: GENERATE PROTOTYPES

The user wants to see options before committing to a direction.

REQUEST: "Make this hero section more modern"
ELEMENT: <section class="bg-white p-8 text-center">...</section>
COMPONENT: HeroSection (src/components/HeroSection.tsx)
COUNT: 3
PROTOTYPE_DIR: .vybit/prototypes/<commitId>/

INSTRUCTIONS:
1. Create the directory .vybit/prototypes/<commitId>/
2. Generate 3 complete HTML mockup files, each showing a different design direction.
   - Each file should be a self-contained HTML page (inline CSS/JS is fine).
   - Name them descriptively: e.g. modern-minimal.html, bold-gradient.html, etc.
3. Create a manifest.json in the same directory with:
   {
     "request": "Make this hero section more modern",
     "options": [
       { "id": "<uuid>", "label": "Modern Minimal", "description": "Clean lines, lots of whitespace", "htmlPath": "modern-minimal.html" },
       ...
     ]
   }
4. Call mark_change_implemented with commitId and:
   { prototypes: { manifestPath: ".vybit/prototypes/<commitId>/manifest.json" } }
5. Then call implement_next_change again to continue the loop.
```

---

## Panel UX

### PrototypePicker component (new)

Lives in `panel/src/components/PrototypePicker/`. Modlet pattern.

**States:**
1. **Loading** — "Agent is generating options..." (shown while waiting for `PROTOTYPE_OPTIONS` message)
2. **Comparing** — Options displayed as cards. Hover to preview. Click to select.
3. **Selected** — Winner highlighted. "Implementing..." shown while agent applies.

**Interactions:**
- **Click** a thumbnail card → opens that mockup in a full-width iframe (carousel mode)
- **Carousel prev/next** → navigates between mockups
- **"Select This"** button → sends `PROTOTYPE_SELECTED` → card shows selected state
- **"None of these"** button → discards all options, agent can re-generate or the user can provide more guidance

**Where it renders:**
- Could be a new tab ("Prototypes") that appears only when options are pending
- Could be a modal/overlay on top of the current panel content
- Could replace the Picker content temporarily

**Open question:** Does the PrototypePicker replace the current panel content or overlay it? A tab is cleanest but adds UI complexity.

### Integration with existing tabs

When a `PROTOTYPE_OPTIONS` message arrives:
1. A "Prototypes" indicator appears (badge on a tab, or a toast/banner)
2. User navigates to view options
3. After selection, the indicator clears and normal flow resumes

---

## Server Changes

### `.vybit/` directory management

Add to `server/index.ts`:
- On startup, resolve `.vybit/` path (CLI flag > env var > `<cwd>/.vybit/`)
- Lazy-create on first write
- Expose path to MCP tools via deps

### Prototype manifest handling

Add to `server/queue.ts` (or new `server/prototypes.ts`):
- `loadManifest(sessionId)` — reads and validates `manifest.json`
- `selectOption(sessionId, optionId)` — converts selected option into committed patches
- Cleanup: delete prototype files after selection (or after configurable TTL)

### `mark_change_implemented` extension

Accept optional `prototypes` field in the results:
```typescript
{
  commitId: string;
  results: PatchResult[];
  prototypes?: {
    manifestPath: string;
  };
}
```

When `prototypes` is present, the server:
1. Reads the manifest
2. Broadcasts `PROTOTYPE_OPTIONS` to the panel
3. Waits for `PROTOTYPE_SELECTED` (or timeout)
4. Creates a new committed patch from the selected option
5. Emits `committed` event so the agent loop picks it up

---

## Open Questions

1. **MCP tool naming.** Should we rename `implement_next_change` to something more general now, or just expand what it can return? See Option A/B/C in Key Design Decisions §2.

2. **How many options?** Should the panel let the user request "more options" or "different direction"? This could be a message patch that goes back through the queue.

3. **Cost/speed.** Generating 3 full HTML mockups takes real agent time. Should we show options incrementally as they're generated (streaming prototype files), or wait until all are ready? Incremental display would require the agent to update the manifest after each file.

4. **Serving mockup files.** The server needs a new static-file route to serve HTML from `.vybit/prototypes/`. Security consideration: these files run in iframes — should they be sandboxed (`sandbox` attribute) to prevent scripts from affecting the parent panel?

5. **Explore button color.** What color differentiates "Explore" from Queue (teal border) and Commit (teal fill)? Candidates: bit-orange, a new purple/violet, or a gradient.

6. **Picker rendering context.** Does the PrototypePicker replace the current panel content, open as a modal, or appear as a new tab?

---

## Implementation Phases

### Phase 1: Foundation
- `.vybit/` directory management (server-side)
- `PrototypeOption` and `PrototypeManifest` types in `shared/types.ts`
- "Explore" button in element drawer (State B) and draw canvas footer
- `prototype: true` flag on message patches, server-side detection
- `PROTOTYPE_OPTIONS` and `PROTOTYPE_SELECTED` WebSocket messages
- Server reads manifest → broadcasts to panel → receives selection → creates committed patch

### Phase 2: Panel UI
- `PrototypePicker` component (modlet) — thumbnail cards + carousel viewer
- Iframe rendering of HTML mockups served from `.vybit/prototypes/`
- Selection flow → feeds back into agent loop

### Phase 3: MCP Integration
- Expand `implement_next_change` response to include prototype instructions
- Expand `mark_change_implemented` to accept prototype manifests
- Optional: add `follow_next_instruction` alias

### Phase 4: Polish & Extensions
- Agent screenshot integration for richer thumbnail previews
- "More options" / "Different direction" feedback loop
- Prototype history (browse past prototype sessions)
- Future prototype types: class-bundle overlays, component variants, theme overrides
