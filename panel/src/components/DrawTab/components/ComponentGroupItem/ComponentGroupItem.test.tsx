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

test('shows "Inserting" label when armed', () => {
  renderItem(group, true);
  expect(screen.getByText('Inserting')).toBeInTheDocument();
});

test('shows "Insert" label when not armed', () => {
  renderItem(group, false);
  expect(screen.getByText('Insert')).toBeInTheDocument();
});

test('shows Customize button', () => {
  renderItem();
  expect(screen.getByText('Customize')).toBeInTheDocument();
});

test('shows "Replace" when hasPageSelection is true', () => {
  const onArm = vi.fn();
  const onDisarm = vi.fn();
  render(
    <ComponentGroupItem group={group} isArmed={false} onArm={onArm} onDisarm={onDisarm} hasPageSelection />
  );
  expect(screen.getByText('Replace')).toBeInTheDocument();
});
