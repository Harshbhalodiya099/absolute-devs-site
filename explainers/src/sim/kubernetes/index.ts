/**
 * Kubernetes simulation — headless entry point (React-free, deterministic).
 *
 * The public surface a renderer needs: a clean initial state, the reducer (as an
 * ordinary two-arg `useReducer` reducer), and the types. Randomness comes from
 * the shared `makeRng` via `reduce` — this module owns no PRNG.
 */
import { initialKubeState, reduce } from "./reduce";
import type { KubeAction, KubeState } from "./state";

export type { KubeAction, KubeNode, KubeState, Pod, PodPhase } from "./state";
export { initialKubeState };

/**
 * The reducer as a strict two-arg `useReducer` reducer: React dispatches
 * `(state, action)` only, and `reduce` derives its seeded generator from the
 * state. Tests can still call `reduce` directly with an explicit rng.
 */
export const reduceKube = (state: KubeState, action: KubeAction): KubeState => reduce(state, action);
