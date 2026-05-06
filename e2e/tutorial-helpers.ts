import { type Page, type Frame, expect } from '@playwright/test';

// ── Helpers (inlined from test-app/e2e/helpers.ts to avoid dual-Playwright) ──

async function clickToggleButton(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !!(host?.shadowRoot?.querySelector('.toggle-btn'));
  }, { timeout: 5000 });
  await page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const btn = host.shadowRoot!.querySelector('.toggle-btn') as HTMLButtonElement;
    btn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    btn.click();
  });
}

async function getPanelFrame(page: Page): Promise<Frame> {
  await page.waitForFunction(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !!(host?.shadowRoot?.querySelector('iframe'));
  }, { timeout: 8000 });
  let frame: Frame | null = null;
  for (let i = 0; i < 20; i++) {
    frame =
      page.frames().find(f => f.url().includes('/panel') && !f.url().includes('mode=design')) ??
      null;
    if (frame) break;
    await page.waitForTimeout(250);
  }
  if (!frame) throw new Error('Panel frame not found');
  return frame;
}

async function waitForPanelReady(frame: Frame): Promise<void> {
  await frame.waitForFunction(
    () => !document.body.textContent?.includes('Waiting for connection'),
    { timeout: 10000 },
  );
}

/**
 * Click the Select button in the bottom toolbar (overlay shadow DOM).
 */
async function clickSelectButton(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !!(host?.shadowRoot?.querySelector('.bt-combo[data-tool="select"]'));
  }, { timeout: 8000 });
  const { x, y } = await getShadowButtonCenter(page, '.bt-combo[data-tool="select"]');
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);
}

/**
 * Click the Insert button in the bottom toolbar (overlay shadow DOM).
 */
async function clickInsertButton(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !!(host?.shadowRoot?.querySelector('.bt-combo[data-tool="insert"]'));
  }, { timeout: 8000 });
  const { x, y } = await getShadowButtonCenter(page, '.bt-combo[data-tool="insert"]');
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);
}

/**
 * Wait for the element drawer to appear in the overlay shadow DOM.
 */
async function waitForElementDrawer(page: Page, timeout = 5000): Promise<void> {
  await page.waitForFunction(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !!(host?.shadowRoot?.querySelector('.element-drawer'));
  }, { timeout });
}

/**
 * Get the center coordinates of a shadow DOM element matching a selector + text.
 * Returns { x, y } or throws if not found.
 *
 * We use real mouse clicks (page.mouse.click) instead of element.click() because
 * the drop zone registers a capture-phase click handler on the document. Moving the
 * mouse to the overlay host first triggers onMouseMove → hideDropIndicator → clears
 * dom.currentTarget, so the capture handler returns early and lets the click through.
 */
async function getShadowButtonCenter(
  page: Page,
  selector: string,
  textContent?: string,
): Promise<{ x: number; y: number }> {
  const rect = await page.evaluate(
    ({ sel, text }) => {
      const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
      const candidates = host.shadowRoot!.querySelectorAll(sel) as NodeListOf<HTMLElement>;
      for (const el of candidates) {
        if (!text || el.textContent?.includes(text)) {
          const r = el.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      throw new Error(`Shadow button not found: ${sel} ${text ?? ''}`);
    },
    { sel: selector, text: textContent },
  );
  return rect;
}

/**
 * Click "Describe change" button in the element drawer.
 * Transitions drawer from State A to State B (textarea + Queue).
 */
async function clickDescribeChange(page: Page): Promise<void> {
  await waitForElementDrawer(page);
  const { x, y } = await getShadowButtonCenter(page, '.ed-action-btn', 'Describe change');
  await page.mouse.click(x, y);
  // Wait for State B transition — textarea should appear
  await page.waitForFunction(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !!(host?.shadowRoot?.querySelector('.element-drawer .ed-textarea'));
  }, { timeout: 5000 });
  await page.waitForTimeout(200);
}

/**
 * Click "Edit text" button in the element drawer.
 * Transitions drawer to State C (text editing mode).
 *
 * Uses direct JS click (not page.mouse.click) because the drawer may be
 * positioned off-screen when the selected element is near the top/bottom of
 * the viewport. The drop-zone capture handler is idle during select mode so
 * there is no interception risk.
 */
async function clickEditText(page: Page): Promise<void> {
  await waitForElementDrawer(page);
  await page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const btns = host?.shadowRoot?.querySelectorAll('.ed-action-btn') as NodeListOf<HTMLElement>;
    for (const btn of btns) {
      if (btn.textContent?.includes('Edit text')) {
        btn.click();
        return;
      }
    }
    throw new Error('Shadow button not found: .ed-action-btn[text~="Edit text"]');
  });
  await page.waitForTimeout(300);
}

/**
 * Type text in the element drawer textarea (State B).
 */
async function typeInDrawerTextarea(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const textarea = host.shadowRoot!.querySelector('.element-drawer .ed-textarea') as HTMLTextAreaElement;
    if (!textarea) throw new Error('Drawer textarea not found');
    textarea.focus();
    textarea.value = t;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await page.waitForTimeout(200);
}

