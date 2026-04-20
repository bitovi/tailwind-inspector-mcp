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

async function clickSelectElementButton(frame: Frame): Promise<void> {
  const page = frame.page();
  for (let attempt = 0; attempt < 10; attempt++) {
    const foundContentBtn = await frame.evaluate(() => {
      const btn =
        document.querySelector('button[title*="Select an element"]') as HTMLButtonElement | null ??
        Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent?.includes('Select an element'),
        ) as HTMLButtonElement | null;
      if (btn) { btn.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); btn.click(); return true; }
      return false;
    }).catch(() => false);
    if (foundContentBtn) return;

    const foundModeToggle = await frame.evaluate(() => {
      const btns = document.querySelectorAll('button[aria-pressed]');
      for (const b of btns) {
        if (b.textContent?.trim() === 'Select' || b.getAttribute('title')?.includes('Select')) {
          (b as HTMLButtonElement).scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          (b as HTMLButtonElement).click();
          return true;
        }
      }
      return false;
    }).catch(() => false);
    if (foundModeToggle) return;

    const foundInOverlay = await page.evaluate(() => {
      const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
      const btn = host?.shadowRoot?.querySelector('.tb-select') as HTMLButtonElement | null;
      if (btn) { btn.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); btn.click(); return true; }
      return false;
    }).catch(() => false);
    if (foundInOverlay) return;

    await page.waitForTimeout(500);
  }
  throw new Error('No select button found in panel or overlay after retries');
}

async function waitForToolbarVisible(page: Page, timeout = 5000): Promise<void> {
  await page.waitForFunction(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !!host?.shadowRoot?.querySelector('.el-toolbar');
  }, { timeout });
}

async function clickToolbarButton(page: Page, buttonText: string): Promise<void> {
  await waitForToolbarVisible(page);
  const clicked = await page.evaluate((text) => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const toolbar = host?.shadowRoot?.querySelector('.el-toolbar');
    if (!toolbar) return false;
    const buttons = toolbar.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent?.trim().includes(text)) {
        btn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        btn.click();
        return true;
      }
    }
    return false;
  }, buttonText);
  if (!clicked) throw new Error(`Toolbar button "${buttonText}" not found`);
}

async function clickInsert(frame: Frame): Promise<void> {
  // Wait for the Insert button to appear (panel may still be connecting)
  await frame.waitForFunction(() => {
    return !!document.querySelector('button[title="Insert to add content"]');
  }, { timeout: 10000 });
  await frame.evaluate(() => {
    const btn = document.querySelector('button[title="Insert to add content"]') as HTMLButtonElement;
    if (!btn) throw new Error('Insert button not found');
    btn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    btn.click();
  });
  await frame.page().waitForTimeout(500);
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
  'Place a Component',
  'Build with Nested Components',
  'Fine-Tune the Design',
  'Report a Bug',
];

const TOTAL_STEPS = 11;

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

async function typeInToolbarTextarea(page: Page, text: string): Promise<void> {
  await waitForToolbarVisible(page);
  await page.evaluate((t) => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const textarea = host.shadowRoot!.querySelector('.msg-row textarea') as HTMLTextAreaElement;
    if (!textarea) throw new Error('Toolbar textarea not found');
    textarea.focus();
    textarea.value = t;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

async function clickToolbarSend(page: Page): Promise<void> {
  await page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const btn = host.shadowRoot!.querySelector('.msg-send') as HTMLButtonElement;
    if (!btn) throw new Error('Send button not found');
    btn.click();
  });
}

async function clickTextConfirm(page: Page): Promise<void> {
  await page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const btn = host.shadowRoot!.querySelector('.text-action-confirm') as HTMLButtonElement;
    if (!btn) throw new Error('Text confirm button not found');
    btn.click();
  });
}

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

  // Enter select mode
  await clickSelectElementButton(frame);
  await page.waitForTimeout(300);

  // Click the Card in section 3 ("Fix Login Page Timeout")
  await page.locator('text=Fix Login Page Timeout').first().click();
  await page.waitForTimeout(1000);

  // Type a message in the overlay toolbar
  await typeInToolbarTextarea(page, 'Make the bug tag flash red');
  await clickToolbarSend(page);
  await page.waitForTimeout(500);

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
  const frame = await getPanelFrame(page);

  // Enter select mode
  await clickSelectElementButton(frame);
  await page.waitForTimeout(300);

  // Click the empty state card ("No Data Available")
  await page.locator('text=No Data Available').first().click();
  await page.waitForTimeout(1000);

  // Click "Text" in the overlay toolbar
  await clickToolbarButton(page, 'Text');
  await page.waitForTimeout(500);

  // Type replacement text
  await page.keyboard.type('Nothing here yet!');
  await page.waitForTimeout(300);

  // Confirm the text edit
  await clickTextConfirm(page);
}

