# 060 — Explore & Prototype: Use Cases

## Overview

VyBit adds two tiers of design exploration, accessed through a single **[Explore ▾]** dropdown button. Both tiers let the user describe what they want (via text or drawing) and receive multiple options to compare. They differ in speed, fidelity, and what happens after.

| Tier | Name | Speed | Fidelity | Setup required |
|------|------|-------|----------|----------------|
| 1 | **Quick Explore** | Fast (~30s) | Low — static HTML mockups in iframes | None |
| 2 | **Feature Flag Explore** | Slower (~2min) | High — real component variants live in the app | One-time OpenFeature setup |

---

## Entry Points

### Element Drawer (text description)

When the user selects an element and clicks "Describe change," the textarea footer shows:

```
←  🎤  [Explore ▾] [Queue] [Commit]
            │
            ├─ Quick (HTML mockups)
            └─ With Feature Flags (real variants)
```

- **Explore ▾** — split button. Click runs Quick by default. ▾ opens dropdown.
- "With Feature Flags" is grayed out with a setup CTA if OpenFeature isn't configured yet.

### Draw Canvas (visual sketch)

When the user draws on the canvas, the footer shows:

```
[✕ Close]        [Explore ▾] [Queue Change]
                      │
                      ├─ Quick (HTML mockups)
                      └─ With Feature Flags (real variants)
```

Same dropdown behavior. Sketches are inherently ambiguous, so Explore is positioned as the primary action (filled button) with Queue Change as secondary (outline).

---

## Tier 1: Quick Explore

### UC-1: Generate mockup options from text

**Trigger:** User selects element → Describe change → types "make this hero more modern" → clicks Explore (Quick).

**Result:** Agent generates 2–3 standalone HTML mockup files. Panel shows a carousel viewer with one mockup at a time.

```
┌──────────────────────────────────┐
│  ◀  Option 2 of 3  ▶            │
│  "Bold Gradient"                 │
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │    [mockup in iframe]      │  │
│  │                            │  │
│  └────────────────────────────┘  │
│  Vibrant colors with a bold      │
│  gradient background...          │
│                                  │
│  [Implement] [Refine ▾] [Discard]│
└──────────────────────────────────┘
```

### UC-2: Generate mockup options from a drawing

**Trigger:** User draws a layout sketch on the canvas → clicks Explore (Quick).

**Result:** Same as UC-1, but the agent receives the screenshot + annotations as visual reference. Mockups are the agent's interpretations of the sketch.

### UC-3: Refine a selected mockup

**Trigger:** User is viewing Option B in the carousel and wants to adjust it.

**Flow:** User types refinement text in an input below the mockup → clicks "Refine This."

```
┌──────────────────────────────────┐
│  ◀  Option 2 of 3  ▶            │
│  ┌────────────────────────────┐  │
│  │    [mockup iframe]         │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Make this darker, and add  │  │
│  │ more whitespace            │  │
│  └────────────────────────────┘  │
│  [Refine This] [Implement] [▾]  │
└──────────────────────────────────┘
```

**Result:** Agent generates new mockup(s) based on the selected one + refinement. Carousel updates with the new options. The original options may be kept or replaced (TBD).

### UC-4: Redirect all options

**Trigger:** User doesn't like any mockup. Wants to change direction entirely.

**Flow:** User types new guidance without selecting a specific option → clicks "Regenerate All."

```
┌──────────────────────────────────┐
│  ◀  Option 2 of 3  ▶            │
│  ┌────────────────────────────┐  │
│  │    [mockup iframe]         │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ These are too corporate.   │  │
│  │ Try something more playful │  │
│  └────────────────────────────┘  │
│  [Regenerate All]     [Discard]  │
└──────────────────────────────────┘
```

**Result:** Agent receives original request + new feedback. Generates a fresh set of mockups. Carousel replaces all options.

### UC-5: Implement the winning mockup

**Trigger:** User is happy with Option B → clicks "Implement."

**Result:** The selected mockup becomes a normal committed change. The MCP response to the agent says: "Implement this design in the source code." Agent applies class/structure changes. Mockup files are cleaned up.

