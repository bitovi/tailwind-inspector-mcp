# 060 — Feature Flags Exploration (OpenFeature + VyBit)

## Problem

When users ask the agent to "make variations of this component," the current spec proposes generating static HTML mockup files viewed in iframes. But real design exploration needs to happen in the live running app — with real data, real routing, real interactions. And customers are asking whether chosen variants can make their way to production for A/B testing and gradual rollout.

Static HTML mockups don't bridge to production. Feature flags do.

## Core Idea

The agent generates **whole prototype variants** as real components, wires them behind **OpenFeature feature flags**, and VyBit's panel lets the user toggle between them live in the running app. When the user picks a winner, the flag-driven code stays in the codebase — the team swaps VyBit's provider for their real flag provider (LaunchDarkly, Flagsmith, etc.) and ships.

OpenFeature is the right abstraction because:
- It's vendor-agnostic — works with any flag management system
- It has framework-specific SDKs (React, Angular) that handle re-rendering on flag changes
- The user's app code never references VyBit directly — just evaluates flags
- Removing VyBit later is a one-line provider change, not a rewrite

## `window.vybit` — The Bridge

VyBit's overlay injects before the app loads. It establishes `window.vybit` as the canonical namespace for all VyBit capabilities exposed to the page. Feature flags are one surface on it.

```typescript
// Overlay sets this up before the app loads
window.vybit = {
  flags: {},                          // current flag values
  setFlag(key: string, value: any) {  // panel calls this to toggle
    this.flags[key] = value;
    this._listeners.forEach(cb => cb(key, value));
  },
  getFlags() {                        // returns all known flags
    return { ...this.flags };
  },
  onFlagChange(cb: (key: string, value: any) => void) {
    this._listeners.push(cb);
    return () => { /* unsubscribe */ };
  },
  _listeners: [],
};
```

The overlay already runs first, so `window.vybit` is guaranteed to exist before the app's OpenFeature provider initializes.

## Agent-Installed Provider

The agent writes a thin OpenFeature provider into the user's app that reads from `window.vybit`. It's designed to be invisible in production when VyBit isn't present.

```typescript
import { Provider, ProviderEvents, JsonValue } from '@openfeature/web-sdk';

class VyBitFlagProvider implements Provider {
  readonly metadata = { name: 'vybit' };
  events = new OpenFeatureEventEmitter();

  initialize() {
    // No vybit on the page? Fine — just never emit changes.
    window.vybit?.onFlagChange(() => {
      this.events.emit(ProviderEvents.ConfigurationChanged);
    });
  }

  resolveBooleanEvaluation(flagKey: string, defaultValue: boolean) {
    return this._resolve(flagKey, defaultValue);
  }

  resolveStringEvaluation(flagKey: string, defaultValue: string) {
    return this._resolve(flagKey, defaultValue);
  }

  resolveNumberEvaluation(flagKey: string, defaultValue: number) {
    return this._resolve(flagKey, defaultValue);
  }

  resolveObjectEvaluation<T extends JsonValue>(flagKey: string, defaultValue: T) {
    return this._resolve(flagKey, defaultValue);
  }

  private _resolve<T>(flagKey: string, defaultValue: T) {
    const val = window.vybit?.flags?.[flagKey];
    if (val === undefined) {
      // FLAG_NOT_FOUND tells MultiProvider to skip to the next provider
      return { value: defaultValue, reason: 'DEFAULT', errorCode: 'FLAG_NOT_FOUND' };
    }
    return { value: val as T };
  }
}
```

### Production safety

When `window.vybit` doesn't exist (production, any env without the overlay):
- `initialize()` does nothing — no event subscription
- Every `resolve*` call returns `FLAG_NOT_FOUND`
- `MultiProvider` skips to the real provider (LaunchDarkly, Flagsmith, etc.)
- Zero overhead, zero behavior change

The user's app code never references VyBit:

```typescript
// This works with or without VyBit present
const variant = client.getStringValue('hero-variant', 'default');
```

### MultiProvider wiring

```typescript
import { OpenFeature, MultiProvider } from '@openfeature/web-sdk';

OpenFeature.setProvider(
  new MultiProvider([
    { provider: new VyBitFlagProvider() },   // overrides first (no-op without overlay)
    { provider: new LaunchDarklyProvider() }, // real provider as fallback
  ])
);
```

