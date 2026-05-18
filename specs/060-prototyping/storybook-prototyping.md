# 060 — Storybook-Based Prototyping

## Problem

The main spec proposes generating static HTML mockup files for prototype comparison. These work universally but have a fundamental fidelity gap: they can't use the project's real framework, styling system, or design system components. An HTML mockup of a React component using Tailwind + Radix + custom theme tokens will always be an approximation.

VyBit already has deep Storybook integration — addon injection, proxy, overlay in stories, story discovery, argTypes extraction. Storybook's entire purpose is rendering real components in isolation. This makes it a natural vehicle for prototype variants.

## Core Idea

Instead of writing standalone HTML files to `.vybit/prototypes/`, the agent writes **real component variants as Storybook stories**. Each variant is a framework-correct component (React, Angular, etc.) with a corresponding story export. VyBit's panel presents these stories in a carousel/picker, loading each as a Storybook iframe at the story's URL. The user compares, picks a winner, and the agent implements it — with the advantage that the winning variant is already real component code.

## Where This Fits in the Tier Model

The use-cases doc defines two tiers. Storybook Explore slots in between as a middle tier:

| Tier | Name | Requires | Fidelity | Speed |
|------|------|----------|----------|-------|
| 0 | Quick Explore (HTML) | Nothing | Low — static mockups | Fast (~30s) |
| **1** | **Storybook Explore** | **Running Storybook** | **Medium — real components, isolated** | **Medium (~1min)** |
| 2 | Feature Flag Explore | OpenFeature setup | High — live in the app | Slower (~2min) |

The **Explore ▾** dropdown adapts based on what's available:

```
┌──────────────────────────────────────┐
│ Quick                                │
│ Generate HTML mockups to compare.    │
│ Fast, visual-only.                   │
├──────────────────────────────────────┤
│ In Storybook                         │
│ Real component variants rendered     │
│ in your framework + design system.   │
│                                      │
│ (grayed + [Set up] if not ready)     │
├──────────────────────────────────────┤
│ With Feature Flags                   │
│ Live variants in the running app.    │
│ Slower, fully live.                  │
│                                      │
│ (grayed + [Set up] if not ready)     │
└──────────────────────────────────────┘
```

When Storybook is detected (via `detectStorybookUrl()`), the "In Storybook" option is active. When not detected, it's grayed out with a hint: "Start Storybook to enable."

**Default behavior:** Clicking the Explore button (not the ▾) still runs Quick by default. But if the user has used Storybook Explore before in this session, it becomes the default.

---

## Strengths Over HTML Mockups

### Real framework rendering

Stories render in the user's actual framework (React, Angular) with their real build pipeline. CSS-in-JS, Tailwind v4 `@theme` tokens, CSS custom properties, font imports, and framework-specific features all work correctly. HTML mockups must fake all of this with inline styles.

### Design system fidelity

If the project uses a component library (Radix, Shadcn, Material, PrimeNG), the agent can compose prototype variants using those real components. The mockup looks exactly like the production app because it *is* the same rendering pipeline.

### Interactive prototypes

Stories support hover states, animations, click handlers, responsive viewports via Storybook's viewport addon, and args/controls for prop exploration. HTML mockups are static.

### Existing infrastructure

VyBit's Storybook addon already handles:
- Overlay injection into story iframes (via preview decorator)
- Server-side proxy for Storybook assets (`/storybook/*` route)
- Story discovery via `index.json` polling
- ArgTypes extraction from story files
- Story navigation via `postMessage` / URL scheme

The prototype viewer only needs to load Storybook iframes at specific story URLs — which the proxy already supports.

### Shorter implementation path

A winning prototype story is already a real component file. "Implement the winner" means the agent moves/renames the component into the real source tree — not reverse-engineering HTML into framework code. This also makes it a natural stepping stone to the Feature Flags tier (the story variant becomes the flag-gated component).

---

## Weaknesses & Mitigations

### Storybook must be running

