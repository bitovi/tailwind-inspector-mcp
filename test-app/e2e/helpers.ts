import { type Page, type Frame, type Locator, expect } from '@playwright/test';

/**
 * Clicks the overlay toggle button to open the inspector panel.
 * Does NOT activate select mode — use clickSelectElementButton() to do that.
 */
export async function clickToggleButton(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !!(host?.shadowRoot?.querySelector('.toggle-btn'));
  }, { timeout: 5000 });
  await page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const btn = host.shadowRoot!.querySelector('.toggle-btn') as HTMLButtonElement;
    btn.click();
  });
}

/**
 * Returns the panel iframe Frame object, waiting up to 8s for it to appear.
 * Excludes the design canvas frame (mode=design).
 */
export async function getPanelFrame(page: Page): Promise<Frame> {
  // First ensure the iframe is in the shadow DOM
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

/**
 * Waits for the panel WebSocket to connect.
 */
export async function waitForPanelReady(frame: Frame): Promise<void> {
  await frame.waitForFunction(
    () => !document.body.textContent?.includes('Waiting for connection'),
    { timeout: 10000 },
  );
}

/**
 * Activates crosshair/select mode. Works in three scenarios:
 * 1. Empty state: clicks the "Select an element" content button in the panel
 * 2. Element selected: clicks ModeToggle's "Select" button (re-activates crosshair)
 * 3. Fallback: clicks the overlay toolbar's Select button
 * Uses evaluate to bypass Playwright pointer-event interception issues with
 * iframes nested inside shadow DOM.
 */
export async function clickSelectElementButton(frame: Frame): Promise<void> {
  const page = frame.page();

  // Retry a few times — UI may be briefly transitioning
  for (let attempt = 0; attempt < 10; attempt++) {
    // Try the panel's empty-state "Select an element" button
    const foundContentBtn = await frame.evaluate(() => {
      const btn =
        document.querySelector('button[title*="Select an element"]') as HTMLButtonElement | null ??
        Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent?.includes('Select an element'),
        ) as HTMLButtonElement | null;
      if (btn) { btn.click(); return true; }
      return false;
    }).catch(() => false);

    if (foundContentBtn) return;

    // Try ModeToggle's "Select" button (aria-pressed, title-based match for icon-only buttons)
    const foundModeToggle = await frame.evaluate(() => {
      const btns = document.querySelectorAll('button[aria-pressed]');
      for (const b of btns) {
        if (b.textContent?.trim() === 'Select' || b.getAttribute('title')?.includes('Select')) {
          (b as HTMLButtonElement).click();
          return true;
        }
      }
      return false;
    }).catch(() => false);

    if (foundModeToggle) return;

    // Try overlay toolbar's Select button
    const foundInOverlay = await page.evaluate(() => {
      const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
      const btn = host?.shadowRoot?.querySelector('.tb-select') as HTMLButtonElement | null;
      if (btn) { btn.click(); return true; }
      return false;
    }).catch(() => false);

    if (foundInOverlay) return;

    await page.waitForTimeout(500);
  }

  throw new Error('No select button found in panel or overlay after retries');
}

/**
 * Counts .highlight-overlay elements in the shadow root.
 */
export async function getHighlightCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return host.shadowRoot!.querySelectorAll('.highlight-overlay').length;
  });
}

/**
 * Full 3-step flow: open inspector → wait for panel → activate select mode → click element.
 * Returns the panel Frame.
 */
export async function openAndSelectElement(page: Page, locator: Locator): Promise<Frame> {
  await clickToggleButton(page);
  const frame = await getPanelFrame(page);
  await waitForPanelReady(frame);
  await page.waitForTimeout(300);
  await clickSelectElementButton(frame);
  await locator.click();
  return frame;
}

// ---------------------------------------------------------------------------
// Overlay toolbar helpers
// ---------------------------------------------------------------------------

/**
 * Waits for the overlay toolbar (.el-toolbar) to appear in the shadow DOM.
 */
export async function waitForToolbarVisible(page: Page, timeout = 5000): Promise<void> {
  await page.waitForFunction(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !!host?.shadowRoot?.querySelector('.el-toolbar');
  }, { timeout });
}

/**
 * Waits for the overlay toolbar to disappear from the shadow DOM.
 */