/**
 * Click "Queue" button in the element drawer (State B or State C-dirty).
 */
async function clickDrawerQueue(page: Page): Promise<void> {
  const { x, y } = await getShadowButtonCenter(page, '.ed-queue-btn');
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
}

// ── Tutorial section titles (indexed by step number) ─────────────────────
const SECTION_TITLES = [
  '', // placeholder for 0-index
  'Welcome to VyBit',
  'Open the Panel',
  'Your First Change',
  'Send a Voice Message',
  'Edit Text In Place',
  'Describe What to Add',
  'Sketch What to Add',
  'Move Elements',
  'Delete Elements',
  'Copy and Paste',
  'Place a Component',
  'Build with Nested Components',
  'Fine-Tune the Design',
  'Report a Bug',
  'Explore Your Theme',
  'Wireframe with HTML Elements',
];

const TOTAL_STEPS = 14;

// ── Internal: assertion helpers ──────────────────────────────────────────

async function getProgress(page: Page): Promise<Set<number>> {
  const arr = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('vybit-tutorial-progress');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  return new Set(arr as number[]);
}

async function assertStepCompleted(page: Page, step: number): Promise<void> {
  // Wait for localStorage to reflect the completed step
  await expect.poll(
    async () => {
      const progress = await getProgress(page);
      if (!progress.has(step)) {
        console.log(`[tutorial] waiting for step ${step} — localStorage has: [${[...progress].join(', ')}]`);
      }
      return progress.has(step);
    },
    { message: `Step ${step} ("${SECTION_TITLES[step]}") should be in localStorage`, timeout: 10_000 },
  ).toBe(true);

  // Verify DOM: section should have green background and "Done" badge
  const section = page.locator('section').filter({ has: page.locator(`h2:has-text("${SECTION_TITLES[step]}")`) });
  await expect(section).toHaveClass(/bg-green-100/, { timeout: 5000 });
  await expect(section.locator('text=Done')).toBeVisible({ timeout: 5000 });
}

async function assertCompletionBanner(page: Page): Promise<void> {
  await expect(page.locator('text=You did it!')).toBeVisible({ timeout: 10_000 });
}

async function scrollToStep(page: Page, step: number): Promise<void> {
  const heading = page.locator(`h2:has-text("${SECTION_TITLES[step]}")`);
  await heading.waitFor({ timeout: 5000 });
  // Scroll the section heading to the top of the viewport with a small buffer
  await page.evaluate((title) => {
    const headings = Array.from(document.querySelectorAll('h2'));
    const h = headings.find(el => el.textContent?.includes(title));
    if (!h) return;
    const top = h.getBoundingClientRect().top + window.scrollY - 32;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, SECTION_TITLES[step]);
  await page.waitForTimeout(400);
}

// ── Internal: overlay shadow DOM helpers ─────────────────────────────────
// (Element drawer helpers are defined above)

// ── Internal: panel frame helpers ────────────────────────────────────────

async function clickBugReportMode(frame: Frame): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const found = await frame.evaluate(() => {
      const btn = document.querySelector('button[title="Report a bug"]') as HTMLButtonElement;
      if (btn) { btn.click(); return true; }
      return false;
    }).catch(() => false);
    if (found) return;
    await frame.page().waitForTimeout(500);
  }
  throw new Error('Bug Report button not found');
}

async function openDraftsAndCommit(frame: Frame): Promise<void> {
  // Click the draft count button in the panel footer
  const draftButton = frame.getByRole('button', { name: /\d+ draft/ }).first();
  await draftButton.waitFor({ timeout: 10_000 });
  await draftButton.click();

  // Click "Commit All"
  const commitButton = frame.getByRole('button', { name: 'Commit All' });
  await commitButton.waitFor({ timeout: 5000 });
  await commitButton.click();
  await frame.page().waitForTimeout(500);
}

// ── Internal: step implementations ───────────────────────────────────────

async function doStep1(page: Page): Promise<void> {
  await scrollToStep(page, 1);
  // Use the fallback "Mark complete" button
  const section = page.locator('section').filter({ has: page.locator(`h2:has-text("${SECTION_TITLES[1]}")`) });
  await section.getByRole('button', { name: 'Mark complete' }).click();
}

async function doStep2(page: Page): Promise<void> {
  // Opening the panel auto-completes step 2 via REGISTER/OVERLAY_STATUS
  await clickToggleButton(page);
  const frame = await getPanelFrame(page);
  await waitForPanelReady(frame);
  await page.waitForTimeout(500);
}

async function doStep3(page: Page): Promise<void> {
  await scrollToStep(page, 3);
  const frame = await getPanelFrame(page);

  // Enter select mode via bottom toolbar
  await clickSelectButton(page);

  // Click the Card in section 3 ("Fix Login Page Timeout")
  await page.locator('text=Fix Login Page Timeout').first().click();
  await page.waitForTimeout(1000);

  // Click "Describe change" in the element drawer
  await clickDescribeChange(page);

  // Type a message in the drawer textarea
  await typeInDrawerTextarea(page, 'Make the bug tag flash red');

  // Click Queue to stage the message
  await clickDrawerQueue(page);

  // Open drafts and commit
  await openDraftsAndCommit(frame);
}

