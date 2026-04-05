import { test, expect } from '@playwright/test';
import {
  clickToggleButton,
  getPanelFrame,
  waitForPanelReady,
  clickSelectElementButton,
  waitForToolbarVisible,
  waitForToolbarHidden,
  clickToolbarButton,
  getPanelActiveTab,
} from './helpers';

test.describe('Flow E: Cross-mode switching via overlay toolbar', () => {
  test('select → element → overlay insert → point → overlay select → element', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Open panel and wait for WS
    await clickToggleButton(page);
    const frame = await getPanelFrame(page);
    await waitForPanelReady(frame);
    await page.waitForTimeout(300);

    // ── Step 1: Enter select mode via panel ──
    await clickSelectElementButton(frame);
    await page.waitForTimeout(500);

    // Verify panel is in select mode (ModeToggle select button is aria-pressed)
    const selectPressed = await frame.evaluate(() => {
      const btn = document.querySelector('button[title="Select an element"]');
      return btn?.getAttribute('aria-pressed');
    });
    expect(selectPressed).toBe('true');

    // ── Step 2: Click an element on the page ──
    const targetEl = page.locator('text=Primary').first();
    await targetEl.click();
    await page.waitForTimeout(500);

    // Verify toolbar appeared
    await waitForToolbarVisible(page);

    // Verify panel shows Design tab as active
    const tab1 = await getPanelActiveTab(frame);
    expect(tab1).toBe('design');

    // ── Step 3: Click Insert on overlay toolbar ──
    await clickToolbarButton(page, 'Insert');
    await page.waitForTimeout(500);

    // Toolbar should disappear (mode switched, element cleared)
    await waitForToolbarHidden(page);

    // Verify panel switched to Place tab
    const tab2 = await getPanelActiveTab(frame);
    expect(tab2).toBe('place');

    // Verify panel insert button is now active
    const insertPressed = await frame.evaluate(() => {
      const btn = document.querySelector('button[title="Insert to add content"]');
      return btn?.getAttribute('aria-pressed');
    });
    expect(insertPressed).toBe('true');

    // ── Step 4: Click a placement site (browse mode should be active) ──
    const insertTarget = page.locator('text=Primary').first();
    await insertTarget.click();
    await page.waitForTimeout(500);

    // After locking an insert point, the toolbar should reappear
    await waitForToolbarVisible(page);

    // ── Step 5: Click Select on overlay toolbar ──
    await clickToolbarButton(page, 'Select');
    await page.waitForTimeout(500);

    // Toolbar should disappear again (mode switched)
    await waitForToolbarHidden(page);

    // Verify panel goes back to select mode with Design tab
    const selectPressedAgain = await frame.evaluate(() => {
      const btn = document.querySelector('button[title="Select an element"]');
      return btn?.getAttribute('aria-pressed');
    });
    expect(selectPressedAgain).toBe('true');

    const tab3 = await getPanelActiveTab(frame);
    expect(tab3).toBe('design');

    // ── Step 6: Click an element again ──
    const targetEl2 = page.locator('text=Primary').first();
    await targetEl2.click();
    await page.waitForTimeout(500);

    // Toolbar should reappear
    await waitForToolbarVisible(page);

    // Panel should still show Design tab
    const tab4 = await getPanelActiveTab(frame);
    expect(tab4).toBe('design');
  });
});
