// Patcher: applies/reverts class changes to the live DOM.
// Extracted from index.ts preview/revert logic.

let previewState: { elements: HTMLElement[]; originalClasses: string[] } | null = null;
let previewStyleEl: HTMLStyleElement | null = null;
/** Accumulates CSS for committed/staged classes so revertPreview() never strips it. */
let committedStyleEl: HTMLStyleElement | null = null;
let previewGeneration = 0;

export async function applyPreview(
  elements: HTMLElement[],
  oldClass: string,
  newClass: string,
  serverOrigin: string,
): Promise<void> {
  // Bump generation so any in-flight preview from a previous call is ignored.
  const gen = ++previewGeneration;
  console.log(`[vybit-patcher] applyPreview START gen=${gen} old="${oldClass}" new="${newClass}" elements=${elements.length}`);

  // Save original state on first preview
  if (!previewState) {
    previewState = {
      elements,
      originalClasses: elements.map(n => n.className),
    };
  }

  // Fetch generated CSS for newClass from the MCP server and inject into
  // document.head so the class has styles even if purged from the user's build.
  if (newClass) {
    try {
      const res = await fetch(`${serverOrigin}/css`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        credentials: 'include',
        body: JSON.stringify({ classes: [newClass] }),
      });
      // If a revert (or newer preview) happened while we were fetching, bail out.
      if (gen !== previewGeneration) { console.log(`[vybit-patcher] applyPreview STALE after fetch gen=${gen} current=${previewGeneration}`); return; }
      if (!res.ok) {
        const errBody = await res.text();
        console.error('[vybit-patcher] CSS fetch FAILED:', res.status, errBody);
      } else {
        const { css } = await res.json() as { css: string };
        if (gen !== previewGeneration) { console.log(`[vybit-patcher] applyPreview STALE after parse gen=${gen} current=${previewGeneration}`); return; }
        console.log(`[vybit-patcher] applyPreview injecting CSS gen=${gen} length=${css.length}`);
        if (!previewStyleEl) {
          previewStyleEl = document.createElement('style');
          previewStyleEl.setAttribute('data-tw-preview', '');
          document.head.appendChild(previewStyleEl);
        }
        previewStyleEl.textContent = css;
      }
    } catch (err) {
      console.error('[vybit-patcher] CSS fetch error:', err);
      // If the server is unavailable, apply the class anyway — it may already exist in the build
    }
  }

  // One more staleness check before mutating the DOM.
  if (gen !== previewGeneration) { console.log(`[vybit-patcher] applyPreview STALE before DOM gen=${gen} current=${previewGeneration}`); return; }

  console.log(`[vybit-patcher] applyPreview applying DOM swap gen=${gen} old="${oldClass}" new="${newClass}"`);
  // Restore original classes before applying new swap to avoid accumulation
  if (previewState) {
    for (let i = 0; i < previewState.elements.length; i++) {
      previewState.elements[i].className = previewState.originalClasses[i];
    }
  }

  // Apply class swap to all equivalent nodes
  for (const node of elements) {
    if (oldClass) node.classList.remove(oldClass);
    if (newClass) node.classList.add(newClass);
  }
}

/**
 * Atomically apply multiple class swaps as a single preview.
 * All pairs are applied in one DOM pass after a single CSS fetch.
 */
