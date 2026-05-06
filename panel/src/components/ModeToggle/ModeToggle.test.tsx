import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeToggle } from './ModeToggle';

describe('ModeToggle', () => {
  it('renders three icon buttons with tooltips', () => {
    render(<ModeToggle mode="select" onModeChange={() => {}} isEditMode={true} />);
    expect(screen.getByTitle('Edit')).toBeInTheDocument();
    expect(screen.getByTitle('Report a bug')).toBeInTheDocument();
    expect(screen.getByTitle('Theme')).toBeInTheDocument();
  });

  it('marks Edit as active when isEditMode is true', () => {
    render(<ModeToggle mode="select" onModeChange={() => {}} isEditMode={true} />);
    expect(screen.getByTitle('Edit')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTitle('Report a bug')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTitle('Theme')).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks Edit as inactive when in bug-report mode', () => {
    render(<ModeToggle mode="bug-report" onModeChange={() => {}} isEditMode={false} />);
    expect(screen.getByTitle('Edit')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTitle('Report a bug')).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks Theme as active when mode is theme', () => {
    render(<ModeToggle mode="theme" onModeChange={() => {}} isEditMode={false} />);
    expect(screen.getByTitle('Theme')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTitle('Edit')).toHaveAttribute('aria-pressed', 'false');
  });

  it('Edit click from bug-report calls onModeChange with select', () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="bug-report" onModeChange={onChange} isEditMode={false} />);
    fireEvent.click(screen.getByTitle('Edit'));
    expect(onChange).toHaveBeenCalledWith('select');
  });

  it('Edit click when already in edit mode is a no-op', () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="select" onModeChange={onChange} isEditMode={true} />);
    fireEvent.click(screen.getByTitle('Edit'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onModeChange with bug-report when Bug Report is clicked', () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="select" onModeChange={onChange} isEditMode={true} />);
    fireEvent.click(screen.getByTitle('Report a bug'));
    expect(onChange).toHaveBeenCalledWith('bug-report');
  });

  it('calls onModeChange with theme when Theme is clicked', () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="select" onModeChange={onChange} isEditMode={true} />);
    fireEvent.click(screen.getByTitle('Theme'));
    expect(onChange).toHaveBeenCalledWith('theme');
  });

  // -------------------------------------------------------------------
  // Button color states
  // -------------------------------------------------------------------

  describe('button color states', () => {
    it('Edit active has teal background', () => {
      render(<ModeToggle mode="select" onModeChange={() => {}} isEditMode={true} />);
      const editBtn = screen.getByTitle('Edit');
      expect(editBtn.className).toContain('bg-bit-teal-dark');
    });

    it('Edit inactive has transparent background', () => {
      render(<ModeToggle mode="bug-report" onModeChange={() => {}} isEditMode={false} />);
      const editBtn = screen.getByTitle('Edit');
      expect(editBtn.className).toContain('bg-transparent');
    });

    it('Bug Report active has teal background', () => {
      render(<ModeToggle mode="bug-report" onModeChange={() => {}} isEditMode={false} />);
      const bugBtn = screen.getByTitle('Report a bug');
      expect(bugBtn.className).toContain('bg-bit-teal-dark');
    });

    it('Theme active has teal background', () => {
      render(<ModeToggle mode="theme" onModeChange={() => {}} isEditMode={false} />);
      const themeBtn = screen.getByTitle('Theme');
      expect(themeBtn.className).toContain('bg-bit-teal-dark');
    });
  });
});
