// In-memory clipboard for copy/paste of DOM elements.
// Stores ghost HTML + CSS so pasted elements render correctly.

export interface VyBitClipboard {
  ghostHtml: string;
  ghostCss: string;
  sourceComponentName: string;
  sourceClasses: string;
}

let clipboard: VyBitClipboard | null = null;

export function setClipboard(data: VyBitClipboard): void {
  clipboard = data;
}

export function getClipboard(): VyBitClipboard | null {
  return clipboard;
}

export function clearClipboard(): void {
  clipboard = null;
}

/**
 * Extract all class names from an element's outerHTML (including children),
 * then call the server's /css endpoint to generate the Tailwind CSS needed
 * to render a ghost copy of the element.
 *
 * For ghost elements that already have injected CSS, also grabs that style block.
 */
export async function extractGhostCssForElement(
  el: HTMLElement,
  serverOrigin: string,
): Promise<string> {
  // Collect all class names from the element tree
  const allClasses = new Set<string>();
  const html = el.outerHTML;
  const classRegex = /class="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(html)) !== null) {
    for (const cls of match[1].split(/\s+/)) {
      if (cls) allClasses.add(cls);
    }
  }

  // Check if this element is inside a ghost that already has injected CSS
  const ghostName = el.dataset.twDroppedComponent
    ?? el.closest('[data-tw-dropped-component]')?.getAttribute('data-tw-dropped-component');
  if (ghostName) {
    const existingStyle = document.getElementById(`vybit-ghost-css-${ghostName}`);
    if (existingStyle?.textContent) {
      return existingStyle.textContent;
    }
  }

  // Fall back to generating CSS from the server
  if (allClasses.size === 0) return '';
  try {
    const res = await fetch(`${serverOrigin}/css`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classes: [...allClasses] }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.css ?? '';
  } catch {
    return '';
  }
}