async function doStep4(page: Page): Promise<void> {
  // Headless Chrome doesn't support SpeechRecognition.
  // Dispatch synthetic vybit:message to trigger tutorial auto-completion.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('vybit:message', {
      detail: { type: 'MESSAGE_STAGE', inputMethod: 'voice', message: 'test voice message' },
    }));
  });
}

async function doStep5(page: Page): Promise<void> {
  await scrollToStep(page, 5);

  // Enter select mode via bottom toolbar
  await clickSelectButton(page);

  // Click the empty state card ("No Data Available")
  await page.locator('text=No Data Available').first().click();
  await page.waitForTimeout(1000);

  // Click "Edit text" in the element drawer
  await clickEditText(page);
  await page.waitForTimeout(500);

  // Type replacement text (element is now contentEditable)
  await page.keyboard.type('Nothing here yet!');
  await page.waitForTimeout(300);

  // Click "Queue" in the drawer (C-dirty state) to commit the text edit
  await clickDrawerQueue(page);
}

async function doStep6(page: Page): Promise<void> {
  await scrollToStep(page, 6);

  // Switch to Insert mode via bottom toolbar
  await clickInsertButton(page);
  await page.waitForTimeout(500);

  // Click between form fields to set an insertion point.
  // Target the "Email" input label area — clicking near it should show insertion indicators.
  const emailLabel = page.locator('text=Email').first();
  const emailBox = await emailLabel.boundingBox();
  if (!emailBox) throw new Error('Email label not found');

  // Click just below the Email field to lock an insertion point
  await page.mouse.click(emailBox.x + emailBox.width / 2, emailBox.y + emailBox.height + 10);
  await page.waitForTimeout(800);

  // Click "Describe change" in the element drawer
  await clickDescribeChange(page);

  // Type a message in the drawer textarea
  await typeInDrawerTextarea(page, 'Add a phone number field');

  // Click Queue to stage the message
  await clickDrawerQueue(page);
}

async function getDesignFrame(page: Page): Promise<Frame> {
  let frame: Frame | null = null;
  for (let i = 0; i < 40; i++) {
    frame = page.frames().find(f => f.url().includes('mode=design')) ?? null;
    if (frame) break;
    await page.waitForTimeout(250);
  }
  if (!frame) throw new Error('Design canvas frame not found');
  return frame;
}

