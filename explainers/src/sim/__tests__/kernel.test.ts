/**
 * Golden-trace + determinism harness for the Tier 1 kernel. Written before any
 * scenario or renderer exists, per the roadmap: every later phase is guarded by
 * these traces. If a number here changes, the queueing model changed — and that
 * must be a deliberate, reviewed edit, not an accident.
 */
import { describe, expect, it } from "vitest";
import { createSim, defEdge, defNode, run, serialize, step, type SimGraph } from "../index";

/** Client → API → Postgres, the canonical two-hop request path. */
const chain: SimGraph = {
  nodes: [defNode("client", "client", { requestRps: 100 }), defNode("api", "api"), defNode("db", "postgres")],
  edges: [defEdge("client", "api"), defEdge("api", "db")],
};

describe("Tier 1 kernel", () => {
  it("computes latency/throughput for a two-hop chain", () => {
    const s0 = createSim(chain, 42);

    // Global SLOs: end-to-end latency = API(6.25) + DB(16); cost = API(20)+DB(40).
    expect(s0.global).toEqual({ latencyMs: 22.25, throughputRps: 100, costPerMonthUsd: 60, errorRatePct: 0 });

    // The DB is the bottleneck: ρ = 100/200 ⇒ latency = 8 / (1 − 0.5) = 16.
    expect(s0.metrics.get("db")).toMatchObject({ latencyMs: 16, throughputRps: 100, utilizationPct: 50, errorRatePct: 0 });
    // The API is comfortable: ρ = 100/500 ⇒ latency = 5 / 0.8 = 6.25.
    expect(s0.metrics.get("api")).toMatchObject({ latencyMs: 6.25, utilizationPct: 20 });
  });

  it("is deterministic: same (graph, seed) ⇒ byte-identical trace", () => {
    const a = run(createSim(chain, 7), 5).map(serialize);
    const b = run(createSim(chain, 7), 5).map(serialize);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).toHaveLength(6); // t0 … t5
  });

  it("is order-independent: node/edge array order does not change results", () => {
    const shuffled: SimGraph = { nodes: [...chain.nodes].reverse(), edges: [...chain.edges].reverse() };
    expect(serialize(createSim(shuffled, 1))).toEqual(serialize(createSim(chain, 1)));
  });

  it("advances ticks purely (static graph ⇒ steady metrics)", () => {
    const s0 = createSim(chain, 0);
    const s1 = step(s0);
    expect(s1.tick).toBe(1);
    expect(s1.global).toEqual(s0.global); // no events yet ⇒ nothing changes over time
    expect(s0.tick).toBe(0); // step did not mutate its input
  });

  it("a downed node drops its traffic and surfaces errors", () => {
    const g: SimGraph = { ...chain, nodes: chain.nodes.map((n) => (n.id === "db" ? { ...n, status: "down" } : n)) };
    const s = createSim(g, 0);
    expect(s.metrics.get("db")).toMatchObject({ throughputRps: 0, errorRatePct: 100 });
    expect(s.global.throughputRps).toBe(0);
    expect(s.global.errorRatePct).toBe(100);
  });
});
