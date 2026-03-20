import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlexAlignSelect } from './FlexAlignSelect';

function make(overrides = {}) {
  return {
    currentValue: 'items-baseline',
    lockedValue: null,
    locked: false,
    onHover: vi.fn(),
    onLeave: vi.fn(),
    onClick: vi.fn(),
    ...overrides,
  };
}

describe('FlexAlignSelect', () => {
  it('renders the header label "Align"', () => {
    render(<FlexAlignSelect {...make()} />);
    expect(screen.getByText(/Align/i)).toBeInTheDocument();
  });

  it('shows the current value label (e.g. "baseline")', () => {
    render(<FlexAlignSelect {...make()} />);
    // The label below the diagram shows the short name
    expect(screen.getByText('baseline')).toBeInTheDocument();
  });

  it('opens dropdown on click showing all 5 options', () => {
    render(<FlexAlignSelect {...make()} />);
    fireEvent.click(screen.getByRole('button'));
    // All five option labels should appear in the dropdown grid
    expect(screen.getByText('start')).toBeInTheDocument();
    expect(screen.getByText('center')).toBeInTheDocument();
    // 'baseline' already showing as current label + in grid
    expect(screen.getAllByText('baseline').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('stretch')).toBeInTheDocument();
    expect(screen.getByText('end')).toBeInTheDocument();
  });

  it('calls onHover when hovering an option', () => {
    const onHover = vi.fn();
    render(<FlexAlignSelect {...make({ onHover })} />);
    fireEvent.click(screen.getByRole('button'));
    // Find the "center" label in the dropdown and hover its parent cell
    const centerLabel = screen.getByText('center');
    const cell = centerLabel.closest('[class*="cursor-pointer"]')!;
    fireEvent.mouseEnter(cell);
    expect(onHover).toHaveBeenCalledWith('items-center');
  });

  it('calls onClick and closes dropdown when clicking an option', () => {
    const onClick = vi.fn();
    render(<FlexAlignSelect {...make({ onClick })} />);
    fireEvent.click(screen.getByRole('button'));
    const endLabel = screen.getByText('end');
    const cell = endLabel.closest('[class*="cursor-pointer"]')!;
    fireEvent.click(cell);
    expect(onClick).toHaveBeenCalledWith('items-end');
    // Dropdown should close — only one "end" label remaining (none in dropdown)
    expect(screen.queryByText('stretch')).not.toBeInTheDocument();
  });

  it('shows locked value when lockedValue is set', () => {
    render(<FlexAlignSelect {...make({ currentValue: 'items-start', lockedValue: 'items-center' })} />);
    // The label should reflect the locked value, not the current value
    expect(screen.getByText('center')).toBeInTheDocument();
  });

  it('does not open when foreignLocked', () => {
    render(<FlexAlignSelect {...make({ locked: true, lockedValue: null })} />);
    fireEvent.click(screen.getByRole('button'));
    // Should NOT show dropdown options
    expect(screen.queryByText('start')).not.toBeInTheDocument();
  });

  it('shows remove row when onRemove is provided', () => {
    const onRemove = vi.fn();
    render(<FlexAlignSelect {...make({ onRemove })} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('remove')).toBeInTheDocument();
  });

  it('shows dashed empty state when no value set', () => {
    render(<FlexAlignSelect {...make({ currentValue: null })} />);
    // Should show dash placeholder for the label
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