### UC-6: Discard exploration

**Trigger:** User clicks "Discard" on the carousel.

**Result:** All mockup files deleted. Panel returns to normal editing view. No changes queued.

### UC-7: Visually edit a mockup (Phase 2)

**Trigger:** User views a mockup and wants to tweak spacing, colors, etc. directly — same as editing the real app.

**Flow:** Mockups are served through VyBit's server with the overlay injected. User clicks elements in the mockup iframe and uses the same chips/scrubbers/color pickers.

**Result:** Edits are applied to the mockup HTML. When the user implements, the edited mockup is the reference.

**Note:** Phase 2 — requires overlay to be aware it's running inside a mockup context.

---

## Tier 2: Feature Flag Explore

### UC-8: Generate live variants from text

**Trigger:** User selects element → Describe change → types "make 3 variations of this hero" → clicks Explore ▾ → "With Feature Flags."

**Prerequisite:** OpenFeature + VyBitFlagProvider must be set up (see UC-14).

**Result:** Agent writes 2–3 real component variants (e.g., `HeroModern`, `HeroBold`, `HeroPlayful`), registers a feature flag (`hero-variant`), and wires the parent to render based on the flag value. Panel shows a variant switcher.

```
┌──────────────────────────────────────┐
│ Feature Flags: HeroSection           │
│                                      │
│ hero-variant                         │
│ ┌──────────────────────────────────┐ │
│ │ ● Modern Minimal                 │ │
│ │ ○ Bold Gradient                  │ │
│ │ ○ Playful                        │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [Commit to Current]  [Remove Flags]  │
└──────────────────────────────────────┘
```

Selecting a radio button **instantly changes the live app** via `window.vybit.setFlag(...)`.

### UC-9: Generate live variants from a drawing

**Trigger:** User draws a sketch → clicks Explore ▾ → "With Feature Flags."

**Result:** Same as UC-8, but agent uses the sketch as visual reference for the variants it builds.

### UC-10: Toggle between live variants

**Trigger:** Variants exist. User clicks a different radio option in the panel.

**Result:** `window.vybit.setFlag('hero-variant', 'bold')` is called. VyBitFlagProvider emits `PROVIDER_CONFIGURATION_CHANGED`. React/Angular SDK re-renders the component immediately with the new variant. No page reload.

### UC-11: Edit flag values (non-enum flags)

**Trigger:** Agent created flags that aren't just string enums — numbers, booleans, etc.

**Panel renders type-appropriate controls:**

```
┌──────────────────────────────────────┐
│ hero-variant                         │
│ ● Modern  ○ Bold  ○ Playful         │
│                                      │
│ grid-columns              [◀ 3 ▶]   │
│                                      │
│ show-testimonials         [  ✓  ]    │
│                                      │
│ [Commit to Current]  [Remove Flags]  │
└──────────────────────────────────────┘
```

| Flag type | Control |
|-----------|---------|
| String enum | Radio buttons |
| Number | Stepper or ScaleScrubber |
| Boolean | Toggle / checkbox |

Every change updates the live app immediately.

### UC-12: Commit to current flag values

**Trigger:** User is happy with the current combination of flag values → clicks "Commit to Current."

**What it tells the agent:**

- For each flag, the agent receives the chosen value and instructions to:
  - Remove the feature flag evaluation code
  - Hardcode the chosen value (or render only the chosen variant)
  - Delete unused variant components
  - Clean up associated mock data
  - Remove the flag registration

**Example:** If `hero-variant` is set to `"bold"`:
- Delete `HeroModern` and `HeroPlayful` components
- Remove the flag switch — just render `<HeroBold />` directly
- Remove `hero-variant` from flag definitions

### UC-13: Keep a flag for production A/B testing

**Trigger:** User wants to commit some flags but leave others in place for their team to A/B test in production.

**Per-flag action:**

```
┌──────────────────────────────────────┐
│ hero-variant                         │
│ ● Modern  ○ Bold  ○ Playful         │
│ [Commit "Modern"]  [Keep as Flag 🚩]│
│                                      │
│ grid-columns              [◀ 4 ▶]   │
│ [Commit 4]         [Keep as Flag 🚩]│
└──────────────────────────────────────┘
```

