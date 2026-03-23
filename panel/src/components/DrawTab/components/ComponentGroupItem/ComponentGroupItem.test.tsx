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

test('shows loading preview', () => {
  renderItem();
  expect(screen.getByText('Loading preview…')).toBeInTheDocument();
});

test('shows placement hint when armed', () => {
  renderItem(group, true);
  expect(screen.getByText('Click the page to place')).toBeInTheDocument();
  expect(screen.queryByText('Button')).not.toBeInTheDocument();
});

test('shows group name when not armed', () => {
  renderItem(group, false);
  expect(screen.getByText('Button')).toBeInTheDocument();
  expect(screen.queryByText('Click the page to place')).not.toBeInTheDocument();
});

test('creates a hidden probe iframe for the first story', () => {
  renderItem();
  const iframe = document.querySelector('iframe[src*="components-button--primary"]');
  expect(iframe).toBeTruthy();
});
