// @vitest-environment jsdom

/**
 * Integration tests for React fiber tree walking.
 *
 * Each test renders real JSX into jsdom, queries a DOM element by CSS selector,
 * and asserts structured output from the fiber-walking functions.
 *
 * To add a new case: render JSX → pick selector → assert getInfo() output.
 */

import { describe, it, expect } from 'vitest';
import React, { forwardRef, memo, createContext, useContext } from 'react';
import { render } from '@testing-library/react';
import {
  getFiber,
  findOwningComponent,
  buildPathLabel,
  extractComponentProps,
  findInlineRepeatedNodes,
} from './fiber';
import type { ComponentInfo } from './fiber';

// ---------------------------------------------------------------------------
// Helper: getInfo(container, selector)
// ---------------------------------------------------------------------------

interface BoundaryInfo {
  name: string;
  props: Record<string, unknown> | null;
}

function getInfo(container: HTMLElement, selector: string) {
  const el = container.querySelector(selector);
  if (!el) throw new Error(`Selector "${selector}" matched nothing`);

  const fiber = getFiber(el);
  if (!fiber) throw new Error(`No fiber found on element matching "${selector}"`);

  const boundary = findOwningComponent(fiber);
  const pathLabel = boundary ? buildPathLabel(fiber, boundary) : null;
  const props = boundary ? extractComponentProps(boundary.componentFiber) : null;
  const repeated = boundary
    ? findInlineRepeatedNodes(fiber, boundary.componentFiber)
    : [];

  // Walk ALL boundaries from this element up to the root.
  // Includes both host elements (div, button) and React components.
  const allBoundaries: BoundaryInfo[] = [];
  let current = fiber;
  while (current) {
    const b = findOwningComponent(current);
    if (!b) break;
    allBoundaries.push({
      name: b.componentName,
      props: extractComponentProps(b.componentFiber),
    });
    current = b.componentFiber;
  }

  // Filter to only React component boundaries (functions, forwardRef, memo),
  // skipping host elements like 'div', 'button', 'span'.
  // Host elements are single lowercase HTML tag names; component names contain
  // uppercase letters, parens, dots, or are multi-word.
  const HTML_TAG = /^[a-z][a-z0-9]*$/;
  const componentBoundaries = allBoundaries.filter(
    (b) => !HTML_TAG.test(b.name),
  );

  return {
    fiber,
    boundary,
    pathLabel,
    props,
    repeated,
    allBoundaries,
    componentBoundaries,
    el,
  };
}

