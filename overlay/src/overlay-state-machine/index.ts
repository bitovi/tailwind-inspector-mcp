// Overlay state machine — dispatch + getState.
// Single entry point for all state transitions in the overlay.

import type { OverlayState, OverlayAction, OverlayEffect } from './types';
import { overlayReducer, INITIAL_STATE } from './reducer';
import { executeEffects, type EffectDeps } from './effect-executor';

export type { OverlayState, OverlayAction, OverlayEffect } from './types';
export type { EffectDeps } from './effect-executor';
export { INITIAL_STATE } from './reducer';
export { overlayReducer } from './reducer';

// ── Singleton store ──────────────────────────────────────────────────────

let currentState: OverlayState = INITIAL_STATE;
let deps: EffectDeps | null = null;

/** Initialize the state machine with effect dependencies. Call once at overlay boot. */
export function initStateMachine(effectDeps: EffectDeps): void {
  deps = effectDeps;
}

/** Get the current overlay state (read-only snapshot). */
export function getState(): OverlayState {
  return currentState;
}

/**
 * Dispatch an action to transition the overlay state machine.
 * Runs the pure reducer, updates state, then executes effects.
 */
export function dispatch(action: OverlayAction): void {
  if (!deps) {
    console.warn('[overlay-sm] dispatch called before initStateMachine — action dropped:', action.type);
    return;
  }

  const result = overlayReducer(currentState, action);
  const prevState = currentState;
  currentState = result.state;

  // Execute side effects
  if (result.effects.length > 0) {
    executeEffects(result.effects, deps);
  }

  // Notify subscribers
  for (const sub of subscribers) {
    sub(currentState, prevState, action);
  }
}

// ── Subscriptions (for debugging / devtools) ─────────────────────────────

type Subscriber = (state: OverlayState, prev: OverlayState, action: OverlayAction) => void;
const subscribers: Subscriber[] = [];

/** Subscribe to state changes. Returns unsubscribe function. */
export function subscribe(fn: Subscriber): () => void {
  subscribers.push(fn);
  return () => {
    const idx = subscribers.indexOf(fn);
    if (idx >= 0) subscribers.splice(idx, 1);
  };
}

/** Reset state to initial (for testing). */
export function resetState(): void {
  currentState = INITIAL_STATE;
}
