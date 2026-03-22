import type { Meta, StoryObj } from '@storybook/react';
import { useRef } from 'react';
import { DropZoneIndicator } from './DropZoneIndicator';
import { useDropZone } from './useDropZone';
import type { IndicatorVariant } from './types';

/* ── Reusable wrapper that wires useDropZone to DropZoneIndicator ── */

function DemoContainer({
  variant,
  targetSelector,
  children,
}: {
  variant: IndicatorVariant;
  targetSelector?: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { relativeRect, dropPosition, axis, onMouseMove, onMouseLeave } =
    useDropZone({ containerRef, targetSelector });

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ position: 'relative' }}
    >
      {children}
      <DropZoneIndicator
        targetRect={relativeRect}
        position={dropPosition}
        axis={axis}
        variant={variant}
      />
      {dropPosition && (
        <div data-drop-indicator style={{
          position: 'absolute', top: -20, right: 0,
          fontSize: 10, fontFamily: "'Inter', sans-serif",
          color: variant === 'teal' ? '#00848B' : '#3b82f6',
          fontWeight: 600, letterSpacing: '0.04em',
        }}>
          {dropPosition}
        </div>
      )}
    </div>
  );
}

/* ── Fake card element ─────────────────────────────────────── */

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        backgroundColor: '#404040',
        border: '1px solid #555',
        borderRadius: 6,
        color: '#e5e5e5',
        fontSize: 13,
        fontFamily: "'Inter', sans-serif",
        userSelect: 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Meta ──────────────────────────────────────────────────── */

const meta: Meta<typeof DropZoneIndicator> = {
  component: DropZoneIndicator,
  title: 'Panel/DropZoneIndicator',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: 40, backgroundColor: '#2c2c2c', minHeight: '100vh' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DropZoneIndicator>;

/* ═══════════════════════════════════════════════════════════
   Story 1 — VerticalList (flex-col): teal variant
   ═══════════════════════════════════════════════════════════ */
export const VerticalList: Story = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <p style={{ color: '#999', fontSize: 11, marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>
        Hover over cards. Four zones: <b>before</b> · <b>first-child</b> · <b>last-child</b> · <b>after</b>.
      </p>
      <DemoContainer variant="teal">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Card>Header Section</Card>
          <Card>Hero Banner</Card>
          <Card>Feature Grid</Card>
          <Card>Testimonials</Card>
          <Card>Footer</Card>
        </div>
      </DemoContainer>
    </div>
  ),
};

/* ═══════════════════════════════════════════════════════════
   Story 2 — HorizontalFlex (flex-row): teal variant
   ═══════════════════════════════════════════════════════════ */
export const HorizontalFlex: Story = {
  render: () => (
    <div>
      <p style={{ color: '#999', fontSize: 11, marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>
        Horizontal layout. Four zones: <b>before</b> · <b>first-child</b> · <b>last-child</b> · <b>after</b>.
      </p>
      <DemoContainer variant="teal">
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
          <Card style={{ flex: 1 }}>Sidebar</Card>
          <Card style={{ flex: 2 }}>Main Content</Card>
          <Card style={{ flex: 1 }}>Aside</Card>
        </div>
      </DemoContainer>
    </div>
  ),
};

/* ═══════════════════════════════════════════════════════════
   Story 3 — Grid (2 × 3): teal variant
   ═══════════════════════════════════════════════════════════ */
export const Grid: Story = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <p style={{ color: '#999', fontSize: 11, marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>
        CSS grid layout. Indicators follow the grid's row axis (vertical).
      </p>
      <DemoContainer variant="teal">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
          }}
        >
          <Card>Card 1</Card>
          <Card>Card 2</Card>
          <Card>Card 3</Card>
          <Card>Card 4</Card>
          <Card>Card 5</Card>
          <Card>Card 6</Card>
        </div>
      </DemoContainer>
    </div>
  ),
};

/* ═══════════════════════════════════════════════════════════
   Story 4 — Nested: containers that hold child elements
   ═══════════════════════════════════════════════════════════ */
export const Nested: Story = {
  render: () => (
    <div style={{ maxWidth: 520 }}>
      <p style={{ color: '#999', fontSize: 11, marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>
        Real-world nesting: containers with children inside.
        Hover edges for <b>before</b>/<b>after</b> (sibling),
        center for <b>first-child</b>/<b>last-child</b> (insert among existing children).
      </p>
      <DemoContainer variant="teal">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* A container card with children */}
          <Card style={{ padding: 0 }}>
            <div style={{
              padding: '8px 12px', fontSize: 11, fontWeight: 600,
              color: '#999', borderBottom: '1px solid #555',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              Page Header
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ padding: '6px 10px', backgroundColor: '#4a4a4a', borderRadius: 4, fontSize: 12, color: '#ccc' }}>
                Logo
              </div>
              <div style={{ padding: '6px 10px', backgroundColor: '#4a4a4a', borderRadius: 4, fontSize: 12, color: '#ccc' }}>
                Navigation
              </div>
            </div>
          </Card>

          {/* A row container with children */}
          <Card style={{ padding: 10, display: 'flex', flexDirection: 'row', gap: 8 }}>
            <Card style={{ flex: 1, padding: '8px 10px', fontSize: 12 }}>Sidebar</Card>
            <Card style={{ flex: 2, padding: 0 }}>
              <div style={{
                padding: '6px 10px', fontSize: 11, fontWeight: 600,
                color: '#999', borderBottom: '1px solid #555',
              }}>
                Main Content
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ padding: '4px 8px', backgroundColor: '#4a4a4a', borderRadius: 3, fontSize: 11, color: '#bbb' }}>
                  Paragraph 1
                </div>
                <div style={{ padding: '4px 8px', backgroundColor: '#4a4a4a', borderRadius: 3, fontSize: 11, color: '#bbb' }}>
                  Paragraph 2
                </div>
                <div style={{ padding: '4px 8px', backgroundColor: '#4a4a4a', borderRadius: 3, fontSize: 11, color: '#bbb' }}>
                  Paragraph 3
                </div>
              </div>
            </Card>
          </Card>

          {/* A simple leaf card */}
          <Card>Footer</Card>
        </div>
      </DemoContainer>
    </div>
  ),
};

