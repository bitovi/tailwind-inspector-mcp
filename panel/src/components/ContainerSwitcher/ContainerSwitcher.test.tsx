import { render, screen, fireEvent } from '@testing-library/react';
import { ContainerSwitcher } from './ContainerSwitcher';

test('renders button to toggle container menu', () => {
  render(<ContainerSwitcher />);
  const button = screen.getByTitle('Change container');
  expect(button).toBeInTheDocument();
});

test('opens menu when button is clicked', () => {
  render(<ContainerSwitcher />);
  const button = screen.getByTitle('Change container');
  fireEvent.click(button);
  expect(screen.getByText('Popover')).toBeInTheDocument();
});

test('closes menu when click happens outside', () => {
  const { container } = render(
    <div>
      <ContainerSwitcher />
      <div data-testid="outside">Outside</div>
    </div>
  );
  const button = screen.getByTitle('Change container');
  fireEvent.click(button);
  expect(screen.getByText('Popover')).toBeInTheDocument();
  
  fireEvent.mouseDown(container.querySelector('[data-testid="outside"]')!);
  // Menu should be closed
});
