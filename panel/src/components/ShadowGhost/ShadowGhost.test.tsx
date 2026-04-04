import { render } from '@testing-library/react';
import { ShadowGhost } from './ShadowGhost';

test('attaches shadow DOM with CSS and HTML', () => {
  const { container } = render(
    <ShadowGhost ghostHtml="<span>Hello</span>" ghostCss=".test { color: red }" />,
  );
  const host = container.firstElementChild as HTMLElement;
  expect(host.shadowRoot).toBeTruthy();
  expect(host.shadowRoot!.innerHTML).toContain('.test { color: red }');
  expect(host.shadowRoot!.innerHTML).toContain('<span>Hello</span>');
});

test('passes style and className to host element', () => {
  const { container } = render(
    <ShadowGhost
      ghostHtml="<div>Test</div>"
      ghostCss=""
      style={{ opacity: 0.5 }}
      className="my-class"
    />,
  );
  const host = container.firstElementChild as HTMLElement;
  expect(host.style.opacity).toBe('0.5');
  expect(host.className).toBe('my-class');
});

test('updates shadow DOM when ghostHtml changes', () => {
  const { container, rerender } = render(
    <ShadowGhost ghostHtml="<span>First</span>" ghostCss="" />,
  );
  const host = container.firstElementChild as HTMLElement;
  expect(host.shadowRoot!.innerHTML).toContain('First');

  rerender(<ShadowGhost ghostHtml="<span>Second</span>" ghostCss="" />);
  expect(host.shadowRoot!.innerHTML).toContain('Second');
});
