/**
 * The kernel: a pure reducer over `SimState`. It owns the fixed-timestep tick
 * loop and the per-tick pipeline — for Tier 1 that pipeline is just "solve the
 * metrics for the current graph and commit an immutable snapshot." No events and
 * no graph mutation yet, so every tick of a static graph is identical; that is
 * expected. The value shipped here is the *shape*: a deterministic `step` and a
 * golden-testable trace that Phase 4 (events) and beyond extend without changing
 * this contract.
 *
 * Determinism: metrics for tick T are solved with an RNG seeded from
 * `seed + T`, so a tick's randomness is reproducible yet distinct per tick.
 */
import type { NodeId, EdgeId, SimGraph, SimState } from "../contracts";
import { solve } from "../metrics/solve";
import { makeRng } from "../rng";

/** Solve the metrics for a bare graph state and return the completed snapshot. */
function withMetrics(base: Omit<SimState, "metrics" | "global">): SimState {
  const draft: SimState = { ...base, metrics: new Map(), global: {} };
  const { metrics, global } = solve(draft, makeRng(base.seed + base.tick));
  return { ...draft, metrics, global };
}

/**
 * Build the initial state (tick 0) from a graph + seed and solve its metrics.
 * Node/edge order in the arrays is irrelevant — the solver is order-independent.
 */
export function createSim(graph: SimGraph, seed = 0): SimState {
  const nodes = new Map<NodeId, (typeof graph.nodes)[number]>(graph.nodes.map((n) => [n.id, n]));
  const edges = new Map<EdgeId, (typeof graph.edges)[number]>(graph.edges.map((e) => [e.id, e]));
  return withMetrics({ tick: 0, seed, nodes, edges });
}

/** Advance one tick. Pure: `step(state)` depends only on `state`. */
export function step(state: SimState): SimState {
  return withMetrics({ tick: state.tick + 1, seed: state.seed, nodes: state.nodes, edges: state.edges });
}

/** Run `ticks` steps, returning the full trace `[t0, t1, … t_ticks]`. */
export function run(initial: SimState, ticks: number): SimState[] {
  const trace = [initial];
  for (let i = 0; i < ticks; i++) trace.push(step(trace[trace.length - 1]));
  return trace;
}

/**
 * Stable, plain-JSON view of a snapshot — Maps become key-sorted objects — so a
 * trace can be saved, replayed, and asserted against a golden fixture with a
 * byte-for-byte `JSON.stringify` comparison.
 */
export function serialize(state: SimState): unknown {
  const sortObj = <T>(m: ReadonlyMap<string, T>): Record<string, T> =>
    Object.fromEntries([...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const sortKeys = (o: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return {
    tick: state.tick,
    seed: state.seed,
    nodes: sortObj(state.nodes),
    edges: sortObj(state.edges),
    metrics: Object.fromEntries(
      [...state.metrics.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, sortKeys(v)]),
    ),
    global: sortKeys(state.global),
  };
}