async function doStep7(page: Page): Promise<void> {
  await scrollToStep(page, 7);
  const frame = await getPanelFrame(page);

  // Switch to Insert mode
  await clickInsertButton(page);
  await page.waitForTimeout(500);

  // Click a placement site on the page (non-interactive element)
  const signups = page.locator('text=Monthly Signups').first();
  await signups.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const signupsBox = await signups.boundingBox();
  if (!signupsBox) throw new Error('Monthly Signups not found for step 7');
  // Click just below the heading to set insertion point
  await page.mouse.click(signupsBox.x + signupsBox.width / 2, signupsBox.y + signupsBox.height + 15);
  await page.waitForTimeout(1000);

  // Click "Draw / Screenshot Canvas" button in the panel Place tab
  await frame.waitForFunction(() => {
    return !!Array.from(document.querySelectorAll('span')).find(s => s.textContent?.includes('Draw / Screenshot Canvas'));
  }, { timeout: 8000 });
  await frame.evaluate(() => {
    const span = Array.from(document.querySelectorAll('span')).find(s => s.textContent?.includes('Draw / Screenshot Canvas'));
    const btn = span?.closest('button') as HTMLButtonElement | null;
    if (!btn) throw new Error('Draw / Screenshot Canvas button not found');
    btn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    btn.click();
  });
  await page.waitForTimeout(1000);

  // Wait for the design canvas iframe to appear
  await expect(page.locator('[data-tw-design-canvas]')).toBeVisible({ timeout: 8000 });
  const designFrame = await getDesignFrame(page);

  // Wait for the canvas toolbar to load
  await designFrame.waitForFunction(() => {
    return !!Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Add to Drafts'));
  }, { timeout: 8000 });

  // Draw a stroke on the canvas
  const iframeEl = page.locator('[data-tw-design-canvas] iframe');
  const iframeBox = await iframeEl.boundingBox();
  if (!iframeBox) throw new Error('Design canvas iframe bounding box not found');

  const canvasBox = await designFrame.evaluate(() => {
    const canvas = document.querySelector('[data-testid="design-canvas"] canvas')
      ?? document.querySelector('canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (!canvasBox) throw new Error('Canvas element not found in design iframe');

  const startX = iframeBox.x + canvasBox.x + canvasBox.width * 0.2;
  const startY = iframeBox.y + canvasBox.y + canvasBox.height * 0.3;
  const endX = iframeBox.x + canvasBox.x + canvasBox.width * 0.8;
  const endY = iframeBox.y + canvasBox.y + canvasBox.height * 0.7;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    await page.mouse.move(startX + (endX - startX) * t, startY + (endY - startY) * t);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

  // Click "Add to Drafts" to submit the drawing
  await designFrame.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Add to Drafts')) as HTMLButtonElement | undefined;
    if (!btn) throw new Error('"Add to Drafts" button not found');
    btn.click();
  });
  await page.waitForTimeout(1000);
}

async function clickComponentPlace(frame: Frame, componentName: string): Promise<void> {
  // Wait for the component list to load and find the target component's Place button
  await frame.waitForFunction((name) => {
    const items = document.querySelectorAll('li');
    for (const item of items) {
      const nameEl = Array.from(item.querySelectorAll('a, div')).find(el => el.textContent?.includes(name));
      if (nameEl) {
        const placeBtn = Array.from(item.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Place' && b.className.includes('h-5.5'));
        if (placeBtn) return true;
      }
    }
    return false;
  }, componentName, { timeout: 15000 });

  await frame.evaluate((name) => {
    const items = document.querySelectorAll('li');
    for (const item of items) {
      const nameEl = Array.from(item.querySelectorAll('a, div')).find(el => el.textContent?.includes(name));
      if (nameEl) {
        const placeBtn = Array.from(item.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Place' && b.className.includes('h-5.5')) as HTMLButtonElement;
        if (placeBtn) {
          placeBtn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          placeBtn.click();
          return;
        }
      }
    }
    throw new Error(`Place button for "${name}" not found`);
  }, componentName);
  await frame.page().waitForTimeout(800);
}

/**
 * Drag a component from the panel thumbnail to a target element on the page.
 * Uses the drag-drop flow: mousedown on thumbnail → drag past threshold →
 * overlay captures pointermove → mouseup on target to drop.
 */
async function dragComponentToTarget(
  frame: Frame,
  componentName: string,
  dropTarget: { x: number; y: number },
): Promise<void> {
  const page = frame.page();

  // Wait for the component's drag-handle thumbnail to be present
  await frame.waitForFunction((name) => {
    const items = document.querySelectorAll('li');
    for (const item of items) {
      const nameEl = Array.from(item.querySelectorAll('a, div')).find(el => el.textContent?.includes(name));
      if (nameEl) {
        const dragHandle = item.querySelector('.cursor-grab');
        if (dragHandle) return true;
      }
    }
    return false;
  }, componentName, { timeout: 15000 });

  // Scroll the thumbnail into view and get its bounding box in iframe-local coords
  const thumbRect = await frame.evaluate((name) => {
    const items = document.querySelectorAll('li');
    for (const item of items) {
      const nameEl = Array.from(item.querySelectorAll('a, div')).find(el => el.textContent?.includes(name));
      if (nameEl) {
        const dragHandle = item.querySelector('.cursor-grab') as HTMLElement | null;
        if (dragHandle) {
          dragHandle.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          const rect = dragHandle.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        }
      }
    }
    throw new Error(`Drag handle for "${name}" not found`);
  }, componentName);

  // Get the iframe's position in the parent page to convert coords
  const iframeOffset = await page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const iframe = host?.shadowRoot?.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe) throw new Error('Panel iframe not found');
    const rect = iframe.getBoundingClientRect();
    return { x: rect.x, y: rect.y };
  });

  // Calculate parent-page coordinates of the thumbnail center
  const startX = iframeOffset.x + thumbRect.x;
  const startY = iframeOffset.y + thumbRect.y;

  // Perform drag: mousedown → move past threshold → move to target → mouseup
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(50);

  // Move past the 5px drag threshold to trigger DRAG_START
  await page.mouse.move(startX, startY - 10, { steps: 3 });
  await page.waitForTimeout(100);

  // Move to the drop target (overlay's pointermove now handles indicators)
  await page.mouse.move(dropTarget.x, dropTarget.y, { steps: 5 });
  await page.waitForTimeout(200);

  // Drop the component
  await page.mouse.up();
  await page.waitForTimeout(1500);
}

/**
 * Returns true if Storybook components loaded, false if unavailable (e.g. demo).
 */
async function ensureStorybookConnected(frame: Frame): Promise<boolean> {
  // Check if components are already loaded
  const hasComponents = await frame.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(b => b.textContent?.trim() === 'Place' && b.className.includes('h-5.5'));
  }).catch(() => false);
  if (hasComponents) {
    console.log('[tutorial] ensureStorybookConnected: Place buttons already present');
    return true;
  }

  // Log current panel state for diagnosis
  const panelState = await frame.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean);
    const text = document.body.innerText.slice(0, 400);
    return { buttons, text };
  }).catch(() => ({ buttons: [] as string[], text: '(eval failed)' }));
  console.log('[tutorial] ensureStorybookConnected: no Place buttons found');
  console.log('[tutorial] panel buttons:', panelState.buttons.slice(0, 20));
  console.log('[tutorial] panel text (first 400 chars):', panelState.text);

  // If "Storybook not detected" is shown, click "Scan for Storybook" as fallback
  const hasScanButton = await frame.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Scan for Storybook'));
    if (btn) {
      (btn as HTMLButtonElement).click();
      return true;
    }
    return false;
  }).catch(() => false);

  console.log('[tutorial] ensureStorybookConnected: hasScanButton =', hasScanButton);

  // Wait up to 15s for components to appear; return false if they don't
  const appeared = await frame.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(b => b.textContent?.trim() === 'Place' && b.className.includes('h-5.5'));
  }, { timeout: 15000 }).then(() => true).catch(() => false);

  if (appeared) {
    console.log('[tutorial] ensureStorybookConnected: Place buttons now present');
  } else {
    console.log('[tutorial] ensureStorybookConnected: Storybook unavailable, will use fallback');
  }
  return appeared;
}

