// CSS-in-JS style helpers for the overlay.
// Composable style objects keep inline styles DRY and readable.

type StyleObj = Record<string, string>;

/** Convert a camelCase style object to a cssText string. */
export function css(obj: StyleObj): string {
  let out = '';
  for (const key in obj) {
    // camelCase → kebab-case  (e.g. pointerEvents → pointer-events)
    const prop = key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
    out += `${prop}:${obj[key]};`;
  }
  return out;
}

// ── Colors ───────────────────────────────────────────────────────────────

export const TEAL = '#00848B';
export const TEAL_06 = 'rgba(0,132,139,0.06)';

// ── Z-index layers ──────────────────────────────────────────────────────

export const Z_CURSOR = '2147483647';
export const Z_INDICATOR = '2147483645';
export const Z_LOCKED = '2147483644';

// ── Base style objects (compose via spread) ─────────────────────────────

export const FIXED_OVERLAY: StyleObj = {
  position: 'fixed',
  pointerEvents: 'none',
};

export const CURSOR_LABEL: StyleObj = {
  ...FIXED_OVERLAY,
  zIndex: Z_CURSOR,
  background: TEAL,
  color: '#fff',
  fontSize: '11px',
  fontFamily: 'system-ui,sans-serif',
  padding: '3px 8px',
  borderRadius: '4px',
  whiteSpace: 'nowrap',
  opacity: '0',
  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  transition: 'opacity 0.1s',
};

export const INDICATOR_BASE: StyleObj = {
  ...FIXED_OVERLAY,
  zIndex: Z_INDICATOR,
  display: 'none',
};

export const DASHED_BORDER: StyleObj = {
  border: `2px dashed ${TEAL}`,
  borderRadius: '4px',
  boxSizing: 'border-box',
};

export const ARROW_BASE: StyleObj = {
  position: 'absolute',
  width: '0',
  height: '0',
  borderStyle: 'solid',
};

export const LINE_BASE: StyleObj = {
  ...FIXED_OVERLAY,
  display: 'block',
  background: TEAL,
};

// ── Surface colors ──────────────────────────────────────────────────────

export const SURFACE = '#1e1e2e';
export const SURFACE_DARK = '#181825';
export const CANVAS_BG = '#FAFBFB';
export const BORDER_LIGHT = '#DFE2E2';

// ── Container z-index ───────────────────────────────────────────────────

export const Z_CONTAINER = '999999';

// ── Container bases ─────────────────────────────────────────────────────

export const CONTAINER_HOST: StyleObj = {
  position: 'fixed',
  zIndex: Z_CONTAINER,
  background: 'var(--ov-toolbar-bg)',
  pointerEvents: 'auto',
};

export const PANEL_SHADOW: StyleObj = {
  boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
};

export const IFRAME_FILL: StyleObj = {
  width: '100%',
  height: '100%',
  border: 'none',
};

export const IFRAME_FLEX: StyleObj = {
  flex: '1',
  border: 'none',
};

// ── Drag handle ─────────────────────────────────────────────────────────

export const DRAG_HANDLE: StyleObj = {
  height: '28px',
  background: 'var(--ov-toolbar-bg)',
  cursor: 'move',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0',
  userSelect: 'none',
};

// ── Resize handles ──────────────────────────────────────────────────────

export const RESIZE_HANDLE_H: StyleObj = {
  width: '6px',
  cursor: 'ew-resize',
  background: 'var(--ov-toolbar-bg)',
  borderLeft: '1px solid var(--ov-toolbar-sep)',
  flexShrink: '0',
};

export const CORNER_GRIPPER: StyleObj = {
  position: 'absolute',
  bottom: '0',
  right: '0',
  width: '16px',
  height: '16px',
  cursor: 'nwse-resize',
};

// ── Design canvas ───────────────────────────────────────────────────────

export const DESIGN_CANVAS: StyleObj = {
  outline: '2px dashed var(--ov-teal)',
  outlineOffset: '2px',
  borderRadius: '6px',
  background: 'var(--ov-canvas-bg)',
  position: 'relative',
  overflow: 'hidden',
  minWidth: '300px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
  boxSizing: 'border-box',
};

export const DESIGN_CANVAS_IFRAME: StyleObj = {
  ...IFRAME_FILL,
  display: 'block',
};

export const CANVAS_RESIZE_HANDLE: StyleObj = {
  position: 'absolute',
  bottom: '0',
  left: '0',
  right: '0',
  height: '8px',
  cursor: 'ns-resize',
  background: 'linear-gradient(transparent, var(--ov-teal-bg-05))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const CANVAS_RESIZE_BAR: StyleObj = {
  width: '32px',
  height: '3px',
  borderRadius: '2px',
  background: 'var(--ov-canvas-border)',
};

