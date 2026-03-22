import { render, screen } from '@testing-library/react';
import { DropZoneIndicator } from './DropZoneIndicator';
import { computeDropPosition } from './useDropZone';

/* ── computeDropPosition unit tests ─────────────────────── */

describe('computeDropPosition', () => {
  const rect = new DOMRect(100, 200, 200, 100);

  describe('vertical axis (4 zones: 25/25/25/25)', () => {
    test('top 25% → before', () => {
      // y = 210 → ratio = 0.1
      expect(computeDropPosition({ x: 200, y: 210 }, rect, 'vertical')).toBe('before');
    });

    test('25–50% → first-child', () => {
      // y = 235 → ratio = 0.35
      expect(computeDropPosition({ x: 200, y: 235 }, rect, 'vertical')).toBe('first-child');
    });

    test('50–75% → last-child', () => {
      // y = 260 → ratio = 0.6
      expect(computeDropPosition({ x: 200, y: 260 }, rect, 'vertical')).toBe('last-child');
    });

    test('bottom 25% → after', () => {
      // y = 285 → ratio = 0.85
      expect(computeDropPosition({ x: 200, y: 285 }, rect, 'vertical')).toBe('after');
    });

    test('exactly 25% boundary → first-child', () => {
      // y = 200 + 0.25 * 100 = 225 → ratio 0.25 → not < 0.25, so first-child
      expect(computeDropPosition({ x: 200, y: 225 }, rect, 'vertical')).toBe('first-child');
    });

    test('exactly 50% boundary → last-child', () => {
      // y = 200 + 0.5 * 100 = 250 → ratio 0.5 → not < 0.5, so last-child
      expect(computeDropPosition({ x: 200, y: 250 }, rect, 'vertical')).toBe('last-child');
    });

    test('exactly 75% boundary → after', () => {
      // y = 200 + 0.75 * 100 = 275 → ratio 0.75 → not < 0.75, so after
      expect(computeDropPosition({ x: 200, y: 275 }, rect, 'vertical')).toBe('after');
    });
  });

  describe('horizontal axis', () => {
    test('left 25% → before', () => {
      expect(computeDropPosition({ x: 120, y: 250 }, rect, 'horizontal')).toBe('before');
    });

    test('25–50% → first-child', () => {
      expect(computeDropPosition({ x: 170, y: 250 }, rect, 'horizontal')).toBe('first-child');
    });

    test('50–75% → last-child', () => {
      expect(computeDropPosition({ x: 230, y: 250 }, rect, 'horizontal')).toBe('last-child');
    });

    test('right 25% → after', () => {
      expect(computeDropPosition({ x: 280, y: 250 }, rect, 'horizontal')).toBe('after');
    });
  });
});

/* ── DropZoneIndicator rendering tests ──────────────────── */