**Risk:** Not every project has Storybook. Even projects that do may not be running it during a VyBit session.

**Mitigation:** This tier is opportunistic — available when Storybook is detected, hidden otherwise. Tier 0 (HTML mockups) remains the universal fallback. The panel could also show a "Start Storybook" action that triggers the agent to run `npx storybook dev`.

### Agent must write framework-correct code

**Risk:** HTML mockups have zero compilation requirements — any valid HTML renders. Story variants must be valid framework components that compile under the project's build config. Agent errors are more likely.

**Mitigation:** See [Error Detection & Recovery](#error-detection--recovery) below. VyBit can detect Storybook error screens in the story iframe and feed compile errors back to the agent automatically, creating a self-healing loop.

### HMR discovery latency

**Risk:** After the agent writes a story file, Storybook needs to process it via HMR and update `index.json`. Typical latency is 1–3 seconds but can be longer for large projects.

**Mitigation:** The panel shows "Generating options..." while waiting. The server polls `index.json` for the expected story IDs (derived from the manifest) with a short interval. This is bounded — if stories don't appear within 15 seconds, the panel shows an error with a "Retry" action.

### One-time Storybook config setup

**Risk:** Storybook needs to know where to find prototype story files. If they live in `.vybit/prototypes/`, the Storybook config must include that path in its `stories` glob.

**Mitigation:** A one-time "Set up Storybook Explore" action (similar to "Establish Feature Flags") tells the agent to add the config. See [Setup Flow](#setup-flow).

---

## Prototype File Location

Prototype stories live in `.vybit/prototypes/`, keeping them out of the project's real source tree:

```
.vybit/
  prototypes/
    <commitId>/
      manifest.json
      HeroModern.tsx          ← variant component
      HeroModern.stories.tsx  ← or combined story file
      HeroBold.tsx
      HeroPlayful.tsx
      Prototypes.stories.tsx  ← single story file exporting all variants
```

### Why `.vybit/prototypes/` and not the source tree

- Prototype files are temporary — they shouldn't appear in `git status` or IDE file trees
- `.vybit/` is gitignored by convention
- Cleanup is simple: delete the `<commitId>/` directory
- No risk of prototype components being accidentally imported by the real app

### Storybook config requirement

Storybook must be configured to scan `.vybit/prototypes/` for stories. The agent adds this during setup:

```js
// .storybook/main.ts (or equivalent)
export default {
  stories: [
    '../src/**/*.stories.@(ts|tsx)',
    '../.vybit/prototypes/**/*.stories.@(ts|tsx)',  // ← agent adds this line
  ],
};
```

---

## Setup Flow

### Detection

The server checks two things:
1. Is Storybook running? (`detectStorybookUrl()` — already implemented)
2. Is the Storybook config scanning `.vybit/prototypes/`? (new check — server reads the Storybook main config and checks the `stories` globs)

### "Set up Storybook Explore" action

When Storybook is running but not configured for prototypes:

1. User clicks "In Storybook" in the Explore dropdown
2. Panel shows: "Storybook is running but needs a one-time config update to show prototypes."
3. User clicks "Set Up"
4. Server sends MCP instructions telling the agent to:
   - Add `'../.vybit/prototypes/**/*.stories.@(ts|tsx)'` to the `stories` array in the Storybook main config
   - Create `.vybit/` directory if it doesn't exist
   - Ensure `.vybit/` is in `.gitignore`
5. Agent makes the change → Storybook HMR picks it up
6. Panel detects the config is ready → "In Storybook" becomes active

This is a one-time operation per project, similar to "Establish Feature Flags."

---

## Data Flow

### Prototype lifecycle

```
1. User commits an "explore" request
   e.g. "Make this hero section more modern — show me 3 options"
   with explore tier = "storybook"

2. Agent calls implement_next_change → receives instructions:
   ACTION: GENERATE STORYBOOK PROTOTYPES

   REQUEST: "Make this hero section more modern"
   ELEMENT: <section class="bg-white p-8 text-center">...</section>
   COMPONENT: HeroSection (src/components/HeroSection.tsx)
   COUNT: 3
   PROTOTYPE_DIR: .vybit/prototypes/<commitId>/
   FRAMEWORK: react (or angular)

   INSTRUCTIONS:
   1. Create the directory .vybit/prototypes/<commitId>/
   2. Generate 3 component variant files, each showing a different
      design direction. Use the project's actual framework, Tailwind
      config, and design system components.
   3. Create a Storybook story file that exports each variant:
      - Title: "Prototypes/<commitId>/HeroSection"
      - One named export per variant
   4. Create a manifest.json:
      {
        "commitId": "<commitId>",
        "request": "Make this hero section more modern",
        "options": [
          {
            "id": "modern-minimal",
            "name": "Modern Minimal",
            "description": "Clean lines with ample whitespace...",
            "storyId": "prototypes-<commitId>-herosection--modern-minimal",
            "file": "HeroModern.tsx"
          },
          ...
        ]
      }
   5. Call mark_change_implemented with:
      { commitId, prototypes: { manifestPath: ".vybit/prototypes/<commitId>/manifest.json" } }
   6. Then call implement_next_change again.

3. Agent writes component files + story file + manifest

4. Agent calls mark_change_implemented

5. Server reads manifest, waits for stories to appear in Storybook's
   index.json (polls with timeout)

6. Server pushes PROTOTYPE_OPTIONS message to panel via WS:
   {
     type: 'PROTOTYPE_OPTIONS',
     commitId: '<commitId>',
     options: [
       {
         id: 'modern-minimal',
         name: 'Modern Minimal',
         description: 'Clean lines with ample whitespace...',
         storybookUrl: '/storybook/iframe.html?id=prototypes-<commitId>-herosection--modern-minimal&viewMode=story'
       },
       ...
     ]
   }

7. Panel renders PrototypePicker
   - Carousel with each option as a Storybook iframe
   - User navigates between options
   - User clicks "Select This" on the winner

8. Panel sends PROTOTYPE_SELECTED → server creates a new committed
   patch with instructions to implement the selected variant

9. Agent implements the winning variant in real source code,
   cleans up .vybit/prototypes/<commitId>/
```

### Story URL scheme

Storybook uses a deterministic URL scheme for rendering stories in iframes:

```
/iframe.html?id=<storyId>&viewMode=story
```

Where `storyId` is derived from the story title and export name:
- Title: `"Prototypes/abc123/HeroSection"`
- Export: `ModernMinimal`
- Story ID: `prototypes-abc123-herosection--modern-minimal`

VyBit's server proxies Storybook at `/storybook/*`, so the panel loads:
```
/storybook/iframe.html?id=prototypes-abc123-herosection--modern-minimal&viewMode=story
```

This is the same proxy mechanism already used for VyBit's Storybook addon.

---

## Error Detection & Recovery

Story variants are real code that must compile. When the agent makes a mistake, Storybook renders an error overlay instead of the component. VyBit can detect this and self-heal.

### Detection mechanism

When the panel loads a story iframe for a prototype option, it checks for errors in two ways:

1. **Storybook error overlay detection.** Storybook renders errors in a distinctive DOM structure (a full-page error overlay with a stack trace). The panel can inspect the iframe content (same-origin via the proxy) for Storybook's error indicator elements.

2. **Story not found in index.json.** If the expected `storyId` never appears in Storybook's `index.json` after a reasonable timeout (15s), the story file itself failed to parse — Storybook never registered it.

### Recovery flow

```
1. Panel detects error in prototype option iframe

2. Panel extracts error message from Storybook's error overlay
   (e.g., "Cannot find module './HeroModern'" or
   "JSX element 'RadixDialog' has no corresponding closing tag")

3. Panel sends PROTOTYPE_ERROR to server:
   {
     type: 'PROTOTYPE_ERROR',
     commitId: '<commitId>',
     optionId: 'modern-minimal',
     error: 'SyntaxError: Unexpected token ...',
     file: '.vybit/prototypes/<commitId>/HeroModern.tsx'
   }

4. Server creates a fix-it patch and queues it for the agent:
   "The prototype variant 'Modern Minimal' has a compilation error.
    Fix the file .vybit/prototypes/<commitId>/HeroModern.tsx:
    Error: <extracted error message>
    Then call mark_change_implemented again."

5. Agent fixes the file → Storybook HMR reloads → panel retries

6. If the fix succeeds, the option renders normally.
   If it fails again, the panel marks that option as "Error — could not render"
   and lets the user proceed with the remaining options.
```

### Max retry limit

To avoid infinite fix loops, the server caps retries at **2 attempts per option**. After that, the option is marked as failed and excluded from the carousel (with a note: "1 of 3 options failed to render").

---

## Panel UX

### PrototypePicker with Storybook iframes

The same `PrototypePicker` component from the main spec works here — the only difference is what URL goes into each iframe. For HTML mockups, it's a static file URL. For Storybook, it's a story iframe URL.

```
┌──────────────────────────────────┐
│  ◀  Option 2 of 3  ▶            │
│  "Bold Gradient"                 │
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │  [Storybook story iframe]  │  │
│  │                            │  │
│  └────────────────────────────┘  │
│  Vibrant colors with a bold      │
│  gradient background...          │
│                                  │
│  [Implement] [Refine ▾] [Discard]│
└──────────────────────────────────┘
```

The carousel is identical to the HTML mockup version. The iframe `src` is the only difference:
- HTML mockup: `/api/prototypes/<commitId>/modern-minimal.html`
- Storybook: `/storybook/iframe.html?id=prototypes-abc123-herosection--modern-minimal&viewMode=story`

### Storybook bonus: Args controls

Because prototype stories can define `argTypes`, the user gets Storybook's built-in controls for free. The panel could expose a "Tweak Props" toggle that reveals Storybook's controls panel within the iframe (`&viewMode=story&panel=bottom`). This lets users explore prop variations (text content, boolean flags, data shapes) beyond what VyBit's scrubbers cover.

This is a Phase 2 enhancement — v1 just shows the story render.

### Error state

When a prototype option has a compilation error:

```
┌──────────────────────────────────┐
│  ◀  Option 2 of 3  ▶            │
│  "Bold Gradient"                 │
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │  ⚠ This variant failed     │  │
│  │  to compile. The agent is  │  │
│  │  attempting a fix...       │  │
│  │                            │  │
│  └────────────────────────────┘  │
│                                  │
│  [Skip This Option]     [Retry]  │
└──────────────────────────────────┘
```

After max retries:

```
│  ⚠ This variant could not be    │
│  rendered (compilation error).   │
│  [View Error]  [Skip]            │
```

---

## MCP Instructions Format

### Generate prototypes (Storybook)

```
ACTION: GENERATE STORYBOOK PROTOTYPES

The user wants to see design options before committing to a direction.
Generate real component variants rendered as Storybook stories.

REQUEST: "Make this hero section more modern"
ELEMENT: <section class="bg-white p-8 text-center">...</section>
COMPONENT: HeroSection (src/components/HeroSection.tsx)
FRAMEWORK: react
STYLING: tailwindcss v4 (use the project's existing Tailwind classes)
COUNT: 3
PROTOTYPE_DIR: .vybit/prototypes/<commitId>/

IMPORTANT:
- Each variant must be a valid React component that compiles.
- Use the project's real imports: Tailwind classes, design system
  components, existing utilities. Do NOT use inline styles to
  approximate the design system.
- The story file title MUST be: "Prototypes/<commitId>/HeroSection"
- Each story export name becomes the variant identifier.

FILE STRUCTURE:
  .vybit/prototypes/<commitId>/
    HeroModern.tsx
    HeroBold.tsx
    HeroPlayful.tsx
    Prototypes.stories.tsx
    manifest.json

STORY FILE FORMAT:
  import type { Meta, StoryObj } from '@storybook/react';
  import { HeroModern } from './HeroModern';
  import { HeroBold } from './HeroBold';
  import { HeroPlayful } from './HeroPlayful';

  const meta: Meta = {
    title: 'Prototypes/<commitId>/HeroSection',
  };
  export default meta;

  export const ModernMinimal: StoryObj = {
    render: () => <HeroModern />,
  };
  export const BoldGradient: StoryObj = {
    render: () => <HeroBold />,
  };
  export const Playful: StoryObj = {
    render: () => <HeroPlayful />,
  };

MANIFEST FORMAT:
  {
    "commitId": "<commitId>",
    "request": "Make this hero section more modern",
    "tier": "storybook",
    "options": [
      {
        "id": "modern-minimal",
        "name": "Modern Minimal",
        "description": "Clean lines, generous whitespace, subtle shadows",
        "storyExport": "ModernMinimal",
        "storyId": "prototypes-<commitId>-herosection--modern-minimal",
        "file": "HeroModern.tsx"
      },
      ...
    ]
  }

After writing all files, call mark_change_implemented with:
  {
    commitId: "<commitId>",
    results: [{ patchId: "<patchId>", success: true }],
    prototypes: {
      manifestPath: ".vybit/prototypes/<commitId>/manifest.json"
    }
  }

Then call implement_next_change again to continue the loop.
```

### Implement the winner

After the user selects an option, the agent receives a standard implementation instruction:

```
ACTION: IMPLEMENT SELECTED PROTOTYPE

The user selected "Bold Gradient" from 3 prototype options.

SOURCE: .vybit/prototypes/<commitId>/HeroBold.tsx
TARGET: src/components/HeroSection.tsx

INSTRUCTIONS:
1. Read the selected prototype variant at the source path above.
2. Apply its design to the target component. You may:
   - Copy the variant's JSX/template structure into the existing component
   - Extract reusable pieces into the existing component's file
   - Adapt the variant to work with the component's existing props/state
3. Do NOT simply copy the file — integrate the design into the
   existing component structure.
4. Delete the prototype directory: .vybit/prototypes/<commitId>/
5. Call mark_change_implemented, then implement_next_change.
```

---

## Server Changes

### New: Storybook config detection

Add to `server/storybook.ts`:

```typescript
/**
 * Check whether the Storybook main config includes .vybit/prototypes/
 * in its stories globs. Returns true if prototypes will be discovered.
 */
export async function isStorybookConfiguredForPrototypes(): Promise<boolean>
```

This reads the Storybook main config file (`.storybook/main.ts`, `.storybook/main.js`, etc.) and checks whether any `stories` glob matches `.vybit/prototypes/`. Used by the panel to determine whether to show the "Set Up" CTA.

### New: Story readiness polling

Add to `server/prototypes.ts` (new file):

```typescript
/**
 * Poll Storybook's index.json until all expected story IDs appear,
 * or timeout after maxWaitMs.
 */
export async function waitForStories(
  storybookUrl: string,
  expectedStoryIds: string[],
  maxWaitMs: number = 15000
): Promise<{ ready: string[]; missing: string[] }>
```

Called after the agent reports prototypes are written. The server waits for Storybook HMR to process the new files before pushing `PROTOTYPE_OPTIONS` to the panel.

### New: Error relay

The panel sends `PROTOTYPE_ERROR` messages to the server via WebSocket. The server:
1. Creates a fix-it patch with the error details
2. Queues it for the agent (same mechanism as normal patches)
3. Tracks retry count per option per commit

### Manifest serving

The server exposes a REST endpoint to read manifests:
```
GET /api/prototypes/<commitId>/manifest.json
```

And proxies story iframes through the existing Storybook proxy at `/storybook/*`.

---

## Comparison: HTML Mockups vs Storybook Stories

| Dimension | HTML Mockups (Tier 0) | Storybook Stories (Tier 1) |
|-----------|----------------------|---------------------------|
| **Setup** | None | One-time Storybook config |
| **Runtime dependency** | None | Running Storybook process |
| **Framework fidelity** | None — standalone HTML | Full — real React/Angular |
| **Design system** | Must be approximated | Used directly |
| **Interactivity** | Static | Full (hover, click, etc.) |
| **Agent error rate** | Very low (any HTML works) | Higher (must compile) |
| **Error recovery** | N/A | Auto-detect + agent fix loop |
| **Time to render** | Instant | 1–3s HMR delay |
| **Path to production** | Agent reverse-engineers HTML | Variant is real code |
| **Cleanup** | Delete HTML files | Delete story + component files |

### When to use which

- **HTML Mockups:** Quick directional exploration. "Show me 3 completely different takes on this." The user wants speed and creative range over fidelity.
- **Storybook Stories:** Higher-fidelity exploration. "Show me 3 variations that work with our design system." The user wants options that look like the real thing and can be implemented directly.

The two tiers serve different moments in the design process. A user might start with HTML mockups to explore direction, then switch to Storybook stories once they've narrowed the direction and want realistic variants.

---

## Relationship to Feature Flags (Tier 2)

Storybook Explore and Feature Flag Explore are complementary, not competing:

- **Storybook** renders variants in isolation. Good for comparing visual design.
- **Feature Flags** render variants in the live app. Good for testing with real data, routing, and layout context.

A natural escalation path: the user explores with Storybook stories, picks a winner, and instead of "Implement" chooses "Build as Live Variant" — which takes the winning story component and wires it behind a feature flag in the running app. The component code is already real, so the agent just needs to add the flag evaluation and `window.vybit` wiring.

---

## Implementation Phases

### Phase 1: Foundation

- Storybook config detection (`isStorybookConfiguredForPrototypes()`)
- "Set up Storybook Explore" MCP instruction flow
- Story readiness polling (`waitForStories()`)
- Manifest schema for Storybook tier (extends existing schema with `storyId` field)
- `PROTOTYPE_OPTIONS` message with `storybookUrl` per option

### Phase 2: PrototypePicker integration

- Panel loads Storybook story iframes in the carousel
- Error detection in story iframes (Storybook error overlay detection)
- `PROTOTYPE_ERROR` → server → agent fix-it loop (max 2 retries)
- "Implement" action creates implementation patch from winning story

### Phase 3: Refinement

- "Refine This" action for individual stories (agent edits the variant, HMR reloads)
- "Regenerate All" action (agent rewrites all variants)
- Args/controls toggle for prop exploration
- Escalation to Feature Flags ("Build as Live Variant")

---

## Open Questions

1. **Story title convention.** Using `"Prototypes/<commitId>/ComponentName"` keeps prototypes grouped in Storybook's sidebar. But `commitId` is a UUID — should the title use the request text instead? e.g., `"Prototypes/Make hero more modern/HeroSection"`. Risk: long titles, special characters.

2. **Import paths in prototypes.** Variants in `.vybit/prototypes/<commitId>/` may need to import from the project's `src/`. Relative imports would be fragile (`../../../../src/components/Button`). Should the agent use path aliases? Or should the setup step configure a `tsconfig` paths entry?

3. **Angular story format.** Angular components need module declarations (or standalone component metadata). The MCP instructions need framework-specific guidance. The server already knows the framework — it should include the right story format in the instructions.

4. **Storybook sidebar clutter.** Prototype stories will appear in Storybook's sidebar. Should VyBit configure Storybook to hide them (via `tags: ['!autodocs', '!dev']` or a custom filter)? Or is sidebar visibility useful for the user?

5. **Concurrent explorations.** If the user starts a second exploration while the first is still showing, should the first be discarded? Or can multiple exploration sessions coexist in the panel?

6. **Story file hot-reload reliability.** Some Storybook configurations have issues with HMR for new files (as opposed to edits to existing files). Need to verify that adding a new `.stories.tsx` file to a glob-watched directory triggers Storybook's story index update without a full restart.
