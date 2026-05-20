# 060 — Shared Architecture Across Exploration Tiers

## The Question

Three exploration tiers are proposed — HTML mockups, Storybook variants, and feature-flag variants. Each has different fidelity, speed, and prerequisites. But much of what the user interacts with is the same: they trigger exploration, see options, compare them, tweak parameters, pick a winner, and feed it back to the agent. What infrastructure is shared?

## The Three Tiers, Revisited

| Tier | Rendering | Output Location | How the User Sees It | What "Implement" Means |
|------|-----------|----------------|---------------------|----------------------|
| **Quick** (HTML) | Static HTML in iframe | `.vybit/prototypes/<id>/` | Carousel of iframes loading HTML files | Agent reverse-engineers HTML → source code |
| **Storybook** | Real component in Storybook iframe | `.vybit/prototypes/<id>/` (stories) | Carousel of iframes loading story URLs | Agent moves/adapts variant file into source tree |
| **Feature Flags** | Live component in the running app | Source tree (real components) | Flag toggle switches the live page | Agent removes flag code, keeps winner |

Despite these differences, the tiers share five layers of infrastructure:

1. **Exploration session** — a server-side object that tracks the lifecycle from "user asked for options" through "user picked a winner"
2. **Option manifest** — a uniform schema describing what options exist, regardless of how they render
3. **Option viewer / chooser** — a panel UI that presents options, lets the user navigate/compare, and captures the selection
4. **Refinement loop** — the user's ability to tweak a specific option or redirect all options before committing
5. **Selection → agent handoff** — converting the user's choice into the next MCP instruction

Let's walk through each.

---

## 1. Exploration Session

Every exploration — regardless of tier — follows the same lifecycle:

```
requested → generating → comparing → (refining →)* selected → implementing → done
```

The server needs an `ExploreSession` object to track this. It's separate from the commit/patch queue (which tracks implementation work), but it *creates* commits at both ends — one to trigger prototype generation, one to trigger implementation of the winner.

```typescript
interface ExploreSession {
  id: string;
  tier: 'quick' | 'storybook' | 'flags';
  status: ExploreStatus;

  // What the user asked for
  request: string;               // "make this hero more modern"
  elementKey?: string;            // selected element (if any)
  componentName?: string;         // resolved component name
  image?: string;                 // canvas screenshot (if from draw)

  // What the agent produced
  options: ExploreOption[];       // populated after agent reports back
  manifestPath?: string;          // .vybit/prototypes/<id>/manifest.json

  // What the user chose
  selectedOptionId?: string | null;
  refinements?: ExploreRefinement[];  // refinement history

  // Commits that anchor this session in the queue
  sourceCommitId: string;         // the commit that triggered generation
  implementCommitId?: string;     // the commit created after selection
}

type ExploreStatus =
  | 'requested'      // user clicked Explore, commit queued
  | 'generating'     // agent picked it up, working
  | 'comparing'      // options ready, user is viewing
  | 'refining'       // user asked for refinement, agent working
  | 'selected'       // user picked a winner
  | 'implementing'   // agent is applying the winner
  | 'done'           // winner implemented
  | 'discarded';     // user canceled

interface ExploreRefinement {
  targetOptionId?: string;  // null = redirect all
  feedback: string;
  timestamp: number;
}
```

This object is the backbone. The panel needs it to know what to render. The server needs it to generate the right MCP instructions. The MCP tools need it to route `mark_change_implemented` results correctly.

### Where it lives

`server/explore.ts` (new file) — manages `ExploreSession[]` in memory. Emits events that the WebSocket layer relays to the panel. Persists manifests to `.vybit/prototypes/` for durability.

### Relationship to the queue

The explore session doesn't replace commits/patches — it wraps them. When the user clicks Explore:

