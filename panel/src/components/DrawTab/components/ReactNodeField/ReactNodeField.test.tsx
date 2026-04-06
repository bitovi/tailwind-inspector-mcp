import { render, screen, fireEvent } from '@testing-library/react';
import { ReactNodeField } from './ReactNodeField';
import type { ArmedComponentData } from '../../types';

const armedData: ArmedComponentData = {
  componentName: 'Icon',
  storyId: 'components-icon--default',
  ghostHtml: '<svg width="12" height="12"></svg>',
  ghostCss: '',
};

test('renders empty text input by default', () => {
  render(<ReactNodeField name="iconLeft" value={undefined} onChange={() => {}} />);
  expect(screen.getByPlaceholderText('(empty)')).toBeInTheDocument();
});

test('renders with existing text value', () => {
  render(<ReactNodeField name="children" value={{ type: 'text', value: 'Hello' }} onChange={() => {}} />);
  expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
});

test('calls onChange with text value on typing', () => {
  const onChange = vi.fn();
  render(<ReactNodeField name="children" value={{ type: 'text', value: '' }} onChange={onChange} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New text' } });
  expect(onChange).toHaveBeenCalledWith({ type: 'text', value: 'New text' });
});

test('shows receptive placeholder when armed', () => {
  render(
    <ReactNodeField
      name="iconLeft"
      value={undefined}
      onChange={() => {}}
      armedComponentData={armedData}
    />
  );
  expect(screen.getByPlaceholderText('Click to set Icon')).toBeInTheDocument();
});

test('assigns component on click when armed', () => {
  const onChange = vi.fn();
  const onDisarm = vi.fn();
  render(
    <ReactNodeField
      name="iconLeft"
      value={undefined}
      onChange={onChange}
      armedComponentData={armedData}
      onDisarm={onDisarm}
    />
  );
  fireEvent.click(screen.getByPlaceholderText('Click to set Icon'));
  expect(onChange).toHaveBeenCalledWith({
    type: 'component',
    componentName: 'Icon',
    storyId: 'components-icon--default',
    componentPath: undefined,
    args: undefined,
    ghostHtml: '<svg width="12" height="12"></svg>',
    ghostCss: '',
  });
  expect(onDisarm).toHaveBeenCalled();
});

test('renders component chip when filled', () => {
  render(
    <ReactNodeField
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
    <ReactNodeField
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
