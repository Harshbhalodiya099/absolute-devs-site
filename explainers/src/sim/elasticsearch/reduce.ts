/**
 * Elasticsearch simulation — the pure reducer. `reduce(state, action, rng) =>
 * state` never mutates its input, so a `(seed, action list)` pair replays to a
 * byte-identical trace. Randomness is confined to `tick` (allocation tie-breaks)
 * and `search` (per-shard latency jitter); every other action is deterministic.
 *
 * The heart is `tick`: one turn of the shard-allocation loop. As in the K8s sim
 * each copy advances by **at most one state per turn** (gated on its state at the
 * *start* of the turn) so the learner watches recovery happen step by step:
 *
 *   node fails → copies lost → replica promoted → new copy initializes → assigned
 *
 * The rng is a defaulted parameter so this doubles as an ordinary two-arg
 * `useReducer` reducer (`reduceEs`): React never threads a generator through
 * dispatch, and the seed still fully determines placement and latency.
 */
import { makeRng } from "../rng";
import type { SeededRng } from "../contracts";
import type { CopyState, EsAction, EsNode, EsState, Health, SearchResult, SearchRoute, ShardCopy } from "./state";

/** Number of primary shards the index is created with (fixed for its life). */
const SHARDS = 4;

/** States that put a copy on a node (count against that node's load). */
const ON_NODE: CopyState[] = ["assigned", "initializing", "relocating"];

/** States in which a copy is serving reads / can be promoted or queried. */
const LIVE: CopyState[] = ["assigned", "initializing", "relocating"];

const nodeById = (nodes: EsNode[], id: string | null) => nodes.find((n) => n.id === id);
const isUp = (nodes: EsNode[], id: string | null) => !!nodeById(nodes, id) && !nodeById(nodes, id)!.down;

/** How many copies currently sit on a node (its source node, while relocating). */
function load(copies: ShardCopy[], nodeId: string): number {
  return copies.filter((c) => c.node === nodeId && ON_NODE.includes(c.state)).length;
}

/** Every copy of one shard. */
const shardCopies = (copies: ShardCopy[], shard: number) => copies.filter((c) => c.shard === shard);

/**
 * Pick the least-loaded up node that does **not** already hold a copy of this
 * shard (a primary and its replica may never co-locate — that is the whole point
 * of replicas). Ties broken with the seeded rng, so placement is varied but fully
 * replayable. Returns null when no node can legally host the copy (it stays
 * unassigned — yellow if it is a replica, red if it is the only primary).
 */
function pickNode(copies: ShardCopy[], nodes: EsNode[], copy: ShardCopy, rng: SeededRng): EsNode | null {
  const taken = new Set(shardCopies(copies, copy.shard).filter((c) => c.id !== copy.id && c.node).map((c) => c.node));
  const eligible = nodes.filter((n) => !n.down && !taken.has(n.id));
  if (eligible.length === 0) return null;
  const min = Math.min(...eligible.map((n) => load(copies, n.id)));
  const tied = eligible.filter((n) => load(copies, n.id) === min);
  return tied[rng.int(tied.length)];
}

/** A shard's primary copy (there is always exactly one). */
const primaryOf = (copies: ShardCopy[], shard: number) => shardCopies(copies, shard).find((c) => c.role === "primary");

/**
 * Cluster health, the way Elasticsearch computes it:
 * - **red**    — at least one shard has no *assigned* primary (data unavailable).
 * - **yellow** — every primary is assigned, but some replica is not (no full
 *                redundancy — you would lose data if the wrong node died now).
 * - **green**  — every copy, primary and replica, is assigned.
 */
export function health(state: EsState): Health {
  for (let s = 0; s < state.shards; s++) {
    const p = primaryOf(state.copies, s);
    if (!p || p.state !== "assigned") return "red";
  }
  return state.copies.every((c) => c.state === "assigned") ? "green" : "yellow";
}

