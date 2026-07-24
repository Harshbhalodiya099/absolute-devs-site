/**
 * DNS simulation — headless entry point (React-free, deterministic).
 *
 * The public surface a renderer needs: a clean initial state, the reducer
 * (as an ordinary two-arg `useReducer` reducer), and the types. Randomness
 * comes from the shared `makeRng` via `reduce` — this module owns no PRNG.
 */
import { reduce } from "./reduce";
import type { DnsAction, DnsNodeId, DnsState } from "./state";

export type { DnsAction, DnsNodeId, DnsPhase, DnsState, Hop } from "./state";

const ALL_NODES: DnsNodeId[] = ["client", "resolver", "root", "tld", "auth"];

/** A fresh idle state. Caching is on by default but nothing is cached yet. */
export function initialDnsState(seed: number): DnsState {
  return {
    tick: 0,
    seed,
    cacheEnabled: true,
    cached: false,
    down: Object.fromEntries(ALL_NODES.map((n) => [n, false])) as Record<DnsNodeId, boolean>,
    phase: "idle",
    plan: [],
    activeHop: 0,
    totalLatencyMs: 0,
    log: [],
  };
}

/**
 * The reducer as a strict two-arg `useReducer` reducer: React dispatches
 * `(state, action)` only, and `reduce` derives its seeded generator from the
 * state. Tests can still call `reduce` directly with an explicit rng.
 */
export const reduceDns = (state: DnsState, action: DnsAction): DnsState => reduce(state, action);
