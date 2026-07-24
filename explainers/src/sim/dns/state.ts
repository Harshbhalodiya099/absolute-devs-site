/**
 * DNS simulation — the headless state (React-free, plain serializable JSON).
 *
 * This is a Tier-0 scripted state machine (see PHASE4-SIMULATIONS.md §1), not
 * the Tier-1 flow solver: a lookup *walks* the resolver hierarchy hop by hop.
 * State is deliberately a flat JSON object so a `(seed, action list)` pair can
 * be replayed to a byte-identical `JSON.stringify` trace — the same determinism
 * contract the kernel golden tests use.
 */

/** The five actors a lookup can touch, in walk order. */
export type DnsNodeId = "client" | "resolver" | "root" | "tld" | "auth";

/** One leg of the walk: who asked whom, how long it took, and why. */
export interface Hop {
  from: DnsNodeId;
  to: DnsNodeId;
  latencyMs: number;
  /** Human-readable reason, surfaced verbatim in the causal step log. */
  note: string;
}

/** Where a lookup is in its life. */
export type DnsPhase = "idle" | "walking" | "answered" | "failed";

export interface DnsState {
  /** Monotonic action counter — bumped on every reduce, for trace ordering. */
  tick: number;
  /** The one randomness source; carried so `reset` can keep the trace stable. */
  seed: number;
  /** Whether the resolver is allowed to cache answers at all. */
  cacheEnabled: boolean;
  /** Whether the resolver currently holds a valid (un-expired) answer. */
  cached: boolean;
  /** Which servers are currently unreachable (a broken nameserver). */
  down: Record<DnsNodeId, boolean>;
  phase: DnsPhase;
  /** The full deterministic plan built at `lookup`; walked by `advance`. */
  plan: Hop[];
  /** Index into `plan` of the next hop to complete. */
  activeHop: number;
  /** Latency accumulated from the hops completed so far. */
  totalLatencyMs: number;
  /** The causal narration, one line per meaningful event. */
  log: string[];
}

export type DnsAction =
  | { type: "lookup" }
  | { type: "advance" }
  | { type: "toggleCache" }
  | { type: "clearCache" }
  | { type: "toggleDown"; node: DnsNodeId }
  | { type: "reset" };
