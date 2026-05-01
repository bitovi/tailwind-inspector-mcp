# 05 — Inline Text Editing

> `contentEditable` on real elements. Double-click or toolbar button to enter. Produces `text-change` patch.

## Problem

Every text change currently requires a round-trip to the agent. Typing a heading or button label should be instant.

## Solution

Extends spec 034 (text-editing). Enable `contentEditable` directly on DOM elements for immediate inline text editing.

## Entry Points

| Trigger | Behavior |
|---------|----------|
| **Double-click** on a text element | Enter edit mode immediately |
| **"Edit Text" button** in element toolbar | Enter edit mode on the selected element |
| **Pressing Enter** with a text element selected | Enter edit mode (keyboard-first users) |

## Editing Behavior

- Element gets `contentEditable="true"` and a visible focus ring (teal outline)
- Native text editing: cursor, selection, Cmd+B/I for bold/italic
- Overlay suppresses element selection events while editing
- Design panel dims class-editing UI (`TEXT_EDIT_ACTIVE` message)

## Confirmation / Cancellation

| Key | Action |
|-----|--------|
| **Escape** | Cancel — revert `innerHTML` to original |
| **Cmd+Enter** | Confirm — stage `text-change` patch |
| **Click outside** | Confirm — same as Cmd+Enter |
| **Tab** | Confirm current, move to next sibling text element (edit-hopping) |

## Patch Type

Reuses the `text-change` patch from spec 034:

```ts
interface TextChangePatch {
  kind: 'text-change';
  elementSelector: string;
  componentPath: string;
  originalHtml: string;  // innerHTML before editing
  newHtml: string;       // innerHTML after editing
}
```

Deduplicates by `elementSelector` — editing the same element again replaces the previous patch.

## Agent Instructions

```
Change the text content of the element matching `{elementSelector}` 
in {componentPath}.

Original HTML: {originalHtml}
New HTML:      {newHtml}

Translate HTML formatting (e.g., <b>, <i>) to the appropriate 
JSX/TSX equivalent for the target framework.
```

## Constraints

- Disabled during drag-to-move and resize operations
- Ghost elements support text editing (modifies the ghost HTML in the pending patch)

## Empty Element Handling

Newly inserted elements (from spec 01) won't have any text content, making it hard to get a cursor inside them. Options:

- **"Text" button inserts default text**: If the selected element has no text content, the Text button (or double-click) inserts placeholder text like "Text" and enters edit mode immediately. This gives the user something to select/modify.
- **"Text" button available in Insert mode too**: Allow the Text toolbar button to work during Insert mode — click it, then click a placement point, and a text element (`<p>Text</p>` or `<span>Text</span>`) is inserted with contentEditable already active. This parallels how Figma's Text tool works.

Both approaches may be needed — one for editing existing empty elements, one for inserting new text from scratch.
