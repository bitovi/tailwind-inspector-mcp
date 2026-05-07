import { test, expect, type Page, type Frame } from '@playwright/test';
import {
  clickToggleButton,
  getPanelFrame,
  waitForPanelReady,
  clickInsert,
  ensureStorybookConnected,
} from './helpers';

/**
 * Switches to Insert mode and waits for component rows to load.
 * Returns the (possibly re-acquired) panel frame, since clicking Insert
 * may cause the overlay to recreate the iframe on slow CI loads.
 */
async function openInsertTab(page: Page, frame: Frame): Promise<Frame> {
  console.log('[drag-to-slot] openInsertTab: clicking Insert button');
  await clickInsert(frame);

  // Re-acquire frame — on slow CI the iframe may reload after clickInsert
  console.log('[drag-to-slot] openInsertTab: re-acquiring panel frame');
  const freshFrame = await getPanelFrame(page);

  console.log('[drag-to-slot] openInsertTab: ensuring Storybook connected');
  await ensureStorybookConnected(freshFrame);

  // Wait for component rows to render (they appear after Storybook data arrives)
  console.log('[drag-to-slot] openInsertTab: waiting for component rows');
  await freshFrame.waitForFunction(() => {
    const rows = document.querySelectorAll('[data-testid^="component-row-"]');
    return rows.length > 0;
  }, { timeout: 15_000, polling: 500 });
  console.log('[drag-to-slot] openInsertTab: done');
  return freshFrame;
}

/**
 * Finds a component row by name in the panel and returns its bounding box
 * relative to the panel iframe.
 */
async function getComponentRowBox(frame: Frame, componentName: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const row = frame.locator(`[data-testid="component-row-${componentName}"]`).first();
  await row.waitFor({ timeout: 15000 });
  const box = await row.boundingBox();
  if (!box) throw new Error(`Component row "${componentName}" has no bounding box`);
  return box;
}

/**
 * Finds the drag handle (thumbnail) for a component by name.
 */