describe('DropZoneIndicator', () => {
  test('renders nothing when targetRect is null', () => {
    const { container } = render(
      <DropZoneIndicator targetRect={null} position={null} axis="vertical" variant="teal" />,
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when position is null', () => {
    const { container } = render(
      <DropZoneIndicator
        targetRect={new DOMRect(0, 0, 200, 50)}
        position={null}
        axis="vertical"
        variant="teal"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders a "before" indicator', () => {
    render(
      <DropZoneIndicator
        targetRect={new DOMRect(10, 20, 200, 50)}
        position="before"
        axis="vertical"
        variant="teal"
      />,
    );
    const indicator = screen.getByTestId('drop-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator.dataset.position).toBe('before');
  });

  test('renders an "after" indicator', () => {
    render(
      <DropZoneIndicator
        targetRect={new DOMRect(10, 20, 200, 50)}
        position="after"
        axis="vertical"
        variant="teal"
      />,
    );
    const indicator = screen.getByTestId('drop-indicator');
    expect(indicator.dataset.position).toBe('after');
  });

  test('renders a "first-child" indicator', () => {
    render(
      <DropZoneIndicator
        targetRect={new DOMRect(10, 20, 200, 50)}
        position="first-child"
        axis="vertical"
        variant="teal"
      />,
    );
    const indicator = screen.getByTestId('drop-indicator');
    expect(indicator.dataset.position).toBe('first-child');
  });

  test('renders a "last-child" indicator', () => {
    render(
      <DropZoneIndicator
        targetRect={new DOMRect(10, 20, 200, 50)}
        position="last-child"
        axis="vertical"
        variant="teal"
      />,
    );
    const indicator = screen.getByTestId('drop-indicator');
    expect(indicator.dataset.position).toBe('last-child');
  });

  test('teal "first-child" uses dashed border', () => {
    render(
      <DropZoneIndicator
        targetRect={new DOMRect(0, 0, 100, 40)}
        position="first-child"
        axis="vertical"
        variant="teal"
      />,
    );
    const indicator = screen.getByTestId('drop-indicator');
    expect(indicator.style.border).toContain('dashed');
  });

  test('blue "last-child" uses solid border + background', () => {
    render(
      <DropZoneIndicator
        targetRect={new DOMRect(0, 0, 100, 40)}
        position="last-child"
        axis="vertical"
        variant="blue"
      />,
    );
    const indicator = screen.getByTestId('drop-indicator');
    expect(indicator.style.border).toContain('solid');
    expect(indicator.style.backgroundColor).toBeTruthy();
  });

  test('"first-child" renders inside-arrow pointing inward (down for vertical)', () => {
    render(
      <DropZoneIndicator
        targetRect={new DOMRect(0, 0, 200, 80)}
        position="first-child"
        axis="vertical"
        variant="teal"
      />,
    );
    const indicator = screen.getByTestId('drop-indicator');
    expect(screen.getByTestId('inside-arrow')).toBeInTheDocument();
  });

  test('"last-child" renders inside-arrow pointing inward (up for vertical)', () => {
    render(
      <DropZoneIndicator
        targetRect={new DOMRect(0, 0, 200, 80)}
        position="last-child"
        axis="vertical"
        variant="teal"
      />,
    );
    expect(screen.getByTestId('inside-arrow')).toBeInTheDocument();
  });

  test('teal "before" renders arrow end-caps', () => {
    render(
      <DropZoneIndicator
        targetRect={new DOMRect(0, 0, 200, 50)}
        position="before"
        axis="vertical"
        variant="teal"
      />,
    );
    const indicator = screen.getByTestId('drop-indicator');
    // Arrow spans are rendered inside
    expect(indicator.querySelectorAll('span').length).toBe(2);
  });

  test('blue "before" does not render arrow end-caps', () => {
    render(
      <DropZoneIndicator
        targetRect={new DOMRect(0, 0, 200, 50)}
        position="before"
        axis="vertical"
        variant="blue"
      />,
    );
    const indicator = screen.getByTestId('drop-indicator');
    expect(indicator.querySelectorAll('span').length).toBe(0);
  });

  test('horizontal axis "before" renders vertical line', () => {
    render(
      <DropZoneIndicator
        targetRect={new DOMRect(50, 10, 150, 80)}
        position="before"
        axis="horizontal"
        variant="teal"
      />,
    );
    const indicator = screen.getByTestId('drop-indicator');
    // For horizontal axis, the line is vertical: height=targetHeight, narrow width
    expect(indicator.style.height).toBe('80px');
    expect(indicator.style.width).toBe('3px');
  });

  test('vertical axis "before" renders horizontal line', () => {
    render(
      <DropZoneIndicator
        targetRect={new DOMRect(50, 10, 150, 80)}
        position="before"
        axis="vertical"
        variant="teal"
      />,
    );
    const indicator = screen.getByTestId('drop-indicator');
    // For vertical axis, the line is horizontal: width=targetWidth, narrow height
    expect(indicator.style.width).toBe('150px');
    expect(indicator.style.height).toBe('3px');
  });
});
