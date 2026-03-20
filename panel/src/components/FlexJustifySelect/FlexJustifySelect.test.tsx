import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlexJustifySelect } from './FlexJustifySelect';

const defaultProps = {
  currentValue: 'justify-between' as string | null,
  lockedValue: null as string | null,
  locked: false,
  onHover: vi.fn(),
  onLeave: vi.fn(),
  onClick: vi.fn(),
  onRemove: undefined as (() => void) | undefined,
  onRemoveHover: undefined as (() => void) | undefined,
};

function renderSelect(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  // Reset mocks for each render
  (props.onHover as ReturnType<typeof vi.fn>).mockClear();
  (props.onLeave as ReturnType<typeof vi.fn>).mockClear();
  (props.onClick as ReturnType<typeof vi.fn>).mockClear();
  return render(<FlexJustifySelect {...props} />);
}

describe('FlexJustifySelect', () => {
  it('renders the header label "Justify"', () => {
    renderSelect();
    expect(screen.getByText(/Justify/i)).toBeInTheDocument();
  });

  it('shows the current value label (e.g. "between")', () => {
    renderSelect({ currentValue: 'justify-between' });
    expect(screen.getByText('between')).toBeInTheDocument();
  });

  it('opens dropdown on click showing all 7 options', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button'));
    // All 7 justify labels should appear in the dropdown (may also have the trigger label)
    const labels = ['start', 'center', 'stretch', 'between', 'around', 'evenly', 'end'];
    for (const label of labels) {
      const elements = screen.getAllByText(label);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('calls onHover when hovering an option', () => {
    const onHover = vi.fn();
    renderSelect({ onHover });
    fireEvent.click(screen.getByRole('button'));
    // Find "start" labels — the one in the dropdown is inside a DiagramCell
    const startElements = screen.getAllByText('start');
    // Hover the parent diagram cell container (the cursor-pointer div wrapping each cell)
    const cell = startElements[startElements.length - 1].closest('.cursor-pointer');
    if (cell) fireEvent.mouseEnter(cell);
    expect(onHover).toHaveBeenCalledWith('justify-start');
  });

  it('calls onClick and closes dropdown when clicking an option', () => {
    const onClick = vi.fn();
    renderSelect({ onClick });
    fireEvent.click(screen.getByRole('button'));
    // Find the "center" label in the dropdown
    const centerElements = screen.getAllByText('center');
    const cell = centerElements[centerElements.length - 1].closest('.cursor-pointer');
    if (cell) fireEvent.click(cell);
    expect(onClick).toHaveBeenCalledWith('justify-center');
    // Dropdown should be closed — only one "between" label (the trigger)
    expect(screen.queryAllByText('start').length).toBeLessThanOrEqual(1);
  });

  it('shows locked value when lockedValue is set', () => {
    renderSelect({ currentValue: 'justify-start', lockedValue: 'justify-end' });
    // The displayed label should be the locked value
    expect(screen.getByText('end')).toBeInTheDocument();
  });

  it('does not open when foreignLocked', () => {
    renderSelect({ locked: true, lockedValue: null });
    fireEvent.click(screen.getByRole('button'));
    // No dropdown — "around" label shouldn't appear
    expect(screen.queryByText('around')).not.toBeInTheDocument();
  });

  it('shows remove row when onRemove is provided', () => {
    const onRemove = vi.fn();
    renderSelect({ onRemove });
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('remove')).toBeInTheDocument();
  });

  it('shows dashed empty state when no value set', () => {
    const { container } = renderSelect({ currentValue: null });
    expect(screen.getByText('none')).toBeInTheDocument();
    // The empty box should have dashed border
    const dashedBox = container.querySelector('[style*="dashed"]');
    expect(dashedBox).toBeInTheDocument();
  });
});