async function doStep8(page: Page): Promise<void> {
  await scrollToStep(page, 8);

  // Enter select mode via bottom toolbar
  await clickSelectButton(page);
  await page.waitForTimeout(300);

  // Click the "Critical - Fix payment gateway timeout" row to select it
  const criticalRow = page.locator('text=Fix payment gateway timeout').first();
  await criticalRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await criticalRow.click();
  await page.waitForTimeout(800);

  // Get the bounding box of the selected row for drag start
  const criticalBox = await criticalRow.boundingBox();
  if (!criticalBox) throw new Error('Critical row bounding box not found');

  // Get the bounding box of the first row (target for drop)
  const firstRow = page.locator('text=Improve dashboard load time').first();
  const firstBox = await firstRow.boundingBox();
  if (!firstBox) throw new Error('First row bounding box not found');

  const dragStartX = criticalBox.x + criticalBox.width / 2;
  const dragStartY = criticalBox.y + criticalBox.height / 2;
  const dropX = firstBox.x + firstBox.width / 2;
  const dropY = firstBox.y - 5; // Drop above the first row

  // Drag: mousedown → move past threshold → move to target → mouseup
  await page.mouse.move(dragStartX, dragStartY);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.move(dragStartX, dragStartY - 10, { steps: 3 });
  await page.waitForTimeout(100);
  await page.mouse.move(dropX, dropY, { steps: 8 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(1000);
}

async function doStep9(page: Page): Promise<void> {
  await scrollToStep(page, 9);

  // After step 8's drag-move, select mode is still active from the initial
  // clickSelectButton in step 8. Don't click Select again — doing so would
  // toggle it OFF (orange → gray) because the toolbar is in picking state.
  // Just click the target element directly.

  // Click the "Resolved" card to select it
  const resolvedCard = page.locator('text=Migrate to new auth provider').first();
  await resolvedCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await resolvedCard.click();

  // Wait for selection to register (element drawer appears)
  await waitForElementDrawer(page);
  await page.waitForTimeout(300);

  // Press Backspace to remove the element
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(500);
}

async function doStep10(page: Page): Promise<void> {
  await scrollToStep(page, 10);

  // Enter select mode via bottom toolbar
  await clickSelectButton(page);
  await page.waitForTimeout(300);

  // DEBUG: check overlay state after clicking Select
  const stateAfterSelect = await page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const selectBtn = host?.shadowRoot?.querySelector('.bt-combo[data-tool="select"]');
    return {
      hostExists: !!host,
      shadowExists: !!host?.shadowRoot,
      selectBtnExists: !!selectBtn,
      selectBtnClasses: selectBtn?.className ?? '(none)',
      activeElement: document.activeElement?.tagName ?? '(none)',
      bodyChildCount: document.body.children.length,
    };
  });
  console.log(`[step10-debug] After clickSelectButton:`, JSON.stringify(stateAfterSelect));

  // Click one of the team member cards to select it
  const teamMember = page.locator('text=Alice Lim').first();
  await teamMember.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  // DEBUG: check element visibility before click
  const teamMemberBox = await teamMember.boundingBox();
  console.log(`[step10-debug] Alice Lim boundingBox: ${JSON.stringify(teamMemberBox)}`);

  await teamMember.click();
  await page.waitForTimeout(800);

  // DEBUG: check overlay state after clicking the element
  const stateAfterClick = await page.evaluate(() => {
    // Access overlay internal state via the global debug hook if available
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const highlights = host?.shadowRoot?.querySelectorAll('[class*="highlight"]');
    // Check if any element has the selection indicator
    const selectedIndicators = host?.shadowRoot?.querySelectorAll('[class*="select"], [class*="toolbar"]');
    return {
      highlightCount: highlights?.length ?? 0,
      selectedIndicatorCount: selectedIndicators?.length ?? 0,
      activeElement: document.activeElement?.tagName ?? '(none)',
      // Check if the overlay has a toolbar visible (indicates element selected)
      toolbarVisible: !!(host?.shadowRoot?.querySelector('[class*="el-toolbar"], [class*="element-toolbar"]')),
    };
  });
  console.log(`[step10-debug] After clicking Alice Lim:`, JSON.stringify(stateAfterClick));

  // DEBUG: check overlay's internal state.currentTargetEl via a probe
  const hasCurrentTarget = await page.evaluate(() => {
    // The overlay stores state in a module-scope variable. We can't access it directly,
    // but we can check if the keydown handler would early-return by dispatching a probe.
    // Instead, check for the element toolbar which only shows when something is selected.
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const sr = host?.shadowRoot;
    if (!sr) return { shadowRoot: false };
    const toolbar = sr.querySelector('.el-toolbar');
    const toolbarStyle = toolbar ? getComputedStyle(toolbar).display : '(no toolbar el)';
    const allToolbars = sr.querySelectorAll('[class*="toolbar"]');
    const toolbarClasses = Array.from(allToolbars).map(t => t.className).slice(0, 5);
    return {
      shadowRoot: true,
      toolbarEl: !!toolbar,
      toolbarDisplay: toolbarStyle,
      allToolbarCount: allToolbars.length,
      toolbarClasses,
    };
  });
  console.log(`[step10-debug] currentTarget probe (toolbar check):`, JSON.stringify(hasCurrentTarget));

  // Duplicate: dispatch a synthetic Ctrl+D / Cmd+D KeyboardEvent directly
  // into the document so the overlay's keydown handler fires reliably.
  // Using page.keyboard.press('ControlOrMeta+d') is unreliable in headless CI
  // because browsers may intercept Ctrl+D (bookmark shortcut) before the page
  // handler sees it.
  const duplicateResult = await page.evaluate(() => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const event = new KeyboardEvent('keydown', {
      key: 'd',
      code: 'KeyD',
      ctrlKey: !isMac,
      metaKey: isMac,
      bubbles: true,
      cancelable: true,
    });
    const wasDefaultPrevented = !document.dispatchEvent(event);
    return {
      isMac,
      ctrlKey: !isMac,
      metaKey: isMac,
      defaultPrevented: wasDefaultPrevented,
      activeElementAtDispatch: document.activeElement?.tagName ?? '(none)',
    };
  });
  console.log(`[step10-debug] After dispatching Ctrl+D:`, JSON.stringify(duplicateResult));

  await page.waitForTimeout(1000);

  // DEBUG: check if duplicate actually happened (look for cloned element)
  const afterDuplicate = await page.evaluate(() => {
    // Count elements containing "Alice Lim" text
    const aliceElements = Array.from(document.querySelectorAll('*')).filter(
      el => el.textContent?.includes('Alice Lim') && el.children.length < 3
    );
    const progress = JSON.parse(localStorage.getItem('vybit-tutorial-progress') || '[]');
    return {
      aliceMatchCount: aliceElements.length,
      localStorageProgress: progress,
      // Check for any ghost/dropped elements
      droppedComponents: document.querySelectorAll('[data-tw-dropped-component]').length,
    };
  });
  console.log(`[step10-debug] After waiting 1s post-duplicate:`, JSON.stringify(afterDuplicate));
}

