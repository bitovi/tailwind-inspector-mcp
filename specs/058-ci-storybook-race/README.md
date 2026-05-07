# 058 — CI Storybook Race Condition

## Summary

The `flow-drag-to-slot` and `flow-a-place` E2E tests fail in CI because
the Express server cannot find Storybook's `/index.json` at startup. The
panel never receives component data, so "Place" buttons never render.

---

## Verified Facts

### Fact 1: Playwright starts webServers sequentially

**Status:** VERIFIED

Playwright starts each `webServer` entry one-at-a-time in array order.
Each server must respond to its `url` health check before the next starts.
The comment in `e2e/playwright.config.ts` is correct: order matters.

**Evidence:** Playwright source (`webServerPlugin.ts`) calls `setup()` which
awaits `_startProcess()` then `_waitForProcess()`. Tests in Playwright's own
repo prove Plugin2 never runs if Plugin1 is interrupted.

---

### Fact 2: Component data flows via HTTP fetch only — no WebSocket

**Status:** VERIFIED

The Express server gets Storybook data exclusively through:
```
server → HTTP GET http://localhost:6008/index.json → Storybook
server → import() story files from disk → argTypes
```

There is **no** WebSocket channel between the Express server and Storybook
for component discovery.

The `/storybook-server-channel` WebSocket connections visible in CI logs are
Storybook's own internal HMR/channel communication between its browser
frontend and its dev server. They appear in our server logs because we proxy
Storybook (`ws: true` on the proxy middleware), but our server never reads
or processes those messages.

**Evidence:** `grep` of `server/` for "storybook-server-channel" returns zero
matches. The WebSocket handler in `server/websocket.ts` has no special path
handling — it accepts all upgrades generically and logs connect/disconnect.

---

### Fact 3: The "passing" run also had these tests fail (as flaky)

**Status:** VERIFIED

The passing CI run (commit `8eb8bad`, file `temp/passing.txt`) shows:
```
5 flaky
  flow-a-place.spec.ts:41
  flow-drag-to-slot.spec.ts:106
  flow-drag-to-slot.spec.ts:140
  flow-drag-to-slot.spec.ts:186
  flow-drag-to-slot.spec.ts:215
13 passed (3.7m)
```

All 5 tests failed on first attempt, **passed on retry**. The run "passed"
because retried tests eventually found Storybook data available. The run did
not actually prove these tests are reliable.

---

### Fact 4: Server does NOT push notification to panel after reconnect

**Status:** VERIFIED

After the background retry finds Storybook and calls `/api/storybook-reconnect`:
1. `storybookUrl` is updated ✓
2. Storybook proxy is installed ✓
3. **No message is sent to connected panels** ✗

The only messages the server pushes to panels are: `QUEUE_UPDATE`,
`OVERLAY_STATUS`, `RESET_SELECTION`. There is no `STORYBOOK_AVAILABLE` or
similar event.

The panel fetches storybook data once on mount (`useComponentGroups` hook).
The only way to re-fetch is the "Scan for Storybook" button.

---

### Fact 5: CI ran the OLD ensureStorybookConnected (no retry loop)

**Status:** VERIFIED

The CI stack trace shows `helpers.ts:226` — the old single-shot 30s
`waitForFunction`. The newer 3-attempt retry version in
`e2e/shared-helpers.ts` was committed ~13 hours AFTER the CI run. It has
never been tested in CI.

---

### Fact 6: Playwright's readiness URL is too permissive

**Status:** VERIFIED

```ts
// Current:
url: 'http://localhost:6008'        // ← root URL, returns 200 before index is ready

// Server probes:
fetch('http://localhost:6008/index.json')  // ← stricter, requires compiled index
```

There is a window of several seconds between Storybook serving `/` and
`/index.json` being available. Playwright considers Storybook "ready" too
early, so the Express server (which starts next) probes `/index.json` and
gets nothing.

---

## Root Cause Chain

```
1. Playwright checks http://localhost:6008 (root) → 200 ✓ (too early)
2. Playwright starts Express server
3. Express calls detectStorybookUrl() → fetches /index.json → NOT READY → null
4. storybookUrl = null permanently (before retry fix)
5. Panel fetches /api/storybook-data → { available: false }
6. No server push tells panel when Storybook finally arrives
7. Tests wait for "Place" buttons → timeout
```

---

## Proposed Fixes (in order of effectiveness)

### Fix A: Change Playwright readiness URL (eliminates the race)

```ts
url: 'http://localhost:6008/index.json',
```

Playwright won't start Express until `/index.json` is actually ready.
Cleanest fix — attacks the problem at its source.

### Fix B: Server pushes STORYBOOK_AVAILABLE to panels

After background retry succeeds, broadcast to connected panels:
```ts
broadcastTo("panel", { type: "STORYBOOK_AVAILABLE" });
```

Panel reacts by re-fetching `/api/storybook-data`.

### Fix C: The retry in ensureStorybookConnected (current workaround)

The 3-attempt "Scan for Storybook" loop works as a workaround but adds
30s of retry time to every test that hits it. Still worth keeping as
defense-in-depth.

### Recommended: Apply A + B + C together

- **A** prevents the race in normal conditions
- **B** handles edge cases where Storybook is slow to compile
- **C** provides test-level resilience
