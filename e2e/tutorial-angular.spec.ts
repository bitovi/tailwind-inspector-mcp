import { test } from '@playwright/test';
import { runTutorial } from './tutorial-helpers';

test('complete the full tutorial (Angular)', async ({ page }) => {
  test.setTimeout(120_000); // Angular change detection may be slower
  await runTutorial(page);
});
