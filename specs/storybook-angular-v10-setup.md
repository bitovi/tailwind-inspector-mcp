# Setting Up Storybook 10 with Angular 21

This documents the fixes required to get `@storybook/angular` 10.x working with Angular 21 components
in a cross-project monorepo setup (stories and components live in a different package than the Storybook config).

## Problem Setup

```
storybook-test/angular-v10/     ← Storybook config + Angular project (ng run)
  node_modules/@angular/core    ← Storybook framework uses this copy
  .storybook/main.ts
  tsconfig.json
  angular.json

test-app-angular/               ← Actual Angular components + stories
  node_modules/@angular/core    ← Webpack resolves to this copy for component files
  src/app/components/
    badge.component.ts
    badge.component.stories.ts
```

---

## Fix 1 — TypeScript: switch moduleResolution and exclude SB8 addon files

**File:** `storybook-test/angular-v10/tsconfig.json`

**Problem:** `"moduleResolution": "node"` cannot resolve packages that use the `exports` field in
`package.json` (conditional exports). Storybook 10 uses this for its package entry points, causing
`TS2307: Cannot find module 'storybook/preview-api'` errors. Additionally, the tsconfig glob
included SB8-only addon files that import `@storybook/preview-api`, which doesn't exist in SB10.

**Fix:**
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  },
  "exclude": [
    "../../storybook-addon/preview.ts",
    "../../storybook-addon/manager.tsx"
  ]
}
```

---

## Fix 2 — Preview: fix bare `'storybook'` import

**File:** `storybook-test/angular-v10/.storybook/preview.ts`

**Problem:** `import type { Preview } from 'storybook'` — the `storybook` package has no root export
in its exports map, so this fails to resolve.

**Fix:**
```ts
import type { Preview } from '@storybook/angular';
```

---

## Fix 3 — Components: convert Angular signal inputs to `@Input()` decorators

**Files:** `test-app-angular/src/app/components/*.component.ts`

**Problem:** Angular 21 signal inputs (`input.required()`) call `assertInInjectionContext()` during
class field initialization. `@storybook/angular` 10.3.3 instantiates component classes via
`new ComponentClass()` outside Angular's injection context during its JIT template analysis phase,
causing `NG0203: inputFunction() can only be used within an injection context`.

**Fix:** Replace signal inputs with traditional `@Input()` decorators and update templates to use
the property directly instead of calling it as a function.

```ts
// Before (broken with Storybook 10.3.3)
import { Component, input } from '@angular/core';

export class BadgeComponent {
  color = input.required<'blue' | 'green'>(); // ← fails in Storybook
}
// template: {{ color() }}

// After
import { Component, Input } from '@angular/core';

export class BadgeComponent {
  @Input({ required: true }) color!: 'blue' | 'green';
}
// template: {{ color }}
```

---

## Fix 4 — Webpack: prevent duplicate `@angular/core` instances

**File:** `storybook-test/angular-v10/.storybook/main.ts`

**Problem:** Webpack builds the Angular components (from `test-app-angular/src/`) using the cwd
resolution algorithm, which finds `test-app-angular/node_modules/@angular/core`. But the Storybook
framework runtime uses `storybook-test/angular-v10/node_modules/@angular/core`. Two separate
in-memory instances of `@angular/core` cause Angular's global `getLView()` to return `null`,
which produces `TypeError: Cannot read properties of null (reading '15')` in every component template.

**Fix:** Add a `webpackFinal` hook that sets `resolve.modules` to prioritize the Storybook project's
own `node_modules` directory. This ensures a single copy of all Angular packages is used while
preserving the packages' full `exports` map resolution (important for sub-path imports like
`@angular/core/primitives/signals`).

```ts
// storybook-test/angular-v10/.storybook/main.ts
import type { StorybookConfig } from '@storybook/angular';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../../../test-app-angular/src/**/*.stories.@(ts)'],
  addons: [...],
  framework: {
    name: '@storybook/angular',
    options: { projectBuildConfig: 'storybook-angular' },
  },
  webpackFinal: async (config) => {
    config.resolve = config.resolve || {};
    config.resolve.modules = [
      resolve(__dirname, '../node_modules'), // ← Storybook's node_modules first
      'node_modules',
    ];
    return config;
  },
};
```

> **Note:** Do NOT use `resolve.alias` for this. Aliasing `@angular/core` to a directory path
> bypasses the package's `exports` map for sub-path imports (e.g. `@angular/core/primitives/signals`),
> causing `Module not found` build errors.

---

## Summary

| # | File | Change |
|---|------|--------|
| 1 | `tsconfig.json` | `"moduleResolution": "bundler"` + exclude SB8 addon files |
| 2 | `.storybook/preview.ts` | Import `Preview` type from `'@storybook/angular'` not `'storybook'` |
| 3 | `*.component.ts` | Replace `input.required()` with `@Input({ required: true })` |
| 4 | `.storybook/main.ts` | `webpackFinal` with `resolve.modules` to deduplicate Angular packages |
