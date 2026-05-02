import { test, expect, type Page, type Frame } from '@playwright/test';
import {
  clickToggleButton,
  getPanelFrame,
  waitForPanelReady,
  clickInsert,
} from './helpers';

/**
 * Gets the panel iframe's bounding box in page coordinates.
 * Required because page.mouse operates in top-level page coords.
 */
async function getIframePageBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  return page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const iframe = host?.shadowRoot?.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe) throw new Error('Panel iframe not found');
    const rect = iframe.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

/**
 * Switches to the Insert/Place tab and waits for component list to load.
 */
async function openInsertTab(page: Page, frame: Frame): Promise<void> {
  await clickInsert(frame);
  // Wait for at least one component row to appear
  await frame.waitForSelector('[class*="cursor-grab"]', { timeout: 15000 });
}

/**
 * Finds a component row by name in the panel and returns its bounding box
 * relative to the panel iframe.
 */
async function getComponentRowBox(frame: Frame, componentName: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const row = frame.locator(`li`).filter({ hasText: componentName }).first();
  await row.waitFor({ timeout: 5000 });
  const box = await row.boundingBox();
  if (!box) throw new Error(`Component row "${componentName}" has no bounding box`);
  return box;
}

/**
 * Finds the drag handle (thumbnail) for a component by name.
 */