- **Commit** — agent removes the flag, hardcodes the value.
- **Keep as Flag** — flag infrastructure stays. When the team swaps VyBit's provider for LaunchDarkly/Flagsmith, this flag is ready for production use. VyBit stops managing it.

### UC-14: Set up Feature Flags (one-time)

**Trigger:** User clicks Explore ▾ → "With Feature Flags" but OpenFeature isn't configured. Or user clicks "Establish Feature Flags" in panel settings.

**Flow:**

1. Dropdown shows "With Feature Flags" grayed out with `[Set up Feature Flags]` CTA
2. User clicks the CTA
3. Server sends MCP instructions telling the agent to:
   - Install `@openfeature/web-sdk` (+ framework-specific SDK)
   - Create the `VyBitFlagProvider` that reads from `window.vybit`
   - Wrap any existing provider with `MultiProvider`
   - Add `window.vybit` type declaration
4. Agent does the scaffolding
5. Panel detects the provider is ready → "With Feature Flags" becomes available

### UC-15: Remove all flags (discard exploration)

**Trigger:** User clicks "Remove Flags."

**Result:** Agent removes all variant code, flag evaluations, and restores the original component. Flag definitions are cleaned up.

---

## Tier 2 Extension: Mock Services

### UC-16: Variants with mock data

**Trigger:** Agent needs data that doesn't exist yet for a variant (e.g., a recommendations carousel needs an API endpoint).

**Behavior:** Agent creates mock data alongside the variant, gated behind a `mock-services` boolean flag.

```typescript
const useMocks = client.getBooleanValue('mock-services', false);
const data = useMocks ? getMockRecommendations() : await fetch('/api/recommendations');
```

**Panel shows a mock services toggle:**

```
┌──────────────────────────────────────┐
│ Mock Services              [  ✓  ]   │
│ Active mocks:                        │
│  • getMockRecommendations() — Hero   │
│  • getMockAnalytics() — Dashboard    │
└──────────────────────────────────────┘
```

### UC-17: Configure mock behavior (panel settings)

**Panel settings section:**

- **Mock flag name** — configurable (default: `mock-services`)
- **Toggle mocks** — on/off for comparing real vs mock data
- **Tell AI to make mocks** — policy toggle. When on, prototype instructions include "create mock data if needed." When off, agent only makes frontend changes and reports what data is missing.
- **Active mocks** — read-only inventory of all mock-gated code

---

## Cross-Cutting Concerns

### Button layout summary

**Element drawer (State B — textarea open):**
```
←  🎤  [Explore ▾] [Queue] [Commit]
```

**Draw canvas footer:**
```
[✕ Close]        [Explore ▾] [Queue Change]
```

**Explore dropdown:**
```
┌──────────────────────────────────────┐
│ Quick                                │
│ Generate HTML mockups to compare.    │
│ Fast, visual-only.                   │
├──────────────────────────────────────┤
│ With Feature Flags                   │
│ Build real component variants in     │
│ your app. Slower, fully live.        │
│                                      │
│ (grayed + [Set up] if not ready)     │
└──────────────────────────────────────┘
```

### Default behavior

Clicking the Explore button (not the ▾) runs **Quick** by default. This is the common case and requires no setup.

### Panel states during exploration

| State | What the panel shows |
|-------|---------------------|
| Idle | Normal editing (Design/Elements/Components tabs) |
| Quick: generating | "Agent is generating options..." spinner |
| Quick: comparing | Carousel viewer with mockup iframes |
| Quick: refining | Carousel + refinement input |
| Flags: generating | "Agent is building variants..." spinner |
| Flags: comparing | Variant switcher with flag controls |
| Flags: committing | "Agent is finalizing..." spinner |

### Escalation path (Quick → Flags)

Not explicitly defined yet, but a natural extension: user explores with Quick mockups, picks a winner, and instead of "Implement" chooses "Build as Flag Variants" to get real code. This bridges the two tiers. TBD whether to include in v1.
