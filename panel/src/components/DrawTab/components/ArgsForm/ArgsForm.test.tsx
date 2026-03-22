import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArgsForm } from './ArgsForm';

describe('ArgsForm', () => {
  test('renders nothing when argTypes is empty', () => {
    const { container } = render(
      <ArgsForm argTypes={{}} args={{}} onArgsChange={() => {}} />
    );
    expect(container.innerHTML).toBe('');
  });

  test('renders a select for select control type', () => {
    render(
      <ArgsForm
        argTypes={{ color: { control: 'select', options: ['blue', 'red', 'green'] } }}
        args={{ color: 'blue' }}
        onArgsChange={() => {}}
      />
    );
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('blue')).toBeInTheDocument();
    expect(screen.getByText('red')).toBeInTheDocument();
    expect(screen.getByText('green')).toBeInTheDocument();
  });

  test('calls onArgsChange when select value changes', () => {
    const onChange = vi.fn();
    render(
      <ArgsForm
        argTypes={{ color: { control: 'select', options: ['blue', 'red'] } }}
        args={{ color: 'blue' }}
        onArgsChange={onChange}
      />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'red' } });
    expect(onChange).toHaveBeenCalledWith({ color: 'red' });
  });

  test('renders a text input for text control type', () => {
    render(
      <ArgsForm
        argTypes={{ children: { control: 'text' } }}
        args={{ children: 'Hello' }}
        onArgsChange={() => {}}
      />
    );
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Hello');
  });

  test('calls onArgsChange when text input changes', () => {
    const onChange = vi.fn();
    render(
      <ArgsForm
        argTypes={{ children: { control: 'text' } }}
        args={{ children: 'Hello' }}
        onArgsChange={onChange}
      />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'World' } });
    expect(onChange).toHaveBeenCalledWith({ children: 'World' });
  });

  test('renders a checkbox for boolean control type', () => {
    render(
      <ArgsForm
        argTypes={{ disabled: { control: 'boolean' } }}
        args={{ disabled: true }}
        onArgsChange={() => {}}
      />
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  test('calls onArgsChange when checkbox is toggled', () => {
    const onChange = vi.fn();
    render(
      <ArgsForm
        argTypes={{ disabled: { control: 'boolean' } }}
        args={{ disabled: false }}
        onArgsChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith({ disabled: true });
  });

  test('renders a number input for number control type', () => {
    render(
      <ArgsForm
        argTypes={{ count: { control: 'number' } }}
        args={{ count: 5 }}
        onArgsChange={() => {}}
      />
    );
    const input = screen.getByRole('spinbutton');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(5);
  });

  test('renders text input for unknown control type', () => {
    render(
      <ArgsForm
        argTypes={{ custom: { control: 'object' } }}
        args={{ custom: 'something' }}
        onArgsChange={() => {}}
      />
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('something');
  });

  test('renders multiple fields', () => {
    render(
      <ArgsForm
        argTypes={{
          color: { control: 'select', options: ['blue', 'red'] },
          children: { control: 'text' },
        }}
        args={{ color: 'blue', children: 'Hello' }}
        onArgsChange={() => {}}
      />
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  test('preserves other args when one field changes', () => {
    const onChange = vi.fn();
    render(
      <ArgsForm
        argTypes={{
          color: { control: 'select', options: ['blue', 'red'] },
          children: { control: 'text' },
        }}
        args={{ color: 'blue', children: 'Hello' }}
        onArgsChange={onChange}
      />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'red' } });
    expect(onChange).toHaveBeenCalledWith({ color: 'red', children: 'Hello' });
  });
});
