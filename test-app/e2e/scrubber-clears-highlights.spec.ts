import { test, expect, type Page, type Frame } from '@playwright/test';

/**
 * Verifies that blue highlight boxes disappear as soon as the user
 * starts interacting with a ScaleScrubber chip (pointer-down → open dropdown
 * or begin scrubbing), matching the behaviour of the old plain chips.
 */

async function activateInspectMode(page: Page) {
  await page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const btn = host.shadowRoot!.querySelector('.toggle-btn') as HTMLButtonElement;
    btn.click();
  });
}

async function getHighlightCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return host.shadowRoot!.querySelectorAll('.highlight-overlay').length;
  });
}

async function getPanelFrame(page: Page): Promise<Frame> {
  let frame: Frame | null = null;
  for (let i = 0; i < 20; i++) {
    frame = page.frames().find(f => f.url().includes('/panel')) ?? null;
    if (frame) break;
    await page.waitForTimeout(250);
  }
  if (!frame) throw new Error('Panel frame not found');
  return frame;
}

/**
 * Click a page element in inspect mode and wait for the panel to render chips.
 * activateInspectMode opens the panel container; we wait until the panel's WS
 * is connected (no longer showing "Waiting for connection"), then click the element.
 */
async function selectElementAndWaitForPanel(page: Page, locator: import('@playwright/test').Locator): Promise<Frame> {
  const frame = await getPanelFrame(page);

  // Wait until the panel WS is connected ("Waiting for connection" goes away)
  await frame.waitForFunction(
    () => !document.body.textContent?.includes('Waiting for connection'),
    { timeout: 10000 },
  );

  // Small buffer to ensure the server has processed the REGISTER message
  await page.waitForTimeout(300);

  // Now click the element — panel is connected and will receive ELEMENT_SELECTED
  await locator.click();

  // Wait for the Picker to render ScaleScrubber chips
  await frame.locator('.cursor-ew-resize').first().waitFor({ timeout: 8000 });
  return frame;
}

/** Find the ScaleScrubber chip (cursor-ew-resize) whose trimmed text matches the given class. */
async function findScrubberChip(frame: Frame, className: string) {
  const locator = frame.locator('.cursor-ew-resize').filter({ hasText: className });
  try {
    await locator.first().waitFor({ timeout: 5000 });
    return locator.first();
  } catch {
    return null;
  }
}

test.describe('ScaleScrubber clears highlights on interaction', () => {
  test('highlights are removed when the user pointer-downs a ScaleScrubber chip', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await activateInspectMode(page);

    const primaryBtn = page.locator('button:has-text("Primary")').first();
    const frame = await selectElementAndWaitForPanel(page, primaryBtn);

    const highlightsBefore = await getHighlightCount(page);
    expect(highlightsBefore, 'Highlights should appear after clicking an element').toBeGreaterThan(0);

    const chip = await findScrubberChip(frame, 'text-sm');
    expect(chip, 'text-sm ScaleScrubber chip should be present in the panel').not.toBeNull();

    await chip!.click();
    await page.waitForTimeout(500);

    const highlightsAfter = await getHighlightCount(page);
    expect(highlightsAfter, 'Highlights should be cleared after pointer-down on the scrubber chip').toBe(0);
  });

  test('highlights are removed when the user opens the ScaleScrubber dropdown and hovers an option', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await activateInspectMode(page);

    const primaryBtn = page.locator('button:has-text("Primary")').first();
    const frame = await selectElementAndWaitForPanel(page, primaryBtn);

    expect(await getHighlightCount(page)).toBeGreaterThan(0);

    const chip = await findScrubberChip(frame, 'text-sm');
    expect(chip).not.toBeNull();

    await chip!.click();
    await page.waitForTimeout(500);

    // Hover over a dropdown option to trigger a preview
    const option = frame.getByText('text-base', { exact: true });
    await option.hover();
    await page.waitForTimeout(300);

    const highlightsAfter = await getHighlightCount(page);
    expect(highlightsAfter, 'Highlights should be gone after opening scrubber dropdown and hovering an option').toBe(0);
  });
});
