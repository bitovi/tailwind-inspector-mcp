---
name: debugging-skill
description: Always start a fresh browser session after any file change, walk through the full user flow, and monitor for errors before proceeding with further work.
---

# Debugging Skill: Error-Free UI Verification

## Purpose
Ensure that after any code change, the app is fully reloaded, the user flow is tested from the beginning, and no runtime errors or warnings are present before continuing with feature work or test automation.

## Workflow

1. **Restart Browser Session**
   - After any file change or hot-reload, always start a new browser session (do not reuse previous state).
   - This ensures no stale state or session issues.

2. **Start with the Test App (http://localhost:5173)**
   - Always verify behavior on the standalone test app first, before testing in Storybook or other environments.
   - The test app runs directly in the page (no iframes), making it easier to inspect shadow DOM elements, debug overlay state, and interact with the bottom toolbar.
   - Only move to Storybook (SB8/SB10) or other environments after confirming the feature works in the test app.

3. **Walk Through Full User Flow**
   - Navigate to the target page.
   - Interact with the UI as a real user would.

4. **Monitor for Errors and Warnings**
   - Capture all browser console logs, errors, and exceptions during navigation and interaction.
   - Do not proceed if any runtime errors or warnings are present.
   - Only continue with feature work or test automation when the UI is confirmed error-free.

## Clicking the Toggle Button (Playwright MCP)

The VyBit toggle button (`aria-label="Open VyBit inspector"`) lives inside a **shadow DOM** (`#tw-visual-editor-host`). Playwright MCP's `click_element` and snapshot tools cannot reach shadow DOM elements directly.

**Always use `page.evaluate()` to click it:**

```ts
await page.waitForFunction(() => {
  const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
  return !!(host?.shadowRoot?.querySelector('.toggle-btn'));
}, { timeout: 5000 });

await page.evaluate(() => {
  const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
  const btn = host.shadowRoot!.querySelector('.toggle-btn') as HTMLButtonElement;
  btn.click();
});
```

Or with Playwright MCP's `mcp_playwright_browser_evaluate`:

```ts
// Step 1: wait for button
await page.waitForFunction(() =>
  !!(document.querySelector('#tw-visual-editor-host') as HTMLElement)?.shadowRoot?.querySelector('.toggle-btn')
);

// Step 2: click it
await page.evaluate(() => {
  const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
  (host.shadowRoot!.querySelector('.toggle-btn') as HTMLButtonElement).click();
});
```

> Do NOT try `getByRole('button', { name: 'Open VyBit inspector' })` or snapshot-based clicks — they will not find the shadow DOM element.

## Best Practices
- Always verify the UI is in a clean state before testing features.
- Use Playwright or similar tools to automate the flow and error monitoring.
- Document any errors found and fix them before proceeding.

---

This skill should be followed for all feature implementation, E2E test writing, and UI debugging.
