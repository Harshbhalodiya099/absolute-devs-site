/**
 * Elasticsearch simulation — the headless state (React-free, plain serializable
 * JSON). Like the DNS and Kubernetes sims this is a Tier-0 scripted state
 * machine; the reuse being validated is the deterministic-reducer spine, not any
 * DNS/K8s-specific idea (see PHASE4 §1).
 *
 * Its *shape* is a third distinct one. DNS builds a plan and walks it once;
 * Kubernetes reconciles a pod count; Elasticsearch reconciles **shard
 * placement**. An index is split into a fixed number of primary shards, and each
 * shard is copied `replicas` times. Every copy is a `ShardCopy` that must live on
 * a node, and a primary and its replica may never share a node — so a node
 * failure both *loses* copies and *promotes* a surviving replica to primary. The
 * loop drives every copy toward `assigned`, then evens the copies across nodes.
 *
 * State stays a flat JSON object so a `(seed, action list)` pair replays to a
 * byte-identical `JSON.stringify` trace — the same determinism contract the
 * kernel, DNS and Kubernetes golden tests use.
 */

/** A cluster node. `down === true` is a failed node — it holds no live copies. */
export interface EsNode {
  id: string;
  /** A down node runs nothing and takes no new copies until it recovers. */
  down: boolean;
}

/** Which kind of copy this is. A shard has exactly one `primary` at all times. */
export type ShardRole = "primary" | "replica";

/**
 * A shard copy's lifecycle, mirroring the states a learner sees in `_cat/shards`:
 * - `assigned`     — STARTED: live on its node, serving reads.
 * - `initializing` — INITIALIZING: placed on a node, still recovering its data.
 * - `relocating`   — RELOCATING: moving from `node` to `relocatingTo` (rebalance).
 * - `unassigned`   — UNASSIGNED: has no home yet (freshly created, or orphaned by
 *                    a node failure). This is what turns a cluster yellow or red.
 */
export type CopyState = "assigned" | "initializing" | "relocating" | "unassigned";

/**
 * One physical copy of one shard. Identity is `id` (stable across role changes,
 * so a promoted replica keeps its id); `role` and `state` carry the meaning the
 * renderer draws. `node` is where it lives now (the source, while relocating);
 * `relocatingTo` is its destination while `state === "relocating"`, else null.
 */
export interface ShardCopy {
  id: string;
  /** Which shard this is a copy of (0 … shards-1). */
  shard: number;
  role: ShardRole;
  state: CopyState;
  node: string | null;
  relocatingTo: string | null;
}

/** Cluster health — the single most important readout in Elasticsearch. */
export type Health = "green" | "yellow" | "red";

/** One shard's leg of a fanned-out search: the copy the coordinator chose. */
export interface SearchRoute {
  shard: number;
  copyId: string;
  role: ShardRole;
  node: string;
  latencyMs: number;
}

/**
 * The result of the most recent search, or null before any search. A search is a
 * scatter/gather: the coordinator asks one live copy of *every* shard in
 * parallel, so the wall-clock latency is the **slowest** shard plus a small merge
 * cost — not the sum. If any shard has no live copy the result is partial.
 */
export interface SearchResult {
  /** The node that received the client request and fanned the query out. */
  coordinator: string;
  /** One chosen copy per reachable shard. */
  routes: SearchRoute[];
  /** Shards with no live copy — their data is missing from the result. */
  missingShards: number[];
  /** Simulated wall-clock latency: slowest shard + merge overhead. */
  totalLatencyMs: number;
  /** True when every shard answered. */
  ok: boolean;
}

export interface EsState {
  /** Monotonic action counter — bumped on every reduce, for trace ordering. */
  tick: number;
  /** The one randomness source (seeds allocation tie-breaks and search jitter). */
  seed: number;
  /** How many primary shards the index has (fixed for the life of the index). */
  shards: number;
  /** Replica copies per shard (adjustable — the redundancy/cost trade-off). */
  replicas: number;
  nodes: EsNode[];
  copies: ShardCopy[];
  /** Next copy id to hand out — keeps ids deterministic and trace-stable. */
  nextCopyId: number;
  /** Next node number to hand out when a node is added. */
  nextNodeId: number;
  /**
   * True once a `tick` reaches a fixed point (nothing changed). The renderer's
   * timer runs the loop only while this is false, so a fully recovered — or a
   * genuinely stuck (not enough nodes for the replicas) — cluster stops ticking.
   */
  settled: boolean;
  /** Cumulative count of completed shard relocations — a teaching metric. */
  relocations: number;
  /** The most recent search's routing + latency, or null. */
  lastSearch: SearchResult | null;
  /** The causal narration, one line per meaningful event. */
  log: string[];
}

export type EsAction =
  | { type: "tick" }
  /** Toggle a node between up and down (simulate a node failure / recovery). */
  | { type: "toggleNode"; id: string }
  /** Add a fresh node to the cluster (triggers rebalancing). */
  | { type: "addNode" }
  /** Permanently remove a node (its copies are orphaned and reallocated). */
  | { type: "removeNode"; id: string }
  /** Fan a search out across the shards and record its routing + latency. */
  | { type: "search" }
  /** Change the replica count per shard (redundancy vs. storage cost). */
  | { type: "setReplicas"; count: number }
  | { type: "reset" };
