import { render, screen, fireEvent } from '@testing-library/react';
import { ScaleScrubber } from './ScaleScrubber';

const VALUES = ['px-0', 'px-1', 'px-2', 'px-4', 'px-8', 'px-16'];

function setup(overrides: Partial<Parameters<typeof ScaleScrubber>[0]> = {}) {
  const onHover = vi.fn();
  const onLeave = vi.fn();
  const onClick = vi.fn();

  render(
    <ScaleScrubber
      values={VALUES}
      currentValue="px-4"
      lockedValue={null}
      locked={false}
      onHover={onHover}
      onLeave={onLeave}
      onClick={onClick}
      {...overrides}
    />
  );

  return { onHover, onLeave, onClick };
}

function getChip() {
  return screen.getByText(/^px-/);
}

// jsdom doesn't implement setPointerCapture — stub it so pointerdown doesn't throw
function stubPointerCapture(el: Element) {
  (el as HTMLElement).setPointerCapture = vi.fn();
  (el as HTMLElement).releasePointerCapture = vi.fn();
}

test('renders the current value as a chip', () => {
  setup();
  expect(screen.getByText('px-4')).toBeInTheDocument();
});

test('shows lockedValue on the chip when it belongs to this scrubber', () => {
  setup({ lockedValue: 'px-8', locked: true });
  expect(screen.getByText('px-8')).toBeInTheDocument();
});

test('ignores lockedValue from another scrubber (not in values)', () => {
  setup({ lockedValue: 'py-4', locked: true });
  // should still show currentValue, not lockedValue
  expect(screen.getByText('px-4')).toBeInTheDocument();
});

test('click opens the dropdown with all values', () => {
  setup();
  const chip = getChip();
  stubPointerCapture(chip);

  fireEvent.pointerDown(chip, { clientX: 0 });
  fireEvent.pointerUp(chip, { clientX: 0 });

  // Each value should appear in the dropdown
  for (const val of VALUES) {
    expect(screen.getAllByText(val).length).toBeGreaterThan(0);
  }
});

test('second click closes the dropdown and calls onLeave', () => {
  const { onLeave } = setup();
  const chip = getChip();
  stubPointerCapture(chip);

  // Open
  fireEvent.pointerDown(chip, { clientX: 0 });
  fireEvent.pointerUp(chip, { clientX: 0 });
  expect(screen.getAllByText('px-0').length).toBeGreaterThan(0);

  // Close
  fireEvent.pointerDown(chip, { clientX: 0 });
  fireEvent.pointerUp(chip, { clientX: 0 });
  expect(onLeave).toHaveBeenCalledTimes(1);
});

test('hovering a dropdown item calls onHover', () => {
  const { onHover } = setup();
  const chip = getChip();
  stubPointerCapture(chip);

  fireEvent.pointerDown(chip, { clientX: 0 });
  fireEvent.pointerUp(chip, { clientX: 0 });

  fireEvent.mouseEnter(screen.getAllByText('px-8')[0]);
  expect(onHover).toHaveBeenCalledWith('px-8');
});

test('clicking a dropdown item calls onClick and closes the dropdown', () => {
  const { onClick } = setup();
  const chip = getChip();
  stubPointerCapture(chip);

  fireEvent.pointerDown(chip, { clientX: 0 });
  fireEvent.pointerUp(chip, { clientX: 0 });

  fireEvent.click(screen.getAllByText('px-8')[0]);
  expect(onClick).toHaveBeenCalledWith('px-8');
  // dropdown should be gone — chip still shows currentValue (lockedValue is prop-controlled)
  expect(screen.queryByText('px-0')).not.toBeInTheDocument();
});

test('does not open when locked=true', () => {
  setup({ locked: true, lockedValue: null });
  const chip = getChip();
  stubPointerCapture(chip);

  fireEvent.pointerDown(chip, { clientX: 0 });
  fireEvent.pointerUp(chip, { clientX: 0 });

  // None of the OTHER values should be visible
  expect(screen.queryByText('px-0')).not.toBeInTheDocument();
});

test('calls onStart on pointerdown when not foreign-locked', () => {
  const onStart = vi.fn();
  setup({ onStart });
  const chip = getChip();
  stubPointerCapture(chip);

  fireEvent.pointerDown(chip, { clientX: 0 });
  expect(onStart).toHaveBeenCalledTimes(1);
});

test('does not call onStart when foreign-locked', () => {
  const onStart = vi.fn();
  setup({ locked: true, lockedValue: null, onStart });
  const chip = getChip();
  stubPointerCapture(chip);

  fireEvent.pointerDown(chip, { clientX: 0 });
  expect(onStart).not.toHaveBeenCalled();
});