// ---------------------------------------------------------------------------
// Test components (defined inline — not imported from test-app)
// ---------------------------------------------------------------------------

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex rounded-full text-xs badge-${color}`}>
      {children}
    </span>
  );
}

function Button({
  variant,
  children,
  leftIcon,
}: {
  variant: string;
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
}) {
  return (
    <button className={`btn btn-${variant}`}>
      {leftIcon && <span className="icon-left">{leftIcon}</span>}
      <span className="btn-label">{children}</span>
    </button>
  );
}

function Card({
  title,
  description,
  tag,
}: {
  title: string;
  description: string;
  tag: string;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        <Badge color="blue">{tag}</Badge>
      </div>
      <p className="card-desc">{description}</p>
    </div>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="page">{children}</div>;
}

function Sidebar({ children }: { children: React.ReactNode }) {
  return <nav className="sidebar">{children}</nav>;
}

function NavItem({ label }: { label: string }) {
  return <a className="nav-item">{label}</a>;
}

function Layout({ children }: { children: React.ReactNode }) {
  return <div className="layout">{children}</div>;
}

function Icon({ name }: { name: string }) {
  return <svg className={`icon icon-${name}`} data-icon={name}><path d="M0 0" /></svg>;
}

function Dashboard({ children }: { children: React.ReactNode }) {
  return <div className="dashboard">{children}</div>;
}

function StatsCard({ metric, badge }: { metric: string; badge: string }) {
  return (
    <div className="stats-card">
      <span className="metric">{metric}</span>
      <Badge color="green">{badge}</Badge>
    </div>
  );
}

function App({ children }: { children: React.ReactNode }) {
  return <div className="app">{children}</div>;
}

function Tree({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="tree-node" data-label={label}>
      <span className="tree-label">{label}</span>
      {children && <div className="tree-children">{children}</div>}
    </div>
  );
}

function Li({ children, className }: { children: React.ReactNode; className?: string }) {
  return <li className={className ?? 'list-item'}>{children}</li>;
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="list">{children}</ul>;
}

const InputWithRef = forwardRef<HTMLInputElement, { placeholder: string }>(
  function Input(props, ref) {
    return <input ref={ref} className="input" placeholder={props.placeholder} />;
  },
);

const MemoTag = memo(function Tag({ label }: { label: string }) {
  return <span className="tag">{label}</span>;
});

function CustomDisplayName() {
  return <div className="custom">hello</div>;
}
CustomDisplayName.displayName = 'MySpecialName';

const ThemeContext = createContext('light');

function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Fiber integration: getInfo(jsx, selector)', () => {
  // == Basic Components ==

  describe('basic components', () => {
    it('#1 simple component — Button', () => {
      const { container } = render(<Button variant="primary">Click</Button>);
      const info = getInfo(container, 'button');

      expect(info.componentBoundaries[0].name).toBe('Button');
      expect(info.componentBoundaries[0].props).toMatchObject({
        variant: 'primary',
        children: 'Click',
      });
    });

    it('#2 forwardRef component — Input', () => {
      const { container } = render(<InputWithRef placeholder="Type..." />);
      const info = getInfo(container, 'input');

      expect(info.componentBoundaries[0].name).toBe('Input');
      expect(info.componentBoundaries[0].props).toMatchObject({
        placeholder: 'Type...',
      });
    });

    it('#3 memo wrapper — Tag', () => {
      const { container } = render(<MemoTag label="hello" />);
      const info = getInfo(container, '.tag');

      expect(info.componentBoundaries[0].name).toBe('Tag');
      expect(info.componentBoundaries[0].props).toMatchObject({ label: 'hello' });
    });

    it('#4 displayName override', () => {
      const { container } = render(<CustomDisplayName />);
      const info = getInfo(container, '.custom');

      expect(info.componentBoundaries[0].name).toBe('MySpecialName');
    });

    it('#5 no component boundary (plain HTML)', () => {
      const { container } = render(<div><span className="plain">text</span></div>);
      const el = container.querySelector('.plain')!;
      const fiber = getFiber(el);
      // In RTL, there's always a wrapping div from render(), so there may be
      // boundaries from the test harness. Check that there's no *named* component.
      const boundary = fiber ? findOwningComponent(fiber) : null;
      // boundary may be a host element like 'div' or 'span', but no function component
      const isHostOnly = !boundary || typeof boundary.componentType === 'string';
      expect(isHostOnly).toBe(true);
    });
  });

  // == Nesting — Component in Component in Component ==

  describe('nesting: component in component in component', () => {
    it('#6 2-deep: Card → Badge', () => {
      const { container } = render(
        <Card title="Test" description="Desc" tag="New" />,
      );
      const info = getInfo(container, '.rounded-full');

      expect(info.componentBoundaries[0].name).toBe('Badge');
      expect(info.componentBoundaries[1].name).toBe('Card');
    });

    it('#7 3-deep: Page → Card → Badge', () => {
      const { container } = render(
        <Page>
          <Card title="Test" description="Desc" tag="New" />
        </Page>,
      );
      const info = getInfo(container, '.rounded-full');

      expect(info.componentBoundaries[0].name).toBe('Badge');
      expect(info.componentBoundaries[1].name).toBe('Card');
      expect(info.componentBoundaries[2].name).toBe('Page');
    });

    it('#8 3-deep with slots: Layout → Sidebar → NavItem', () => {
      const { container } = render(
        <Layout>
          <Sidebar>
            <NavItem label="Home" />
          </Sidebar>
        </Layout>,
      );
      const info = getInfo(container, '.nav-item');

      expect(info.componentBoundaries[0].name).toBe('NavItem');
      expect(info.componentBoundaries[1].name).toBe('Sidebar');
      expect(info.componentBoundaries[2].name).toBe('Layout');
    });

    it('#9 component renders another via prop: Button → Icon via leftIcon', () => {
      const { container } = render(
        <Button variant="save" leftIcon={<Icon name="star" />}>
          Save
        </Button>,
      );
      const info = getInfo(container, 'svg');

      // Nearest component boundary from the SVG is Icon
      expect(info.componentBoundaries[0].name).toBe('Icon');
      // Next is Button
      expect(info.componentBoundaries[1].name).toBe('Button');

      // Button's props should include leftIcon as a serialized React element
      const buttonProps = info.componentBoundaries[1].props!;
      expect(buttonProps.leftIcon).toMatchObject({
        __reactElement: true,
        componentName: 'Icon',
        props: { name: 'star' },
      });
    });

    it('#10 4-deep: App → Dashboard → StatsCard → Badge', () => {
      const { container } = render(
        <App>
          <Dashboard>
            <StatsCard metric="Users" badge="Live" />
          </Dashboard>
        </App>,
      );
      const info = getInfo(container, '.rounded-full');

      expect(info.componentBoundaries.map((b) => b.name)).toEqual(
        expect.arrayContaining(['Badge', 'StatsCard', 'Dashboard', 'App']),
      );
      // Verify order: Badge is nearest, App is outermost
      expect(info.componentBoundaries[0].name).toBe('Badge');
      const appIdx = info.componentBoundaries.findIndex((b) => b.name === 'App');
      expect(appIdx).toBeGreaterThan(0);
    });

    it('#11 same component nested: Tree → Tree → Tree', () => {
      const { container } = render(
        <Tree label="root">
          <Tree label="child">
            <Tree label="leaf" />
          </Tree>
        </Tree>,
      );
      // Select the innermost tree-label
      const leafLabels = container.querySelectorAll('.tree-label');
      const leafLabel = leafLabels[leafLabels.length - 1];
      const info = getInfo(container, `[data-label="leaf"] > .tree-label`);

      // Should find three Tree boundaries with different label props
      const treeBoundaries = info.componentBoundaries.filter(
        (b) => b.name === 'Tree',
      );
      expect(treeBoundaries.length).toBe(3);
      expect(treeBoundaries[0].props?.label).toBe('leaf');
      expect(treeBoundaries[1].props?.label).toBe('child');
      expect(treeBoundaries[2].props?.label).toBe('root');
    });

    it('#12 component wrapping host elements: Card → div → Badge', () => {
      // Card renders <div className="card"><div className="card-header">...<Badge>...</div>
      // The host divs between Card and Badge are not component boundaries
      const { container } = render(
        <Card title="Wrapped" description="Test" tag="Info" />,
      );
      const info = getInfo(container, '.rounded-full');

      // componentBoundaries skips host elements — goes straight Badge → Card
      expect(info.componentBoundaries[0].name).toBe('Badge');
      expect(info.componentBoundaries[1].name).toBe('Card');
    });
  });

  // == Path Labels ==

  describe('path labels', () => {
    it('#13 path through host elements', () => {
      const { container } = render(
        <Button variant="go" leftIcon={null}>
          Go
        </Button>,
      );
      const info = getInfo(container, '.btn-label');

      // buildPathLabel uses the *first* boundary (which may be a host element
      // like 'button') as the root. The path label describes the structural
      // path from that boundary down to the target element.
      expect(info.pathLabel?.label).toBeTruthy();
      // Should contain span somewhere (the target is a span)
      expect(info.pathLabel?.label).toContain('span');
    });
  });

  // == Props Extraction at Each Depth ==

  describe('props extraction at each depth', () => {
    it('#15 props at leaf (Badge)', () => {
      const { container } = render(
        <Page>
          <Card title="Alert" description="Desc" tag="Urgent" />
        </Page>,
      );
      const info = getInfo(container, '.rounded-full');
      const badgeProps = info.componentBoundaries[0].props!;

      expect(info.componentBoundaries[0].name).toBe('Badge');
      expect(badgeProps.color).toBe('blue');
      expect(badgeProps.children).toBe('Urgent');
    });

    it('#16 props at middle (Card)', () => {
      const { container } = render(
        <Page>
          <Card title="Alert" description="Something" tag="Urgent" />
        </Page>,
      );
      const info = getInfo(container, '.rounded-full');
      const cardProps = info.componentBoundaries[1].props!;

      expect(info.componentBoundaries[1].name).toBe('Card');
      expect(cardProps.title).toBe('Alert');
      expect(cardProps.description).toBe('Something');
      expect(cardProps.tag).toBe('Urgent');
    });

    it('#17 props at root (Page) — children serialized as React element', () => {
      const { container } = render(
        <Page>
          <Card title="Alert" description="Desc" tag="Urgent" />
        </Page>,
      );
      const info = getInfo(container, '.rounded-full');
      const pageProps = info.componentBoundaries.find((b) => b.name === 'Page')?.props;

      expect(pageProps).toBeTruthy();
      // Page's children is the Card element, serialized
      expect(pageProps!.children).toMatchObject({
        __reactElement: true,
        componentName: 'Card',
      });
    });

    it('#18 ReactNode props serialize correctly', () => {
      const { container } = render(
        <Button variant="primary" leftIcon={<Icon name="star" />}>
          Go
        </Button>,
      );
      const info = getInfo(container, 'button');
      const buttonProps = info.componentBoundaries[0].props!;

      expect(buttonProps.leftIcon).toMatchObject({
        __reactElement: true,
        componentName: 'Icon',
        props: { name: 'star' },
      });
      expect(buttonProps.variant).toBe('primary');
    });
  });

  // == Repeated / List Patterns ==

  describe('repeated list patterns', () => {
    it('#19 simple repeated items (no component wrapper)', () => {
      // findInlineRepeatedNodes is designed for elements that DON'T have their
      // own component boundary — raw .map() items without a wrapper component.
      const items = ['a', 'b', 'c', 'd', 'e'];
      const { container } = render(
        <List>
          {items.map((i) => (
            <li key={i} className="raw-item">{i}</li>
          ))}
        </List>,
      );
      const info = getInfo(container, '.raw-item');

      // All <li> elements share the same type and className — repeated detection works
      expect(info.repeated.length).toBeGreaterThanOrEqual(5);
    });

    it('#20 repeated with component wrapper — boundary is the component', () => {
      // When each repeated item IS a component (Card), findInlineRepeatedNodes
      // doesn't find siblings because it only searches within the boundary.
      // This is correct: component boundaries are the unit of selection.
      const items = ['A', 'B', 'C', 'D', 'E'];
      const { container } = render(
        <List>
          {items.map((i) => (
            <Card key={i} title={i} description={`Desc ${i}`} tag={i} />
          ))}
        </List>,
      );
      const info = getInfo(container, '.rounded-full');

      // Boundary is Badge (inside Card) — repeated doesn't find siblings
      // because the search scope is Badge→Card, which only has one Card
      expect(info.componentBoundaries[0].name).toBe('Badge');
      expect(info.componentBoundaries[1].name).toBe('Card');
    });

    it('#21 repeated with active outlier (raw elements, no component wrapper)', () => {
      // Same as #19 but one item has a different className (active state).
      // ≤1 outlier tolerance should still find all siblings.
      const items = ['a', 'b', 'c', 'd', 'e'];
      const { container } = render(
        <List>
          {items.map((i) => (
            <li key={i} className={i === 'c' ? 'list-item active' : 'list-item'}>
              {i}
            </li>
          ))}
        </List>,
      );
      const info = getInfo(container, '.list-item');

      // ≤1 outlier tolerance — should still find all siblings
      expect(info.repeated.length).toBeGreaterThanOrEqual(5);
    });
  });

  // == Edge Cases ==

  describe('edge cases', () => {
    it('#22 Fragment wrapper', () => {
      const { container } = render(
        <>
          <Badge color="red">A</Badge>
          <Badge color="blue">B</Badge>
        </>,
      );
      const spans = container.querySelectorAll('.rounded-full');
      const info = getInfo(container, '.rounded-full');

      expect(info.componentBoundaries[0].name).toBe('Badge');
    });

    it('#23 Context provider nesting', () => {
      const { container } = render(
        <ThemeProvider>
          <App>
            <Button variant="themed">Click</Button>
          </App>
        </ThemeProvider>,
      );
      const info = getInfo(container, 'button');

      // Nearest component is Button, not ThemeProvider
      expect(info.componentBoundaries[0].name).toBe('Button');
      // App should be in the chain
      expect(info.componentBoundaries.some((b) => b.name === 'App')).toBe(true);
    });

    it('#24 higher-order component', () => {
      function withWrapper(Wrapped: React.ComponentType<any>) {
        function Wrapper(props: any) {
          return (
            <div className="hoc-wrapper">
              <Wrapped {...props} />
            </div>
          );
        }
        Wrapper.displayName = `withWrapper(${Wrapped.displayName || Wrapped.name})`;
        return Wrapper;
      }

      const WrappedButton = withWrapper(Button);
      const { container } = render(
        <WrappedButton variant="hoc">HOC</WrappedButton>,
      );
      const info = getInfo(container, 'button');

      // Button is still the nearest boundary
      expect(info.componentBoundaries[0].name).toBe('Button');
      // HOC wrapper should also be in the chain
      // Note: the wrapper function's displayName is set to 'withWrapper(Button)'
      // but resolveComponentName checks function.name first; verify the HOC
      // is reachable by checking for either the displayName or function name
      const hocBoundary = info.componentBoundaries.find(
        (b) => b.name.includes('Wrapper') || b.name.includes('withWrapper'),
      );
      expect(hocBoundary).toBeTruthy();
    });
  });
});