With `FirstMatchStrategy` (the default), VyBit overrides take priority during development. In production, everything falls through.

### Removal path

To remove VyBit entirely, delete `VyBitFlagProvider` from the `MultiProvider` array. One line. All flag keys, variants, and component code stay untouched.

## UX: "Establish Feature Flags" Button

Same pattern as "Connect to Storybook" — a setup-once action surfaced when the capability isn't present.

### Detection

Panel checks for flags via VyBit's server (which knows what flags it's told the agent to create). If none exist and the provider hasn't been set up, the panel shows the button.

### What the button does

1. User clicks "Establish Feature Flags" in the panel
2. Panel sends a request to the server
3. Server responds to the MCP connection with a prompt instructing the agent to:
   - Install `@openfeature/web-sdk` (plus `@openfeature/react-sdk` or `@openfeature/angular-sdk` as appropriate — the server already knows the framework)
   - Create the `VyBitFlagProvider`
   - Wrap the existing provider (if any) with `MultiProvider`
   - Add the `window.vybit` type declaration
4. Agent does the scaffolding once
5. Panel detects the provider is ready → button disappears, flag controls become available

After this one-time setup, every "make variations" request just creates flags + component variants. The plumbing is already in place.

## Data Flow: Creating Variations

```
1. User selects a component and says "make 3 variations of this hero section"

2. Agent calls implement_next_change → receives instructions:
   - action: "prototype"
   - Create 3 real component variants (HeroModern, HeroBold, HeroPlayful)
   - Register a string flag "hero-variant" with values "modern" | "bold" | "playful"
   - Wire the parent to render the selected variant based on the flag
   - Report flag metadata back to VyBit

3. Agent writes real components + flag evaluation:

   const variant = client.getStringValue('hero-variant', 'modern');
   switch (variant) {
     case 'modern':  return <HeroModern />;
     case 'bold':    return <HeroBold />;
     case 'playful': return <HeroPlayful />;
   }

4. Agent calls mark_change_implemented with flag metadata:
   { flags: [{ key: 'hero-variant', variants: ['modern', 'bold', 'playful'] }] }

5. Server stores flag metadata, pushes to panel via WebSocket

6. Panel renders a toggle/dropdown: "Hero: Modern / Bold / Playful"
   - User selects "Bold"
   - Panel calls window.vybit.setFlag('hero-variant', 'bold')
   - VyBitFlagProvider emits PROVIDER_CONFIGURATION_CHANGED
   - React/Angular SDK re-renders the component with the new variant

7. User picks a winner → that variant becomes the default
   - Agent updates the default value or removes the other variants
   - Or: team connects their real flag provider and ships as an A/B test
```

## Mock Services — Backend-Dependent Variations

Frontend variations often need data that doesn't exist yet. A "hero with a recommendations carousel" needs an API endpoint. A "dashboard with real-time analytics" needs a data source. The agent can prototype the frontend, but it can't spin up new backend services.

The solution: the agent creates mock data alongside the variation and gates it behind a **mock services flag**. Same OpenFeature + `window.vybit` plumbing.

```typescript
// Agent writes this alongside the new variation
const useMocks = client.getBooleanValue('mock-services', false);

const recommendations = useMocks
  ? getMockRecommendations()  // agent-generated static/fake data
  : await fetch('/api/recommendations').then(r => r.json());
```

When VyBit is present and the user is exploring, the mock flag is `true` — mocks serve the data. In production (or when toggled off), real services are used.

This also protects the backend from prototype experiments. The agent never modifies real API routes or database schemas during exploration. Everything new is mocked.

### Two layers of flags

| Layer | Purpose | Example |
|-------|---------|---------|
| **UI flags** | Which variation of a component renders | `hero-variant: "modern" \| "bold" \| "playful"` |
| **Service flags** | Whether the app uses real backends or mock data | `mock-services: true \| false` |

Both are managed through the same `window.vybit` → VyBitFlagProvider → OpenFeature pipeline.

### Panel Settings: Mock Services

The panel exposes settings for mock service behavior. These live in a "Feature Flags" settings section.

