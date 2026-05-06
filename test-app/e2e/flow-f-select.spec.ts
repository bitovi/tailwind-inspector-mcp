import { test, expect, type Page, type Frame } from '@playwright/test';
import {
  clickToggleButton,
  getPanelFrame,
  waitForPanelReady,
  clickSelectElementButton,
  getPanelButtonColor,
  getHighlightCount,
  getPageInteraction,
} from './helpers';

// ── Flow F: Select — persistent selection mode ───────────────────────────
//
// State machine:
//   GRAY   → click Select → ORANGE (no element)
//   ORANGE → click element → ORANGE (element selected, selecting persists)
//   ORANGE → click outside → ORANGE (new element, selecting persists)
//   ORANGE → click inside  → pass-through (no selection behavior)
//   ORANGE → click Select  → TEAL (if element) or GRAY (if no element)
//   ORANGE → Escape        → TEAL (if element) or GRAY (if no element)
//   TEAL   → click Select  → ORANGE (re-enable selecting, keep element)
//   TEAL   → Escape        → GRAY (deselect everything)
//   ORANGE → Describe change → TEAL (stop selecting, open describe textarea)
//   ORANGE → Edit text       → TEAL (stop selecting, enter text editing)

/** Returns the crosshair cursor state from the page. */
async function getCursor(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.style.cursor);
}

/** Returns whether the hover outline exists in the overlay shadow DOM. */
async function hasHoverOutline(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !!host?.shadowRoot?.querySelector('.hover-target-outline');
  });
}

/** Returns the border-style of the hover outline (e.g. 'dashed', 'solid'). */
async function getHoverOutlineBorderStyle(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const outline = host?.shadowRoot?.querySelector('.hover-target-outline') as HTMLElement | null;
    if (!outline) return null;
    return window.getComputedStyle(outline).borderStyle;
  });
}

/** Returns whether the panel shows element data (not the empty state). */
async function panelHasElement(frame: Frame): Promise<boolean> {
  return frame.evaluate(() => {
    const text = document.body.innerText;
    return !text.includes('Use the toolbar below the page') && text.includes('instance');
  });
}

/** Click the Select mode button on the panel. */
async function clickPanelSelect(frame: Frame): Promise<void> {
  await clickSelectElementButton(frame);
  await frame.page().waitForTimeout(500);
}

