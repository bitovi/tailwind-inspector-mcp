import { render, screen, fireEvent } from '@testing-library/react';
import { MiniScrubber } from './MiniScrubber';

const values = ['pt-0', 'pt-1', 'pt-2', 'pt-4', 'pt-8'];

test('renders placeholder when no current value', () => {
  render(
    <MiniScrubber
      placeholder="t"
      values={values}
      currentValue={null}
      displayValue={null}
    />
  );
  expect(screen.getByText('t')).toBeInTheDocument();
});

test('renders displayValue when value is set', () => {
  render(
    <MiniScrubber
      placeholder="t"
      values={values}
      currentValue="pt-4"
      displayValue="t-4"
    />
  );
  expect(screen.getByText('t-4')).toBeInTheDocument();
});

test('adds bm-has-val class when value is set', () => {
  render(
    <MiniScrubber
      placeholder="t"
      values={values}
      currentValue="pt-4"
      displayValue="t-4"
    />
  );
  expect(screen.getByText('t-4')).toHaveClass('bm-has-val');
});

test('opens dropdown on click', () => {
  render(
    <MiniScrubber
      placeholder="t"
      values={values}
      currentValue={null}
      displayValue={null}
    />
  );
  fireEvent.pointerDown(screen.getByText('t'), { clientX: 100, clientY: 100 });
  fireEvent.pointerUp(screen.getByText('t'));
  // Dropdown should now show all values
  expect(screen.getByText('pt-0')).toBeInTheDocument();
  expect(screen.getByText('pt-4')).toBeInTheDocument();
});

test('calls onClick when dropdown item is clicked', () => {
  const onClick = vi.fn();
  render(
    <MiniScrubber
      placeholder="t"
      values={values}
      currentValue={null}
      displayValue={null}
      onClick={onClick}
    />
  );
  // Open dropdown
  fireEvent.pointerDown(screen.getByText('t'), { clientX: 100, clientY: 100 });
  fireEvent.pointerUp(screen.getByText('t'));
  // Click a value
  fireEvent.click(screen.getByText('pt-4'));
  expect(onClick).toHaveBeenCalledWith('pt-4');
});

test('does not respond when disabled', () => {
  const onScrubStart = vi.fn();
  render(
    <MiniScrubber
      placeholder="t"
      values={values}
      currentValue={null}
      displayValue={null}
      disabled
      onScrubStart={onScrubStart}
    />
  );
  fireEvent.pointerDown(screen.getByText('t'), { clientX: 100, clientY: 100 });
  expect(onScrubStart).not.toHaveBeenCalled();
});

test('uses formatValue for scrub display', () => {
  const formatValue = (v: string) => v.replace('pt-', 't-');
  render(
    <MiniScrubber
      placeholder="t"
      values={values}
      currentValue="pt-2"
      displayValue="t-2"
      formatValue={formatValue}
    />
  );
  expect(screen.getByText('t-2')).toBeInTheDocument();
});

test('sets cursor based on axis', () => {
  const { rerender } = render(
    <MiniScrubber
      placeholder="t"
      values={values}
      currentValue={null}
      displayValue={null}
      axis="y"
    />
  );
  expect(screen.getByText('t')).toHaveStyle({ cursor: 'ns-resize' });

  rerender(
    <MiniScrubber
      placeholder="l"
      values={values}
      currentValue={null}
      displayValue={null}
      axis="x"
    />
  );
  expect(screen.getByText('l')).toHaveStyle({ cursor: 'ew-resize' });
});
