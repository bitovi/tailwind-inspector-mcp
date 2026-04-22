import { render, screen, fireEvent } from '@testing-library/react';
import { SlotField } from './SlotField';

test('renders empty text input by default', () => {
  render(<SlotField name="iconLeft" value={undefined} onChange={() => {}} />);
  expect(screen.getByPlaceholderText('(empty)')).toBeInTheDocument();
});

test('renders with existing text value', () => {
  render(<SlotField name="children" value={{ type: 'text', value: 'Hello' }} onChange={() => {}} />);
  expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
});

test('calls onChange with text value on typing', () => {
  const onChange = vi.fn();
  render(<SlotField name="children" value={{ type: 'text', value: '' }} onChange={onChange} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New text' } });
  expect(onChange).toHaveBeenCalledWith({ type: 'text', value: 'New text' });
});

test('shows receptive placeholder when field is receptive', () => {
  render(
    <SlotField
      name="iconLeft"
      value={undefined}
      onChange={() => {}}
      isReceptive={true}
    />
  );
  expect(screen.getByPlaceholderText('Pick a component →')).toBeInTheDocument();
});

test('arm button calls onArmSelf', () => {
  const onArmSelf = vi.fn();
  render(
    <SlotField
      name="iconLeft"
      value={undefined}
      onChange={() => {}}
      onArmSelf={onArmSelf}
    />
  );
  fireEvent.click(screen.getByTitle('Set iconLeft to a component'));
  expect(onArmSelf).toHaveBeenCalled();
});

test('arm button shows Cancel title when receptive', () => {
  render(
    <SlotField
      name="iconLeft"
      value={undefined}
      onChange={() => {}}
      isReceptive={true}
      onArmSelf={() => {}}
    />
  );
  expect(screen.getByTitle('Cancel')).toBeInTheDocument();
});

test('renders component chip when filled', () => {
  render(
    <SlotField
      name="iconLeft"
      value={{
        type: 'component',
        componentName: 'Icon',
        storyId: 'components-icon--default',
        args: { name: 'check' },
        ghostHtml: '<svg width="12" height="12"></svg>',
        ghostCss: '',
      }}
      onChange={() => {}}
    />
  );
  expect(screen.getByText('Icon')).toBeInTheDocument();
  expect(screen.getByTitle('Clear')).toBeInTheDocument();
});

test('clear button reverts to text input', () => {
  const onChange = vi.fn();
  render(
    <SlotField
      name="iconLeft"
      value={{
        type: 'component',
        componentName: 'Icon',
        storyId: 'components-icon--default',
        ghostHtml: '',
        ghostCss: '',
      }}
      onChange={onChange}
    />
  );
  fireEvent.click(screen.getByTitle('Clear'));
  expect(onChange).toHaveBeenCalledWith({ type: 'text', value: '' });
});
