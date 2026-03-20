import { render, screen, fireEvent } from '@testing-library/react';
import { GapModel } from './GapModel';
import type { GapSlotData } from './types';

const GAP_SCALE = ['gap-0', 'gap-1', 'gap-2', 'gap-4', 'gap-8'];
const GAP_X_SCALE = ['gap-x-0', 'gap-x-1', 'gap-x-2', 'gap-x-4', 'gap-x-8'];
const GAP_Y_SCALE = ['gap-y-0', 'gap-y-1', 'gap-y-2', 'gap-y-4', 'gap-y-8'];

function makeSlots(overrides: {
  gap?: string | null;
  gapX?: string | null;
  gapY?: string | null;
} = {}): GapSlotData[] {
  return [
    { key: 'gap',   value: overrides.gap  ?? null, scaleValues: GAP_SCALE },
    { key: 'gap-x', value: overrides.gapX ?? null, scaleValues: GAP_X_SCALE },
    { key: 'gap-y', value: overrides.gapY ?? null, scaleValues: GAP_Y_SCALE },
  ];
}

// ─── Rendering ────────────────────────────────────────────

test('renders the gm-root container', () => {
  const { container } = render(<GapModel slots={makeSlots()} />);
  expect(container.querySelector('.gm-root')).toBeInTheDocument();
});

test('renders the 3×3 grid', () => {
  const { container } = render(<GapModel slots={makeSlots()} />);
  expect(container.querySelector('.gm-grid')).toBeInTheDocument();
});

test('renders three visual boxes', () => {
  const { container } = render(<GapModel slots={makeSlots()} />);
  expect(container.querySelectorAll('.gm-box')).toHaveLength(3);
});

test('does not render mode toggle buttons', () => {
  const { container } = render(<GapModel slots={makeSlots()} />);
  expect(container.querySelector('.gm-mode-row')).not.toBeInTheDocument();
});

// ─── Gap-x display ─────────────────────────────────────────

test('shows formatted gap-x value', () => {
  render(<GapModel slots={makeSlots({ gapX: 'gap-x-4' })} />);
  expect(screen.getByText('x-4')).toBeInTheDocument();
});

test('shows placeholder x when no gap-x value', () => {
  render(<GapModel slots={makeSlots()} />);
  expect(screen.getByText('x')).toBeInTheDocument();
});

// ─── Gap-y display ─────────────────────────────────────────

test('shows formatted gap-y value', () => {
  render(<GapModel slots={makeSlots({ gapY: 'gap-y-2' })} />);
  expect(screen.getByText('y-2')).toBeInTheDocument();
});

test('shows placeholder y when no gap-y value', () => {
  render(<GapModel slots={makeSlots()} />);
  expect(screen.getByText('y')).toBeInTheDocument();
});

// ─── Gap shorthand display ──────────────────────────────────

test('shows gap shorthand value', () => {
  render(<GapModel slots={makeSlots({ gap: 'gap-2' })} />);
  expect(screen.getByText('gap-2')).toBeInTheDocument();
});

test('shows placeholder gap when no gap value', () => {
  render(<GapModel slots={makeSlots()} />);
  expect(screen.getByText('gap')).toBeInTheDocument();
});

test('shows all three scrubbers simultaneously', () => {
  render(<GapModel slots={makeSlots({ gap: 'gap-4', gapX: 'gap-x-2', gapY: 'gap-y-6' })} />);
  expect(screen.getByText('gap-4')).toBeInTheDocument();
  expect(screen.getByText('x-2')).toBeInTheDocument();
  expect(screen.getByText('y-6')).toBeInTheDocument();
});

// ─── Callbacks ─────────────────────────────────────────────

