/**
 * Minimal HTML-to-JSX conversion for ReactNode text field content.
 * Handles the most common cases when pasting HTML/SVG into a ReactNode prop:
 *   - Wraps raw HTML in a JS expression string suitable for JSX props
 *   - Does NOT perform a full parse — edge cases should be fixed by the agent
 *
 * Usage: htmlToJsxPropValue('<svg>...</svg>') → '{<svg>...</svg>}'
 */
export function htmlToJsxPropValue(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '""';
  // If it looks like markup, wrap in braces so it's a JSX expression
  if (trimmed.startsWith('<')) {
    return `{${trimmed}}`;
  }
  // Plain text — emit as a quoted string
  return `"${trimmed.replace(/"/g, '\\"')}"`;
}
