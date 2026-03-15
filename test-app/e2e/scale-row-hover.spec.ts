import { test, expect, type Frame, type Page } from '@playwright/test';

/** Get the panel iframe's bounding box in main-page coordinates. */
async function getIframePageBox(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const iframe = host.shadowRoot!.querySelector('iframe') as HTMLIFrameElement;
    const rect = iframe.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

/** Wait for the panel iframe frame object. */
async function getPanelFrame(page: Page): Promise<Frame> {
  let frame: Frame | null = null;
  for (let i = 0; i < 20; i++) {
    frame = page.frames().find(f => f.url().includes('/panel')) || null;
    if (frame) break;
    await page.waitForTimeout(250);
  }
  if (!frame) throw new Error('Panel frame not found');
  return frame;
}

/** Count chips that visually appear highlighted (checks computed/animated colour). */
async function getVisuallyHighlightedChipCount(frame: Frame): Promise<number> {
  return frame.evaluate(() => {
    const ACTIVE_COLOR = 'rgb(0, 132, 139)';
    return Array.from(document.querySelectorAll('div'))
      .filter(el => (el as HTMLElement).className.includes('cursor-pointer'))
      .filter(el => window.getComputedStyle(el as HTMLElement).color === ACTIVE_COLOR)
      .length;
  });
}

/** Common setup: activate inspect, click Primary button, open the text-size scrubber dropdown. */
async function setupScaleRow(page: Page): Promise<{ frame: Frame; iframeBox: { x: number; y: number; width: number; height: number } }> {
  await page.goto('/');
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const btn = host.shadowRoot!.querySelector('.toggle-btn') as HTMLButtonElement;
    btn.click();
  });

  const frame = await getPanelFrame(page);
  await frame.waitForFunction(
    () => !document.body.textContent?.includes('Waiting for connection'),
    { timeout: 10000 },
  );

  await page.waitForTimeout(300);

  await page.locator('button:has-text("Primary")').first().click();

  const scrubber = frame.locator('.cursor-ew-resize').filter({ hasText: 'text-sm' }).first();
  await scrubber.waitFor({ timeout: 8000 });
  await scrubber.click();
  await page.waitForTimeout(300);

  const iframeBox = await getIframePageBox(page);
  return { frame, iframeBox };
}

test('only the active scrubber option stays highlighted after sweeping the dropdown and leaving', async ({ page }) => {
  const { frame, iframeBox } = await setupScaleRow(page);

  const startChipBox = await frame.getByText('text-xs', { exact: true }).boundingBox();
  expect(startChipBox).toBeTruthy();

  const startX = iframeBox.x + startChipBox!.x + startChipBox!.width / 2;
  const startY = iframeBox.y + startChipBox!.y + startChipBox!.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.move(startX, startY + 220, { steps: 20 });

  // Move the mouse outside the panel entirely
  await page.mouse.move(200, 400, { steps: 10 });
  await page.waitForTimeout(300);

  expect(await getVisuallyHighlightedChipCount(frame)).toBe(1);
});

test('at most one scrubber option appears visually highlighted during mouse sweep', async ({ page }) => {
  const { frame, iframeBox } = await setupScaleRow(page);

  const startChipBox = await frame.getByText('text-xs', { exact: true }).boundingBox();
  expect(startChipBox).toBeTruthy();

  const startX = iframeBox.x + startChipBox!.x + startChipBox!.width / 2;
  const startY = iframeBox.y + startChipBox!.y + startChipBox!.height / 2;

  // Move step-by-step and after each step wait one animation frame,
  // then count how many chips are VISUALLY green (catches CSS transition trails).
  const totalSteps = 30;
  let maxHighlighted = 0;
  for (let i = 0; i <= totalSteps; i++) {
    await page.mouse.move(startX + (i / totalSteps) * 400, startY);
    const count = await frame.evaluate(() => {
      return new Promise<number>((resolve) => {
        requestAnimationFrame(() => {
          const ACTIVE_COLOR = 'rgb(0, 132, 139)';
          const n = Array.from(document.querySelectorAll('div'))
            .filter(el => (el as HTMLElement).className.includes('cursor-pointer'))
            .filter(el => window.getComputedStyle(el as HTMLElement).color === ACTIVE_COLOR)
            .length;
          resolve(n);
        });
      });
    });
    if (count > maxHighlighted) maxHighlighted = count;
  }

  expect(maxHighlighted).toBeLessThanOrEqual(1);
});

test('only the active scrubber option stays highlighted when mouse exits the iframe', async ({ page }) => {
  const { frame, iframeBox } = await setupScaleRow(page);

  const startChipBox = await frame.getByText('text-xs', { exact: true }).boundingBox();
  expect(startChipBox).toBeTruthy();

  const chipX = iframeBox.x + startChipBox!.x + startChipBox!.width / 2;
  const chipY = iframeBox.y + startChipBox!.y + startChipBox!.height / 2;

  await frame.getByText('text-xs', { exact: true }).hover();
  await page.waitForTimeout(100);
  expect(await getVisuallyHighlightedChipCount(frame)).toBe(1);

  // Now use raw page mouse coordinates to exit the iframe to the main page.
  // This simulates the user's mouse leaving the iframe boundary without a
  // mouseleave event firing on any element inside the iframe.
  await page.mouse.move(chipX, chipY); // sync Playwright's mouse position
  await page.mouse.move(200, 400, { steps: 5 });
  await page.waitForTimeout(300);

  expect(await getVisuallyHighlightedChipCount(frame)).toBe(1);
});
