import { test, expect, type Page, type Frame } from '@playwright/test';
import {
  clickToggleButton,
  getPanelFrame,
  waitForPanelReady,
  clickInsert,
  clickPlacementSite,
  clickComponentPlace,
  verifyFlowRow,
  type FlowTableRow,
} from './helpers';

// ── Flow B table (mirrors SKILL.md exactly) ──────────────────────────────
//
// | Step | Action              | Tab   | Panel Insert | Overlay    | Components | Page                |
// |------|---------------------|-------|-------------|------------|------------|---------------------|
// |  1   | initial             | null  | gray        | no-toolbar | —          | none                |
// |  2   | clickInsert         | place | orange      | no-toolbar | gray       | browse-mode         |
// |  3   | clickPlacementSite  | place | teal        | toolbar    | teal       | insert-point-locked |
// |  4   | clickComponentPlace | place | gray        | no-toolbar | gray       | none                |

const FLOW_B_TABLE: FlowTableRow[] = [
  { step: 1, action: 'initial',            tab: null,    panelInsert: 'gray',   overlay: 'no-toolbar', components: '—',    page: 'none' },
  { step: 2, action: 'clickInsert',        tab: 'place', panelInsert: 'orange', overlay: 'no-toolbar', components: 'gray', page: 'browse-mode' },
  { step: 3, action: 'clickPlacementSite', tab: 'place', panelInsert: 'teal',   overlay: 'toolbar',    components: 'teal', page: 'insert-point-locked' },
  { step: 4, action: 'clickComponentPlace', tab: 'place', panelInsert: 'gray',  overlay: 'no-toolbar', components: 'gray', page: 'none' },
];

const ACTIONS: Record<string, (page: Page, frame: Frame) => Promise<void>> = {
  initial:            async () => {},
  clickInsert:        async (_p, frame) => clickInsert(frame),
  clickPlacementSite: async (page) => clickPlacementSite(page),
  clickComponentPlace: async (_p, frame) => clickComponentPlace(frame),
};

// ── Test ──────────────────────────────────────────────────────────────────

test.describe('Flow B: Place — pick location first, then pick a component', () => {
  test('full flow matches the behavior table', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');
    await page.waitForTimeout(2000);

    await clickToggleButton(page);
    const frame = await getPanelFrame(page);
    await waitForPanelReady(frame);
    await page.waitForTimeout(500);

    for (const row of FLOW_B_TABLE) {
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