1. A `message` patch is created and committed (like today's "Commit" button)
2. The commit gets a new flag: `explore: { tier, count }` 
3. When the agent picks up this commit via `implement_next_change`, the MCP format layer checks for the `explore` flag and generates prototype instructions instead of implementation instructions
4. The session transitions through its lifecycle alongside (but separate from) the commit status

This means the existing queue, commit, and MCP tool infrastructure doesn't change structurally — the explore session is a parallel tracking structure that influences how commits are *formatted* for the agent.

---

## 2. Option Manifest

All three tiers produce a set of options for the user to compare. The manifest schema should be uniform, with tier-specific fields nested under a discriminated union.

```typescript
interface ExploreOption {
  id: string;
  name: string;
  description: string;

  // How to render this option in the panel chooser
  viewer: OptionViewer;

  // Tier-specific metadata for implementing the winner
  source: OptionSource;
}

// --- Viewer: how the panel displays this option ---

type OptionViewer =
  | { type: 'iframe'; url: string }           // HTML mockup or Storybook story
  | { type: 'live'; flagKey: string; flagValue: string };  // feature flag toggle

// For Quick tier:   { type: 'iframe', url: '/api/prototypes/<id>/modern.html' }
// For Storybook:    { type: 'iframe', url: '/storybook/iframe.html?id=...&viewMode=story' }
// For Feature Flags: { type: 'live', flagKey: 'hero-variant', flagValue: 'modern' }
```

The key insight: **Quick and Storybook both resolve to "show an iframe."** The only difference is the URL. This means the panel's option viewer component can handle both with the same rendering code. Feature Flags are different — they switch the live page — but the chooser UI (list of options, selection, refinement input) is still the same.

```typescript
// --- Source: how to implement the winner ---

type OptionSource =
  | { type: 'html'; filePath: string }                      // reverse-engineer into source
  | { type: 'component'; filePath: string; storyId: string } // adapt into source tree
  | { type: 'flag'; flagKey: string; flagValue: string };     // remove flag, keep winner
```

The `source` field drives what the MCP instructions say when the user selects this option. The server reads it and generates the appropriate "implement selected prototype" message.

### Manifest file

Written to `.vybit/prototypes/<sessionId>/manifest.json`:

```json
{
  "sessionId": "abc123",
  "tier": "storybook",
  "request": "Make this hero section more modern",
  "elementKey": "...",
  "componentName": "HeroSection",
  "options": [
    {
      "id": "modern-minimal",
      "name": "Modern Minimal",
      "description": "Clean lines, generous whitespace",
      "viewer": { "type": "iframe", "url": "/storybook/iframe.html?id=..." },
      "source": { "type": "component", "filePath": ".vybit/prototypes/abc123/HeroModern.tsx", "storyId": "..." }
    }
  ]
}
```

Feature flag tiers don't write to `.vybit/prototypes/` — their variants live in the source tree. But the manifest schema is the same; only the `viewer` and `source` fields differ.

---

## 3. Option Viewer / Chooser (Panel)

The panel needs a single `ExploreViewer` component that works across all tiers. The difference between tiers is only *what's inside the preview area* — the chrome around it (navigation, refinement input, action buttons) is identical.

### Shared shell

```
┌──────────────────────────────────────────┐
│  ◀  Option 2 of 3  ▶     "Bold Gradient" │
│  ┌──────────────────────────────────────┐ │
│  │                                      │ │
│  │         [preview area]               │ │  ← iframe (Quick/Storybook)
│  │                                      │ │     or "viewing live" indicator (Flags)
│  │                                      │ │
│  └──────────────────────────────────────┘ │
│  Vibrant colors with a bold gradient...   │
│  ┌──────────────────────────────────────┐ │
│  │ Refine: make it darker, more space   │ │  ← refinement input (shared)
│  └──────────────────────────────────────┘ │
│  [Refine This] [Implement] [Discard]  [▾] │
└──────────────────────────────────────────┘
```

### Preview area by tier

| Tier | Preview area content |
|------|---------------------|
| Quick | `<iframe src="/api/prototypes/{id}/{file}.html" sandbox="allow-scripts" />` |
| Storybook | `<iframe src="/storybook/iframe.html?id={storyId}&viewMode=story" />` |
| Feature Flags | Status indicator: "Viewing live — 'Bold Gradient' is active on the page" + the user's app is already showing the variant |

For iframe tiers (Quick + Storybook), the preview area is literally the same `<iframe>` element with a different `src`. This is one component:

```typescript
function OptionPreview({ viewer }: { viewer: OptionViewer }) {
  if (viewer.type === 'iframe') {
    return <iframe src={viewer.url} className="w-full h-full border-0" />;
  }
  if (viewer.type === 'live') {
    return <LivePreviewIndicator flagKey={viewer.flagKey} value={viewer.flagValue} />;
  }
}
```

For feature flags, when the user navigates between options in the chooser, the panel calls `window.vybit.setFlag(...)` (relayed via WebSocket to the overlay) to switch the live app. The preview area just confirms what's active.

### Navigation and selection

The carousel navigation (prev/next, option counter, option name) is tier-independent. The user always sees "Option 2 of 3" regardless of whether the options are HTML files, Storybook stories, or feature flag values.

### Action buttons

The footer buttons are shared, but their behavior varies slightly:

| Button | Quick | Storybook | Feature Flags |
|--------|-------|-----------|---------------|
| **Implement** | Agent reverse-engineers HTML into source code | Agent adapts component file into source tree | Agent removes flag evaluation, keeps winner |
| **Refine This** | Agent regenerates this specific option | Agent regenerates this story variant | Agent rebuilds this variant component |
| **Refine All** | Agent regenerates all options | Agent regenerates all stories | Agent rebuilds all variants |
| **Discard** | Delete `.vybit/prototypes/<id>/`, return to normal | Same cleanup | Agent removes all variant code + flag |

The button *labels* are the same. The server generates different MCP instructions based on the session's `tier`.

### Component structure (modlet)

```
panel/src/components/ExploreViewer/
  index.ts
  ExploreViewer.tsx         ← main component (carousel shell)
  ExploreViewer.test.tsx
  OptionPreview.tsx          ← iframe or live indicator
  ExploreActions.tsx         ← Implement / Refine / Discard buttons
  RefinementInput.tsx        ← text input for refinement feedback
  types.ts                   ← ExploreOption, ExploreSession (client-side)
```

This is one component that handles all three tiers. No `HtmlViewer`, `StorybookViewer`, `FlagViewer` split — the tier differences are isolated to `OptionPreview` and to the server-side MCP instructions.

---

## 4. Refinement Loop

Refinement is the user saying "I like this direction but change X" (refine one) or "none of these, try Y instead" (redirect all). This is shared across all tiers.

### How refinement works

1. User types feedback in the `RefinementInput`
2. Panel sends `EXPLORE_REFINE` message to server:
   ```typescript
   { type: 'EXPLORE_REFINE', sessionId, targetOptionId?: string, feedback: string }
   ```
3. Server appends to `session.refinements[]` and creates a new commit with instructions:
   - If `targetOptionId` is set: "Regenerate this specific option with the following feedback: ..."
   - If null: "Regenerate all options with the following feedback: ..."
4. Session status → `'refining'` → agent picks up → generates new options → `'comparing'` again
5. Panel updates with new/replaced options

### What the agent receives

The refinement commit's MCP instructions include:
- The original request
- The full refinement history (so the agent has context on previous attempts)
- The current manifest (so the agent knows what exists)
- Whether to replace one option or all

This is the same `buildContentParts()` pipeline — the explore session just produces different instruction text based on its state.

### Tier-specific refinement nuances

- **Quick**: Agent regenerates HTML files. Old files are deleted, new ones written.
- **Storybook**: Agent regenerates component + story files. Storybook HMR picks up changes.
- **Feature Flags**: Agent modifies variant component code in the source tree. The app hot-reloads.

The panel doesn't care which — it shows "Refining..." and waits for the updated `EXPLORE_OPTIONS` message.

---

## 5. Selection → Agent Handoff

When the user picks a winner, the panel sends `EXPLORE_SELECTED` and the server translates that into a new committed change for the agent. This translation is tier-specific, but the *triggering mechanism* is shared.

### Shared flow

```
Panel: EXPLORE_SELECTED { sessionId, selectedOptionId }
  → Server: session.selectedOptionId = selectedOptionId
  → Server: session.status = 'selected'
  → Server: creates new Commit based on session.tier + selected option's source
  → Server: broadcasts QUEUE_UPDATE
  → Agent: implement_next_change picks up the new commit
  → Agent: receives tier-specific "implement the winner" instructions
```

### Tier-specific commit creation

| Tier | What the server creates |
|------|------------------------|
| Quick | Commit with `message` patch: "Implement the selected HTML mockup design. Source: `.vybit/prototypes/<id>/<file>.html`. Target: `<componentFile>`" |
| Storybook | Commit with `message` patch: "Adapt the selected Storybook variant. Source: `.vybit/prototypes/<id>/<file>.tsx`. Target: `<componentFile>`" |
| Feature Flags | Commit with `message` patch: "Commit to flag value `<value>` for `<flagKey>`. Remove flag evaluation code, keep the `<value>` variant, delete others." |

In all cases, it's a `message` patch — the free-form text carries the implementation instructions. The MCP format layer wraps it with the appropriate context (element HTML, component file path, etc.).

---

## 6. Connection to Existing Infrastructure

### What already exists and needs minimal change

| Existing | How it's reused |
|----------|----------------|
| **`message` patch kind** | Explore requests and selections are both `message` patches — the agent already handles free-text instructions |
| **Commit queue** | Explore triggers and selections flow through the normal commit pipeline |
| **`implement_next_change` / `mark_change_implemented`** | No new MCP tools — the explore flag on the commit changes what instructions are generated |
| **`buildContentParts()` in mcp-format.ts** | Extended to check for `explore` flag and produce prototype-generation or winner-implementation instructions |
| **Storybook proxy** | Storybook iframe URLs for the option viewer are already serveable via the existing `/storybook/*` proxy |
| **`loadStoryArgTypes()`** | For Storybook tier, arg controls can be embedded — this function already extracts argTypes |
| **`ArgsForm` component** | Arg editing UI already built — can be reused for Storybook tier options that expose args |
| **WebSocket message routing** | New message types (`EXPLORE_OPTIONS`, `EXPLORE_SELECTED`, `EXPLORE_REFINE`) follow the same `{ type, to }` routing |
| **`.vybit/` directory** | HTML and Storybook tiers both write to `.vybit/prototypes/` — one storage location |

### What's new

| New piece | Scope |
|-----------|-------|
| `server/explore.ts` | Session lifecycle, manifest I/O, option-to-commit translation |
| `ExploreViewer` panel component | Carousel + preview + actions + refinement |
| `OptionPreview` panel component | Iframe or live-flag indicator |
| Explore flag on `Commit` type | `commit.explore?: { tier, count }` — triggers prototype MCP instructions |
| `EXPLORE_OPTIONS` WS message | Server → panel: here are the options |
| `EXPLORE_SELECTED` WS message | Panel → server: user picked this one |
| `EXPLORE_REFINE` WS message | Panel → server: user wants to refine |
| `EXPLORE_STATUS` WS message | Server → panel: session status changed |
| Explore button in overlay drawer | UI trigger alongside Queue/Commit |
| `/api/prototypes/` static route | Serves HTML mockup files from `.vybit/prototypes/` |

---

## 7. Storybook Args as In-Tier Tweaking

The Storybook tier has a unique advantage: variants rendered as stories can expose `argTypes`, giving the user Storybook's built-in controls for free. This overlaps with VyBit's existing arg editing infrastructure.

### What already works

VyBit's `ArgsForm` component renders controls for Storybook `argTypes` — selects, text inputs, booleans, etc. This is used today in `ComponentGroupItem` for editing component props before placement. The same component can render inside the `ExploreViewer` when viewing a Storybook option.

### How it could work in the explore viewer

When the user views a Storybook option in the carousel, the panel could show a "Tweak Props" expander below the iframe. This uses the same `ArgsForm` with the story's `argTypes`. When the user changes an arg, the iframe URL updates with the new arg values (Storybook supports `args` in the URL: `&args=propName:value`).

This is *not* a feature flag — it's not toggling between variants. It's tweaking a single variant's props before deciding to implement it. The user might say "I like Modern Minimal, but with `showSubtitle: true` and `layout: 'centered'`" and see it live before committing.

### Shared vs tier-specific

| Capability | Shared? |
|-----------|---------|
| Args form UI (`ArgsForm`) | Yes — already exists |
| ArgTypes extraction (`loadStoryArgTypes()`) | Yes — already exists |
| Iframe URL arg encoding | Storybook-specific (Storybook URL scheme) |
| Including tweaked args in the "implement" instruction | Yes — the selected option's args are added to the `message` patch text |

This means no new arg infrastructure is needed — the explore viewer just composes existing components differently.

---

## 8. Feature Flags as Post-Exploration Persistence

Feature flags serve a dual role: they're an exploration tier (high-fidelity live variants) *and* a persistence mechanism (keeping variants alive for production A/B testing after exploration ends).

### During exploration

Feature flags behave like any other tier: the user sees options, toggles between them, and picks a winner. The `ExploreViewer` renders the same carousel chrome — the only difference is the `OptionPreview` shows a "viewing live" indicator instead of an iframe, and navigating between options calls `window.vybit.setFlag()` instead of changing an iframe `src`.

### After exploration: "Keep as Flag"

When the user selects a winner, they get an extra option unique to the feature flag tier: **Keep as Flag**. This skips the "implement and clean up" step — the flag-gated code stays in the source tree, and the team can swap VyBit's provider for a real one (LaunchDarkly, Flagsmith) to ship it as an A/B test.

This is the only tier that supports a non-destructive "implement" path. For Quick and Storybook, implementing always means integrating the design into the real code and cleaning up prototype files.

### Panel UI for persistent flags

After a flag is kept, it moves from the `ExploreViewer` to a dedicated **Flags** section in the panel. This section shows all active flags with their current values and lets the user toggle them. It's separate from the explore viewer because the exploration is over — the flags are just live configuration now.

```
┌──────────────────────────────────────┐
│ Active Flags                         │
│                                      │
│ hero-variant                         │
│ ● Modern  ○ Bold  ○ Playful         │
│                                      │
│ grid-columns              [◀ 3 ▶]   │
│                                      │
│ [Commit All]         [Remove All]    │
└──────────────────────────────────────┘
```

This panel is *not* part of the shared explore viewer — it's a post-exploration feature unique to the flag tier.

---

## 9. Explore Button & Tier Detection

### Explore button

The `[Explore ▾]` split button appears in two places (overlay drawer, canvas footer). The button itself is shared — its dropdown content adapts based on what's available:

```typescript
interface ExploreTierAvailability {
  quick: { available: true };
  storybook: { available: boolean; reason?: string; setupAction?: () => void };
  flags: { available: boolean; reason?: string; setupAction?: () => void };
}
```

The panel queries the server for tier availability on connect (part of an `EXPLORE_CAPABILITIES` message or bundled with the initial `QUEUE_UPDATE`). Quick is always available. Storybook is available when `detectStorybookUrl()` succeeds. Flags are available when the server detects the VyBit provider is configured (TBD detection mechanism).

### Default tier

Clicking the button (not the ▾) runs the default tier:
- First use: Quick
- After using Storybook or Flags in this session: last-used tier becomes default
- Stored per-session in the `ExploreSession` or as panel-local state

---

## 10. Summary: What to Build First

The shared infrastructure has a clear layering that suggests an implementation order:

### Phase 1: Core loop (shared)
1. `ExploreSession` type + `server/explore.ts` lifecycle management
2. `ExploreOption` manifest schema
3. `EXPLORE_OPTIONS` / `EXPLORE_SELECTED` / `EXPLORE_STATUS` WebSocket messages
4. `explore` flag on `Commit` + `buildContentParts()` branching
5. `ExploreViewer` panel component (carousel shell + `OptionPreview` iframe renderer)
6. `/api/prototypes/` static file route
7. Explore button in overlay drawer + canvas footer

### Phase 2: Quick tier (first tier that uses the shared infra)
8. MCP prototype-generation instructions for HTML mockups
9. `mark_change_implemented` handling for `prototypes` field
10. Manifest reading + `EXPLORE_OPTIONS` broadcast
11. "Implement selected" commit creation for HTML tier

### Phase 3: Storybook tier (layers on shared infra)
12. Storybook config detection (`isStorybookConfiguredForPrototypes()`)
13. Story readiness polling (`waitForStories()`)
14. MCP instructions for Storybook prototypes
15. Error detection + recovery loop
16. Args tweaking in the explore viewer (reuses `ArgsForm`)

### Phase 4: Refinement loop (shared)
17. `RefinementInput` component
18. `EXPLORE_REFINE` message handling
19. Refinement-aware MCP instructions

### Phase 5: Feature flag tier
20. `window.vybit` flag bridge in overlay
21. `VyBitFlagProvider` scaffolding instructions
22. `LivePreviewIndicator` component
23. Flag persistence ("Keep as Flag") UI
24. Mock services support

Each phase builds on the shared infrastructure from Phase 1. The tiers are additive — no tier requires reworking a previous tier's code.

---

## Open Questions

1. **Session vs commit identity.** Should the explore session ID be the same as the commit ID that triggered it? Simpler (one ID), but commits are immutable and sessions have mutable state. Leaning toward separate IDs with a `sourceCommitId` reference.

2. **Refinement: replace or append?** When the user refines one option, should the agent replace that option in the manifest (same slot in the carousel) or add a new option alongside it? Replacing is simpler but loses the original. Appending grows the carousel unboundedly.

3. **Storybook args in the implement instruction.** When the user tweaks args on a Storybook option before implementing, those args need to be captured and included in the "implement the winner" instructions. Should they be stored on the `ExploreOption` or on the `ExploreSession`?

4. **Feature flag detection.** How does the server know that `VyBitFlagProvider` is configured? Options: the overlay checks for `window.vybit.flags` and reports to the server; the server looks for the provider file on disk; the user manually marks it as set up.

5. **Carousel vs page takeover for feature flags.** The carousel makes sense for iframe tiers because each option needs its own rendering context. But feature flags switch the live app — the user is already seeing the variant in the page. Does the carousel still make sense, or should the panel just show radio buttons with "Viewing live" text?

6. **Cross-tier escalation.** Can a user start with Quick, pick a winner, and then say "now build this as a real component with a feature flag" instead of implementing it directly? This would chain tiers. The session would need a `previousTier` + `previousSelection` to carry context forward.