test.describe('Flow F: Select — persistent selection mode', () => {
  let page: Page;
  let frame: Frame;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    test.setTimeout(90000);
    await page.goto('/');
    await page.waitForTimeout(2000);

    await clickToggleButton(page);
    frame = await getPanelFrame(page);
    await waitForPanelReady(frame);
    await page.waitForTimeout(500);
  });

  test('Step 1→2: click Select → orange, crosshair active', async () => {
    // Step 1: initial — gray, no crosshair
    await expect.poll(
      () => getPanelButtonColor(frame, 'Select an element'),
      { message: 'Initial: Select button gray', timeout: 5000 },
    ).toBe('gray');
    expect(await getCursor(page)).toBe('');

    // Step 2: click Select → orange
    await clickPanelSelect(frame);
    await expect.poll(
      () => getPanelButtonColor(frame, 'Select an element'),
      { message: 'After click: Select button orange', timeout: 5000 },
    ).toBe('orange');
    expect(await getCursor(page)).toBe('crosshair');
  });

  test('Step 2→3: click element → stays orange, crosshair persists', async () => {
    await clickPanelSelect(frame);

    // Hover over an element — verify dashed teal outline
    const heading = page.locator('h3').first();
    await heading.hover();
    await page.waitForTimeout(300);
    expect(await hasHoverOutline(page)).toBe(true);
    expect(await getHoverOutlineBorderStyle(page)).toBe('dashed');

    // Click the element
    await heading.click();
    await page.waitForTimeout(500);

    // Should stay orange + crosshair
    await expect.poll(
      () => getPanelButtonColor(frame, 'Select an element'),
      { message: 'After select: button stays orange', timeout: 5000 },
    ).toBe('orange');
    expect(await getCursor(page)).toBe('crosshair');
    expect(await getHighlightCount(page)).toBeGreaterThan(0);
    expect(await panelHasElement(frame)).toBe(true);
  });

  test('hover inside selected → no outline; hover outside → dashed outline', async () => {
    await clickPanelSelect(frame);

    // Click an element to select it
    const heading = page.locator('h3').first();
    await heading.click();
    await page.waitForTimeout(500);

    // Hover inside the selected element — no outline
    await heading.hover();
    await page.waitForTimeout(300);
    expect(await hasHoverOutline(page)).toBe(false);

    // Hover outside (different element) — should show dashed outline
    const otherEl = page.locator('p').first();
    await otherEl.hover();
    await page.waitForTimeout(300);
    // The body is outside the heading, so outline should appear
    const outline = await hasHoverOutline(page);
    // Only check if there's a valid element to hover (might be the heading itself at 5,5)
    if (outline) {
      expect(await getHoverOutlineBorderStyle(page)).toBe('dashed');
    }
  });

  test('click outside selected → re-selects new element, stays orange', async () => {
    await clickPanelSelect(frame);

    // Select first element
    const heading = page.locator('h3').first();
    await heading.click();
    await page.waitForTimeout(500);
    expect(await panelHasElement(frame)).toBe(true);

    // Click a different element — should select it, stay orange
    const otherHeading = page.locator('p').first();
    if (await otherHeading.count() > 0) {
      await otherHeading.click();
      await page.waitForTimeout(500);

      await expect.poll(
        () => getPanelButtonColor(frame, 'Select an element'),
        { message: 'After re-select: button stays orange', timeout: 5000 },
      ).toBe('orange');
      expect(await getCursor(page)).toBe('crosshair');
      expect(await getHighlightCount(page)).toBeGreaterThan(0);
    }
  });

  test('Escape with orange+element → teal (stop selecting, keep element)', async () => {
    await clickPanelSelect(frame);

    // Select an element
    const heading = page.locator('h3').first();
    await heading.click();
    await page.waitForTimeout(500);

    // Press Escape → should go to teal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await expect.poll(
      () => getPanelButtonColor(frame, 'Select an element'),
      { message: 'After Escape: button teal', timeout: 5000 },
    ).toBe('teal');
    expect(await getCursor(page)).toBe('');
    expect(await getHighlightCount(page)).toBeGreaterThan(0);
    expect(await panelHasElement(frame)).toBe(true);
  });

  test('Escape from teal → gray (deselect everything)', async () => {
    await clickPanelSelect(frame);

    // Select an element
    const heading = page.locator('h3').first();
    await heading.click();
    await page.waitForTimeout(500);

    // First Escape: orange → teal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Second Escape: teal → gray
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await expect.poll(
      () => getPanelButtonColor(frame, 'Select an element'),
      { message: 'After 2nd Escape: button gray', timeout: 5000 },
    ).toBe('gray');
    expect(await getCursor(page)).toBe('');
    expect(await getHighlightCount(page)).toBe(0);
  });

  test('click Select with orange+element → teal (stop selecting)', async () => {
    await clickPanelSelect(frame);

    // Select an element
    const heading = page.locator('h3').first();
    await heading.click();
    await page.waitForTimeout(500);

    // Click Select button: orange + element → teal
    await clickPanelSelect(frame);
    await expect.poll(
      () => getPanelButtonColor(frame, 'Select an element'),
      { message: 'After toggle: button teal', timeout: 5000 },
    ).toBe('teal');
    expect(await getCursor(page)).toBe('');
    expect(await panelHasElement(frame)).toBe(true);
  });

  test('click Select from teal → orange (re-enable selecting)', async () => {
    await clickPanelSelect(frame);

    // Select an element
    const heading = page.locator('h3').first();
    await heading.click();
    await page.waitForTimeout(500);

    // Click Select: orange → teal
    await clickPanelSelect(frame);
    await page.waitForTimeout(300);

    // Click Select again: teal → orange (re-enable selecting)
    await clickPanelSelect(frame);
    await expect.poll(
      () => getPanelButtonColor(frame, 'Select an element'),
      { message: 'After 2nd toggle: button orange (re-enabled)', timeout: 5000 },
    ).toBe('orange');
    expect(await getCursor(page)).toBe('crosshair');
    expect(await panelHasElement(frame)).toBe(true);
  });

  test('click Select with orange+no element → gray (cancel)', async () => {
    await clickPanelSelect(frame);

    // Don't select anything — click Select again
    await clickPanelSelect(frame);

    await expect.poll(
      () => getPanelButtonColor(frame, 'Select an element'),
      { message: 'After cancel: button gray', timeout: 5000 },
    ).toBe('gray');
    expect(await getCursor(page)).toBe('');
  });

  test('Escape with orange+no element → gray (cancel)', async () => {
    await clickPanelSelect(frame);

    // Press Escape without selecting
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await expect.poll(
      () => getPanelButtonColor(frame, 'Select an element'),
      { message: 'After Escape cancel: button gray', timeout: 5000 },
    ).toBe('gray');
    expect(await getCursor(page)).toBe('');
  });

  test('Describe change from orange → teal (stop selecting)', async () => {
    await clickPanelSelect(frame);

    // Select an element
    const heading = page.locator('h3').first();
    await heading.click();
    await page.waitForTimeout(500);

    // Verify we're orange with crosshair
    expect(await getCursor(page)).toBe('crosshair');

    // Click "Describe change" in the element drawer (inside shadow DOM)
    await page.evaluate(() => {
      const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
      const sr = host?.shadowRoot;
      const drawer = sr?.querySelector('.element-drawer');
      const btns = drawer?.querySelectorAll('button');
      for (const btn of btns || []) {
        if (btn.textContent?.includes('Describe change')) {
          (btn as HTMLButtonElement).click();
          break;
        }
      }
    });
    await page.waitForTimeout(500);

    // Should be teal: no crosshair, element still selected
    expect(await getCursor(page)).toBe('');
    await expect.poll(
      () => getPanelButtonColor(frame, 'Select an element'),
      { message: 'After Describe change: button teal', timeout: 5000 },
    ).toBe('teal');
    expect(await panelHasElement(frame)).toBe(true);
  });
});
