---
name: create-react-modlet
description: Create React components or hooks following the modlet pattern in this project. Use when creating any new component or hook in panel/src/components/. Modlets are self-contained folders with index.ts, implementation, tests, and optional types.
---

# Skill: Creating React Modlets

This skill teaches how to create React components and hooks following the **modlet pattern** in this project.

## What Is a Modlet?

A modlet is a self-contained folder that houses everything related to a specific module. Each modlet includes its implementation, tests, and types — all in one place.

## When to Use This Skill

Use this skill when:
- Creating any new React component in the panel
- Creating a custom hook
- Breaking down a complex component into sub-components

## Storybook

This project uses Storybook for visual component development. Run it from the `panel/` directory:

```bash
npm run storybook        # starts dev server at http://localhost:6006
npm run build-storybook  # static build
```

Story files live alongside the component inside the modlet folder.

## Modlet Locations

Panel components are organized in `panel/src/components/`:

```
panel/src/components/
├── ScaleRow/            # Scale/numeric value picker
├── ColorGrid/           # Color swatch picker
├── ContainerSwitcher/   # Container mode switcher
└── YourComponent/       # New components go here
```

## Naming Conventions

- **PascalCase** for component folders and files: `ScaleRow/`, `ColorGrid/`
- **camelCase** for hooks: `useMyHook/`
- **lowercase** for grouping folders if needed: `common/`

## Modlet Structure

### Visual Modlet (React Component)

```
ComponentName/
├── index.ts                    # Re-export entry point (required)
├── ComponentName.tsx           # Component implementation (required)
├── ComponentName.test.tsx      # Tests (required)
├── ComponentName.stories.tsx   # Storybook stories (required)
└── types.ts                    # Custom types (optional)
```

### Non-Visual Modlet (Hook/Utility)

```
useMyHook/
├── index.ts                    # Re-export entry point (required)
├── useMyHook.ts                # Implementation (required)
├── useMyHook.test.ts           # Tests (required)
└── types.ts                    # Custom types (optional)
```

## Core Rules

1. **Folder naming**: Name the modlet folder after its main export (e.g., `/ScaleRow` exports `ScaleRow`)
2. **index.ts only re-exports**: Never define logic in `index.ts`, only re-export from within the modlet
3. **Tests are mandatory**: Every modlet must have tests in `<modlet-name>.test.tsx`
4. **Stories for visual modlets**: All visual components must have a `ComponentName.stories.tsx` file
5. **Sub-organization**: Additional components go in a `/components` subfolder, hooks in `/hooks` — each as its own modlet

## Creation Process

### Step 1: Plan with Todos

Use `manage_todo_list` to track progress:

```
1. Create modlet folder
2. Add index.ts with re-exports
3. Add main component/hook file
4. Add test file
5. Add stories file
6. (If needed) Add types.ts
7. Verify tests pass
8. Verify TypeScript compiles
9. Verify story renders in Storybook
```

### Step 2: Create Files

#### index.ts (Required)

```typescript
export { ComponentName } from './ComponentName';
export type { ComponentNameProps } from './types';
```

#### ComponentName.tsx (Required)

```tsx
import React from 'react';
import type { ComponentNameProps } from './types';

export function ComponentName({ someProp }: ComponentNameProps) {
  const base = 'some-tailwind-classes';
  const conditional = someProp ? 'active-classes' : '';

  return (
    <div className={`${base} ${conditional}`}>
      {/* Implementation */}
    </div>
  );
}
```

**Styling notes:**
- Use Tailwind classes directly — no `cn()` utility in this project
- Use template literals for conditional classes: `` `${base} ${isActive ? 'active' : ''}` ``
- Design tokens are available as custom Tailwind classes: `bv-teal`, `bv-orange`, `bv-surface`, `bv-surface-hi`, `bv-text`, `bv-text-mid`, `bv-border`
- Common pattern: define `base`, `hover`, `current`, `preview` class strings separately, then combine

#### ComponentName.stories.tsx (Required for visual components)

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ComponentName } from './ComponentName';

