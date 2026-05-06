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
// | Step | Action              | Tab   | Panel Insert | Overlay    | Components | Page                | Reasoning                                    |
// |------|---------------------|-------|-------------|------------|------------|---------------------|----------------------------------------------|
// |  1   | initial             | null  | gray        | no-toolbar | —          | none                | Nothing active                               |
// |  2   | clickInsert         | place | orange      | no-toolbar | gray       | browse-mode         | Orange = crosshair active                    |
// |  3   | clickPlacementSite  | place | orange      | no-toolbar | teal       | browse-mode         | Browse persists — user can re-click elsewhere|
// |  4   | clickComponentPlace | place | orange      | no-toolbar | gray       | browse-mode         | Placed — browse restarts for rapid placement |

const FLOW_B_TABLE: FlowTableRow[] = [
  { step: 1, action: 'initial',                          panelInsert: 'gray',   overlay: 'no-toolbar', components: '—',    page: 'none' },
  { step: 2, action: 'clickInsert',        tab: 'components', panelInsert: 'orange', overlay: 'no-toolbar', components: 'gray', page: 'browse-mode' },
  { step: 3, action: 'clickPlacementSite', tab: 'components', panelInsert: 'orange', overlay: 'no-toolbar', components: 'teal', page: 'browse-mode' },
  { step: 4, action: 'clickComponentPlace', tab: 'components', panelInsert: 'orange', overlay: 'no-toolbar', components: 'gray', page: 'browse-mode' },
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

  test('debug: observe actual state at each step', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/');
    await page.waitForTimeout(2000);

    await clickToggleButton(page);
    const frame = await getPanelFrame(page);
    await waitForPanelReady(frame);
    await page.waitForTimeout(500);

    const captureState = async (label: string) => {
      const tab = await frame.evaluate(() => {
        const active = document.querySelector('[role="tab"][aria-selected="true"]');
        return active?.textContent?.trim().toLowerCase() ?? null;
      });
      const insertColor = await frame.page().evaluate(() => {
        const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
        const sr = host?.shadowRoot;
        const btn = sr?.querySelector('.bt-combo[data-tool="insert"]') as HTMLElement | null;
        if (!btn) return 'not-found';
        const cls = btn.className;
        if (cls.includes('picking')) return 'orange';
        if (cls.includes('engaged')) return 'teal';
        return 'gray';
      });
      const hasElToolbar = await page.evaluate(() => {
        const host = document.querySelector('#tw-visual-editor-host') as HTMLElement;
        return !!host?.shadowRoot?.querySelector('.el-toolbar');
      });
      const cursor = await page.evaluate(() => document.documentElement.style.cursor);
      console.log(`[${label}] tab=${tab} insert=${insertColor} el-toolbar=${hasElToolbar} cursor=${cursor}`);
    };

    // Step 1: initial
    await captureState('Step 1: initial');

    // Step 2: clickInsert
    await clickInsert(frame);
    await page.waitForTimeout(500);
    await captureState('Step 2: clickInsert');

    // Step 3: clickPlacementSite
    await clickPlacementSite(page);
    await page.waitForTimeout(500);
    await captureState('Step 3: clickPlacementSite');

    // Step 4: clickComponentPlace
    await clickComponentPlace(frame);
    await page.waitForTimeout(500);
    await captureState('Step 4: clickComponentPlace');

    expect(true).toBe(true); // always pass - just for debug
  });
});