/* ═══════════════════════════════════════════════════════════
   Story 5 — VariantComparison: teal vs blue side-by-side
   ═══════════════════════════════════════════════════════════ */
export const VariantComparison: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 32 }}>
      <div style={{ flex: 1 }}>
        <h3 style={{ color: '#00848B', fontSize: 12, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>
          Teal (Bitovi brand)
        </h3>
        <DemoContainer variant="teal">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Card>Header</Card>
            <Card>Content</Card>
            <Card>Footer</Card>
          </div>
        </DemoContainer>
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ color: '#3b82f6', fontSize: 12, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>
          Blue (VS Code / Figma)
        </h3>
        <DemoContainer variant="blue">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Card>Header</Card>
            <Card>Content</Card>
            <Card>Footer</Card>
          </div>
        </DemoContainer>
      </div>
    </div>
  ),
};

/* ═══════════════════════════════════════════════════════════
   Story 6 — VerticalList with blue variant
   ═══════════════════════════════════════════════════════════ */
export const VerticalListBlue: Story = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <p style={{ color: '#999', fontSize: 11, marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>
        Same vertical list, blue variant. Arrow inside border shows first-child vs last-child.
      </p>
      <DemoContainer variant="blue">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Card>Header Section</Card>
          <Card>Hero Banner</Card>
          <Card>Feature Grid</Card>
          <Card>Testimonials</Card>
          <Card>Footer</Card>
        </div>
      </DemoContainer>
    </div>
  ),
};

/* ═══════════════════════════════════════════════════════════
   Story 7 — HorizontalFlex with blue variant
   ═══════════════════════════════════════════════════════════ */
export const HorizontalFlexBlue: Story = {
  render: () => (
    <div>
      <p style={{ color: '#999', fontSize: 11, marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>
        Horizontal layout, blue variant.
      </p>
      <DemoContainer variant="blue">
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
          <Card style={{ flex: 1 }}>Sidebar</Card>
          <Card style={{ flex: 2 }}>Main Content</Card>
          <Card style={{ flex: 1 }}>Aside</Card>
        </div>
      </DemoContainer>
    </div>
  ),
};

/* ═══════════════════════════════════════════════════════════
   Story 8 — InsidePosition: first-child vs last-child
   ═══════════════════════════════════════════════════════════ */
export const InsidePosition: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 32 }}>
      <div style={{ flex: 1 }}>
        <h3 style={{ color: '#00848B', fontSize: 12, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>
          Vertical (flex-col) — teal
        </h3>
        <p style={{ color: '#999', fontSize: 11, marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>
          Hover the upper-center zone to see <b>first-child</b> (▼ arrow),
          lower-center for <b>last-child</b> (▲ arrow).
        </p>
        <DemoContainer variant="teal">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Card style={{ height: 80, display: 'flex', alignItems: 'center' }}>Tall Card A</Card>
            <Card style={{ height: 80, display: 'flex', alignItems: 'center' }}>Tall Card B</Card>
          </div>
        </DemoContainer>
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ color: '#3b82f6', fontSize: 12, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>
          Horizontal (flex-row) — blue
        </h3>
        <p style={{ color: '#999', fontSize: 11, marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>
          Hover the left-center for <b>first-child</b> (▶ arrow),
          right-center for <b>last-child</b> (◀ arrow).
        </p>
        <DemoContainer variant="blue">
          <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
            <Card style={{ flex: 1, minWidth: 120 }}>Wide A</Card>
            <Card style={{ flex: 1, minWidth: 120 }}>Wide B</Card>
          </div>
        </DemoContainer>
      </div>
    </div>
  ),
};
