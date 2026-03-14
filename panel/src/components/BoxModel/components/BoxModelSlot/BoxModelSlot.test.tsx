import { render, screen, fireEvent } from '@testing-library/react';
import { BoxModelSlot } from './BoxModelSlot';

test('renders placeholder when no value', () => {
  render(
    <BoxModelSlot slotKey="t" value={null} placeholder="t" layer="padding" isExpanded={false} frozen={false} />
  );
  expect(screen.getByText('t')).toBeInTheDocument();
});

test('renders value when set (truncates prefix)', () => {
  render(
    <BoxModelSlot slotKey="t" value="pt-10" placeholder="t" layer="padding" isExpanded={false} frozen={false} />
  );
  expect(screen.getByText('t-10')).toBeInTheDocument();
});

test('adds bm-has-val class when value is set', () => {
  render(
    <BoxModelSlot slotKey="t" value="pt-10" placeholder="t" layer="padding" isExpanded={false} frozen={false} />
  );
  expect(screen.getByText('t-10')).toHaveClass('bm-has-val');
});

test('calls onClick when not frozen', () => {
  const onClick = vi.fn();
  render(
    <BoxModelSlot slotKey="t" value={null} placeholder="t" layer="padding" isExpanded={false} frozen={false} onClick={onClick} />
  );
  fireEvent.click(screen.getByText('t'));
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('does not call onClick when frozen', () => {
  const onClick = vi.fn();
  render(
    <BoxModelSlot slotKey="t" value={null} placeholder="t" layer="padding" isExpanded={false} frozen={true} onClick={onClick} />
  );
  fireEvent.click(screen.getByText('t'));
  expect(onClick).not.toHaveBeenCalled();
});
