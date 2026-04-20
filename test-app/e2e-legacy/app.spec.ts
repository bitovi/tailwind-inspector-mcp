import { test, expect } from '@playwright/test';

test.describe('Test App', () => {
  test('loads the page with header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toContainText('VyBit Interactive Tutorial');
  });

  test('renders all tutorial sections', async ({ page }) => {
    await page.goto('/');
    // 11 tutorial sections — each is a <section> with rounded-lg shadow-sm border
    const sections = page.locator('section.rounded-lg.shadow-sm.border');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(11);
  });

  test('renders all Button instances', async ({ page }) => {
    await page.goto('/');
    // Tutorial page has many buttons (Mark complete, Assign, Close Issue, Refresh Invoice, etc.)
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('renders all Badge instances', async ({ page }) => {
    await page.goto('/');
    const badges = page.locator('.rounded-full.text-xs.font-medium');
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
