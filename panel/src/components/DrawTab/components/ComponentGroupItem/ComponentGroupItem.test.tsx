import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentGroupItem } from './ComponentGroupItem';
import type { ComponentGroup } from '../../types';

const group: ComponentGroup = {
  name: 'Button',
  fullTitle: 'Components/Button',
  tags: [],
  stories: [
    { id: 'components-button--primary', title: 'Components/Button', name: 'Primary' },
    { id: 'components-button--secondary', title: 'Components/Button', name: 'Secondary' },
  ],
  argTypes: {},
};

function renderItem(g: ComponentGroup = group, isArmed = false) {
  const onArm = vi.fn();
  const onDisarm = vi.fn();
  const result = render(
    <ComponentGroupItem group={g} isArmed={isArmed} onArm={onArm} onDisarm={onDisarm} />
  );
  return { ...result, onArm, onDisarm };
}

test('renders group name', () => {
  renderItem();
  expect(screen.getByText('Button')).toBeInTheDocument();
});

test('shows component name when armed', () => {
  renderItem(group, true);
  // In the compact row layout, name is always visible
  expect(screen.getByText('Button')).toBeInTheDocument();
});

test('shows "Placing" label when armed', () => {
  renderItem(group, true);
  expect(screen.getByText('Placing')).toBeInTheDocument();
});

test('shows "Place" label when not armed', () => {
  renderItem(group, false);
  expect(screen.getByText('Place')).toBeInTheDocument();
});

test('shows Customize button', () => {
  renderItem();
  expect(screen.getByText('Customize')).toBeInTheDocument();
});

test('shows "Replace" when insertMode is replace', () => {
  const onArm = vi.fn();
  const onDisarm = vi.fn();
  render(
    <ComponentGroupItem group={group} isArmed={false} onArm={onArm} onDisarm={onDisarm} insertMode="replace" />
  );
  expect(screen.getByText('Replace')).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Button color / style states
// ---------------------------------------------------------------------------

describe('button color states', () => {
  function getActionButton(text: string): HTMLElement {
    return screen.getByText(text).closest('button')!;
  }

  test('gray: not armed, no page selection → default border style', () => {
    renderItem(group, false);
    const btn = getActionButton('Place');
    expect(btn.className).toContain('border-bv-border');
    expect(btn.className).toContain('text-bv-text-mid');
  });

  test('orange: isArmed=true → orange border + bg', () => {
    renderItem(group, true);
    const btn = getActionButton('Placing');
    expect(btn.className).toContain('border-bv-orange');
    expect(btn.className).toContain('bg-bv-orange');
    expect(btn.className).toContain('text-white');
  });

  test('teal: hasPageSelection=true → teal border + text', () => {
    const onArm = vi.fn();
    const onDisarm = vi.fn();
    render(
      <ComponentGroupItem group={group} isArmed={false} onArm={onArm} onDisarm={onDisarm} hasPageSelection={true} />
    );
    const btn = getActionButton('Place');
    expect(btn.className).toContain('border-bv-teal');
    expect(btn.className).toContain('text-bv-teal');
  });
});

// ---------------------------------------------------------------------------
// Callback tests
// ---------------------------------------------------------------------------

describe('callbacks', () => {
  test('clicking Place when not armed calls onArm', () => {
    const { onArm } = renderItem(group, false);
    fireEvent.click(screen.getByText('Place'));
    expect(onArm).toHaveBeenCalled();
  });

  test('clicking Placing when armed calls onDisarm', () => {
    const { onDisarm } = renderItem(group, true);
    fireEvent.click(screen.getByText('Placing'));
    expect(onDisarm).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Label tests for replace mode
// ---------------------------------------------------------------------------

describe('replace mode labels', () => {
  test('"Replacing" when isArmed + insertMode=replace', () => {
    const onArm = vi.fn();
    const onDisarm = vi.fn();
    render(
      <ComponentGroupItem group={group} isArmed={true} onArm={onArm} onDisarm={onDisarm} insertMode="replace" />
    );
    expect(screen.getByText('Replacing')).toBeInTheDocument();
  });

  test('"Replace" when not armed + insertMode=replace', () => {
    const onArm = vi.fn();
    const onDisarm = vi.fn();
    render(
      <ComponentGroupItem group={group} isArmed={false} onArm={onArm} onDisarm={onDisarm} insertMode="replace" />
    );
    expect(screen.getByText('Replace')).toBeInTheDocument();
  });
});
