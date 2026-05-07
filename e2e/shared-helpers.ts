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
  const WAIT_PER_ATTEMPT = 10_000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
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
    await frame.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Scan for Storybook')
      );
      if (btn) (btn as HTMLButtonElement).click();
    }).catch(() => {});

    // Wait up to WAIT_PER_ATTEMPT for Place buttons to appear
    const appeared = await frame.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(b => b.textContent?.trim() === 'Place' && b.className.includes('h-5.5'));
    }, { timeout: WAIT_PER_ATTEMPT }).then(() => true).catch(() => false);

    if (appeared) {
      console.log('[ensureStorybookConnected] Place buttons now present');
      return true;
    }

    if (attempt < MAX_ATTEMPTS) {
      console.log(`[ensureStorybookConnected] attempt ${attempt}/${MAX_ATTEMPTS} timed out, retrying…`);
    }
  }

  if (throwOnFail) {
    throw new Error(`Storybook components not found after ${MAX_ATTEMPTS} attempts (${MAX_ATTEMPTS * WAIT_PER_ATTEMPT / 1000}s total)`);
  }
  console.log('[ensureStorybookConnected] Storybook unavailable, using fallback');
  return false;
}