/** One turn of the allocation loop. Pure: reads `state`, returns the next. */
function tick(state: EsState, rng: SeededRng): EsState {
  const startState: Record<string, CopyState> = {};
  for (const c of state.copies) startState[c.id] = c.state;

  const log: string[] = [];
  let relocations = state.relocations;
  let copies: ShardCopy[] = state.copies.map((c) => ({ ...c }));

  // 1. Fail detection: any copy on a down (or vanished) node is orphaned. It
  //    keeps its role for now; promotion in step 2 repairs a lost primary.
  for (const c of copies) {
    if (c.state !== "unassigned" && !isUp(state.nodes, c.node)) {
      log.push(`shard ${c.shard} ${c.role} lost — node ${c.node} is gone`);
      c.state = "unassigned";
      c.node = null;
      c.relocatingTo = null;
    }
  }

  // 2. Promotion: for any shard whose primary is now down, promote a surviving
  //    replica to primary and demote the orphaned primary copy to replica. This
  //    keeps exactly one primary per shard, and is the concept the sim exists to
  //    teach: primary → (replica promoted) → new primary.
  for (let s = 0; s < state.shards; s++) {
    const p = primaryOf(copies, s);
    if (p && p.state === "unassigned") {
      const replica = shardCopies(copies, s).find((c) => c.role === "replica" && LIVE.includes(c.state));
      if (replica) {
        replica.role = "primary";
        p.role = "replica";
        log.push(`replica of shard ${s} promoted to primary on ${replica.node}`);
      }
    }
  }

  // 3. Allocate copies that were unassigned at the *start* of the turn onto a
  //    legal node — INITIALIZING first, so recovery is a visible two-step.
  for (const c of copies) {
    if (c.state === "unassigned" && startState[c.id] === "unassigned") {
      const node = pickNode(copies, state.nodes, c, rng);
      if (node) {
        c.state = "initializing";
        c.node = node.id;
        log.push(`shard ${c.shard} ${c.role} recovering on ${node.id}`);
      }
    }
  }

  // 4. Finish recovery: copies that were INITIALIZING at the start are now STARTED.
  for (const c of copies) {
    if (c.state === "initializing" && startState[c.id] === "initializing") {
      c.state = "assigned";
      log.push(`shard ${c.shard} ${c.role} started on ${c.node}`);
    }
  }

  // 5. Complete relocations: copies that were RELOCATING at the start land on
  //    their destination node.
  for (const c of copies) {
    if (c.state === "relocating" && startState[c.id] === "relocating" && c.relocatingTo) {
      log.push(`shard ${c.shard} ${c.role} relocated ${c.node} → ${c.relocatingTo}`);
      c.node = c.relocatingTo;
      c.relocatingTo = null;
      c.state = "assigned";
      relocations++;
    }
  }

  // 6. Rebalance — only once the cluster is otherwise quiet (nothing pending or
  //    moving). Move one copy off the most-loaded node onto the least-loaded when
  //    the gap is ≥ 2, without co-locating a shard's copies. Each move shrinks the
  //    gap by 2, so the loop terminates rather than oscillating.
  const quiet = copies.every((c) => c.state === "assigned");
  if (quiet) {
    const up = state.nodes.filter((n) => !n.down);
    if (up.length >= 2) {
      const byLoad = [...up].sort((a, b) => load(copies, b.id) - load(copies, a.id));
      const hi = byLoad[0];
      const lo = byLoad[byLoad.length - 1];
      if (load(copies, hi.id) - load(copies, lo.id) >= 2) {
        const loShards = new Set(copies.filter((c) => c.node === lo.id).map((c) => c.shard));
        const movable = copies.find((c) => c.node === hi.id && c.state === "assigned" && !loShards.has(c.shard));
        if (movable) {
          movable.state = "relocating";
          movable.relocatingTo = lo.id;
          log.push(`rebalancing: shard ${movable.shard} ${movable.role} moving ${hi.id} → ${lo.id}`);
        }
      }
    }
  }

  // A turn that changed nothing is a fixed point: either fully recovered/balanced,
  // or genuinely stuck (too few nodes to place every replica). Either way, stop.
  const settled = JSON.stringify(copies) === JSON.stringify(state.copies) && relocations === state.relocations;

  return {
    ...state,
    tick: state.tick + 1,
    copies,
    relocations,
    settled,
    log: settled ? state.log : [...state.log, ...log].slice(-60),
  };
}

/**
 * Fan a search out across every shard: the coordinator asks one live copy of
 * each shard in parallel. Because the legs run concurrently, the wall-clock
 * latency is the slowest shard plus a small merge cost — the lesson that a search
 * is bounded by its slowest shard, not the sum. A shard with no live copy is
 * missing from the result (a partial answer).
 */
function runSearch(state: EsState, rng: SeededRng): SearchResult {
  const up = state.nodes.filter((n) => !n.down);
  const coordinator = up.length ? up[rng.int(up.length)].id : "—";

  const routes: SearchRoute[] = [];
  const missingShards: number[] = [];
  for (let s = 0; s < state.shards; s++) {
    // Any assigned copy can serve a read — prefer the primary, else a replica.
    const serving = shardCopies(state.copies, s).filter((c) => c.state === "assigned");
    if (serving.length === 0) {
      missingShards.push(s);
      continue;
    }
    const chosen = serving[rng.int(serving.length)];
    // A leg costs more when it crosses the network off the coordinator node.
    const sameNode = chosen.node === coordinator;
    const latencyMs = 6 + rng.int(12) + (sameNode ? 0 : 4);
    routes.push({ shard: s, copyId: chosen.id, role: chosen.role, node: chosen.node!, latencyMs });
  }

  const fanOut = routes.length ? Math.max(...routes.map((r) => r.latencyMs)) : 0;
  const mergeMs = 2 + Math.ceil(routes.length / 2);
  return { coordinator, routes, missingShards, totalLatencyMs: fanOut + mergeMs, ok: missingShards.length === 0 };
}

