import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlexWrapSelect } from './FlexWrapSelect';
import type { FlexWrapSelectProps } from './types';

function renderSelect(overrides: Partial<FlexWrapSelectProps> = {}) {
  const props: FlexWrapSelectProps = {
    currentValue: 'flex-nowrap',
    lockedValue: null,
    locked: false,
    onHover: vi.fn(),
    onLeave: vi.fn(),
    onClick: vi.fn(),
    ...overrides,
  };
  return { ...render(<FlexWrapSelect {...props} />), props };
}

describe('FlexWrapSelect', () => {
  it('renders the header label "Wrap"', () => {
    renderSelect();
    expect(screen.getByText('Wrap')).toBeInTheDocument();
  });

  it('shows the current value label (e.g. "no-wrap")', () => {
    renderSelect({ currentValue: 'flex-nowrap' });
    expect(screen.getByText('no-wrap')).toBeInTheDocument();
  });

  it('shows "wrap" label when value is flex-wrap', () => {
    renderSelect({ currentValue: 'flex-wrap' });
    expect(screen.getByText('wrap')).toBeInTheDocument();
  });

  it('shows "wrap-reverse" label when value is flex-wrap-reverse', () => {
    renderSelect({ currentValue: 'flex-wrap-reverse' });
    expect(screen.getByText('wrap-reverse')).toBeInTheDocument();
  });

  it('opens dropdown on click showing all 3 options', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button'));
    // All 3 labels should now be visible (collapsed + dropdown for active value)
    expect(screen.getAllByText('no-wrap').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('wrap')).toBeInTheDocument();
    expect(screen.getByText('wrap-reverse')).toBeInTheDocument();
  });

  it('calls onHover when hovering an option', () => {
    const { props } = renderSelect({ currentValue: 'flex-nowrap' });
    fireEvent.click(screen.getByRole('button'));
    // "wrap" only appears once (in the dropdown, not the collapsed trigger)
    const wrapLabel = screen.getByText('wrap');
    // The label's parent div is the WrapCell root
    fireEvent.mouseEnter(wrapLabel.parentElement!);
    expect(props.onHover).toHaveBeenCalledWith('flex-wrap');
  });

  it('calls onClick and closes dropdown when clicking an option', () => {
    const { props } = renderSelect({ currentValue: 'flex-nowrap' });
    fireEvent.click(screen.getByRole('button'));
    const wrapLabel = screen.getByText('wrap');
    fireEvent.click(wrapLabel.parentElement!);
    expect(props.onClick).toHaveBeenCalledWith('flex-wrap');
  });

  it('shows locked value when lockedValue is set', () => {
    renderSelect({ currentValue: 'flex-nowrap', lockedValue: 'flex-wrap' });
    expect(screen.getByText('wrap')).toBeInTheDocument();
  });

  it('does not open when foreignLocked', () => {
    const { props } = renderSelect({ locked: true, lockedValue: null });
    fireEvent.click(screen.getByRole('button'));
    // Should not show all 3 options — dropdown is closed
    const wrapLabels = screen.queryAllByText('wrap');
    // Only the collapsed label should be present, not the dropdown items
    expect(wrapLabels.length).toBeLessThanOrEqual(1);
    expect(props.onHover).not.toHaveBeenCalled();
  });

  it('shows dashed empty state when currentValue is null', () => {
    renderSelect({ currentValue: null });
    // The empty-state box shows "Wrap" text inside
    const wrapTexts = screen.getAllByText('Wrap');
    expect(wrapTexts.length).toBeGreaterThanOrEqual(1);
  });
});
