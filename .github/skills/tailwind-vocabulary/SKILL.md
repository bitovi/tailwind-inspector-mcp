---
name: tailwind-vocabulary
description: Canonical terminology for Tailwind CSS concepts used throughout the codebase. Reference this skill to ensure consistent naming in code, docs, and conversation.
---

# Skill: Tailwind Vocabulary

Canonical terms used in code, types, comments, and specs. All contributors (human and AI) must use these names consistently.

## Core Terms

| Term | Type | Example | Description |
|------|------|---------|-------------|
| **classToken** | `string` | `"py-4"` | A complete Tailwind utility class string |
| **prefix** | `string` | `"py-"` | The utility prefix including trailing dash |
| **value** | `string` | `"4"` | The token after the prefix |
| **scale** | `string[]` | `["py-0","py-1",…]` | All valid classTokens for a given prefix |
| **themeKey** | `string \| null` | `"spacing"` | The Tailwind config namespace the prefix reads from |
| **category** | `string` | `"spacing"` | Semantic UI grouping (spacing, sizing, typography…) |
| **valueType** | `"scalar" \| "color" \| "enum"` | `"scalar"` | Determines which panel control renders |

## Patch Lifecycle Terms

| Term | Description |
|------|-------------|
| **patch** | A single proposed change: one classToken swap on one element |
| **staged** | User has selected a new value; change is local to the panel, previewed in the overlay |
| **committed** | User clicked "Commit to Agent"; change is in the server queue waiting for the AI agent |
| **implementing** | Agent has picked up the change and is applying it to source code |
| **implemented** | Agent confirmed the change is written to source |
| **elementKey** | Stable identifier for a target element: `${componentName}::${childPath}` |

## Message Protocol

All WebSocket messages between panel, overlay, and server use the `PATCH_*` prefix:

| Message | Direction | Purpose |
|---------|-----------|---------|
| `PATCH_PREVIEW` | panel → overlay | Live-preview a class swap in the DOM |
| `PATCH_REVERT` | panel → overlay | Revert any active preview |
| `PATCH_STAGE` | panel → overlay | Stage a change (overlay fills in context, sends `PATCH_STAGED` to server) |
| `PATCH_STAGED` | overlay → server | Patch with full context, added to server queue as staged |
| `PATCH_COMMIT` | panel → server | Move staged patches to committed status |
| `PATCH_UPDATE` | server → panel | Broadcast current counts by status |

## Usage Rules

1. Use `classToken` (not "class name" or "CSS class") when referring to a Tailwind utility string.
2. Use `prefix` (not "property name" or "utility name") for the part before the value.
3. Use `patch` (not "change" or "edit") for a single proposed modification.
4. Use the lifecycle terms (`staged`, `committed`, `implementing`, `implemented`) precisely — don't substitute synonyms.
