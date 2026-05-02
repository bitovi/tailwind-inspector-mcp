import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElementsTab } from './ElementsTab';
import { PRIMITIVES } from './primitives';

vi.mock('../../ws', () => ({
  sendTo: vi.fn(),
  onMessage: vi.fn(() => () => {}),
}));

import { sendTo } from '../../ws';

describe('ElementsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all primitives', () => {
    render(<ElementsTab />);
    for (const p of PRIMITIVES) {
      expect(screen.getByText(p.name)).toBeInTheDocument();
    }
  });

  it('renders Place buttons for each primitive', () => {
    render(<ElementsTab />);
    const buttons = screen.getAllByRole('button', { name: 'Place' });
    expect(buttons).toHaveLength(PRIMITIVES.length);
  });

  it('sends COMPONENT_ARM when Place is clicked', () => {
    render(<ElementsTab />);
    const buttons = screen.getAllByRole('button', { name: 'Place' });
    fireEvent.click(buttons[0]);
    expect(sendTo).toHaveBeenCalledWith('overlay', expect.objectContaining({
      type: 'COMPONENT_ARM',
      componentName: PRIMITIVES[0].name,
      ghostHtml: PRIMITIVES[0].ghostHtml,
    }));
  });

  it('shows Placing state and sends COMPONENT_DISARM on second click', () => {
    render(<ElementsTab />);
    const buttons = screen.getAllByRole('button', { name: 'Place' });
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Placing')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Placing'));
    expect(sendTo).toHaveBeenCalledWith('overlay', { type: 'COMPONENT_DISARM' });
  });

  it('calls onArmedChange callback', () => {
    const onArmedChange = vi.fn();
    render(<ElementsTab onArmedChange={onArmedChange} />);
    const buttons = screen.getAllByRole('button', { name: 'Place' });
    fireEvent.click(buttons[0]);
    expect(onArmedChange).toHaveBeenCalledWith(true);
  });

  it('shows Replace buttons when insertMode is replace', () => {
    render(<ElementsTab insertMode="replace" />);
    const buttons = screen.getAllByRole('button', { name: 'Replace' });
    expect(buttons).toHaveLength(PRIMITIVES.length);
  });

  it('sends COMPONENT_ARM with insertMode replace', () => {
    render(<ElementsTab insertMode="replace" />);
    const buttons = screen.getAllByRole('button', { name: 'Replace' });
    fireEvent.click(buttons[0]);
    expect(sendTo).toHaveBeenCalledWith('overlay', expect.objectContaining({
      type: 'COMPONENT_ARM',
      insertMode: 'replace',
    }));
    expect(screen.getByText('Replacing')).toBeInTheDocument();
  });
});
