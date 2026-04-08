// @vitest-environment jsdom
import { it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { getFiber, findComponentBoundary } from './fiber';

function Button({ variant, children }: { variant: string; children: React.ReactNode }) {
  return <button className={`btn btn-${variant}`}>{children}</button>;
}

function withWrapper(Wrapped: React.ComponentType<any>) {
  function Wrapper(props: any) {
    return <div className="hoc-wrapper"><Wrapped {...props} /></div>;
  }
  Wrapper.displayName = `withWrapper(${Wrapped.displayName || Wrapped.name})`;
  return Wrapper;
}

it('debug HOC boundaries', () => {
  const WrappedButton = withWrapper(Button);
  const { container } = render(<WrappedButton variant="hoc">HOC</WrappedButton>);
  const btn = container.querySelector('button')!;
  const fiber = getFiber(btn);

  const boundaries: string[] = [];
  let current = fiber;
  while (current) {
    const b = findComponentBoundary(current);
    if (!b) break;
    boundaries.push(`${b.componentName} (type: ${typeof b.componentType})`);
    current = b.componentFiber;
  }
  console.log('HOC boundaries:', boundaries);
  expect(true).toBe(true);
});

function Li({ children, className }: { children: React.ReactNode; className?: string }) {
  return <li className={className ?? 'list-item'}>{children}</li>;
}

it('debug repeated', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  const { container } = render(
    <ul>{items.map(i => <Li key={i}>{i}</Li>)}</ul>
  );
  const li = container.querySelector('li')!;
  const fiber = getFiber(li);
  const boundary = findComponentBoundary(fiber);
  console.log('Li boundary:', boundary?.componentName, 'type:', typeof boundary?.componentType);

  let current = fiber;
  const chain: string[] = [];
  while (current) {
    const b = findComponentBoundary(current);
    if (!b) break;
    chain.push(b.componentName);
    current = b.componentFiber;
  }
  console.log('Full chain from li:', chain);

  let f = fiber;
  const fiberChain: string[] = [];
  while (f) {
    const name = typeof f.type === 'string' ? f.type : (f.type?.name || f.type?.displayName || `tag=${f.tag}`);
    fiberChain.push(name);
    f = f.return;
  }
  console.log('Raw fiber chain:', fiberChain);
});
