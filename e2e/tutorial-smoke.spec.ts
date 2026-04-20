import { test, expect } from '@playwright/test';
import { SECTION_TITLES, TOTAL_STEPS } from './tutorial-helpers';

test.describe('Tutorial smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.evaluate(() => localStorage.removeItem('vybit-tutorial-progress'));
    await page.reload();
    await page.waitForTimeout(2000);
  });

  test('progress counter starts at 0', async ({ page }) => {
    await expect(page.locator(`text=0 of ${TOTAL_STEPS} completed`)).toBeVisible();
  });

  test('Mark complete updates progress counter', async ({ page }) => {
    const section = page.locator('section').filter({ has: page.locator(`h2:has-text("${SECTION_TITLES[1]}")`) });
    await section.getByRole('button', { name: 'Mark complete' }).click();
    await expect(page.locator(`text=1 of ${TOTAL_STEPS} completed`)).toBeVisible({ timeout: 5000 });
  });

  test('Start Over resets all progress', async ({ page }) => {
    // Mark a few steps complete
    for (let step = 1; step <= 3; step++) {
      const section = page.locator('section').filter({ has: page.locator(`h2:has-text("${SECTION_TITLES[step]}")`) });
      const btn = section.getByRole('button', { name: 'Mark complete' });
      if (await btn.isVisible()) await btn.click();
    }
    await expect(page.locator(`text=3 of ${TOTAL_STEPS} completed`)).toBeVisible({ timeout: 5000 });

    // Click Start Over
    await page.getByRole('button', { name: /Start Over/ }).click();
    await expect(page.locator(`text=0 of ${TOTAL_STEPS} completed`)).toBeVisible({ timeout: 5000 });

    // Verify localStorage is cleared
    const progress = await page.evaluate(() => localStorage.getItem('vybit-tutorial-progress'));
    expect(JSON.parse(progress ?? '[]')).toEqual([]);
  });

  test('progress persists across page reload', async ({ page }) => {
    // Mark step 1 complete
    const section = page.locator('section').filter({ has: page.locator(`h2:has-text("${SECTION_TITLES[1]}")`) });
    await section.getByRole('button', { name: 'Mark complete' }).click();
    await expect(page.locator(`text=1 of ${TOTAL_STEPS} completed`)).toBeVisible({ timeout: 5000 });

    // Reload and verify
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.locator(`text=1 of ${TOTAL_STEPS} completed`)).toBeVisible({ timeout: 5000 });
  });

  test('completion banner appears when all steps done', async ({ page }) => {
    // Mark all steps complete via fallback buttons
    for (let step = 1; step <= TOTAL_STEPS; step++) {
      const section = page.locator('section').filter({ has: page.locator(`h2:has-text("${SECTION_TITLES[step]}")`) });
      const btn = section.getByRole('button', { name: 'Mark complete' });
      if (await btn.isVisible()) await btn.click();
      await page.waitForTimeout(200);
    }

    await expect(page.locator('text=You did it!')).toBeVisible({ timeout: 10_000 });
  });
});