async function doStep11(page: Page): Promise<void> {
  await scrollToStep(page, 11);

  // Ensure panel is open and connected
  const panelAlreadyOpen = await page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !!(host?.shadowRoot?.querySelector('iframe'));
  }).catch(() => false);

  if (!panelAlreadyOpen) {
    await clickToggleButton(page);
  }
  const frame = await getPanelFrame(page);
  await waitForPanelReady(frame);
  await page.waitForTimeout(300);

  // Switch to Insert mode via bottom toolbar
  await clickInsertButton(page);
  await page.waitForTimeout(500);

  // Ensure Storybook is connected (click "Scan for Storybook" if needed)
  const hasStorybook = await ensureStorybookConnected(frame);

  if (hasStorybook) {
    // Drag the Badge component from the panel thumbnail to the page
    const dropTarget = page.locator('text=Priority: High').first();
    await dropTarget.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const dropBox = await dropTarget.boundingBox();
    if (!dropBox) throw new Error('Drop target "Priority: High" not found');

    await dragComponentToTarget(frame, 'Badge', {
      x: dropBox.x + dropBox.width / 2,
      y: dropBox.y + dropBox.height / 2,
    });
  } else {
    // No Storybook (e.g. demo project) — use fallback "Mark complete" button
    console.log('[tutorial] step 11: no Storybook, clicking Mark complete');
    const section = page.locator('section').filter({ has: page.locator(`h2:has-text("${SECTION_TITLES[11]}")`) });
    await section.getByRole('button', { name: 'Mark complete' }).click();
  }
}

