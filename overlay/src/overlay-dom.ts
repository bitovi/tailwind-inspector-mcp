// DOM infrastructure for the overlay.
// Holds shadow DOM refs, toolbar DOM refs, hover preview elements, caches,
// and other DOM-level state that is NOT part of the state machine.
//
// These fields are set once at init or lazily, and are never part of
// mode/interaction transitions.

import type { ContainerName, IContainer } from "./containers/IContainer";
import type { ElementGroup } from "./grouping";
import type { DesignCanvasEntry } from "./overlay-state";

export const dom = {
	// ── Shadow DOM refs (set once at init) ──
	shadowRoot: null as unknown as ShadowRoot,
	shadowHost: null as unknown as HTMLElement,

	// ── Containers ──
	containers: null as unknown as Record<ContainerName, IContainer>,
	activeContainer: null as unknown as IContainer,

	// ── Hover preview DOM ──
	hoverOutlineEl: null as HTMLElement | null,
	hoverTooltipEl: null as HTMLElement | null,
	lastHoveredEl: null as Element | null,
	lastMoveTime: 0,

	// ── Toolbar DOM refs ──
	toolbarEl: null as HTMLElement | null,
	msgRowEl: null as HTMLElement | null,
	pickerEl: null as HTMLElement | null,
	pickerCloseHandler: null as ((e: MouseEvent) => void) | null,
	pickerRefreshCallback: null as (() => void) | null,

	// ── Depth picker ──
	depthPickerEl: null as HTMLElement | null,

	// ── Design canvas ──
	designCanvasWrappers: [] as DesignCanvasEntry[],

	// ── Caches ──
	tailwindConfigCache: null as any,
	cachedNearGroups: null as ElementGroup[] | null,
	cachedExactMatches: null as HTMLElement[] | null,

	// ── Instance metadata ──
	currentInstances: [] as Array<{ index: number; label: string; parent: string }>,

	// ── WS tracking ──
	wasConnected: false,
};