```
┌─────────────────────────────────────────────────┐
│ Feature Flag Settings                           │
│                                                 │
│ Mock flag name: [mock-services          ]       │
│                                                 │
│ [✓] Toggle mocks                                │
│     When on, mock-gated code uses fake data.    │
│     When off, real services are called.          │
│                                                 │
│ [✓] Tell AI to make mocks for service changes   │
│     When checked, prototype instructions tell   │
│     the agent: "If your variations need data    │
│     that doesn't exist yet, create mock data    │
│     and gate it behind the mock flag."           │
│     When unchecked, the agent only makes        │
│     frontend changes — if it needs new data,    │
│     it reports what's needed but doesn't mock.  │
│                                                 │
│ Active mocks:                                   │
│  • getMockRecommendations() — HeroBold          │
│  • getMockAnalytics() — DashboardV2             │
│  • getMockUserProfile() — ProfileRedesign       │
└─────────────────────────────────────────────────┘
```

**Mock flag name** — Input field. Lets the team align with their existing mocking convention (`USE_MOCKS`, `ENABLE_STUBS`, etc.). Default: `mock-services`. VyBit uses this name in all MCP instructions to the agent.

**Toggle mocks** — Checkbox. Immediate on/off. Writes `window.vybit.setFlag(mockFlagName, true/false)`. The user flips this during exploration to compare "with mock data" vs "with real data" to see what breaks or looks different.

**Tell AI to make mocks** — Checkbox. Policy toggle that changes MCP instructions. When checked, every prototype request includes a directive: "If your variations require data that doesn't exist yet, create mock data and gate it behind the `{mockFlagName}` flag." When unchecked, the agent only makes frontend changes — if it needs new data, it says so but doesn't mock it. This controls how ambitious the agent gets.

**Active mocks** — Read-only list. Shows all mock-gated code the agent has created across exploration sessions. Each entry links to the mock function and the variation that uses it. This gives the team visibility into what's mocked before shipping — important for cleanup.

### Mock cleanup before production

When the team is ready to ship, they need to know what mocks exist so they can:
1. Build real backend endpoints to replace them
2. Remove mock code
3. Or keep mocks for testing/staging environments

The "Active mocks" list serves as this inventory. A future "Clean up mocks" action could tell the agent to remove all mock-gated code and replace it with real service calls (once the endpoints exist).

## Why Not Intercept Fetch?

We explored whether VyBit's overlay could passively discover existing OpenFeature flags by monkey-patching `fetch` and inspecting responses from flag provider backends (LaunchDarkly, Flagsmith, etc.).

Technically possible — the overlay runs first and could intercept the bulk flag fetch. But:
- Every provider has a different URL pattern and response shape
- Heuristic detection is fragile
- Some providers use WebSockets/SSE, not fetch
- It solves discovery but not toggling

With the `window.vybit` approach, discovery isn't needed — VyBit is the source of truth for flags it created. The agent reports back what flags it set up, and the panel renders controls from that metadata.

For *existing* flags the user already has (not created by VyBit), a future extension could have the agent expose those through `window.vybit` as well — reading from the app's OpenFeature client and surfacing them in the panel.

## Open Questions

1. **Flag naming convention.** Should VyBit impose a naming scheme (e.g., `vybit-hero-variant`) to avoid collisions with existing production flags? Or let the agent use natural names?

2. **Variant cleanup.** After the user picks a winner, should the agent remove the other variants and the flag evaluation code? Or leave them in for potential future use / A/B testing?

3. **Multiple flags per exploration.** A single "make variations" request might produce multiple flags (layout variant + color variant + density variant). How does the panel group these? By the exploration session? By component?

4. **Existing OpenFeature apps.** If the app already uses OpenFeature with a provider, the agent wraps it with MultiProvider. If the app doesn't use OpenFeature at all, the agent sets up VyBitFlagProvider as the sole provider. The instructions need to handle both paths.

5. **Framework detection.** The server needs to know React vs Angular to send the right SDK installation instructions. This may already be available from the app context.

6. **`window.vybit` type safety.** Should VyBit ship a `.d.ts` file that the agent can reference? Or inline the type declaration?

## Relationship to Spec 060

This is an alternative (or complement) to the HTML mockup approach in the main spec. The two can coexist:

- **HTML mockups** (spec 060): Simpler, works without any app instrumentation, good for quick visual comparisons in an iframe/carousel. No path to production.
- **Feature flags** (this doc): Requires one-time setup, but variations run in the real app and have a direct path to production A/B testing.

The "Explore" button could offer both: "Quick Preview" (HTML mockups) vs "Build Variations" (feature flags in the app).
