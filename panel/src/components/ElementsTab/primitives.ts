import type { Primitive } from './types';

const CHILD_CLASSES = 'p-1 text-sm rounded border border-dashed border-black';

export const PRIMITIVES: Primitive[] = [
  {
    id: 'div-flex-row',
    name: 'div.flex-row',
    ghostHtml: `<div class="flex flex-row gap-2"><div class="${CHILD_CLASSES}">01</div><div class="${CHILD_CLASSES}">02</div></div>`,
    previewCss: `
      .flex { display: flex; }
      .flex-row { flex-direction: row; }
      .gap-2 { gap: 0.5rem; }
      .p-1 { padding: 0.25rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .rounded { border-radius: 0.25rem; }
      .border { border-width: 1px; }
      .border-dashed { border-style: dashed; }
      .border-black { border-color: black; }
    `,
  },
  {
    id: 'div-flex-row-flex-auto',
    name: 'div.flex-row>.flex-auto',
    ghostHtml: `<div class="flex gap-2"><div class="flex-auto ${CHILD_CLASSES}">01</div><div class="flex-auto ${CHILD_CLASSES}">02</div></div>`,
    previewCss: `
      .flex { display: flex; }
      .flex-auto { flex: 1 1 auto; }
      .gap-2 { gap: 0.5rem; }
      .p-1 { padding: 0.25rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .rounded { border-radius: 0.25rem; }
      .border { border-width: 1px; }
      .border-dashed { border-style: dashed; }
      .border-black { border-color: black; }
    `,
  },
  {
    id: 'div-flex-col',
    name: 'div.flex-col',
    ghostHtml: `<div class="flex flex-col gap-2"><div class="${CHILD_CLASSES}">01</div><div class="${CHILD_CLASSES}">02</div></div>`,
    previewCss: `
      .flex { display: flex; }
      .flex-col { flex-direction: column; }
      .gap-2 { gap: 0.5rem; }
      .p-1 { padding: 0.25rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .rounded { border-radius: 0.25rem; }
      .border { border-width: 1px; }
      .border-dashed { border-style: dashed; }
      .border-black { border-color: black; }
    `,
  },
  {
    id: 'button-inline',
    name: 'button.inline',
    ghostHtml: `<button class="inline p-1 text-sm rounded border border-dashed border-black">button</button>`,
    previewCss: `
      .inline { display: inline; }
      .p-1 { padding: 0.25rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .rounded { border-radius: 0.25rem; }
      .border { border-width: 1px; }
      .border-dashed { border-style: dashed; }
      .border-black { border-color: black; }
      button { cursor: pointer; background: none; font: inherit; }
    `,
  },
];