async function doStep6(page: Page): Promise<void> {
  await scrollToStep(page, 6);
  const frame = await getPanelFrame(page);

  // Switch to Insert mode via the panel button
  await clickInsert(frame);
  await page.waitForTimeout(500);

  // Click between form fields to set an insertion point.
  // Target the "Email" input label area — clicking near it should show insertion indicators.
  const emailLabel = page.locator('text=Email').first();
  const emailBox = await emailLabel.boundingBox();
  if (!emailBox) throw new Error('Email label not found');

  // Click just below the Email field to lock an insertion point
  await page.mouse.click(emailBox.x + emailBox.width / 2, emailBox.y + emailBox.height + 10);
  await page.waitForTimeout(800);

  // Type a message in the overlay toolbar
  await typeInToolbarTextarea(page, 'Add a phone number field');
  await clickToolbarSend(page);
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
  await clickInsert(frame);
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

async function ensureStorybookConnected(frame: Frame): Promise<void> {
  // Check if components are already loaded
  const hasComponents = await frame.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(b => b.textContent?.trim() === 'Place' && b.className.includes('h-5.5'));
  }).catch(() => false);
  if (hasComponents) return;

  // If "Storybook not detected" is shown, click "Scan for Storybook" as fallback
  const hasScanButton = await frame.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Scan for Storybook'));
    if (btn) {
      (btn as HTMLButtonElement).click();
      return true;
    }
    return false;
  }).catch(() => false);

  if (hasScanButton) {
    // Wait for components to appear after scan
    await frame.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(b => b.textContent?.trim() === 'Place' && b.className.includes('h-5.5'));
    }, { timeout: 30000 });
  } else {
    // Neither components nor scan button — just wait for components
    await frame.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(b => b.textContent?.trim() === 'Place' && b.className.includes('h-5.5'));
    }, { timeout: 30000 });
  }
}

async function doStep8(page: Page): Promise<void> {
  await scrollToStep(page, 8);

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

  // Switch to Insert mode
  await clickInsert(frame);
  await page.waitForTimeout(500);

  // Ensure Storybook is connected (click "Scan for Storybook" if needed)
  await ensureStorybookConnected(frame);

  // Click Place on the Badge component
  await clickComponentPlace(frame, 'Badge');

  // Drop next to the existing status badges in section 8's content area
  // ("Open", "Frontend", "Priority: High" badges)
  const dropTarget = page.locator('text=Priority: High').first();
  await dropTarget.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await dropTarget.click();
  await page.waitForTimeout(1500);
}

async function doStep9(page: Page): Promise<void> {
  await scrollToStep(page, 9);
  const frame = await getPanelFrame(page);

  // Switch to Insert mode
  await clickInsert(frame);
  await page.waitForTimeout(500);

  // Ensure Storybook is connected (click "Scan for Storybook" if needed)
  await ensureStorybookConnected(frame);

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
  // Click Place on Button to arm it.
  await clickComponentPlace(frame, 'Button');

  // Drop on the "Close Issue" button in section 9's content area
  const dropTarget = page.locator('button:has-text("Close Issue")').first();
  await dropTarget.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await dropTarget.click();
  await page.waitForTimeout(2000);
}

async function doStep10(page: Page): Promise<void> {
  await scrollToStep(page, 10);
  const frame = await getPanelFrame(page);

  // Switch back to Select mode
  await clickSelectElementButton(frame);
  await page.waitForTimeout(300);

  // Click a visible element that has Tailwind padding classes.
  // The tutorial page has "Assign" and "Close Issue" buttons with padding.
  const assignBtn = page.locator('button:has-text("Assign")').first();
  await assignBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await assignBtn.click();
  await page.waitForTimeout(1000);

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

async function doStep11(page: Page): Promise<void> {
  await scrollToStep(page, 11);
  const frame = await getPanelFrame(page);

  // Click "Refresh Invoice" to trigger console error + failed fetch
  await page.locator('button:has-text("Refresh Invoice")').click();
  await page.waitForTimeout(1000);

  // Switch to Bug Report mode
  await clickBugReportMode(frame);
  await page.waitForTimeout(500);

  // Click an element in the billing card
  await page.locator('text=Overage charges').first().click();
  await page.waitForTimeout(1000);

  // Type a bug description
  const descInput = frame.getByPlaceholder('Describe the bug…');
  await descInput.waitFor({ timeout: 5000 });
  await descInput.fill('This price should not be negative and the refresh button is broken');
  await page.waitForTimeout(300);

  // Submit the bug report
  const submitBtn = frame.getByRole('button', { name: /Commit Bug Report/i });
  await submitBtn.waitFor({ timeout: 5000 });
  await submitBtn.click();
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
  ];

  for (const { step, fn } of STEPS) {
    await fn(page);
    await assertStepCompleted(page, step);
  }

  await assertCompletionBanner(page);
}

export { SECTION_TITLES, TOTAL_STEPS };
