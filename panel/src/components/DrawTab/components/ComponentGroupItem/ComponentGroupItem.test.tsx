import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentGroupItem } from './ComponentGroupItem';
import type { ComponentGroup } from '../../types';

const group: ComponentGroup = {
  name: 'Button',
  stories: [
    { id: 'components-button--primary', title: 'Components/Button', name: 'Primary' },
    { id: 'components-button--secondary', title: 'Components/Button', name: 'Secondary' },
  ],
  argTypes: {},
};

function renderItem(g: ComponentGroup = group) {
  return render(<ComponentGroupItem group={g} />);
}

test('renders group name', () => {
  renderItem();
  expect(screen.getByRole('button', { name: /button/i })).toBeInTheDocument();
});

test('starts expanded by default', () => {
  renderItem();
  // Should show the loading preview immediately since expanded
  expect(screen.getByText('Loading preview…')).toBeInTheDocument();
});

describe('expand/collapse', () => {
  test('clicking header collapses the content', () => {
    renderItem();
    expect(screen.getByText('Loading preview…')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /button/i }));
    expect(screen.queryByText('Loading preview…')).not.toBeInTheDocument();
  });

  test('clicking again re-expands', () => {
    renderItem();
    const header = screen.getByRole('button', { name: /button/i });

    fireEvent.click(header); // collapse
    fireEvent.click(header); // re-expand
    expect(screen.getByText('Loading preview…')).toBeInTheDocument();
  });
});

test('creates a hidden probe iframe for the first story', () => {
  renderItem();
  const iframe = document.querySelector('iframe[src*="components-button--primary"]');
  expect(iframe).toBeTruthy();
});
