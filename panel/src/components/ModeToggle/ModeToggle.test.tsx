import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeToggle } from './ModeToggle';

describe('ModeToggle', () => {
  it('renders three icon buttons with tooltips', () => {
    render(<ModeToggle mode="select" onModeChange={() => {}} />);
    expect(screen.getByTitle('Select an element')).toBeInTheDocument();
    expect(screen.getByTitle('Insert to add content')).toBeInTheDocument();
    expect(screen.getByTitle('Report a bug')).toBeInTheDocument();
  });

  it('marks neither as active when mode is null', () => {
    render(<ModeToggle mode={null} onModeChange={() => {}} />);
    expect(screen.getByTitle('Select an element')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTitle('Insert to add content')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTitle('Report a bug')).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks Select as active when mode is select', () => {
    render(<ModeToggle mode="select" onModeChange={() => {}} />);
    expect(screen.getByTitle('Select an element')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTitle('Insert to add content')).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks Insert as active when mode is insert', () => {
    render(<ModeToggle mode="insert" onModeChange={() => {}} />);
    expect(screen.getByTitle('Select an element')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTitle('Insert to add content')).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks Bug Report as active when mode is bug-report', () => {
    render(<ModeToggle mode="bug-report" onModeChange={() => {}} />);
    expect(screen.getByTitle('Report a bug')).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onModeChange with select when Select is clicked', () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="insert" onModeChange={onChange} />);
    fireEvent.click(screen.getByTitle('Select an element'));
    expect(onChange).toHaveBeenCalledWith('select');
  });

  it('calls onModeChange with insert when Insert is clicked', () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="select" onModeChange={onChange} />);
    fireEvent.click(screen.getByTitle('Insert to add content'));
    expect(onChange).toHaveBeenCalledWith('insert');
  });

  it('calls onModeChange with bug-report when Bug Report is clicked', () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="select" onModeChange={onChange} />);
    fireEvent.click(screen.getByTitle('Report a bug'));
    expect(onChange).toHaveBeenCalledWith('bug-report');
  });

  it('re-clicking active mode passes same mode (toggle handled by parent)', () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="select" onModeChange={onChange} />);
    fireEvent.click(screen.getByTitle('Select an element'));
    expect(onChange).toHaveBeenCalledWith('select');
  });

  // -------------------------------------------------------------------
  // Button color states
  // -------------------------------------------------------------------

  describe('button color states', () => {
    it('gray: mode=null → both buttons have inactive style', () => {
      render(<ModeToggle mode={null} onModeChange={() => {}} />);
      const selectBtn = screen.getByTitle('Select an element');
      const insertBtn = screen.getByTitle('Insert to add content');
      expect(selectBtn.className).toContain('bg-transparent');
      expect(insertBtn.className).toContain('bg-transparent');
    });

    it('orange: mode=select + isPicking=true → select button is orange', () => {
      render(<ModeToggle mode="select" onModeChange={() => {}} isPicking={true} />);
      const selectBtn = screen.getByTitle('Select an element');
      expect(selectBtn.className).toContain('F5532D');
    });

    it('teal: mode=select + isEngaged=true → select button is teal', () => {
      render(<ModeToggle mode="select" onModeChange={() => {}} isEngaged={true} />);
      const selectBtn = screen.getByTitle('Select an element');
      expect(selectBtn.className).toContain('00464A');
    });

    it('insert orange: mode=insert + isPicking=true → insert button is orange', () => {
      render(<ModeToggle mode="insert" onModeChange={() => {}} isPicking={true} />);
      const insertBtn = screen.getByTitle('Insert to add content');
      expect(insertBtn.className).toContain('F5532D');
    });

    it('insert teal: mode=insert + isEngaged=true → insert button is teal', () => {
      render(<ModeToggle mode="insert" onModeChange={() => {}} isEngaged={true} />);
      const insertBtn = screen.getByTitle('Insert to add content');
      expect(insertBtn.className).toContain('00464A');
    });

    it('resting gray: mode=insert + no picking/engaged → insert button is gray', () => {
      render(<ModeToggle mode="insert" onModeChange={() => {}} isPicking={false} isEngaged={false} />);
      const insertBtn = screen.getByTitle('Insert to add content');
      expect(insertBtn.className).toContain('bg-transparent');
    });

    it('cross-mode: mode=select → insert button is inactive (gray)', () => {
      render(<ModeToggle mode="select" onModeChange={() => {}} isPicking={true} />);
      const insertBtn = screen.getByTitle('Insert to add content');
      expect(insertBtn.className).toContain('bg-transparent');
    });

    it('cross-mode: mode=insert → select button is inactive (gray)', () => {
      render(<ModeToggle mode="insert" onModeChange={() => {}} isPicking={true} />);
      const selectBtn = screen.getByTitle('Select an element');
      expect(selectBtn.className).toContain('bg-transparent');
    });
  });
});
