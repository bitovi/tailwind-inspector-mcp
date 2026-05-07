import { type Frame } from '@playwright/test';

/**
 * Ensure Storybook components are loaded in the panel — triggers a scan if needed.
 * Retries up to 3 times (clicking "Scan for Storybook" each attempt) with 10s waits.
 *
 * @param frame        - The panel iframe Frame
 * @param throwOnFail  - If true (default), throws after all retries. If false, returns
 *                       false so callers (e.g. demo mode) can fall back gracefully.
 */
export async function ensureStorybookConnected(frame: Frame, throwOnFail?: true): Promise<void>;
export async function ensureStorybookConnected(frame: Frame, throwOnFail: false): Promise<boolean>;
export async function ensureStorybookConnected(frame: Frame, throwOnFail = true): Promise<boolean | void> {
  const MAX_ATTEMPTS = 3;
  const WAIT_PER_ATTEMPT = 20_000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Snapshot panel state for diagnostics
    const panelState = await frame.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const placeButtons = buttons.filter(b => b.textContent?.trim() === 'Place');
      const scanBtn = buttons.find(b => b.textContent?.includes('Scan for Storybook'));
      const componentRows = document.querySelectorAll('[data-testid^="component-row-"]');
      const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
      const errorEls = document.querySelectorAll('[role="alert"]');
      return {
        url: window.location.href,
        buttonCount: buttons.length,
        placeButtonCount: placeButtons.length,
        placeButtonClasses: placeButtons.map(b => b.className).slice(0, 3),
        hasScanButton: !!scanBtn,
        componentRowCount: componentRows.length,
        activeTabText: activeTab?.textContent?.trim() ?? null,
        hasErrors: errorEls.length > 0,
        errorText: Array.from(errorEls).map(e => e.textContent?.trim()).slice(0, 2),
        bodyText: document.body.textContent?.slice(0, 200),
      };
    }).catch((e) => ({ evalError: String(e) }));
    console.log(`[ensureStorybookConnected] attempt ${attempt}/${MAX_ATTEMPTS} panel state:`, JSON.stringify(panelState));

    // Already have components? Done.
    const hasComponents = await frame.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(b => b.textContent?.trim() === 'Place' && b.className.includes('h-5.5'));
    }).catch(() => false);
    if (hasComponents) {
      console.log('[ensureStorybookConnected] Place buttons already present');
      return true;
    }

    // Click "Scan for Storybook" if visible
    const clickedScan = await frame.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Scan for Storybook')
      );
      if (btn) { (btn as HTMLButtonElement).click(); return true; }
      return false;
    }).catch(() => false);
    console.log(`[ensureStorybookConnected] attempt ${attempt}: clickedScan=${clickedScan}`);

    // Wait up to WAIT_PER_ATTEMPT for Place buttons to appear
    const appeared = await frame.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(b => b.textContent?.trim() === 'Place' && b.className.includes('h-5.5'));
    }, { timeout: WAIT_PER_ATTEMPT }).then(() => true).catch(() => false);

    if (appeared) {
      console.log(`[ensureStorybookConnected] Place buttons appeared on attempt ${attempt}`);
      return true;
    }

    if (attempt < MAX_ATTEMPTS) {
      console.log(`[ensureStorybookConnected] attempt ${attempt}/${MAX_ATTEMPTS} timed out after ${WAIT_PER_ATTEMPT}ms, retrying…`);
    }
  }

  // Final diagnostic dump before failing
  const finalState = await frame.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return {
      allButtonTexts: buttons.map(b => b.textContent?.trim()).filter(Boolean).slice(0, 20),
      componentRows: document.querySelectorAll('[data-testid^="component-row-"]').length,
      iframes: document.querySelectorAll('iframe').length,
      bodyLength: document.body.textContent?.length ?? 0,
    };
  }).catch((e) => ({ evalError: String(e) }));
  console.log('[ensureStorybookConnected] FAILED — final panel state:', JSON.stringify(finalState));

  if (throwOnFail) {
    throw new Error(`Storybook components not found after ${MAX_ATTEMPTS} attempts (${MAX_ATTEMPTS * WAIT_PER_ATTEMPT / 1000}s total)`);
  }
  console.log('[ensureStorybookConnected] Storybook unavailable, using fallback');
  return false;
}
