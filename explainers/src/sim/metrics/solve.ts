/**
 * The Tier 1 metric solver — a single deterministic forward pass over the graph
 * (sim-engine-plan.md §7, rescoped: no fixpoint feedback loop yet). Traffic is
 * injected at source nodes and flows downstream in topological order; each node
 * serves what it can and forwards the rest per its rule. From the converged
 * per-node load we derive latency/throughput/utilization with a standard
 * queueing approximation.
 *
 * Why single-pass is correct *here*: the teaching topologies are DAGs, and their
 * lessons (add a cache ⇒ the DB sees fewer requests ⇒ tail latency falls) are
 * fully expressed by forward flow. Feedback (a saturated node shedding load back
 * upstream, cache↔DB coupling) is Tier 2 and is deliberately out of scope. If a
 * cycle exists we still terminate: back-edges are simply ignored on this pass
 * (documented limitation, not a crash), so determinism holds regardless.
 *
 * Queueing model: utilization ρ = load / capacity; latency = serviceCost /
 * (1 − ρ), an M/M/1-style rise clamped near ρ = 1 so a saturated node reports a
 * large-but-finite latency instead of ∞. Chosen for legibility over packet
 * accuracy — the emergent behavior is directionally true.
 */
import type { NodeId, NodeMetrics, SeededRng, SimState } from "../contracts";
import { componentFor, ruleFor } from "../rules/registry";

/** Fixed-precision rounding keeps golden traces stable and human-readable. */
const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Kahn topological order with a deterministic tiebreak (ascending id). */
function topoOrder(nodeIds: NodeId[], edges: { from: NodeId; to: NodeId }[]): NodeId[] {
  const indeg = new Map<NodeId, number>(nodeIds.map((id) => [id, 0]));
  const adj = new Map<NodeId, NodeId[]>(nodeIds.map((id) => [id, []]));
  for (const e of edges) {
    if (!adj.has(e.from) || !indeg.has(e.to)) continue; // dangling edge: ignore
    adj.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  const ready = nodeIds.filter((id) => (indeg.get(id) ?? 0) === 0).sort();
  const order: NodeId[] = [];
  const seen = new Set<NodeId>();
  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    seen.add(id);
    for (const to of [...(adj.get(id) ?? [])].sort()) {
      indeg.set(to, (indeg.get(to) ?? 0) - 1);
      if ((indeg.get(to) ?? 0) === 0) {
        // Keep `ready` sorted so the visitation order is fully determined.
        const at = ready.findIndex((r) => r > to);
        if (at === -1) ready.push(to);
        else ready.splice(at, 0, to);
      }
    }
  }
  // Any nodes left sit on a cycle; append them by id so every node is solved once.
  for (const id of nodeIds) if (!seen.has(id)) order.push(id);
  return order;
}

/**
 * Solve one forward pass over `state`'s graph. Pure: same state + rng seed ⇒
 * identical metrics. Returns the per-node metrics and the aggregate SLOs.
 */
export function solve(state: SimState, rng: SeededRng): {
  metrics: Map<NodeId, NodeMetrics>;
  global: NodeMetrics;
} {
  const nodeIds = [...state.nodes.keys()];
  const edges = [...state.edges.values()];

  // Out-edges (sorted) and out-degree, for routing and sink detection.
  const outOf = new Map<NodeId, NodeId[]>(nodeIds.map((id) => [id, []]));
  for (const e of edges) if (outOf.has(e.from)) outOf.get(e.from)!.push(e.to);
  for (const id of nodeIds) outOf.get(id)!.sort();

  const order = topoOrder(nodeIds, edges);

  const inbound = new Map<NodeId, number>(nodeIds.map((id) => [id, 0]));
  const cum = new Map<NodeId, number>(nodeIds.map((id) => [id, 0])); // end-to-end latency so far
  const metrics = new Map<NodeId, NodeMetrics>();

  let totalSource = 0;
  let totalCost = 0;
  let delivered = 0; // traffic that completes somewhere (served but not forwarded on)

  for (const id of order) {
    const node = state.nodes.get(id)!;
    const comp = componentFor(node.kind);
    const rule = ruleFor(node.kind);
    const down = node.status === "down";

    // The rule sees config merged over its component defaults.
    const mergedConfig = { ...(comp?.defaults ?? {}), ...node.config };
    const out = outOf.get(id)!;
    const arrivingRps = inbound.get(id) ?? 0;

    const r = rule({ node: { ...node, config: mergedConfig }, inboundRps: arrivingRps, out, rng, tick: state.tick });

    const source = r.sourceRps ?? 0;
    totalSource += source;
    const offered = arrivingRps + source;

    const capacity = down ? 0 : r.capacityRps ?? Infinity;
    const served = Math.min(offered, capacity);
    const dropped = offered - served;

    const util = capacity === Infinity ? 0 : capacity > 0 ? served / capacity : 1;
    const serviceCost = down ? 0 : r.serviceCostMs ?? 0;
    const latency = serviceCost / (1 - Math.min(util, 0.99));

    const nm: NodeMetrics = {
      latencyMs: round(latency),
      throughputRps: round(served),
      utilizationPct: round(Math.min(util, 1) * 100, 1),
      errorRatePct: round(offered > 0 ? (dropped / offered) * 100 : 0),
      ...(r.metrics ?? {}),
    };
    metrics.set(id, nm);
    if (typeof nm.costPerMonthUsd === "number") totalCost += nm.costPerMonthUsd;

    // End-to-end latency: this node's service time on top of its slowest input path.
    cum.set(id, round(latency + (cum.get(id) ?? 0)));

    // Route served traffic downstream. Absent forwards ⇒ even split over out-edges.
    const forwards = r.forwards ?? out.map((to) => ({ to, fraction: out.length ? 1 / out.length : 0 }));
    let forwarded = 0;
    for (const f of forwards) {
      if (!inbound.has(f.to)) continue;
      const flow = served * f.fraction;
      forwarded += flow;
      inbound.set(f.to, (inbound.get(f.to) ?? 0) + flow);
      cum.set(f.to, Math.max(cum.get(f.to) ?? 0, cum.get(id) ?? 0));
    }
    // Whatever a node serves but doesn't forward on completes here — e.g. a
    // cache hit, or any sink's output. This is what the client actually gets.
    delivered += Math.max(0, served - forwarded);
  }

  const endToEnd = Math.max(0, ...nodeIds.map((id) => cum.get(id) ?? 0));

  const global: NodeMetrics = {
    latencyMs: round(endToEnd),
    throughputRps: round(delivered),
    costPerMonthUsd: round(totalCost),
    errorRatePct: round(totalSource > 0 ? Math.max(0, (1 - delivered / totalSource) * 100) : 0),
  };

  return { metrics, global };
}
