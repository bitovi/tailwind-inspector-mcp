// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { buildInsertContext, buildContext } from './context';

/**
 * Helper: build a DOM tree from an HTML string and return the element
 * matching the given selector. Appends to document.body so ancestors
 * include <body>.
 */
function setup(html: string, targetSelector: string): HTMLElement {
  document.body.innerHTML = html;
  const el = document.querySelector(targetSelector) as HTMLElement;
  if (!el) throw new Error(`Target "${targetSelector}" not found in: ${html}`);
  return el;
}

// ── buildInsertContext ────────────────────────────────────────────────────

describe('buildInsertContext', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('annotates the target with "insert BEFORE this"', () => {
    const target = setup(
      '<form><div class="field" id="customer"><label>Customer</label></div></form>',
      '#customer',
    );
    const result = buildInsertContext(target, 'before');
    expect(result).toContain('<!-- TARGET: insert BEFORE this -->');
  });

  it('annotates the target with "insert AFTER this"', () => {
    const target = setup(
      '<form><div id="title"><label>Title</label></div></form>',
      '#title',
    );
    const result = buildInsertContext(target, 'after');
    expect(result).toContain('<!-- TARGET: insert AFTER this -->');
  });

  it('annotates with FIRST-CHILD and LAST-CHILD', () => {
    const target = setup('<div id="container"><span>child</span></div>', '#container');
    expect(buildInsertContext(target, 'first-child')).toContain('insert FIRST-CHILD this');
    expect(buildInsertContext(target, 'last-child')).toContain('insert LAST-CHILD this');
  });

  it('expands the target one level deep instead of collapsing', () => {
    const target = setup(
      `<form>
        <div class="space-y-2" id="customer-field">
          <label>Customer *</label>
          <select><option>Lisa</option></select>
        </div>
      </form>`,
      '#customer-field',
    );
    const result = buildInsertContext(target, 'before');
    // Should see the label content expanded, not just "..."
    expect(result).toContain('<label>');
    expect(result).toContain('Customer');
    expect(result).toContain('<select>');
  });

  it('siblings get deep-text summaries for disambiguation', () => {
    const target = setup(
      `<form>
        <div class="space-y-2"><label>Case Title *</label><input /></div>
        <div class="space-y-2"><label>Case Description *</label><textarea></textarea></div>
        <div class="space-y-2" id="target"><label>Customer *</label><select></select></div>
        <div class="space-y-2"><label>Priority *</label><select></select></div>
      </form>`,
      '#target',
    );
    const result = buildInsertContext(target, 'before');
    // Siblings should show their text content, not just "..."
    expect(result).toContain('Case Title');
    expect(result).toContain('Case Description');
    expect(result).toContain('Priority');
    // Target should be expanded, showing its label
    expect(result).toContain('Customer');
    expect(result).toContain('<!-- TARGET: insert BEFORE this -->');
  });

  it('handles target with no children (text-only)', () => {
    const target = setup(
      '<div><span id="t">Hello world</span></div>',
      '#t',
    );
    const result = buildInsertContext(target, 'after');
    expect(result).toContain('<!-- TARGET: insert AFTER this -->');
    expect(result).toContain('Hello world');
  });

  it('handles target with empty children', () => {
    const target = setup(
      '<div><div id="empty"></div></div>',
      '#empty',
    );
    const result = buildInsertContext(target, 'before');
    expect(result).toContain('<!-- TARGET: insert BEFORE this -->');
  });

  it('truncates long deep-text summaries in siblings', () => {
    const longText = 'A'.repeat(100);
    const target = setup(
      `<div>
        <div id="long">${longText}</div>
        <div id="target"><span>Target</span></div>
      </div>`,
      '#target',
    );
    const result = buildInsertContext(target, 'before');
    // The sibling summary should be truncated (default 40 chars)
    expect(result).toContain('…');
    // Should NOT contain the full 100-char string
    expect(result).not.toContain(longText);
  });

  it('shows siblings within ±3 of the target', () => {
    // Create 8 siblings, target at index 4
    const target = setup(
      `<div>
        <div class="f"><label>Field 0</label></div>
        <div class="f"><label>Field 1</label></div>
        <div class="f"><label>Field 2</label></div>
        <div class="f"><label>Field 3</label></div>
        <div class="f" id="target"><label>Field 4</label></div>
        <div class="f"><label>Field 5</label></div>
        <div class="f"><label>Field 6</label></div>
        <div class="f"><label>Field 7</label></div>
      </div>`,
      '#target',
    );
    const result = buildInsertContext(target, 'before');
    // Fields 1-7 should be visible (target ±3)
    expect(result).toContain('Field 1');
    expect(result).toContain('Field 7');
    // Field 0 is out of range — there should be an ellipsis
    expect(result).toContain('…');
  });
});

// ── buildContext (existing function — regression) ─────────────────────────

describe('buildContext', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('annotates the target with class change info', () => {
    const target = setup(
      '<div><span class="text-lg" id="t">Hello</span></div>',
      '#t',
    );
    const result = buildContext(target, 'text-lg', 'text-xl', new Map());
    expect(result).toContain('<!-- TARGET: change text-lg → text-xl -->');
    expect(result).toContain('Hello');
  });

  it('uses original classes from the map for previewed elements', () => {
    const target = setup(
      '<div class="previewed" id="t">text</div>',
      '#t',
    );
    const el = document.querySelector('#t') as HTMLElement;
    const originalMap = new Map<HTMLElement, string>([[el, 'original-class']]);
    const result = buildContext(target, 'old', 'new', originalMap);
    expect(result).toContain('class="original-class"');
    expect(result).not.toContain('class="previewed"');
  });
});