const meta: Meta<typeof ComponentName> = {
  component: ComponentName,
  title: 'Panel/ComponentName',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ComponentName>;

export const Default: Story = {
  args: {
    // Default props
  },
};

export const Variant: Story = {
  args: {
    // Variant props
  },
};
```

**Title convention:** Use `Panel/ComponentName` for top-level components.

#### ComponentName.test.tsx (Required)

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentName } from './ComponentName';

test('renders correctly', () => {
  render(<ComponentName someProp="value" />);
  expect(screen.getByText('expected text')).toBeInTheDocument();
});

test('handles user interaction', () => {
  const onClick = vi.fn();
  render(<ComponentName onClick={onClick} />);

  fireEvent.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalled();
});
```

**Testing notes:**
- Uses Vitest with globals (`vi`, `test`, `expect` — no need to import)
- Uses `@testing-library/react` for rendering and `fireEvent` for interactions
- `@testing-library/jest-dom` matchers available (e.g. `toBeInTheDocument()`)
- For user events, `fireEvent` is preferred in existing tests; `userEvent` from `@testing-library/user-event` is also available

#### types.ts (Optional — use when props are non-trivial)

```typescript
export interface ComponentNameProps {
  someProp: string;
  onAction: (value: string) => void;
  locked?: boolean;
}
```

### Step 3: Verify

Run these commands from the `panel/` directory:

```bash
# Run tests
npm test

# Type check
npx tsc --noEmit

# Visual verification in Storybook
npm run storybook
```

## Import Patterns

This project uses **relative imports** — there is no `@/` alias:

```tsx
// From within panel/src/components/ScaleRow/ScaleRow.tsx
import type { ScaleRowProps } from './types';

// Importing overlay utilities
import { parseClasses } from '../../../../overlay/src/class-parser';

// Importing sibling components
import { ColorGrid } from '../ColorGrid';
```

## Existing Component Patterns

Reference these for styling and structure conventions:

**ScaleRow** — chip grid with hover preview and click-to-lock:
- Separates `base`, `hover`, `current`, `preview` class strings
- Accepts `onHover`, `onLeave`, `onClick` callbacks
- Uses `locked` / `lockedValue` props to disable hover when a change is staged

**ColorGrid** — 2D color swatch grid with same hover/lock pattern

**ContainerSwitcher** — simple toggle, sends WebSocket messages via `sendTo`

## Sub-Modlet Organization

For complex components with internal sub-components:

```
ComplexComponent/
├── index.ts
├── ComplexComponent.tsx
├── ComplexComponent.test.tsx
├── types.ts
├── components/
│   ├── SubComponentA/
│   │   ├── index.ts
│   │   ├── SubComponentA.tsx
│   │   └── SubComponentA.test.tsx
│   └── SubComponentB/
│       ├── index.ts
│       ├── SubComponentB.tsx
│       └── SubComponentB.test.tsx
└── hooks/
    └── useComponentLogic/
        ├── index.ts
        ├── useComponentLogic.ts
        └── useComponentLogic.test.ts
```

## Quality Checklist

Before completing any modlet:

- [ ] Folder name matches main export
- [ ] `index.ts` exists and only contains re-exports
- [ ] Main component/hook file exists
- [ ] Test file exists and passes (`npm test` in panel/)
- [ ] (Visual only) Story file exists and renders in Storybook
- [ ] Types file exists if custom types are defined
- [ ] Sub-folders follow modlet structure
- [ ] `cd panel && npx tsc --noEmit` passes
- [ ] Modlet can be imported from its `index.ts`

## Common Mistakes to Avoid

- ❌ Missing `index.ts` file
- ❌ Defining logic directly in `index.ts` instead of re-exporting
- ❌ Skipping tests
- ❌ Using `@/` import alias — this project uses relative imports only
- ❌ Importing `cn` from anywhere — it doesn't exist in this project
- ❌ Skipping stories for visual components
- ❌ Not verifying tests pass after creation
