import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlexDirectionSelect } from './FlexDirectionSelect';
import type { FlexDirectionSelectProps } from './types';

function make(overrides: Partial<FlexDirectionSelectProps> = {}): FlexDirectionSelectProps {
  return {
    currentValue: 'flex-row',
    lockedValue: null,
    locked: false,
    onHover: vi.fn(),
    onLeave: vi.fn(),
    onClick: vi.fn(),
    ...overrides,
  };
}

describe('FlexDirectionSelect', () => {
  it('renders the header label "Direction"', () => {
    render(<FlexDirectionSelect {...make()} />);
    expect(screen.getByText('Direction')).toBeInTheDocument();
  });

  it('shows the current value label (e.g. "row")', () => {
    render(<FlexDirectionSelect {...make({ currentValue: 'flex-row' })} />);
    expect(screen.getByText('row')).toBeInTheDocument();
  });

  it('opens dropdown on click showing all 4 options', () => {
    render(<FlexDirectionSelect {...make()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Direction' }));

    // In the dropdown, all 4 labels appear (plus the trigger label = 2 of "row")
    expect(screen.getAllByText('row').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('col')).toBeInTheDocument();
    expect(screen.getByText('row-reverse')).toBeInTheDocument();
    expect(screen.getByText('col-reverse')).toBeInTheDocument();
  });

  it('calls onHover when hovering an option', () => {
    const onHover = vi.fn();
    render(<FlexDirectionSelect {...make({ onHover })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Direction' }));

    fireEvent.mouseEnter(screen.getByText('col').closest('[style]')!);
    expect(onHover).toHaveBeenCalledWith('flex-col');
  });

  it('calls onClick and closes dropdown when clicking an option', () => {
    const onClick = vi.fn();
    render(<FlexDirectionSelect {...make({ onClick })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Direction' }));

    fireEvent.click(screen.getByText('col-reverse'));
    expect(onClick).toHaveBeenCalledWith('flex-col-reverse');

    // Dropdown should be closed — only one "row" label (the trigger) remains
    expect(screen.queryByText('col-reverse')).not.toBeInTheDocument();
  });

  it('shows locked value when lockedValue is set', () => {
    render(<FlexDirectionSelect {...make({ currentValue: 'flex-row', lockedValue: 'flex-col', locked: true })} />);
    // Locked value overrides current — "col" label shows
    expect(screen.getByText('col')).toBeInTheDocument();
  });

  it('does not open when foreignLocked', () => {
    const onClick = vi.fn();
    render(<FlexDirectionSelect {...make({ locked: true, lockedValue: null, onClick })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Direction' }));

    // Dropdown should NOT open — no "col" label
    expect(screen.queryByText('col')).not.toBeInTheDocument();
  });
});
