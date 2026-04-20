import { test } from '@playwright/test';
import { runTutorial } from './tutorial-helpers';

test('complete the full tutorial', async ({ page }) => {
  test.setTimeout(90_000);
  await runTutorial(page);
});