export async function applyPreviewBatch(
  elements: HTMLElement[],
  pairs: Array<{ oldClass: string; newClass: string }>,
  serverOrigin: string,
): Promise<void> {
  const gen = ++previewGeneration;

  if (!previewState) {
    previewState = {
      elements,
      originalClasses: elements.map(n => n.className),
    };
  }

  const newClasses = pairs.map(p => p.newClass).filter(Boolean);
  if (newClasses.length > 0) {
    try {
      const res = await fetch(`${serverOrigin}/css`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        credentials: 'include',
        body: JSON.stringify({ classes: newClasses }),
      });
      if (gen !== previewGeneration) return;
      if (!res.ok) {
        const errBody = await res.text();
        console.error('[vybit-patcher] CSS batch fetch FAILED:', res.status, errBody);
      } else {
        const { css } = await res.json() as { css: string };
        if (gen !== previewGeneration) return;
        if (!previewStyleEl) {
          previewStyleEl = document.createElement('style');
          previewStyleEl.setAttribute('data-tw-preview', '');
          document.head.appendChild(previewStyleEl);
        }
        previewStyleEl.textContent = css;
      }
    } catch (err) {
      console.error('[vybit-patcher] CSS batch fetch error:', err);
      // Apply anyway if server is unavailable
    }
  }

  if (gen !== previewGeneration) return;

  // Restore originals before applying batch
  if (previewState) {
    for (let i = 0; i < previewState.elements.length; i++) {
      previewState.elements[i].className = previewState.originalClasses[i];
    }
  }

  // Apply all pairs in one DOM pass
  for (const node of elements) {
    for (const { oldClass, newClass } of pairs) {
      if (oldClass) node.classList.remove(oldClass);
      if (newClass) node.classList.add(newClass);
    }
  }
}

export function revertPreview(): void {
  // Invalidate any in-flight applyPreview so it won't apply after this revert.
  previewGeneration++;
  console.log(`[vybit-patcher] revertPreview gen=${previewGeneration} hadPreviewState=${!!previewState}`);

  if (previewState) {
    for (let i = 0; i < previewState.elements.length; i++) {
      previewState.elements[i].className = previewState.originalClasses[i];
    }
    previewState = null;
  }
  // Only remove the active preview style — committedStyleEl is intentionally preserved.
  previewStyleEl?.remove();
  previewStyleEl = null;
}

export function getPreviewState(): { elements: HTMLElement[]; originalClasses: string[] } | null {
  return previewState;
}

/**
 * Clear preview tracking without reverting DOM changes (the staged change is now the baseline).
 * Graduates the preview CSS into committedStyleEl so subsequent revertPreview() calls
 * don't strip CSS that was injected for previously staged classes.
 */
export function commitPreview(): void {
  previewGeneration++;
  console.log(`[vybit-patcher] commitPreview gen=${previewGeneration} hasPreviewStyle=${!!previewStyleEl} previewCssLen=${previewStyleEl?.textContent?.length ?? 0}`);
  previewState = null;

  // Move staged CSS from the transient preview element into the persistent committed bucket.
  if (previewStyleEl) {
    const css = previewStyleEl.textContent || '';
    if (css) {
      if (!committedStyleEl) {
        committedStyleEl = document.createElement('style');
        committedStyleEl.setAttribute('data-tw-committed', '');
        document.head.appendChild(committedStyleEl);
      }
      committedStyleEl.textContent += css;
    }
    previewStyleEl.remove();
    previewStyleEl = null;
  }
}

/**
 * Ensure CSS is committed for a given class.  When PATCH_STAGE races ahead of
 * an in-flight PATCH_PREVIEW CSS fetch, the preview CSS is never injected.
 * This function fetches the CSS independently and appends it to the persistent
 * committedStyleEl so the class always has styles.
 */
export async function ensureCommittedCss(
  newClass: string,
  serverOrigin: string,
): Promise<void> {
  if (!newClass) return;
  console.log(`[vybit-patcher] ensureCommittedCss START class="${newClass}"`);
  try {
    const res = await fetch(`${serverOrigin}/css`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      credentials: 'include',
      body: JSON.stringify({ classes: [newClass] }),
    });
    if (!res.ok) { console.log(`[vybit-patcher] ensureCommittedCss FAILED status=${res.status}`); return; }
    const { css } = await res.json() as { css: string };
    console.log(`[vybit-patcher] ensureCommittedCss OK class="${newClass}" cssLen=${css.length} committedStyleExists=${!!committedStyleEl}`);
    if (!committedStyleEl) {
      committedStyleEl = document.createElement('style');
      committedStyleEl.setAttribute('data-tw-committed', '');
      document.head.appendChild(committedStyleEl);
    }
    committedStyleEl.textContent += css;
    console.log(`[vybit-patcher] ensureCommittedCss DONE committedCssLen=${committedStyleEl.textContent?.length}`);
  } catch (err) {
    console.error(`[vybit-patcher] ensureCommittedCss ERROR`, err);
  }
}
