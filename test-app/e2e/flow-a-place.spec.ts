import { test, expect, type Page, type Frame } from '@playwright/test';
import {
  clickToggleButton,
  getPanelFrame,
  waitForPanelReady,
  clickInsert,
  clickComponentPlace,
  placeOnPage,
  verifyFlowRow,
  type FlowTableRow,
} from './helpers';

// ── Flow A table (mirrors SKILL.md exactly) ──────────────────────────────
//
// | Step | Action              | Tab   | Panel Insert | Overlay    | Components | Page                |
// |------|---------------------|-------|-------------|------------|------------|---------------------|
// |  1   | initial             | null  | gray        | no-toolbar | —          | none                |
// |  2   | clickInsert         | place | orange      | no-toolbar | gray       | browse-mode         |
// |  3   | clickComponentPlace | place | gray        | no-toolbar | one-orange | browse-mode (drop)  |
// |  4   | placeOnPage         | place | gray        | no-toolbar | gray       | none                |
// |  5   | clickInsert (repeat)| place | orange      | no-toolbar | gray       | browse-mode         |

const FLOW_A_TABLE: FlowTableRow[] = [
  { step: 1, action: 'initial',            tab: null,    panelInsert: 'gray',   overlay: 'no-toolbar', components: '—',      page: 'none' },
  { step: 2, action: 'clickInsert',        tab: 'place', panelInsert: 'orange', overlay: 'no-toolbar', components: 'gray',   page: 'browse-mode' },
  { step: 3, action: 'clickComponentPlace', tab: 'place', panelInsert: 'gray',  overlay: 'no-toolbar', components: 'one-orange', page: 'browse-mode' },
  { step: 4, action: 'placeOnPage',        tab: 'place', panelInsert: 'gray',   overlay: 'no-toolbar', components: 'gray',   page: 'none' },
  { step: 5, action: 'clickInsert',        tab: 'place', panelInsert: 'orange', overlay: 'no-toolbar', components: 'gray',   page: 'browse-mode' },
];

const ACTIONS: Record<string, (page: Page, frame: Frame) => Promise<void>> = {
  initial:            async () => {},
  clickInsert:        async (_p, frame) => clickInsert(frame),
  clickComponentPlace: async (_p, frame) => clickComponentPlace(frame),
  placeOnPage:        async (page) => placeOnPage(page),
};

// ── Test ──────────────────────────────────────────────────────────────────

test.describe('Flow A: Place — pick component first, then find a spot', () => {
  test('full flow matches the behavior table (including repeat)', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');
    await page.waitForTimeout(2000);

    await clickToggleButton(page);
    const frame = await getPanelFrame(page);
    await waitForPanelReady(frame);
    await page.waitForTimeout(500);

    for (const row of FLOW_A_TABLE) {
      await ACTIONS[row.action](page, frame);
      await verifyFlowRow(page, frame, row);
    }

    // Verify component was actually placed on the page
    const dropped = await page.evaluate(() =>
      !!document.querySelector('[data-tw-dropped-component]'),
    );
    expect(dropped, 'Component should be placed on the page').toBe(true);
  });
});