export function reduce(state: EsState, action: EsAction, rng: SeededRng = makeRng(state.seed + state.tick)): EsState {
  switch (action.type) {
    case "tick":
      return tick(state, rng);

    case "toggleNode": {
      const node = state.nodes.find((n) => n.id === action.id);
      if (!node) return state;
      const nodes = state.nodes.map((n) => (n.id === action.id ? { ...n, down: !n.down } : n));
      const line = node.down ? `${action.id} recovered — shards can move back onto it` : `${action.id} failed — its shards must be re-hosted`;
      return { ...state, tick: state.tick + 1, nodes, settled: false, log: [...state.log, line].slice(-60) };
    }

    case "addNode": {
      const id = `es-${state.nextNodeId}`;
      const nodes = [...state.nodes, { id, down: false }];
      return { ...state, tick: state.tick + 1, nodes, nextNodeId: state.nextNodeId + 1, settled: false, log: [...state.log, `${id} joined — the cluster will rebalance onto it`].slice(-60) };
    }

    case "removeNode": {
      if (state.nodes.length <= 1) return state; // never remove the last node
      const node = state.nodes.find((n) => n.id === action.id);
      if (!node) return state;
      const nodes = state.nodes.filter((n) => n.id !== action.id);
      // Orphan every copy that lived here; the loop reallocates and promotes.
      const copies = state.copies.map((c) => (c.node === action.id ? { ...c, state: "unassigned" as CopyState, node: null, relocatingTo: null } : c));
      return { ...state, tick: state.tick + 1, nodes, copies, settled: false, log: [...state.log, `${action.id} removed from the cluster`].slice(-60) };
    }

    case "setReplicas": {
      const count = Math.max(0, Math.min(action.count, 3));
      if (count === state.replicas) return state;
      let nextCopyId = state.nextCopyId;
      let copies = state.copies.filter((c) => c.role === "primary" || replicaIndex(state.copies, c) < count);
      // Add fresh unassigned replicas for every shard that is now short.
      for (let s = 0; s < state.shards; s++) {
        const have = copies.filter((c) => c.shard === s && c.role === "replica").length;
        for (let i = have; i < count; i++) {
          copies.push({ id: `c${nextCopyId++}`, shard: s, role: "replica", state: "unassigned", node: null, relocatingTo: null });
        }
      }
      return { ...state, tick: state.tick + 1, replicas: count, copies, nextCopyId, settled: false, log: [...state.log, `replicas set to ${count} per shard`].slice(-60) };
    }

    case "search": {
      const lastSearch = runSearch(state, rng);
      const summary = lastSearch.ok
        ? `search fanned out to ${lastSearch.routes.length} shards, merged in ${lastSearch.totalLatencyMs} ms`
        : `search returned partial results — ${lastSearch.missingShards.length} shard(s) unavailable`;
      return { ...state, tick: state.tick + 1, lastSearch, log: [...state.log, summary].slice(-60) };
    }

    case "reset":
      return initialEsState(state.seed);

    default:
      return state;
  }
}

/** Which replica this copy is (0-based) among its shard's replicas; -1 for a primary. */
function replicaIndex(copies: ShardCopy[], copy: ShardCopy): number {
  if (copy.role !== "replica") return -1;
  return copies.filter((c) => c.shard === copy.shard && c.role === "replica").indexOf(copy);
}

/**
 * A fresh cluster: three up nodes and a 4-shard index with one replica each,
 * hand-placed into a balanced, all-`assigned` green layout (loads 3·3·2). Every
 * shard's primary and replica sit on different nodes, so the cluster starts green
 * and settled — no rebalancing pending.
 */
export function initialEsState(seed: number): EsState {
  const nodes: EsNode[] = [
    { id: "es-1", down: false },
    { id: "es-2", down: false },
    { id: "es-3", down: false },
  ];
  const A = (id: string, shard: number, role: "primary" | "replica", node: string): ShardCopy => ({ id, shard, role, state: "assigned", node, relocatingTo: null });
  const copies: ShardCopy[] = [
    A("c1", 0, "primary", "es-1"), A("c2", 0, "replica", "es-2"),
    A("c3", 1, "primary", "es-2"), A("c4", 1, "replica", "es-3"),
    A("c5", 2, "primary", "es-3"), A("c6", 2, "replica", "es-1"),
    A("c7", 3, "primary", "es-1"), A("c8", 3, "replica", "es-2"),
  ];
  return { tick: 0, seed, shards: SHARDS, replicas: 1, nodes, copies, nextCopyId: 9, nextNodeId: 4, settled: true, relocations: 0, lastSearch: null, log: [] };
}
