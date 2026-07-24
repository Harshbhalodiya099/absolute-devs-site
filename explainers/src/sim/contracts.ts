/**
 * sim/ — the Simulation engine (headless, deterministic). Phase 3 of the
 * Interactive Learning Engine (`interactive-learning-engine-plan.md`), which is
 * `sim-engine-plan.md` §6/§7 rescoped to **Tier 1**: a single forward pass over
 * a DAG that computes per-node latency/throughput from composable rules. No
 * fixpoint feedback solve (that is Tier 2, deferred to a later phase), no
 * events, no renderer.
 *
 * This file is the whole contract surface — the plain, serializable types every
 * other sim module depends on (they import interfaces from here, never each
 * other's internals). Three hard rules keep the core a "product not toy":
 *
 *   1. **Headless.** Nothing under sim/ imports React or the DOM, so the same
 *      code runs in the browser, in Vitest, and (later) in a Worker.
 *   2. **Deterministic.** Same `(graph, seed)` ⇒ byte-identical trace. The only
 *      randomness is the seeded RNG threaded through `RuleContext`.
 *   3. **Serializable.** State is plain records + arrays, so a trace can be
 *      saved, replayed, and asserted against a golden fixture.
 *
 * NodeId/EdgeId are plain strings (not branded) on purpose: authors write graph
 * literals by hand in tests and scenarios, and brand casts would only add noise
 * at this tier. The brand can return when a scenario loader mints ids for us.
 */

export type NodeId = string;
export type EdgeId = string;

/** JSON-serializable value — the only thing a node's `config` may hold. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/* ================= graph ================= */

export interface SimNode {
  id: NodeId;
  /** Registry key: which `ComponentDef` (and thus rule) drives this node. */
  kind: string;
  /** Display override; the component's own label is used when absent. */
  label?: string;
  /** Instance params (replicas, hitRatio, requestRps …), merged over defaults. */
  config: Record<string, JsonValue>;
  status: "healthy" | "degraded" | "down";
  /** Renderer hint only; the kernel never reads it. */
  pos?: { x: number; y: number };
}

export interface SimEdge {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  /** "http" | "tcp" | "replication" | "async" … — advisory at this tier. */
  kind?: string;
}

export interface SimGraph {
  nodes: SimNode[];
  edges: SimEdge[];
}

/* ================= metrics ================= */

/**
 * Open, keyed metric vocabulary: a metric is just a number under a known key.
 * Adding one (say `replicationLagMs`) means adding a key and having some rule
 * emit it — no core change. Tier 1 populates the first block; the rest exist so
 * rules can contribute them without a type edit.
 */
export type MetricKey =
  | "latencyMs"
  | "throughputRps"
  | "utilizationPct"
  | "errorRatePct"
  | "cacheHitRatio"
  | "costPerMonthUsd"
  | "cpuPct"
  | "memPct"
  | "queueDepth"
  | "availabilityPct"
  | "dbLoadPct";

export type NodeMetrics = Partial<Record<MetricKey, number>>;

/* ================= rules ================= */

/**
 * A seeded pseudo-random source — the ONLY nondeterminism the kernel permits.
 * `next()` yields [0, 1); `int(n)` yields an integer in [0, n).
 */
export interface SeededRng {
  next(): number;
  int(maxExclusive: number): number;
}

/**
 * What a rule sees when it runs, for one node, in one forward pass.
 * `node.config` is already merged over the component defaults.
 */
export interface RuleContext {
  node: SimNode;
  /** Traffic (requests/s) arriving from upstream on this pass. */
  inboundRps: number;
  /** Downstream node ids (out-edges), sorted — for rules that route traffic. */
  out: NodeId[];
  rng: SeededRng;
  tick: number;
}

/** A fraction of a node's served traffic sent to a downstream node. */
export interface Forward {
  to: NodeId;
  /** 0..1 of served traffic; the solver clamps and, with no forwards, splits evenly. */
  fraction: number;
}

/**
 * A rule's three additive channels (sim-engine-plan.md §8): local service, how
 * it routes traffic, and any metrics it emits directly. Composition (a cache
 * forwarding only misses ⇒ the DB sees less load) falls out of `forwards`.
 */
export interface RuleOutput {
  /** Requests/s this node can serve; omitted ⇒ effectively unbounded. */
  capacityRps?: number;
  /** Base processing latency (ms) at zero load; omitted ⇒ 0. */
  serviceCostMs?: number;
  /** Traffic this node injects itself (a client). Adds to its offered load. */
  sourceRps?: number;
  /** Where served traffic goes; omitted ⇒ even split across out-edges. */
  forwards?: Forward[];
  /** Direct metric contributions (cost, hit ratio, memory …). */
  metrics?: NodeMetrics;
}

/** A rule is a pure function. It may read `ctx.rng` but must not read the clock. */
export type Rule = (ctx: RuleContext) => RuleOutput;

/** Data + a rule reference. Registering one makes `kind` usable in a graph. */
export interface ComponentDef {
  kind: string;
  /** Preset key in `vocab/` — visual identity for a future renderer. */
  vocab: string;
  ruleKey: string;
  defaults: Record<string, JsonValue>;
  label?: string;
  docs?: { note: string };
  version: string;
}

/* ================= state ================= */

/**
 * An immutable simulation snapshot. Maps are the internal shape (fast, keyed);
 * `serialize()` turns one into stable JSON for golden comparison and save/replay.
 */
export interface SimState {
  tick: number;
  seed: number;
  nodes: ReadonlyMap<NodeId, SimNode>;
  edges: ReadonlyMap<EdgeId, SimEdge>;
  metrics: ReadonlyMap<NodeId, NodeMetrics>;
  /** Aggregate SLOs (end-to-end latency, delivered throughput, total cost …). */
  global: NodeMetrics;
}
