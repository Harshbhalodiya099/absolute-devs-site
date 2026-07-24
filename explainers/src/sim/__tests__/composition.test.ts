/**
 * The composition proof — the whole reason rules emit *routing* rather than
 * hardcoded numbers. Dropping a read-through cache in front of the DB must lower
 * the DB's load and the request's tail latency, with **no change to the DB's own
 * rule**. This is the gate for Phase 3 in the roadmap.
 */
import { describe, expect, it } from "vitest";
import { createSim, defEdge, defNode, type SimGraph } from "../index";

const withoutCache: SimGraph = {
  nodes: [defNode("client", "client", { requestRps: 100 }), defNode("api", "api"), defNode("db", "postgres")],
  edges: [defEdge("client", "api"), defEdge("api", "db")],
};

const withCache: SimGraph = {
  nodes: [
    defNode("client", "client", { requestRps: 100 }),
    defNode("api", "api"),
    defNode("cache", "redis", { hitRatio: 0.8 }),
    defNode("db", "postgres"),
  ],
  edges: [defEdge("client", "api"), defEdge("api", "cache"), defEdge("cache", "db")],
};

describe("composition: adding a cache", () => {
  const base = createSim(withoutCache, 0);
  const cached = createSim(withCache, 0);

  it("drops DB load — only the 20% misses reach it", () => {
    expect(base.metrics.get("db")!.throughputRps).toBe(100);
    expect(cached.metrics.get("db")!.throughputRps).toBe(20);
  });

  it("drops DB tail latency as its utilization falls", () => {
    expect(cached.metrics.get("db")!.latencyMs!).toBeLessThan(base.metrics.get("db")!.latencyMs!);
  });

  it("drops end-to-end tail latency", () => {
    expect(cached.global.latencyMs!).toBeLessThan(base.global.latencyMs!);
  });

  it("still delivers every request (hits complete at the cache)", () => {
    expect(cached.global.throughputRps).toBe(100);
    expect(cached.global.errorRatePct).toBe(0);
  });
});
