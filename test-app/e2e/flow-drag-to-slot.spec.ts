import { test, expect, type Page, type Frame } from '@playwright/test';
import {
  clickToggleButton,
  getPanelFrame,
  waitForPanelReady,
  clickInsert,
} from './helpers';

/**
 * Switches to the Insert/Place tab and waits for component list to load.
 */
async function openInsertTab(page: Page, frame: Frame): Promise<void> {
  await clickInsert(frame);

  // The overlay sends a WS message to switch the panel to Components tab,
  // but in CI the message may arrive late. Wait briefly, then ensure the
  // Components tab is active by clicking it directly if needed.
  await page.waitForTimeout(1000);
  const isComponentsTab = await frame.evaluate(() => {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]');
    return tab?.textContent?.trim().toLowerCase() === 'components';
  }).catch(() => false);

  if (!isComponentsTab) {
    await frame.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const componentsTab = tabs.find(t => t.textContent?.trim() === 'Components');
      if (componentsTab) (componentsTab as HTMLElement).click();
    });
    await page.waitForTimeout(500);
  }

  // If Storybook isn't auto-detected, click "Scan for Storybook" button
  await frame.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Scan for Storybook'));
    if (btn) (btn as HTMLButtonElement).click();
  }).catch(() => {});

  // Wait for at least one component row to appear (data-testid is stable)
  await frame.waitForSelector('[data-testid^="component-row-"]', { timeout: 30000 });
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
    // Get Icon's drag handle position (in-iframe coords)
    const iconHandle = await getDragHandleBox(frame, 'Icon');
    const startX = iconHandle.x + iconHandle.width / 2;
    const startY = iconHandle.y + iconHandle.height / 2;

    // Get Button's row position (in-iframe coords)
    const buttonRow = await getComponentRowBox(frame, 'Button');
    const targetX = buttonRow.x + buttonRow.width / 2;
    const targetY = buttonRow.y + buttonRow.height / 2;

    // Verify Button is initially collapsed
    expect(await isComponentExpanded(frame, 'Button')).toBe(false);

    // Dispatch pointer events directly in the iframe to interact with setPointerCapture
    await frame.evaluate(({ startX, startY, targetX, targetY }) => {
      const handle = document.querySelector('[data-testid="drag-handle-Icon"]') as HTMLElement;
      if (!handle) throw new Error('Icon drag handle not found');

      const fire = (type: string, x: number, y: number, el: HTMLElement | Document = handle) => {
        el.dispatchEvent(new PointerEvent(type, {
          clientX: x, clientY: y, screenX: x, screenY: y,
          bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1,
        }));
      };

      // pointerdown on the drag handle
      fire('pointerdown', startX, startY);
      // Move past threshold
      fire('pointermove', startX + 10, startY + 10);
      // Move to Button row
      fire('pointermove', targetX, targetY);
    }, { startX, startY, targetX, targetY });

    // Wait for hover-to-expand (500ms dwell + buffer)
    await page.waitForTimeout(800);

    // Button should now be expanded
    expect(await isComponentExpanded(frame, 'Button')).toBe(true);

    // Cancel the drag
    await frame.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
  });

  test('drop Icon on Button leftIcon slot field fills the slot', async () => {
    // Get Icon's drag handle position (in-iframe coords)
    const iconHandle = await getDragHandleBox(frame, 'Icon');
    const startX = iconHandle.x + iconHandle.width / 2;
    const startY = iconHandle.y + iconHandle.height / 2;

    // Get Button's row position (in-iframe coords)
    const buttonRow = await getComponentRowBox(frame, 'Button');
    const buttonMidX = buttonRow.x + buttonRow.width / 2;
    const buttonMidY = buttonRow.y + buttonRow.height / 2;

    // Dispatch pointer events directly in the iframe
    await frame.evaluate(({ startX, startY, buttonMidX, buttonMidY }) => {
      const handle = document.querySelector('[data-testid="drag-handle-Icon"]') as HTMLElement;
      if (!handle) throw new Error('Icon drag handle not found');

      const fire = (type: string, x: number, y: number, el: HTMLElement | Document = handle) => {
        el.dispatchEvent(new PointerEvent(type, {
          clientX: x, clientY: y, screenX: x, screenY: y,
          bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1,
        }));
      };

      // pointerdown → move past threshold → move to Button row
      fire('pointerdown', startX, startY);
      fire('pointermove', startX + 10, startY + 10);
      fire('pointermove', buttonMidX, buttonMidY);
    }, { startX, startY, buttonMidX, buttonMidY });

    // Wait for hover-to-expand
    await page.waitForTimeout(800);

    // Button should now be expanded, find the leftIcon slot field
    expect(await isComponentExpanded(frame, 'Button')).toBe(true);

    // Find the leftIcon field's input and get its position
    const leftIconLabel = frame.locator('label').filter({ hasText: 'leftIcon' }).first();
    await leftIconLabel.waitFor({ timeout: 3000 });
    const labelBox = await leftIconLabel.boundingBox();
    expect(labelBox).not.toBeNull();

    // Move to the leftIcon field, then drop
    await frame.evaluate(({ slotX, slotY }) => {
      const handle = document.querySelector('[data-testid="drag-handle-Icon"]') as HTMLElement;
      if (!handle) throw new Error('Icon drag handle not found');

      const fire = (type: string, x: number, y: number, el: HTMLElement | Document = handle) => {
        el.dispatchEvent(new PointerEvent(type, {
          clientX: x, clientY: y, screenX: x, screenY: y,
          bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1,
        }));
      };

      fire('pointermove', slotX, slotY);
      fire('pointerup', slotX, slotY);
    }, { slotX: labelBox!.x + labelBox!.width / 2, slotY: labelBox!.y + labelBox!.height / 2 });

    // Small pause to let state update
    await page.waitForTimeout(300);

    // Verify the slot field shows the Icon component
    const row = frame.locator('[data-testid="component-row-Button"]').first();
    const drawer = row.locator('[class*="border-t-0"]');
    const propArea = drawer.locator('label').filter({ hasText: 'leftIcon' }).first();
    const componentChip = propArea.locator('span', { hasText: 'Icon' });
    await expect(componentChip).toBeVisible({ timeout: 3000 });
  });

  test('drag and release over empty space does not fill any slot', async () => {
    // Get Icon's drag handle position (in-iframe coords)
    const iconHandle = await getDragHandleBox(frame, 'Icon');
    const startX = iconHandle.x + iconHandle.width / 2;
    const startY = iconHandle.y + iconHandle.height / 2;

    // Dispatch pointer events directly in the iframe
    await frame.evaluate(({ startX, startY }) => {
      const handle = document.querySelector('[data-testid="drag-handle-Icon"]') as HTMLElement;
      if (!handle) throw new Error('Icon drag handle not found');

      const fire = (type: string, x: number, y: number, el: HTMLElement | Document = handle) => {
        el.dispatchEvent(new PointerEvent(type, {
          clientX: x, clientY: y, screenX: x, screenY: y,
          bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1,
        }));
      };

      // pointerdown → move past threshold → move to empty space → release
      fire('pointerdown', startX, startY);
      fire('pointermove', startX + 10, startY + 10);
      fire('pointermove', 50, 20);
      fire('pointerup', 50, 20);
    }, { startX, startY });

    await page.waitForTimeout(100);

    // Verify no slots were filled — Button should still be collapsed
    expect(await isComponentExpanded(frame, 'Button')).toBe(false);
  });

  test('drag over own component row does not expand it (self-drop prevention)', async () => {
    // Get Button's row and drag handle positions (in-iframe coords)
    const buttonRow = await getComponentRowBox(frame, 'Button');
    const buttonHandle = await getDragHandleBox(frame, 'Button');
    const startX = buttonHandle.x + buttonHandle.width / 2;
    const startY = buttonHandle.y + buttonHandle.height / 2;
    const targetX = buttonRow.x + buttonRow.width / 2;
    const targetY = buttonRow.y + buttonRow.height / 2;

    // Dispatch pointer events directly in the iframe
    await frame.evaluate(({ startX, startY, targetX, targetY }) => {
      const handle = document.querySelector('[data-testid="drag-handle-Button"]') as HTMLElement;
      if (!handle) throw new Error('Button drag handle not found');

      const fire = (type: string, x: number, y: number, el: HTMLElement | Document = handle) => {
        el.dispatchEvent(new PointerEvent(type, {
          clientX: x, clientY: y, screenX: x, screenY: y,
          bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1,
        }));
      };

      // pointerdown → move past threshold → hover over own row
      fire('pointerdown', startX, startY);
      fire('pointermove', startX + 10, startY + 10);
      fire('pointermove', targetX, targetY);
    }, { startX, startY, targetX, targetY });

    // Wait longer than dwell time
    await page.waitForTimeout(800);

    // Should NOT expand (self-drop prevention)
    expect(await isComponentExpanded(frame, 'Button')).toBe(false);

    // Cancel
    await frame.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
  });
});