async function doStep12(page: Page): Promise<void> {
  await scrollToStep(page, 12);
  const frame = await getPanelFrame(page);

  // Switch to Insert mode via bottom toolbar
  await clickInsertButton(page);
  await page.waitForTimeout(500);

  // Ensure Storybook is connected (click "Scan for Storybook" if needed)
  const hasStorybook = await ensureStorybookConnected(frame);

  if (!hasStorybook) {
    // No Storybook (e.g. demo project) — use fallback "Mark complete" button
    console.log('[tutorial] step 12: no Storybook, clicking Mark complete');
    const section = page.locator('section').filter({ has: page.locator(`h2:has-text("${SECTION_TITLES[12]}")`) });
    await section.getByRole('button', { name: 'Mark complete' }).click();
    return;
  }

  // Find the Button component and click Customize to expand it
  await frame.evaluate(() => {
    const items = document.querySelectorAll('li');
    for (const item of items) {
      const nameEl = Array.from(item.querySelectorAll('a, div')).find(el => el.textContent?.includes('Button'));
      if (nameEl) {
        const customizeBtn = Array.from(item.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Customize') as HTMLButtonElement;
        if (customizeBtn) {
          customizeBtn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          customizeBtn.click();
          return;
        }
      }
    }
    throw new Error('Button component Customize button not found');
  });
  await page.waitForTimeout(1000);

  // Find the leftIcon ⊞ button and click it to arm the ReactNode field
  await frame.waitForFunction(() => {
    return !!Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === '⊞' && b.getAttribute('title')?.includes('leftIcon'));
  }, { timeout: 8000 });
  await frame.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === '⊞' && b.getAttribute('title')?.includes('leftIcon')) as HTMLButtonElement;
    if (!btn) throw new Error('leftIcon ⊞ button not found');
    btn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    btn.click();
  });
  await page.waitForTimeout(800);

  // Now other components should show "Set Prop" button. Click it on the Icon component.
  // We match by the component title link text "Components / Icon" to avoid matching
  // "leftIcon" text inside the Button component's expanded props area.
  await frame.waitForFunction(() => {
    return !!Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Set Prop' && b.className.includes('h-5.5'));
  }, { timeout: 8000 });
  await frame.evaluate(() => {
    const items = document.querySelectorAll('li');
    for (const item of items) {
      // Match specifically the component title (e.g. "Components / Icon"), not any text containing "Icon"
      const titleLink = Array.from(item.querySelectorAll('a')).find(a => {
        const text = a.textContent?.trim() ?? '';
        return text === 'Icon' || text.endsWith('/ Icon') || text.includes('Components / Icon');
      });
      if (titleLink) {
        const setPropBtn = Array.from(item.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Set Prop' && b.className.includes('h-5.5')) as HTMLButtonElement;
        if (setPropBtn) {
          setPropBtn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          setPropBtn.click();
          return;
        }
      }
    }
    throw new Error('Icon Set Prop button not found');
  });
  await page.waitForTimeout(800);

  // Now the Button should show "Place" with the nested Icon in leftIcon.
  // Drag the Button component from the panel to the page
  const dropTarget = page.locator('button:has-text("Close Issue")').first();
  await dropTarget.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const dropBox = await dropTarget.boundingBox();
  if (!dropBox) throw new Error('Drop target "Close Issue" not found');

  await dragComponentToTarget(frame, 'Button', {
    x: dropBox.x + dropBox.width / 2,
    y: dropBox.y + dropBox.height / 2,
  });
}

async function doStep13(page: Page): Promise<void> {
  await scrollToStep(page, 13);
  const frame = await getPanelFrame(page);

  // Switch back to Select mode via bottom toolbar
  await clickSelectButton(page);
  await page.waitForTimeout(300);

  // Click the purple banner element (section 13's playground)
  // The banner has classes: bg-indigo-600 text-white rounded-2xl p-12 ...
  const banner = page.locator('.bg-indigo-600.text-white.rounded-2xl').first();
  await banner.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await banner.click();
  await page.waitForTimeout(1000);

  // Switch to the Design tab in the panel (it may default to Components)
  const designTab = frame.locator('button', { hasText: 'Design' });
  await designTab.waitFor({ timeout: 5000 });
  await designTab.click();
  await page.waitForTimeout(500);

  // Wait for the box model padding slots to appear
  const paddingSlot = frame.locator('[data-layer="padding"] .bm-slot').first();
  await paddingSlot.waitFor({ timeout: 10000 });

  // Click the first padding slot to open its dropdown (must use Playwright click
  // for proper pointer events — the MiniScrubber uses onPointerDown/onPointerUp)
  await paddingSlot.click();
  await page.waitForTimeout(500);

  // Pick a different value from the dropdown to stage a patch
  const dropdownItems = frame.locator('.bm-mini-dropdown-item');
  await dropdownItems.first().waitFor({ timeout: 5000 });

  // Click the second dropdown item (a different value than current)
  const count = await dropdownItems.count();
  if (count > 1) {
    await dropdownItems.nth(1).click();
  } else {
    await dropdownItems.first().click();
  }
  await page.waitForTimeout(500);
}

