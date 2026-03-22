import type { DropZoneIndicatorProps } from './types';

/**
 * Renders a visual indicator showing where a dragged component would be
 * inserted: a line for before/after, or a border highlight for inside.
 *
 * Position this component inside a container with `position: relative` and
 * pass the target element's bounding rect (relative to that container).
 */
export function DropZoneIndicator({
  targetRect,
  position,
  axis,
  variant,
}: DropZoneIndicatorProps) {
  if (!targetRect || !position) return null;

  const isTeal = variant === 'teal';
  const lineColor = isTeal ? '#00848B' : '#3b82f6';
  const lineWidth = isTeal ? 3 : 2;
  const isInside = position === 'first-child' || position === 'last-child';

  // "first-child" / "last-child" → border highlight + directional arrow
  if (isInside) {
    const isVerticalLayout = axis === 'vertical';
    // Arrow points to the insertion edge inside the element
    const arrowDir =
      position === 'first-child'
        ? (isVerticalLayout ? 'down' : 'right')   // prepend → arrow at top/left pointing inward
        : (isVerticalLayout ? 'up' : 'left');      // append  → arrow at bottom/right pointing inward

    return (
      <div
        data-testid="drop-indicator"
        data-drop-indicator
        data-position={position}
        style={{
          position: 'absolute',
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          border: isTeal
            ? `2px dashed ${lineColor}`
            : `2px solid ${lineColor}`,
          backgroundColor: isTeal ? undefined : 'rgba(59, 130, 246, 0.06)',
          borderRadius: 4,
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}
      >
        <InsideArrow
          direction={arrowDir}
          color={lineColor}
          axis={isVerticalLayout ? 'vertical' : 'horizontal'}
        />
      </div>
    );
  }

  // "before" / "after" → line indicator
  const isHorizontalLine = axis === 'vertical'; // vertical layout → horizontal separator line
  const style: React.CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    borderRadius: lineWidth,
  };

  if (isHorizontalLine) {
    // Horizontal line spanning the target's width
    const y =
      position === 'before' ? targetRect.top : targetRect.top + targetRect.height;
    Object.assign(style, {
      top: y - lineWidth / 2,
      left: targetRect.left,
      width: targetRect.width,
      height: lineWidth,
      backgroundColor: lineColor,
    });
  } else {
    // Vertical line spanning the target's height
    const x =
      position === 'before' ? targetRect.left : targetRect.left + targetRect.width;
    Object.assign(style, {
      top: targetRect.top,
      left: x - lineWidth / 2,
      width: lineWidth,
      height: targetRect.height,
      backgroundColor: lineColor,
    });
  }

  return (
    <div data-testid="drop-indicator" data-drop-indicator data-position={position} style={style}>
      {/* End-cap arrows for the teal variant — point inward (>———<) */}
      {isTeal && isHorizontalLine && (
        <>
          <Arrow direction="right" end="left" color={lineColor} />
          <Arrow direction="left" end="right" color={lineColor} />
        </>
      )}
      {isTeal && !isHorizontalLine && (
        <>
          <Arrow direction="down" end="top" color={lineColor} />
          <Arrow direction="up" end="bottom" color={lineColor} />
        </>
      )}
    </div>
  );
}

/* ── Directional arrow inside the "first-child" / "last-child" indicator ── */

function InsideArrow({
  direction,
  color,
  axis,
}: {
  direction: 'up' | 'down' | 'left' | 'right';
  color: string;
  axis: 'vertical' | 'horizontal';
}) {
  const size = 6;
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  };

  // Position the arrow at the insertion edge, centered on the cross-axis
  const posMap: Record<string, React.CSSProperties> = {
    down: {
      ...base,
      top: 4,
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: `${size}px ${size}px 0 ${size}px`,
      borderColor: `${color} transparent transparent transparent`,
    },
    up: {
      ...base,
      bottom: 4,
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: `0 ${size}px ${size}px ${size}px`,
      borderColor: `transparent transparent ${color} transparent`,
    },
    right: {
      ...base,
      left: 4,
      top: '50%',
      transform: 'translateY(-50%)',
      borderWidth: `${size}px 0 ${size}px ${size}px`,
      borderColor: `transparent transparent transparent ${color}`,
    },
    left: {
      ...base,
      right: 4,
      top: '50%',
      transform: 'translateY(-50%)',
      borderWidth: `${size}px ${size}px ${size}px 0`,
      borderColor: `transparent ${color} transparent transparent`,
    },
  };

  return <span data-testid="inside-arrow" style={posMap[direction]} />;
}

/* ── Tiny triangle arrow at each end of the line ──────────── */

function Arrow({
  direction,
  color,
  end,
}: {
  /** Which way the triangle points */
  direction: 'up' | 'down' | 'left' | 'right';
  color: string;
  /** Which end of the line to place the arrow (defaults to direction) */
  end?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const size = 5;
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  };

  // Triangle shapes by direction
  const triangles: Record<string, Pick<React.CSSProperties, 'borderWidth' | 'borderColor'>> = {
    left: {
      borderWidth: `${size}px ${size}px ${size}px 0`,
      borderColor: `transparent ${color} transparent transparent`,
    },
    right: {
      borderWidth: `${size}px 0 ${size}px ${size}px`,
      borderColor: `transparent transparent transparent ${color}`,
    },
    up: {
      borderWidth: `0 ${size}px ${size}px ${size}px`,
      borderColor: `transparent transparent ${color} transparent`,
    },
    down: {
      borderWidth: `${size}px ${size}px 0 ${size}px`,
      borderColor: `${color} transparent transparent transparent`,
    },
  };

  // Placement by end position — nudged inward from the line edges
  const inset = -2;
  const placement = end ?? direction;
  const positions: Record<string, React.CSSProperties> = {
    left: { top: '50%', left: inset, transform: 'translateY(-50%)' },
    right: { top: '50%', right: inset, transform: 'translateY(-50%)' },
    top: { left: '50%', top: inset, transform: 'translateX(-50%)' },
    bottom: { left: '50%', bottom: inset, transform: 'translateX(-50%)' },
  };

  return <span style={{ ...base, ...triangles[direction], ...positions[placement] }} />;
}
