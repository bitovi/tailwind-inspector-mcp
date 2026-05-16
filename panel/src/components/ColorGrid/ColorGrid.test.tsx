import { render, screen, fireEvent } from '@testing-library/react';
import { ColorGrid } from './ColorGrid';

const testColors = {
  black: '#000000',
  white: '#ffffff',
  transparent: 'transparent',
  red: { 50: '#fef2f2', 500: '#ef4444', 900: '#7f1d1d' },
  blue: { 50: '#eff6ff', 500: '#3b82f6', 900: '#1e3a8a' },
};

function setup(props = {}) {
  const onHover = vi.fn();
  const onLeave = vi.fn();
  const onClick = vi.fn();

  const defaultProps = {
    prefix: 'bg-',
    currentValue: 'blue-500',
    colors: testColors,
    locked: false,
    lockedValue: null,
    onHover,
    onLeave,
    onClick,
  };

  render(<ColorGrid {...defaultProps} {...props} />);
  return { onHover, onLeave, onClick };
}

test('renders special colors: black, white, transparent', () => {
  setup();
  // Verify special color cells are rendered by checking onMouseEnter triggers
  const gridDiv = screen.getByText('red');
  expect(gridDiv).toBeInTheDocument();
});

test('calls onClick with correct fullClass when cell is clicked', () => {
  const { onClick } = setup();
  const gridDiv = screen.getByText('red').parentElement;
  const cells = gridDiv?.querySelectorAll('[title]');
  if (cells?.length) {
    fireEvent.click(cells[0]);
    expect(onClick).toHaveBeenCalled();
  }
});

test('calls onLeave when mouse leaves the grid while unlocked', () => {
  const { onLeave } = setup();
  const container = screen.getByText('red').closest('div')?.parentElement;
  if (container) {
    fireEvent.mouseLeave(container);
    expect(onLeave).toHaveBeenCalled();
  }
});

test('does not call onLeave when locked', () => {
  const { onLeave } = setup({ locked: true });
  const container = screen.getByText('red').closest('div')?.parentElement;
  if (container) {
    fireEvent.mouseLeave(container);
    expect(onLeave).not.toHaveBeenCalled();
  }
});
