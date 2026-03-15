// Shared types for the PATCH protocol.
// Imported by overlay (esbuild), panel (Vite), and server (tsx).

export type ContainerName = 'modal' | 'popover' | 'sidebar' | 'popup';

export type PatchStatus = 'staged' | 'committed' | 'implementing' | 'implemented' | 'error';

export interface Patch {
  id: string;               // UUID
  elementKey: string;        // stable identifier: componentName::childPath
  status: PatchStatus;
  originalClass: string;     // classToken before edit ('' if adding new)
  newClass: string;          // classToken after edit
  property: string;          // prefix of the change
  timestamp: string;         // ISO 8601
  // Populated at stage time by the overlay (has DOM access):
  pageUrl?: string;          // URL of the inspected page
  component?: { name: string };
  target?: { tag: string; classes: string; innerText: string };
  context?: string;
  errorMessage?: string;
}

/** Lightweight patch info for UI display (omits context/target for smaller WS payloads) */
export interface PatchSummary {
  id: string;
  elementKey: string;
  status: PatchStatus;
  originalClass: string;
  newClass: string;
  property: string;
  timestamp: string;
  component?: { name: string };
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// WebSocket messages
// ---------------------------------------------------------------------------

// Kept unchanged
export interface RegisterMessage {
  type: 'REGISTER';
  role: 'overlay' | 'panel';
}

export interface ElementSelectedMessage {
  type: 'ELEMENT_SELECTED';
  to: 'panel';
  componentName: string;
  instanceCount: number;
  classes: string;
  tailwindConfig: any;
}

export interface ClearHighlightsMessage {
  type: 'CLEAR_HIGHLIGHTS';
  to: 'overlay';
}

export interface SwitchContainerMessage {
  type: 'SWITCH_CONTAINER';
  to: 'overlay';
  container: ContainerName;
}

export interface PingMessage {
  type: 'PING';
}

export interface PongMessage {
  type: 'PONG';
}

// New PATCH_* messages

/** Panel → Overlay: live-preview a class swap */
export interface PatchPreviewMessage {
  type: 'PATCH_PREVIEW';
  to: 'overlay';
  oldClass: string;
  newClass: string;
}

/** Panel → Overlay: revert any active preview */
export interface PatchRevertMessage {
  type: 'PATCH_REVERT';
  to: 'overlay';
}

/** Panel → Overlay: stage a change (overlay fills context, sends PATCH_STAGED to server) */
export interface PatchStageMessage {
  type: 'PATCH_STAGE';
  to: 'overlay';
  id: string;
  oldClass: string;
  newClass: string;
  property: string;
}

/** Overlay → Server: patch with full context, added to server queue */
export interface PatchStagedMessage {
  type: 'PATCH_STAGED';
  patch: Patch;
}

/** Panel → Server: move staged patches to committed status */
export interface PatchCommitMessage {
  type: 'PATCH_COMMIT';
  ids: string[];
}

/** Server → Panel: broadcast current counts and patch lists by status */
export interface PatchUpdateMessage {
  type: 'PATCH_UPDATE';
  staged: number;
  committed: number;
  implementing: number;
  implemented: number;
  patches: {
    staged: PatchSummary[];
    committed: PatchSummary[];
    implementing: PatchSummary[];
    implemented: PatchSummary[];
  };
}

/** Server → Panel: agent reports work-in-progress */
export interface PatchImplementingMessage {
  type: 'PATCH_IMPLEMENTING';
  ids: string[];
}

/** Server → Panel: agent marks changes done */
export interface PatchImplementedMessage {
  type: 'PATCH_IMPLEMENTED';
  ids: string[];
}

/** Server → Panel: error on a specific patch */
export interface PatchErrorMessage {
  type: 'PATCH_ERROR';
  id: string;
  errorMessage: string;
}

// ---------------------------------------------------------------------------
// Union types
// ---------------------------------------------------------------------------

export type OverlayToPanel = ElementSelectedMessage;
export type PanelToOverlay =
  | PatchPreviewMessage
  | PatchRevertMessage
  | PatchStageMessage
  | ClearHighlightsMessage
  | SwitchContainerMessage;
export type OverlayToServer = PatchStagedMessage;
export type PanelToServer = PatchCommitMessage;
export type ClientToServer =
  | RegisterMessage
  | PatchStagedMessage
  | PatchCommitMessage
  | PingMessage;
export type ServerToClient =
  | PongMessage
  | PatchUpdateMessage
  | PatchImplementingMessage
  | PatchImplementedMessage
  | PatchErrorMessage;

export type AnyMessage =
  | RegisterMessage
  | ElementSelectedMessage
  | PatchPreviewMessage
  | PatchRevertMessage
  | PatchStageMessage
  | PatchStagedMessage
  | PatchCommitMessage
  | PatchUpdateMessage
  | PatchImplementingMessage
  | PatchImplementedMessage
  | PatchErrorMessage
  | ClearHighlightsMessage
  | SwitchContainerMessage
  | PingMessage
  | PongMessage;