export async function waitForToolbarHidden(page: Page, timeout = 5000): Promise<void> {
  await page.waitForFunction(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !host?.shadowRoot?.querySelector('.el-toolbar');
  }, { timeout });
}

/**
 * Clicks a toolbar button by matching its text content.
 * The toolbar lives inside the shadow DOM of #tw-visual-editor-host.
 */
export async function clickToolbarButton(page: Page, buttonText: string): Promise<void> {
  await waitForToolbarVisible(page);
  const clicked = await page.evaluate((text) => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const toolbar = host?.shadowRoot?.querySelector('.el-toolbar');
    if (!toolbar) return false;
    const buttons = toolbar.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent?.trim().includes(text)) {
        btn.click();
        return true;
      }
    }
    return false;
  }, buttonText);
  if (!clicked) throw new Error(`Toolbar button "${buttonText}" not found`);
}

/**
 * Returns the text content of all toolbar buttons as an array.
 */
export async function getToolbarButtonTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    const toolbar = host?.shadowRoot?.querySelector('.el-toolbar');
    if (!toolbar) return [];
    return Array.from(toolbar.querySelectorAll('button')).map(b => b.textContent?.trim() ?? '');
  });
}

/**
 * Returns the active tab ID from the panel frame by checking [data-active="true"]
 * or the aria attribute on the TabBar.
 */
export async function getPanelActiveTab(frame: Frame): Promise<string | null> {
  return frame.evaluate(() => {
    // TabBar buttons have aria-selected="true"
    const activeBtn = document.querySelector('[role="tab"][aria-selected="true"]');
    return activeBtn?.textContent?.trim().toLowerCase() ?? null;
  });
}

// ---------------------------------------------------------------------------
// Flow table helpers — data-driven verification for SKILL.md flow tables
// ---------------------------------------------------------------------------

type ButtonColor = 'gray' | 'orange' | 'teal';

/** Click the Insert mode button on the panel. */
export async function clickInsert(frame: Frame): Promise<void> {
  await frame.evaluate(() => {
    const btn = document.querySelector('button[title="Insert to add content"]') as HTMLButtonElement;
    if (!btn) throw new Error('Insert button not found');
    btn.click();
  });
  await frame.page().waitForTimeout(500);
}

/** Click a placement site on the page (the "Monthly Signups" heading). */
export async function clickPlacementSite(page: Page): Promise<void> {
  await page.locator('h3:has-text("Monthly Signups")').first().click();
  await page.waitForTimeout(800);
}

/** Click the first visible component Place button in the panel (excludes tab bar buttons). */
export async function clickComponentPlace(frame: Frame): Promise<void> {
  await frame.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(b => b.textContent?.trim() === 'Place' && b.className.includes('h-5.5'));
  }, { timeout: 10000 });
  await frame.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent?.trim() === 'Place' && b.className.includes('h-5.5'));
    if (!btn) throw new Error('No component Place button found (looked for h-5.5 class)');
    (btn as HTMLButtonElement).click();
  });
  await frame.page().waitForTimeout(800);
}

/** Returns the color of a panel mode button by inspecting its Tailwind classes. */
export async function getPanelButtonColor(frame: Frame, title: string): Promise<ButtonColor> {
  return frame.evaluate((t) => {
    const btn = document.querySelector(`button[title="${t}"]`) as HTMLElement;
    if (!btn) return 'gray' as const;
    const cls = btn.className;
    if (cls.includes('F5532D')) return 'orange' as const;
    if (cls.includes('00464A')) return 'teal' as const;
    return 'gray' as const;
  }, title);
}

/** Returns the colors of all component Place/Replace buttons (excludes tab bar buttons). */
export async function getComponentButtonColors(frame: Frame): Promise<ButtonColor[]> {
  return frame.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    // Component row buttons have h-5.5 class; tab bar Place/Replace buttons don't
    const placeButtons = allButtons.filter(b => {
      const text = b.textContent?.trim() ?? '';
      return ['Place', 'Replace', 'Placing', 'Replacing'].includes(text) && b.className.includes('h-5.5');
    });
    return placeButtons.map(btn => {
      const cls = btn.className;
      if (cls.includes('bg-bv-orange') && !cls.includes('bg-bv-orange/10')) return 'orange' as const;
      if (cls.includes('border-bv-teal') || cls.includes('bg-bv-teal')) return 'teal' as const;
      return 'gray' as const;
    });
  });
}