export const CANVAS_CORNER_HANDLE: StyleObj = {
  position: 'absolute',
  bottom: '0',
  right: '0',
  width: '14px',
  height: '14px',
  cursor: 'nwse-resize',
  zIndex: '5',
};

export const CANVAS_CORNER_DECO: StyleObj = {
  position: 'absolute',
  bottom: '2px',
  right: '2px',
  width: '8px',
  height: '8px',
  borderRight: '2px solid var(--ov-canvas-border)',
  borderBottom: '2px solid var(--ov-canvas-border)',
};

// ── Shadow host ─────────────────────────────────────────────────────────

export const SHADOW_HOST: StyleObj = {
  ...FIXED_OVERLAY,
  zIndex: Z_CURSOR,
  top: '0',
  left: '0',
  width: '0',
  height: '0',
};

// ── Submitted design image ──────────────────────────────────────────────

export const SUBMITTED_IMAGE: StyleObj = {
  maxWidth: '100%',
  height: 'auto',
  display: 'block',
  pointerEvents: 'none',
};

// ── Shadow DOM stylesheet ───────────────────────────────────────────────
// Injected into the overlay's shadow root as a <style> element.

export const OVERLAY_CSS = `
  /* ── Color scheme tokens ───────────────────────────────────────────── */
  :host {
    --ov-teal: #00848B;
    --ov-teal-dark: #00464A;
    --ov-teal-mid: #003D40;
    --ov-teal-hover: #006b70;
    --ov-teal-btn-hover: #009da5;
    --ov-teal-confirm-hover: #006E74;
    --ov-teal-ring: rgba(0,132,139,0.5);
    --ov-teal-glow-0: rgba(0,132,139,0);
    --ov-teal-glow-09: rgba(0,132,139,0.09);
    --ov-teal-glow-12: rgba(0,132,139,0.12);
    --ov-teal-glow-07: rgba(0,132,139,0.07);
    --ov-teal-bg-05: rgba(0,132,139,0.05);
    --ov-teal-bg-08: rgba(0,132,139,0.08);
    --ov-teal-light: #5fd4da;
    --ov-teal-label: #1ac2cb;
    --ov-teal-text-light: #E0F5F6;
    --ov-teal-action: #005357;
    --ov-orange: #F5532D;
    --ov-orange-glow: rgba(245,83,45,0.5);
    --ov-orange-bg: rgba(245,83,45,0.15);
    --ov-orange-bg-10: rgba(245,83,45,0.1);
    --ov-orange-ring: rgba(245,83,45,0.35);
    --ov-orange-pulse: rgba(245,83,45,0.4);
    --ov-green: #16a34a;
    --ov-green-bg: rgba(22,163,74,0.15);
    --ov-green-ring: rgba(22,163,74,0.35);
    --ov-red: #dc2626;
    --ov-toolbar-bg: #1a1a1a;
    --ov-toolbar-hover: #333;
    --ov-toolbar-active: #444;
    --ov-toolbar-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06);
    --ov-toolbar-sep: #3a3a3a;
    --ov-input-bg: #2a2a2a;
    --ov-text: #e5e5e5;
    --ov-text-mid: #aaa;
    --ov-text-dim: #999;
    --ov-text-faint: #888;
    --ov-text-subtle: #777;
    --ov-text-muted: #ccc;
    --ov-drawer-bg: var(--ov-teal-mid);
    --ov-drawer-border: rgba(0,132,139,0.3);
    --ov-textarea-bg: rgba(0,0,0,0.25);
    --ov-textarea-placeholder: rgba(255,255,255,0.4);
    --ov-back-btn-color: rgba(255,255,255,0.6);
    --ov-back-btn-hover-bg: rgba(255,255,255,0.08);
    --ov-mic-color: rgba(255,255,255,0.5);
    --ov-mic-hover-bg: rgba(255,255,255,0.06);
    --ov-kbd-bg: rgba(255,255,255,0.08);
    --ov-kbd-border: rgba(255,255,255,0.1);
    --ov-picker-bg: #fff;
    --ov-picker-border: #DFE2E2;
    --ov-picker-shadow: 0 8px 28px rgba(0,0,0,0.14);
    --ov-picker-label: #334041;
    --ov-picker-tag: #A3ADAD;
    --ov-picker-heading: #687879;
    --ov-picker-badge-bg: #F4F5F5;
    --ov-picker-badge-border: #DFE2E2;
    --ov-picker-count: #A0ABAB;
    --ov-toggle-bg: #fff;
    --ov-toggle-border: #DFE2E2;
    --ov-toggle-shadow: 0 2px 8px rgba(0,0,0,0.08);
    --ov-canvas-bg: #FAFBFB;
    --ov-canvas-border: #DFE2E2;
    --ov-depth-sep: rgba(255,255,255,0.06);
    --ov-depth-row-hover: var(--ov-teal-bg-08);
    --ov-toolbar-icon-sep: rgba(255,255,255,0.15);
    --ov-toolbar-ring: rgba(255,255,255,0.12);
    --ov-bottom-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08);
    --ov-toast-bg: var(--ov-teal-dark);
    --ov-toast-text: #F4F5F5;
  }
  :host(.light) {
    --ov-toolbar-bg: #ffffff;
    --ov-toolbar-hover: #e8e8e8;
    --ov-toolbar-active: #d4d4d4;
    --ov-toolbar-shadow: 0 4px 16px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.08);
    --ov-toolbar-sep: #d4d4d4;
    --ov-input-bg: #f0f0f0;
    --ov-text: #1a1a1a;
    --ov-text-mid: #555;
    --ov-text-dim: #666;
    --ov-text-faint: #777;
    --ov-text-subtle: #888;
    --ov-text-muted: #444;
    --ov-drawer-bg: #e6f7f7;
    --ov-drawer-border: rgba(0,132,139,0.2);
    --ov-textarea-bg: rgba(0,0,0,0.05);
    --ov-textarea-placeholder: rgba(0,0,0,0.4);
    --ov-back-btn-color: rgba(0,0,0,0.5);
    --ov-back-btn-hover-bg: rgba(0,0,0,0.06);
    --ov-mic-color: rgba(0,0,0,0.4);
    --ov-mic-hover-bg: rgba(0,0,0,0.05);
    --ov-kbd-bg: rgba(0,0,0,0.06);
    --ov-kbd-border: rgba(0,0,0,0.1);
    --ov-picker-bg: #fff;
    --ov-picker-border: #d4d4d4;
    --ov-picker-shadow: 0 8px 28px rgba(0,0,0,0.1);
    --ov-picker-label: #1a1a1a;
    --ov-picker-tag: #888;
    --ov-picker-heading: #555;
    --ov-picker-badge-bg: #f0f0f0;
    --ov-picker-badge-border: #d4d4d4;
    --ov-picker-count: #888;
    --ov-toggle-bg: #fff;
    --ov-toggle-border: #d4d4d4;
    --ov-toggle-shadow: 0 2px 8px rgba(0,0,0,0.06);
    --ov-depth-sep: rgba(0,0,0,0.08);
    --ov-depth-row-hover: rgba(0,132,139,0.06);
    --ov-toolbar-icon-sep: rgba(0,0,0,0.12);
    --ov-toolbar-ring: rgba(0,0,0,0.08);
    --ov-bottom-shadow: 0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.08);
    --ov-toast-bg: #e6f7f7;
    --ov-toast-text: #003D40;
    --ov-teal-light: #006E74;
    --ov-teal-label: #00848B;
  }
  /* ── Dark-lock: page-floating elements stay dark regardless of color scheme ── */
  :host(.light) .el-toolbar,
  :host(.light) .hover-tooltip,
  :host(.light) .element-drawer,
  :host(.light) .text-action-bar,
  :host(.light) .msg-row {
    --ov-toolbar-bg: #1a1a1a;
    --ov-toolbar-hover: #333;
    --ov-toolbar-active: #444;
    --ov-toolbar-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06);
    --ov-toolbar-sep: #3a3a3a;
    --ov-input-bg: #2a2a2a;
    --ov-text: #e5e5e5;
    --ov-text-mid: #aaa;
    --ov-text-dim: #999;
    --ov-text-faint: #888;
    --ov-text-muted: #666;
    --ov-textarea-bg: rgba(255,255,255,0.06);
    --ov-textarea-placeholder: rgba(255,255,255,0.3);
    --ov-back-btn-color: rgba(255,255,255,0.5);
    --ov-back-btn-hover-bg: rgba(255,255,255,0.08);
    --ov-mic-color: rgba(255,255,255,0.4);
    --ov-mic-hover-bg: rgba(255,255,255,0.06);
    --ov-toolbar-icon-sep: rgba(255,255,255,0.15);
    --ov-toolbar-ring: rgba(255,255,255,0.12);
  }
  .toggle-btn {
    position: fixed;
    bottom: 16px;
    right: 16px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1.5px solid var(--ov-toggle-border);
    cursor: pointer;
    z-index: 999999;
    background: var(--ov-picker-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
    animation: vybit-breathe 3s ease-in-out infinite;
    pointer-events: auto;
  }
  @keyframes vybit-breathe {
    0%, 100% { box-shadow: 0 0 0 0 rgba(0,132,139,0), 0 2px 8px rgba(0,0,0,0.08); }
    50%       { box-shadow: 0 0 0 3px rgba(0,132,139,0.09), 0 0 12px rgba(0,132,139,0.07), 0 2px 8px rgba(0,0,0,0.08); }
  }
  .toggle-btn:hover {
    border-color: var(--ov-teal);
    transform: scale(1.08);
    animation: none;
    box-shadow: 0 0 0 5px rgba(0,132,139,0.12), 0 0 18px rgba(0,132,139,0.12), 0 2px 8px rgba(0,0,0,0.10);
  }
  .toggle-btn:active { transform: scale(0.95); }
  .toggle-btn svg { display: block; }
  .toggle-btn .eb-fill { fill: var(--ov-teal); }
  @keyframes rainbow-eyes {
    0%   { fill: #ff4040; }
    14%  { fill: #ff9800; }
    28%  { fill: #ffee00; }
    42%  { fill: #3dff6e; }
    57%  { fill: #00bfff; }
    71%  { fill: #5050ff; }
    85%  { fill: #cc44ff; }
    100% { fill: #ff4040; }
  }
  .toggle-btn:hover .eb-eye-l { animation: rainbow-eyes 1.8s linear infinite; }
  .toggle-btn:hover .eb-eye-r { animation: rainbow-eyes 1.8s linear infinite; animation-delay: -0.45s; }
  .toast {
    position: fixed;
    bottom: 60px;
    background: var(--ov-toast-bg);
    color: var(--ov-toast-text);
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-family: 'Inter', system-ui, sans-serif;
    z-index: 999999;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    opacity: 0;
    transition: opacity 0.2s;
    transform: translateX(-50%);
  }
  .toast.visible {
    opacity: 1;
  }
  @keyframes highlight-pulse {
    0%, 100% { border-color: var(--ov-teal); box-shadow: 0 0 6px rgba(0,132,139,0.5); }
    50%       { border-color: var(--ov-orange); box-shadow: 0 0 6px rgba(245,83,45,0.5); }
  }
  .highlight-overlay {
    position: fixed;
    pointer-events: none;
    border: 2px solid var(--ov-teal);
    border-radius: 2px;
    box-sizing: border-box;
    z-index: 999998;
    animation: highlight-pulse 2s ease-in-out infinite;
  }
  /* Hover preview — lightweight dashed outline shown while selection mode is active */
  .hover-target-outline {
    position: fixed;
    pointer-events: none;
    border: 2px dashed var(--ov-teal);
    border-radius: 2px;
    box-sizing: border-box;
    z-index: 999999;
    transition: top 80ms ease, left 80ms ease, width 80ms ease, height 80ms ease;
  }
  .hover-tooltip {
    position: fixed;
    pointer-events: none;
    z-index: 1000000;
    background: var(--ov-teal-mid);
    color: var(--ov-teal-text-light);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 11px;
    line-height: 1;
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hover-tooltip .ht-dim { opacity: 0.55; }
  /* ── Element toolbar — 3f unified bar ── */
  .el-toolbar .drag-handle {
    width: 12px;
    height: 28px;
    cursor: move;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 5px 0 0 5px;
    opacity: 0.5;
    transition: opacity 120ms ease-out, background 120ms ease-out;
  }
  .el-toolbar .drag-handle:hover {
    background: var(--ov-toolbar-hover);
    opacity: 1;
  }
  .el-toolbar .drag-handle:active {
    background: var(--ov-toolbar-active);
    opacity: 1;
  }
  .el-toolbar .drag-handle svg {
    width: 6px;
    height: 10px;
  }
  .el-toolbar {
    position: fixed;
    z-index: 999999;
    display: flex;
    align-items: center;
    background: var(--ov-toolbar-bg);
    border-radius: 8px;
    padding: 3px;
    box-shadow: var(--ov-toolbar-shadow);
    pointer-events: auto;
    gap: 1px;
  }
  .el-toolbar .tb {
    height: 28px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--ov-text-mid);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 120ms ease-out;
    position: relative;
    flex-shrink: 0;
    font-family: 'Inter', system-ui, sans-serif;
    padding: 0;
  }
  .el-toolbar .tb:hover { background: var(--ov-toolbar-hover); color: var(--ov-text); }
  .el-toolbar .tb.active { background: var(--ov-toast-bg); color: var(--ov-teal-light); }
  .el-toolbar .tb svg { width: 14px; height: 14px; }
  .el-toolbar .tb-icon { width: 28px; }
  .el-toolbar .tb-combo {
    gap: 4px;
    padding: 0 8px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.2px;
  }
  .el-toolbar .tb-combo svg { width: 12px; height: 12px; }
  .el-toolbar .tb-adjunct {
    padding: 0 6px;
    font-size: 10px;
    font-weight: 700;
    background: transparent;
    border-radius: 0;
  }
  .el-toolbar .mode-group {
    display: flex;
    align-items: center;
    border-radius: 5px;
    overflow: hidden;
    transition: opacity 120ms ease-out;
  }
  .el-toolbar .mode-group.ring {
    box-shadow: inset 0 0 0 1.5px var(--ov-teal);
  }
  .el-toolbar .mode-group.dim { opacity: 0.4; }
  .el-toolbar .mode-group .mode-sep {
    width: 1px;
    height: 14px;
    background: var(--ov-teal-ring);
    flex-shrink: 0;
  }
  .el-toolbar .tb-sep {
    width: 1px;
    height: 16px;
    background: var(--ov-toolbar-sep);
    margin: 0 2px;
    flex-shrink: 0;
  }
  /* ── Message row (legacy — kept for canvas message row) ── */
  .msg-row {
    position: fixed;
    z-index: 999999;
    display: flex;
    align-items: flex-end;
    gap: 4px;
    background: var(--ov-toolbar-bg);
    border-radius: 8px;
    padding: 3px 4px 3px 8px;
    box-shadow: var(--ov-toolbar-shadow);
    pointer-events: auto;
  }
  .msg-row textarea {
    width: 260px;
    border: none;
    background: var(--ov-input-bg);
    color: var(--ov-text);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    padding: 4px 8px;
    border-radius: 5px;
    outline: none;
    resize: none;
    overflow: hidden;
    height: 26px;
    box-sizing: border-box;
    margin: 0;
  }
  .msg-row textarea::placeholder { color: var(--ov-text-faint); }
  .msg-send {
    width: 24px;
    height: 24px;
    border-radius: 5px;
    border: none;
    background: var(--ov-teal);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }
  .msg-send svg { width: 12px; height: 12px; }

  /* ── Element Drawer ── */
  .element-drawer {
    position: fixed;
    z-index: 999999;
    display: flex;
    flex-direction: column;
    width: fit-content;
    background: var(--ov-teal-mid);
    border-radius: 8px;
    padding: 5px 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,132,139,0.3);
    pointer-events: auto;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .ed-btn-pair {
    display: flex;
    gap: 4px;
  }
  .ed-action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border: none;
    border-radius: 6px;
    background: var(--ov-teal-action);
    color: var(--ov-text);
    font-family: inherit;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 100ms;
  }
  .ed-action-btn:hover { background: var(--ov-teal-hover); }
  .ed-action-btn svg { width: 12px; height: 12px; flex-shrink: 0; }

  /* State B — Describe change */
  .ed-describe-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 220px;
  }
  .ed-textarea {
    width: 100%;
    border: none;
    background: var(--ov-textarea-bg);
    color: var(--ov-text);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    padding: 6px 10px;
    border-radius: 6px;
    outline: none;
    resize: none;
    overflow: hidden;
    min-height: 64px;
    box-sizing: border-box;
  }
  .ed-textarea::placeholder { color: var(--ov-textarea-placeholder); }
  .ed-textarea:focus { box-shadow: 0 0 0 1px rgba(0,132,139,0.5); }
  .ed-controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }
  .ed-controls-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .ed-back-btn {
    width: 22px;
    height: 22px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--ov-back-btn-color);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: all 100ms;
  }
  .ed-back-btn:hover { color: var(--ov-text); background: var(--ov-back-btn-hover-bg); }
  .ed-back-btn svg { width: 12px; height: 12px; }
  .ed-queue-btn {
    padding: 4px 10px;
    border-radius: 6px;
    border: none;
    background: var(--ov-teal);
    color: white;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 100ms;
  }
  .ed-queue-btn:hover { background: var(--ov-teal-btn-hover); }
  .ed-mic-btn {
    width: 22px;
    height: 22px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--ov-mic-color);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: all 100ms;
  }
  .ed-mic-btn:hover { color: var(--ov-text); background: var(--ov-mic-hover-bg); }
  .ed-mic-btn svg { width: 13px; height: 13px; }
  .ed-mic-btn.listening {
    background: var(--ov-orange);
    color: white;
    animation: mic-pulse 1.5s ease-in-out infinite;
  }

  /* State C — Edit text row */
  .ed-edit-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ed-pill-orange {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--ov-orange-bg);
    color: var(--ov-orange);
    font-family: inherit;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }
  .ed-discard-btn {
    padding: 4px 8px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--ov-back-btn-color);
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 100ms;
  }
  .ed-discard-btn:hover { color: var(--ov-orange); background: var(--ov-orange-bg-10); }

  /* ── Mic button (voice messages) ── */
  .mic-btn {
    width: 24px;
    height: 24px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--ov-text-faint);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 120ms ease-out;
    padding: 0;
  }
  .mic-btn:hover { color: var(--ov-text); background: var(--ov-mic-hover-bg); }
  .mic-btn svg { width: 13px; height: 13px; }
  .mic-btn.listening {
    background: var(--ov-orange);
    color: white;
    animation: mic-pulse 1.5s ease-in-out infinite;
  }
  .mic-btn.error { color: var(--ov-orange); }
  @keyframes mic-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 83, 45, 0.4); }
    50% { box-shadow: 0 0 0 4px rgba(245, 83, 45, 0); }
  }
  /* ── Mic-blocked banner ── */
  .mic-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999999;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 10px 16px;
    background: var(--ov-orange);
    color: white;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    opacity: 0;
    transform: translateY(-100%);
    transition: opacity 0.25s ease-out, transform 0.25s ease-out;
  }
  .mic-banner.visible {
    opacity: 1;
    transform: translateY(0);
  }
  .mic-banner-dismiss {
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    opacity: 0.8;
    flex-shrink: 0;
  }
  .mic-banner-dismiss:hover { opacity: 1; }

  /* ── Text editing action bar ── */
  .text-action-bar {
    position: fixed;
    z-index: 999999;
    display: flex;
    gap: 6px;
    padding: 4px;
    background: var(--ov-toolbar-bg);
    border: 1px solid var(--ov-toolbar-ring);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    pointer-events: auto;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .text-action-confirm {
    padding: 4px 10px;
    border-radius: 5px;
    border: 1px solid var(--ov-teal);
    background: var(--ov-teal);
    color: white;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.12s;
  }
  .text-action-confirm:hover { background: var(--ov-teal-confirm-hover); }
  .text-action-cancel {
    padding: 4px 10px;
    border-radius: 5px;
    border: 1px solid var(--ov-toolbar-icon-sep);
    background: transparent;
    color: var(--ov-text-muted);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.12s;
  }
  .text-action-cancel:hover {
    border-color: var(--ov-orange);
    color: var(--ov-orange);
    background: var(--ov-orange-bg-10);
  }

  .el-toolbar-sep {
    width: 1px;
    background: var(--ov-toolbar-icon-sep);
    flex-shrink: 0;
    align-self: stretch;
  }
  /* ── Hover preview highlight (dashed, for group hover) ── */
  .highlight-preview {
    position: fixed;
    pointer-events: none;
    border: 2px dashed var(--ov-teal);
    border-radius: 2px;
    box-sizing: border-box;
    z-index: 999998;
  }
  /* ── Group picker popover (replaces instance picker) ── */
  .el-group-exact {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-size: 11px;
    color: var(--ov-picker-count);
  }
  .el-group-exact .el-count-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 600;
    color: white;
    background: var(--ov-teal);
    border-radius: 9999px;
  }
  .el-group-divider {
    padding: 6px 12px 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ov-picker-heading);
    border-top: 1px solid var(--ov-picker-border);
  }
  .el-group-empty {
    padding: 12px 14px;
    font-size: 11px;
    color: var(--ov-picker-heading);
    text-align: left;
  }
  .el-group-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    cursor: pointer;
    transition: background 0.1s;
  }
  .el-group-row:hover { background: var(--ov-teal-bg-05); }
  .el-group-row input[type=checkbox] {
    accent-color: var(--ov-teal);
    width: 13px;
    height: 13px;
    flex-shrink: 0;
    cursor: pointer;
  }
  .el-group-count {
    font-size: 11px;
    font-weight: 600;
    color: var(--ov-picker-label);
    min-width: 20px;
  }
  .el-group-diff {
    flex: 1;
    font-size: 10px;
    font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .el-group-diff .diff-add { color: var(--ov-green); }
  .el-group-diff .diff-rem { color: var(--ov-red); }
  /* ── Instance picker popover ── */
  .el-picker {
    position: fixed;
    z-index: 1000000;
    background: var(--ov-picker-bg);
    border: 1px solid var(--ov-picker-border);
    border-radius: 8px;
    box-shadow: var(--ov-picker-shadow);
    min-width: 240px;
    max-width: 320px;
    font-family: 'Inter', system-ui, sans-serif;
    pointer-events: auto;
    overflow: hidden;
  }
  .el-picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px 6px;
    border-bottom: 1px solid var(--ov-picker-border);
  }
  .el-picker-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ov-picker-heading);
  }
  .el-picker-actions {
    display: flex;
    gap: 8px;
  }
  .el-picker-actions a {
    font-size: 10px;
    color: var(--ov-teal);
    cursor: pointer;
    text-decoration: none;
    font-weight: 500;
  }
  .el-picker-actions a:hover { text-decoration: underline; }
  .el-picker-list {
    max-height: 240px;
    overflow-y: auto;
    padding: 4px 0;
  }
  .el-picker-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    cursor: pointer;
    transition: background 0.1s;
  }
  .el-picker-row:hover { background: var(--ov-teal-bg-05); }
  .el-picker-row input[type=checkbox] {
    accent-color: var(--ov-teal);
    width: 13px;
    height: 13px;
    flex-shrink: 0;
    cursor: pointer;
  }
  .el-picker-badge {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid var(--ov-picker-border);
    background: var(--ov-picker-badge-bg);
    color: var(--ov-picker-heading);
    font-size: 8px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .el-picker-badge.checked {
    border-color: var(--ov-teal);
    background: var(--ov-teal-bg-08);
    color: var(--ov-teal);
  }
  .el-picker-label {
    flex: 1;
    font-size: 11px;
    color: var(--ov-picker-label);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .el-picker-tag {
    font-size: 9px;
    color: var(--ov-picker-tag);
    font-weight: 400;
  }
  .el-picker-footer {
    padding: 6px 10px;
    border-top: 1px solid var(--ov-picker-border);
    display: flex;
    justify-content: flex-end;
  }
  .el-picker-apply {
    height: 26px;
    padding: 0 12px;
    border-radius: 5px;
    border: none;
    background: var(--ov-teal);
    color: white;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
  }
  .el-picker-apply:hover { background: var(--ov-teal-confirm-hover); }

  /* ── Depth disambiguation picker (dark, matches toolbar) ── */
  .depth-picker {
    position: fixed;
    z-index: 1000000;
    background: var(--ov-toolbar-bg);
    border-radius: 8px;
    box-shadow: var(--ov-toolbar-shadow);
    min-width: 280px;
    max-width: 440px;
    font-family: 'Inter', system-ui, sans-serif;
    pointer-events: auto;
    overflow: hidden;
  }
  .depth-picker-header {
    display: flex;
    align-items: center;
    padding: 7px 12px 5px;
    border-bottom: 1px solid var(--ov-depth-sep);
  }
  .depth-picker-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ov-text-dim);
  }
  .depth-picker-list {
    padding: 4px 0;
  }
  .depth-picker-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.1s;
    color: var(--ov-text-muted);
  }
  .depth-picker-row:hover {
    background: var(--ov-teal-bg-08);
  }
  /* Nesting depth indentation */
  .depth-0 { padding-left: 12px; }
  .depth-1 { padding-left: 28px; }
  .depth-2 { padding-left: 44px; }
  .depth-3 { padding-left: 60px; }
  .depth-4 { padding-left: 76px; }
  .depth-picker-tag {
    font-family: 'Roboto Mono', 'Menlo', ui-monospace, monospace;
    font-size: 12px;
    font-weight: 500;
    color: var(--ov-text-mid);
    flex-shrink: 0;
  }
  .depth-picker-row:hover .depth-picker-tag { color: var(--ov-text); }
  .depth-picker-comp {
    font-size: 12px;
    font-weight: 600;
    color: var(--ov-teal-label);
    flex-shrink: 0;
  }
  .depth-picker-classes {
    font-family: 'Roboto Mono', 'Menlo', ui-monospace, monospace;
    font-size: 11px;
    color: var(--ov-text-subtle);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  .depth-picker-row:hover .depth-picker-classes { color: var(--ov-text-mid); }
  .depth-picker-hint {
    font-size: 10px;
    color: var(--ov-text-subtle);
    padding: 5px 12px 7px;
    border-top: 1px solid var(--ov-depth-sep);
  }
  .depth-picker-hint kbd {
    font-family: 'Roboto Mono', 'Menlo', ui-monospace, monospace;
    font-size: 9px;
    background: var(--ov-back-btn-hover-bg);
    border: 1px solid var(--ov-kbd-border);
    padding: 1px 4px;
    border-radius: 2px;
    color: var(--ov-text-mid);
  }
  /* Preview highlight for hovered depth row */
  .depth-picker-preview {
    border: 2px dashed var(--ov-orange);
    border-radius: 2px;
    pointer-events: none;
    z-index: 999998;
  }

  /* ── Bottom toolbar ── */
  .bottom-toolbar {
    position: fixed;
    bottom: 14px;
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--ov-toolbar-bg);
    border-radius: 10px;
    padding: 4px;
    box-shadow: var(--ov-bottom-shadow);
    z-index: 999999;
    pointer-events: auto;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .bottom-toolbar .bt-grip {
    width: 14px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    flex-shrink: 0;
    opacity: 0.5;
    transition: opacity 120ms ease-out;
  }
  .bottom-toolbar .bt-grip:hover { opacity: 1; }
  .bottom-toolbar .bt-grip svg { width: 6px; height: 10px; }
  .bottom-toolbar .bt-combo {
    height: 28px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--ov-text-mid);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0 8px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.2px;
    font-family: 'Inter', system-ui, sans-serif;
    cursor: pointer;
    transition: all 120ms ease-out;
    flex-shrink: 0;
  }
  .bottom-toolbar .bt-combo svg { width: 12px; height: 12px; }
  .bottom-toolbar .bt-combo:hover { background: var(--ov-toolbar-hover); color: var(--ov-text); }
  .bottom-toolbar .bt-combo.dim { opacity: 0.4; }
  .bottom-toolbar.text-editing .bt-combo,
  .bottom-toolbar.text-editing .bt-group,
  .bottom-toolbar.text-editing .bt-adjunct {
    pointer-events: none;
    opacity: 0.25;
  }
  .bottom-toolbar .bt-combo.picking {
    background: var(--ov-orange-bg);
    color: var(--ov-orange);
  }
  .bottom-toolbar .bt-combo.engaged {
    box-shadow: inset 0 0 0 1.5px var(--ov-teal);
    color: var(--ov-teal-light);
  }
  /* ── Select group (Select + 1+) ── */
  .bottom-toolbar .bt-group {
    display: flex;
    align-items: center;
    border-radius: 5px;
    overflow: hidden;
    transition: opacity 120ms ease-out;
  }
  .bottom-toolbar .bt-group.dim { opacity: 0.4; }
  .bottom-toolbar .bt-group .bt-combo { border-radius: 0; }
  .bottom-toolbar .bt-group-sep {
    width: 1px;
    height: 14px;
    background: var(--ov-toolbar-sep);
    flex-shrink: 0;
  }
  .bottom-toolbar .bt-adjunct {
    height: 28px;
    border: none;
    background: transparent;
    color: var(--ov-text-mid);
    padding: 0 6px;
    font-size: 10px;
    font-weight: 700;
    font-family: 'Inter', system-ui, sans-serif;
    display: flex;
    align-items: center;
    cursor: pointer;
    border-radius: 0;
    transition: all 120ms ease-out;
  }
  .bottom-toolbar .bt-adjunct:hover { background: var(--ov-toolbar-hover); }
  .bottom-toolbar .bt-adjunct .plus { font-size: 9px; margin-left: 1px; opacity: 0.6; }
  /* ── Engaged group ── */
  .bottom-toolbar .bt-group.engaged {
    box-shadow: inset 0 0 0 1.5px var(--ov-teal);
  }
  .bottom-toolbar .bt-group.engaged .bt-combo,
  .bottom-toolbar .bt-group.engaged .bt-adjunct { color: var(--ov-teal-light); }
  .bottom-toolbar .bt-group.engaged .bt-group-sep { background: var(--ov-teal-ring); }
  /* ── Picking group ── */
  .bottom-toolbar .bt-group.picking {
    background: var(--ov-orange-bg);
  }
  .bottom-toolbar .bt-group.picking .bt-combo,
  .bottom-toolbar .bt-group.picking .bt-adjunct { color: var(--ov-orange); }
  .bottom-toolbar .bt-group.picking .bt-group-sep { background: var(--ov-orange-ring); }
  /* ── Completed group (green — select done during paste) ── */
  .bottom-toolbar .bt-group.completed {
    background: var(--ov-green-bg);
  }
  .bottom-toolbar .bt-group.completed .bt-combo,
  .bottom-toolbar .bt-group.completed .bt-adjunct { color: var(--ov-green); }
  .bottom-toolbar .bt-group.completed .bt-group-sep { background: var(--ov-green-ring); }
  .bottom-toolbar .bt-combo.completed {
    background: var(--ov-green-bg);
    color: var(--ov-green);
  }
  /* ── Separator ── */
  .bottom-toolbar .bt-sep {
    width: 1px;
    height: 16px;
    background: var(--ov-toolbar-sep);
    margin: 0 2px;
    flex-shrink: 0;
  }
`;