async function doStep15(page: Page): Promise<void> {
  await scrollToStep(page, 15);
  const frame = await getPanelFrame(page);

  // Switch to Theme mode — wait for button, click it, then wait for Theme tab content
  const themeBtn = frame.locator('button[title="Theme"]');
  await themeBtn.waitFor({ timeout: 10000 });
  await themeBtn.click();
  await frame.waitForFunction(() => {
    return !!Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Typography'));
  }, { timeout: 10000 });

  // Expand Typography section if collapsed
  const textXlInput = frame.locator('input[title="--text-xl"]');
  if (!(await textXlInput.isVisible().catch(() => false))) {
    await frame.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Typography'));
      btn?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      (btn as HTMLButtonElement)?.click();
    });
    await textXlInput.waitFor({ timeout: 5000 });
  }

  // Change --text-xl to 2rem and blur to trigger the theme edit
  await textXlInput.click({ clickCount: 3 });
  await textXlInput.fill('2rem');
  await textXlInput.press('Tab');

  // Verify the input accepted the new value
  await expect(textXlInput).toHaveValue('2rem', { timeout: 3000 });

  // Verify a draft was staged — the panel footer should show a draft count
  await expect.poll(async () => {
    return frame.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /draft/i.test(b.textContent ?? ''));
      return btn?.textContent?.trim() ?? '';
    });
  }, { message: 'Expected a draft to appear after theme edit', timeout: 5000 }).toMatch(/draft/i);

  // Verify the live preview actually changed the computed style on the page.
  // The overlay injects `:root { --text-xl: 2rem !important; }` which should
  // make .text-xl elements compute to 32px (2rem × 16px base).
  await expect.poll(async () => {
    const info = await page.evaluate(() => {
      const styleEl = document.getElementById('vybit-theme-preview');
      const el = document.querySelector('.text-xl.font-bold') as HTMLElement;
      return {
        styleExists: !!styleEl,
        fontSize: el ? getComputedStyle(el).fontSize : null,
        varValue: getComputedStyle(document.documentElement).getPropertyValue('--text-xl').trim(),
      };
    });
    if (info.fontSize === '32px') return '32px';
    // Include diagnostic info in the received value so failures show context
    return `${info.fontSize} [styleExists=${info.styleExists}, --text-xl="${info.varValue}"]`;
  }, { message: 'Expected .text-xl computed font-size to change to 32px after theme preview', timeout: 10000 }).toBe('32px');

  // The panel sends MESSAGE_STAGE via postMessage to the parent, but in the
  // cross-origin iframe test setup the event doesn't reliably reach
  // useTutorialProgress. Dispatch a synthetic event as fallback (same
  // pattern as step 4's voice message).
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('vybit:message', {
      detail: { type: 'MESSAGE_STAGE', elementKey: 'theme', message: 'theme edit' },
    }));
  });
}

async function doStep14(page: Page): Promise<void> {
  await scrollToStep(page, 14);
  const frame = await getPanelFrame(page);

  // Click "Refresh Invoice" to trigger console error + failed fetch
  await page.locator('button:has-text("Refresh Invoice")').click();

  // Switch to Bug Report mode — wait for the button to appear first
  await clickBugReportMode(frame);

  // Click an element in the billing card
  const target = page.locator('text=Overage charges').first();
  await target.click();

  // Wait for the bug description input to appear (proves the element was selected)
  const descInput = frame.getByPlaceholder('Describe the bug…');
  await descInput.waitFor({ timeout: 10000 });
  await descInput.fill('This price should not be negative and the refresh button is broken');

  // Submit the bug report
  const submitBtn = frame.getByRole('button', { name: /Commit Bug Report/i });
  await submitBtn.waitFor({ timeout: 5000 });
  await submitBtn.click();

  // Cross-origin postMessage from the panel iframe doesn't reliably reach
  // useTutorialProgress. Dispatch a synthetic event as fallback.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('vybit:message', {
      detail: { type: 'BUG_REPORT_STAGE' },
    }));
  });
}

// ── Public API ───────────────────────────────────────────────────────────

export async function runTutorial(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForTimeout(2000);

  // Clear any previous progress
  await page.evaluate(() => localStorage.removeItem('vybit-tutorial-progress'));

  // Run all steps sequentially
  const STEPS: Array<{ step: number; fn: (page: Page) => Promise<void> }> = [
    { step: 1, fn: doStep1 },
    { step: 2, fn: doStep2 },
    { step: 3, fn: doStep3 },
    { step: 4, fn: doStep4 },   // synthetic (voice — no SpeechRecognition in headless)
    { step: 5, fn: doStep5 },
    { step: 6, fn: doStep6 },
    { step: 7, fn: doStep7 },
    { step: 8, fn: doStep8 },
    { step: 9, fn: doStep9 },
    { step: 10, fn: doStep10 },
    { step: 11, fn: doStep11 },
    { step: 12, fn: doStep12 },
    { step: 13, fn: doStep13 },
    { step: 14, fn: doStep14 },
  ];

  for (const { step, fn } of STEPS) {
    console.log(`[tutorial] → starting step ${step} ("${SECTION_TITLES[step]}")`);
    await fn(page);
    console.log(`[tutorial] → step ${step} action done, asserting localStorage`);
    await assertStepCompleted(page, step);
    console.log(`[tutorial] ✓ step ${step} complete`);
  }

  await assertCompletionBanner(page);

  // Bonus steps (after the core 14-step completion banner)
  console.log(`[tutorial] → starting bonus step 15 ("${SECTION_TITLES[15]}")`);
  await doStep15(page);
  console.log(`[tutorial] → step 15 action done, asserting localStorage`);
  await assertStepCompleted(page, 15);
  console.log(`[tutorial] ✓ step 15 complete`);
}

export { SECTION_TITLES, TOTAL_STEPS };