function openDropdown(chip: Element) {
  fireEvent.pointerDown(chip, { pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerUp(chip, { pointerId: 1, clientX: 0, clientY: 0 });
}

test('calls onSlotChange when gap shorthand is selected from dropdown', () => {
  const onSlotChange = vi.fn();
  render(
    <GapModel
      slots={makeSlots({ gap: 'gap-2' })}
      onSlotChange={onSlotChange}
    />
  );
  openDropdown(screen.getByText('gap-2'));
  fireEvent.click(screen.getByText('gap-4'));
  expect(onSlotChange).toHaveBeenCalledWith('gap', 'gap-4');
});

test('calls onSlotChange for gap-x when selected from dropdown', () => {
  const onSlotChange = vi.fn();
  render(
    <GapModel
      slots={makeSlots({ gapX: 'gap-x-2' })}
      onSlotChange={onSlotChange}
    />
  );
  openDropdown(screen.getByText('x-2'));
  fireEvent.click(screen.getByText('gap-x-4'));
  expect(onSlotChange).toHaveBeenCalledWith('gap-x', 'gap-x-4');
});

test('calls onSlotHover when hovering a dropdown item', () => {
  const onSlotHover = vi.fn();
  render(
    <GapModel
      slots={makeSlots({ gap: 'gap-2' })}
      onSlotHover={onSlotHover}
    />
  );
  openDropdown(screen.getByText('gap-2'));
  fireEvent.mouseEnter(screen.getByText('gap-8'));
  expect(onSlotHover).toHaveBeenCalledWith('gap', 'gap-8');
});

// ─── Remove ────────────────────────────────────────────────

test('calls onSlotRemoveHover when hovering the remove item on gap', () => {
  const onSlotRemoveHover = vi.fn();
  render(
    <GapModel
      slots={makeSlots({ gap: 'gap-4' })}
      onSlotRemoveHover={onSlotRemoveHover}
    />
  );
  openDropdown(screen.getByText('gap-4'));
  fireEvent.mouseEnter(screen.getByText('remove'));
  expect(onSlotRemoveHover).toHaveBeenCalledWith('gap');
});

test('calls onSlotRemoveHover when hovering the remove item on gap-x', () => {
  const onSlotRemoveHover = vi.fn();
  render(
    <GapModel
      slots={makeSlots({ gapX: 'gap-x-4' })}
      onSlotRemoveHover={onSlotRemoveHover}
    />
  );
  openDropdown(screen.getByText('x-4'));
  fireEvent.mouseEnter(screen.getByText('remove'));
  expect(onSlotRemoveHover).toHaveBeenCalledWith('gap-x');
});

test('calls onSlotRemoveHover when hovering the remove item on gap-y', () => {
  const onSlotRemoveHover = vi.fn();
  render(
    <GapModel
      slots={makeSlots({ gapY: 'gap-y-4' })}
      onSlotRemoveHover={onSlotRemoveHover}
    />
  );
  openDropdown(screen.getByText('y-4'));
  fireEvent.mouseEnter(screen.getByText('remove'));
  expect(onSlotRemoveHover).toHaveBeenCalledWith('gap-y');
});

test('shows remove item in dropdown when gap has a value', () => {
  render(<GapModel slots={makeSlots({ gap: 'gap-4' })} />);
  openDropdown(screen.getByText('gap-4'));
  expect(screen.getByText('remove')).toBeInTheDocument();
});

test('does not show remove item in dropdown when gap has no value', () => {
  render(<GapModel slots={makeSlots()} />);
  openDropdown(screen.getByText('gap'));
  expect(screen.queryByText('remove')).not.toBeInTheDocument();
});

test('calls onSlotRemove when remove item is mousedown on gap', () => {
  const onSlotRemove = vi.fn();
  render(
    <GapModel
      slots={makeSlots({ gap: 'gap-4' })}
      onSlotRemove={onSlotRemove}
    />
  );
  openDropdown(screen.getByText('gap-4'));
  fireEvent.mouseDown(screen.getByText('remove'));
  expect(onSlotRemove).toHaveBeenCalledWith('gap');
});

test('calls onSlotRemove when remove item is mousedown on gap-x', () => {
  const onSlotRemove = vi.fn();
  render(
    <GapModel
      slots={makeSlots({ gapX: 'gap-x-4' })}
      onSlotRemove={onSlotRemove}
    />
  );
  openDropdown(screen.getByText('x-4'));
  fireEvent.mouseDown(screen.getByText('remove'));
  expect(onSlotRemove).toHaveBeenCalledWith('gap-x');
});

test('calls onSlotRemove when remove item is mousedown on gap-y', () => {
  const onSlotRemove = vi.fn();
  render(
    <GapModel
      slots={makeSlots({ gapY: 'gap-y-4' })}
      onSlotRemove={onSlotRemove}
    />
  );
  openDropdown(screen.getByText('y-4'));
  fireEvent.mouseDown(screen.getByText('remove'));
  expect(onSlotRemove).toHaveBeenCalledWith('gap-y');
});

