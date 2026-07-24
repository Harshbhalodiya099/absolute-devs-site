/**
 * Elasticsearch simulation — headless entry point (React-free, deterministic).
 *
 * The public surface a renderer needs: a clean initial state, the reducer (as an
 * ordinary two-arg `useReducer` reducer), the `health` selector, and the types.
 * Randomness comes from the shared `makeRng` via `reduce` — this module owns no
 * PRNG.
 */
import { health, initialEsState, reduce } from "./reduce";
import type { EsAction, EsState } from "./state";

export type { CopyState, EsAction, EsNode, EsState, Health, SearchResult, SearchRoute, ShardCopy, ShardRole } from "./state";
export { initialEsState, health };

/**
 * The reducer as a strict two-arg `useReducer` reducer: React dispatches
 * `(state, action)` only, and `reduce` derives its seeded generator from the
 * state. Tests can still call `reduce` directly with an explicit rng.
 */
export const reduceEs = (state: EsState, action: EsAction): EsState => reduce(state, action);