async function getDragHandleBox(frame: Frame, componentName: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const row = frame.locator(`li`).filter({ hasText: componentName }).first();
  const handle = row.locator('[class*="cursor-grab"]').first();
  await handle.waitFor({ timeout: 5000 });
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Drag handle for "${componentName}" not found`);
  return box;
}

/**
 * Checks whether a component row is expanded (has the props/customize drawer open).
 */
async function isComponentExpanded(frame: Frame, componentName: string): Promise<boolean> {
  const row = frame.locator(`li`).filter({ hasText: componentName }).first();
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
  const row = frame.locator(`li`).filter({ hasText: componentName }).first();
  const drawer = row.locator('[class*="border-t-0"]');
  // Look for the component name chip inside the prop's field
  const propLabel = drawer.locator(`label`).filter({ hasText: propName });
  const chip = propLabel.locator('span', { hasText: new RegExp(`^\\w+$`) }).first();
  return (await chip.count()) > 0;
}

// ── Tests ────────────────────────────────────────────────────────────────

test.describe('Drag component to slot prop', () => {
  let page: Page;
  let frame: Frame;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await page.goto('/');
    await clickToggleButton(page);
    frame = await getPanelFrame(page);
    await waitForPanelReady(frame);
    await openInsertTab(page, frame);
  });

  test('hover over collapsed component row for 500ms expands it during drag', async () => {
    const iframeBox = await getIframePageBox(page);

    // Get Icon's drag handle position
    const iconHandle = await getDragHandleBox(frame, 'Icon');
    const startX = iframeBox.x + iconHandle.x + iconHandle.width / 2;
    const startY = iframeBox.y + iconHandle.y + iconHandle.height / 2;

    // Get Button's row position
    const buttonRow = await getComponentRowBox(frame, 'Button');
    const targetX = iframeBox.x + buttonRow.x + buttonRow.width / 2;
    const targetY = iframeBox.y + buttonRow.y + buttonRow.height / 2;

    // Verify Button is initially collapsed
    expect(await isComponentExpanded(frame, 'Button')).toBe(false);

    // Start drag from Icon thumbnail
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Move past threshold (5px)
    await page.mouse.move(startX + 10, startY + 10, { steps: 3 });

    // Move to Button row
    await page.mouse.move(targetX, targetY, { steps: 5 });

    // Wait for hover-to-expand (500ms dwell + buffer)
    await page.waitForTimeout(700);

    // Button should now be expanded
    expect(await isComponentExpanded(frame, 'Button')).toBe(true);

    // Cancel the drag
    await page.keyboard.press('Escape');
  });

  test('drop Icon on Button leftIcon slot field fills the slot', async () => {
    const iframeBox = await getIframePageBox(page);

    // Get Icon's drag handle position
    const iconHandle = await getDragHandleBox(frame, 'Icon');
    const startX = iframeBox.x + iconHandle.x + iconHandle.width / 2;
    const startY = iframeBox.y + iconHandle.y + iconHandle.height / 2;

    // Get Button's row position
    const buttonRow = await getComponentRowBox(frame, 'Button');
    const buttonMidX = iframeBox.x + buttonRow.x + buttonRow.width / 2;
    const buttonMidY = iframeBox.y + buttonRow.y + buttonRow.height / 2;

    // Start drag from Icon thumbnail
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 10, startY + 10, { steps: 3 });

    // Move to Button row and wait for expand
    await page.mouse.move(buttonMidX, buttonMidY, { steps: 5 });
    await page.waitForTimeout(700);

    // Button should now be expanded, find the leftIcon slot field
    expect(await isComponentExpanded(frame, 'Button')).toBe(true);

    // Find the leftIcon field's input and get its position
    const leftIconLabel = frame.locator('label').filter({ hasText: 'leftIcon' }).first();
    await leftIconLabel.waitFor({ timeout: 3000 });
    const labelBox = await leftIconLabel.boundingBox();
    expect(labelBox).not.toBeNull();

    // Move to the leftIcon field
    const slotX = iframeBox.x + labelBox!.x + labelBox!.width / 2;
    const slotY = iframeBox.y + labelBox!.y + labelBox!.height / 2;
    await page.mouse.move(slotX, slotY, { steps: 5 });

    // Small pause to let hit-testing update
    await page.waitForTimeout(100);

    // Drop
    await page.mouse.up();

    // Verify the slot field shows the Icon component
    // The slot should now show "Icon" text (component name) inside a chip
    const row = frame.locator('li').filter({ hasText: 'Button' }).first();
    const drawer = row.locator('[class*="border-t-0"]');
    const propArea = drawer.locator('label').filter({ hasText: 'leftIcon' }).first();
    const componentChip = propArea.locator('span', { hasText: 'Icon' });
    await expect(componentChip).toBeVisible({ timeout: 3000 });
  });

  test('drag and release over empty space does not fill any slot', async () => {
    const iframeBox = await getIframePageBox(page);

    // Get Icon's drag handle position
    const iconHandle = await getDragHandleBox(frame, 'Icon');
    const startX = iframeBox.x + iconHandle.x + iconHandle.width / 2;
    const startY = iframeBox.y + iconHandle.y + iconHandle.height / 2;

    // Start drag from Icon thumbnail
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 10, startY + 10, { steps: 3 });

    // Move to empty space (top of panel, away from any component)
    await page.mouse.move(iframeBox.x + 50, iframeBox.y + 20, { steps: 3 });
    await page.waitForTimeout(100);

    // Release
    await page.mouse.up();

    // Verify no slots were filled — Button should still be collapsed
    expect(await isComponentExpanded(frame, 'Button')).toBe(false);
  });

  test('drag over own component row does not expand it (self-drop prevention)', async () => {
    const iframeBox = await getIframePageBox(page);

    // First expand Button manually to check slots
    const buttonRow = await getComponentRowBox(frame, 'Button');

    // Get Button's drag handle
    const buttonHandle = await getDragHandleBox(frame, 'Button');
    const startX = iframeBox.x + buttonHandle.x + buttonHandle.width / 2;
    const startY = iframeBox.y + buttonHandle.y + buttonHandle.height / 2;

    // Start drag from Button's own thumbnail
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 10, startY + 10, { steps: 3 });

    // Hover over Button's own row
    const targetX = iframeBox.x + buttonRow.x + buttonRow.width / 2;
    const targetY = iframeBox.y + buttonRow.y + buttonRow.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 3 });

    // Wait longer than dwell time
    await page.waitForTimeout(700);

    // Should NOT expand (self-drop prevention)
    expect(await isComponentExpanded(frame, 'Button')).toBe(false);

    // Cancel
    await page.keyboard.press('Escape');
  });
});