async function getDragHandleBox(frame: Frame, componentName: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const handle = frame.locator(`[data-testid="drag-handle-${componentName}"]`).first();
  await handle.waitFor({ timeout: 15000 });
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Drag handle for "${componentName}" not found`);
  return box;
}

/**
 * Checks whether a component row is expanded (has the props/customize drawer open).
 */
async function isComponentExpanded(frame: Frame, componentName: string): Promise<boolean> {
  const row = frame.locator(`[data-testid="component-row-${componentName}"]`).first();
  const collapseBtn = row.locator('button', { hasText: '▲ Collapse' });
  return (await collapseBtn.count()) > 0;
}

/**
 * Checks if a slot field shows the "Drop here" placeholder (is a drop target).
 */
async function slotFieldHasDropHint(frame: Frame, propName: string): Promise<boolean> {
  const field = frame.locator(`label`).filter({ hasText: propName }).first();
  const input = field.locator('input');
  const placeholder = await input.getAttribute('placeholder');
  return placeholder === 'Drop here';
}

/**
 * Checks if a slot field is filled with a component.
 */
async function slotFieldIsFilled(frame: Frame, componentName: string, propName: string): Promise<boolean> {
  const row = frame.locator(`[data-testid="component-row-${componentName}"]`).first();
  const drawer = row.locator('[class*="border-t-0"]');
  // Look for the component name chip inside the prop's field
  const propLabel = drawer.locator(`label`).filter({ hasText: propName });
  const chip = propLabel.locator('span', { hasText: new RegExp(`^\\w+$`) }).first();
  return (await chip.count()) > 0;
}

// ── Tests ────────────────────────────────────────────────────────────────

test.describe('Drag component to slot prop', () => {
  // beforeEach navigates, opens panel, and waits for Storybook component data —
  // in CI that can take 60s+ on cold start (panel load + Storybook data fetch).
  test.describe.configure({ timeout: 180_000 });

  let page: Page;
  let frame: Frame;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    console.log('[drag-to-slot] beforeEach: navigating to /');
    await page.goto('/');
    console.log('[drag-to-slot] beforeEach: clicking toggle button');
    await clickToggleButton(page);
    console.log('[drag-to-slot] beforeEach: getting panel frame');
    frame = await getPanelFrame(page);
    console.log('[drag-to-slot] beforeEach: waiting for panel ready');
    await waitForPanelReady(frame);
    console.log('[drag-to-slot] beforeEach: opening Insert tab');
    frame = await openInsertTab(page, frame);
    console.log('[drag-to-slot] beforeEach: complete');
  });

  test('hover over collapsed component row for 500ms expands it during drag', async () => {
    // boundingBox() on frame locators returns main-frame viewport coordinates
    const iconHandle = await getDragHandleBox(frame, 'Icon');
    const startX = iconHandle.x + iconHandle.width / 2;
    const startY = iconHandle.y + iconHandle.height / 2;

    const buttonRow = await getComponentRowBox(frame, 'Button');
    const targetX = buttonRow.x + buttonRow.width / 2;
    const targetY = buttonRow.y + buttonRow.height / 2;

    // Verify Button is initially collapsed
    expect(await isComponentExpanded(frame, 'Button')).toBe(false);

    // Start drag from Icon thumbnail (page.mouse dispatches trusted events
    // that the browser routes to the iframe and support setPointerCapture)
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Move past threshold (5px)
    await page.mouse.move(startX + 10, startY + 10, { steps: 3 });

    // Move to Button row
    await page.mouse.move(targetX, targetY, { steps: 5 });

    // Wait for hover-to-expand (500ms dwell + buffer)
    await page.waitForTimeout(800);

    // Button should now be expanded
    expect(await isComponentExpanded(frame, 'Button')).toBe(true);

    // Cancel the drag
    await page.keyboard.press('Escape');
  });

  test('drop Icon on Button leftIcon slot field fills the slot', async () => {
    const iconHandle = await getDragHandleBox(frame, 'Icon');
    const startX = iconHandle.x + iconHandle.width / 2;
    const startY = iconHandle.y + iconHandle.height / 2;

    const buttonRow = await getComponentRowBox(frame, 'Button');
    const buttonMidX = buttonRow.x + buttonRow.width / 2;
    const buttonMidY = buttonRow.y + buttonRow.height / 2;

    // Start drag from Icon thumbnail
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 10, startY + 10, { steps: 3 });

    // Move to Button row and wait for expand
    await page.mouse.move(buttonMidX, buttonMidY, { steps: 5 });
    await page.waitForTimeout(800);

    // Button should now be expanded, find the leftIcon slot field
    expect(await isComponentExpanded(frame, 'Button')).toBe(true);

    // Find the leftIcon field's input and get its position
    const leftIconLabel = frame.locator('label').filter({ hasText: 'leftIcon' }).first();
    await leftIconLabel.waitFor({ timeout: 3000 });
    const labelBox = await leftIconLabel.boundingBox();
    expect(labelBox).not.toBeNull();

    // Move to the leftIcon field (boundingBox coords are already in main-frame space)
    const slotX = labelBox!.x + labelBox!.width / 2;
    const slotY = labelBox!.y + labelBox!.height / 2;
    await page.mouse.move(slotX, slotY, { steps: 5 });

    // Small pause to let hit-testing update
    await page.waitForTimeout(100);

    // Drop
    await page.mouse.up();

    // Verify the slot field shows the Icon component
    const row = frame.locator('[data-testid="component-row-Button"]').first();
    const drawer = row.locator('[class*="border-t-0"]');
    const propArea = drawer.locator('label').filter({ hasText: 'leftIcon' }).first();
    const componentChip = propArea.locator('span').filter({ hasText: /^Icon$/ });
    await expect(componentChip).toBeVisible({ timeout: 3000 });
  });

  test('drag and release over empty space does not fill any slot', async () => {
    const iconHandle = await getDragHandleBox(frame, 'Icon');
    const startX = iconHandle.x + iconHandle.width / 2;
    const startY = iconHandle.y + iconHandle.height / 2;

    // Start drag from Icon thumbnail
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 10, startY + 10, { steps: 3 });

    // Move to empty space (top-left of panel area, away from any component)
    // Use a point inside the iframe but above the component list
    const iframeBox = await page.evaluate(() => {
      const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
      const iframe = host?.shadowRoot?.querySelector('iframe') as HTMLIFrameElement;
      if (!iframe) throw new Error('Panel iframe not found');
      const rect = iframe.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    });
    await page.mouse.move(iframeBox.x + 50, iframeBox.y + 20, { steps: 3 });
    await page.waitForTimeout(100);

    // Release
    await page.mouse.up();

    // Verify no slots were filled — Button should still be collapsed
    expect(await isComponentExpanded(frame, 'Button')).toBe(false);
  });

  test('drag over own component row does not expand it (self-drop prevention)', async () => {
    const buttonRow = await getComponentRowBox(frame, 'Button');
    const buttonHandle = await getDragHandleBox(frame, 'Button');
    const startX = buttonHandle.x + buttonHandle.width / 2;
    const startY = buttonHandle.y + buttonHandle.height / 2;

    // Start drag from Button's own thumbnail
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 10, startY + 10, { steps: 3 });

    // Hover over Button's own row
    const targetX = buttonRow.x + buttonRow.width / 2;
    const targetY = buttonRow.y + buttonRow.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 3 });

    // Wait longer than dwell time
    await page.waitForTimeout(800);

    // Should NOT expand (self-drop prevention)
    expect(await isComponentExpanded(frame, 'Button')).toBe(false);

    // Cancel
    await page.keyboard.press('Escape');
  });
});