/** Returns the page interaction state by checking the document cursor. */
export async function getPageInteraction(page: Page): Promise<'none' | 'browse-mode'> {
  return page.evaluate(() => {
    return document.documentElement.style.cursor === 'crosshair'
      ? 'browse-mode' as const
      : 'none' as const;
  });
}

/** Whether the overlay toolbar (.el-toolbar) is present in the shadow DOM. */
export async function isOverlayToolbarVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
    return !!host?.shadowRoot?.querySelector('.el-toolbar');
  });
}

/** Click an element on the page to place the armed component (Flow A Step 4). */
export async function placeOnPage(page: Page): Promise<void> {
  await page.locator('h3:has-text("Monthly Signups")').first().click();
  await page.waitForTimeout(800);
}

/**
 * Flow table row — uses the same vocabulary as the SKILL.md tables.
 * Each field maps to one column in the flow table.
 */
export interface FlowTableRow {
  step: number;
  action: string;
  tab: string | null;
  panelInsert?: ButtonColor;
  panelSelect?: ButtonColor;
  overlay: 'no-toolbar' | 'toolbar';
  /** '—' = no buttons, 'gray'/'teal' = all same color, 'one-orange' = exactly one orange + rest gray */
  components: '—' | ButtonColor | 'one-orange';
  page: 'none' | 'browse-mode' | 'insert-point-locked';
}

/**
 * Asserts all columns of a flow table row against the live UI.
 * Vocabulary matches SKILL.md tables exactly so an agent can diff them.
 */
export async function verifyFlowRow(
  page: Page,
  frame: Frame,
  row: FlowTableRow,
): Promise<void> {
  const label = `Step ${row.step}`;

  // Tab — poll since WS messages may still be propagating
  await expect.poll(
    () => getPanelActiveTab(frame),
    { message: `${label}: tab`, timeout: 5000 },
  ).toBe(row.tab);

  // Panel mode buttons — poll for color transitions
  if (row.panelInsert) {
    await expect.poll(
      () => getPanelButtonColor(frame, 'Insert to add content'),
      { message: `${label}: panel Insert button`, timeout: 5000 },
    ).toBe(row.panelInsert);
  }
  if (row.panelSelect) {
    await expect.poll(
      () => getPanelButtonColor(frame, 'Select an element'),
      { message: `${label}: panel Select button`, timeout: 5000 },
    ).toBe(row.panelSelect);
  }

  // Overlay toolbar
  if (row.overlay === 'no-toolbar') {
    await expect.poll(
      () => isOverlayToolbarVisible(page),
      { message: `${label}: overlay toolbar should be hidden`, timeout: 5000 },
    ).toBe(false);
  } else {
    await waitForToolbarVisible(page);
  }

  // Component buttons — poll since hasPageSelection depends on WS propagation
  if (row.components !== '—') {
    if (row.components === 'one-orange') {
      // Exactly one button is orange, the rest are gray
      await expect.poll(
        async () => {
          const colors = await getComponentButtonColors(frame);
          if (colors.length === 0) return false;
          const orangeCount = colors.filter(c => c === 'orange').length;
          const grayCount = colors.filter(c => c === 'gray').length;
          return orangeCount === 1 && grayCount === colors.length - 1;
        },
        { message: `${label}: exactly one component button should be orange`, timeout: 5000 },
      ).toBe(true);
    } else {
      await expect.poll(
        async () => {
          const colors = await getComponentButtonColors(frame);
          return colors.length > 0 ? colors.every(c => c === row.components) : true;
        },
        { message: `${label}: all component buttons should be ${row.components}`, timeout: 5000 },
      ).toBe(true);
    }
  }

  // Page interaction
  if (row.page === 'insert-point-locked') {
    // After locking, crosshair is removed but toolbar is visible (checked above)
    await expect.poll(
      () => getPageInteraction(page),
      { message: `${label}: page (crosshair cleared after lock)`, timeout: 5000 },
    ).toBe('none');
  } else {
    await expect.poll(
      () => getPageInteraction(page),
      { message: `${label}: page interaction`, timeout: 5000 },
    ).toBe(row.page);
  }
}
