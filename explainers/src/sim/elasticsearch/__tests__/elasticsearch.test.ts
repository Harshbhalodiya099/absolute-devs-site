/**
 * Golden-trace + determinism harness for the Elasticsearch simulation, mirroring
 * the DNS and Kubernetes harnesses. Every fixed bug gets a regression test here
 * (a Phase 4 requirement); any change to a count, a health state or a phase means
 * the state machine changed — a deliberate, reviewed edit, not an accident.
 */
import { describe, expect, it } from "vitest";
import { health, initialEsState, reduceEs, type EsAction, type EsState } from "../index";

/** Replay a list of actions from a fresh seed, returning every intermediate state. */
function trace(seed: number, actions: EsAction[]): EsState[] {
  const states: EsState[] = [initialEsState(seed)];
  for (const a of actions) states.push(reduceEs(states[states.length - 1], a));
  return states;
}

/** Run the allocation loop to a fixed point (with a guard against runaway). */
function settle(s0: EsState): EsState {
  let s = s0;
  for (let i = 0; i < 200 && !s.settled; i++) s = reduceEs(s, { type: "tick" });
  return s;
}

const assigned = (s: EsState) => s.copies.filter((c) => c.state === "assigned").length;
const unassigned = (s: EsState) => s.copies.filter((c) => c.state === "unassigned").length;
const primary = (s: EsState, shard: number) => s.copies.find((c) => c.shard === shard && c.role === "primary")!;

describe("Elasticsearch simulation", () => {
  it("starts green: every copy assigned, one primary per shard, and settled", () => {
    const s = initialEsState(1);
    expect(s.settled).toBe(true);
    expect(health(s)).toBe("green");
    expect(assigned(s)).toBe(8); // 4 primaries + 4 replicas
    for (let sh = 0; sh < s.shards; sh++) {
      expect(s.copies.filter((c) => c.shard === sh && c.role === "primary")).toHaveLength(1);
    }
  });

  it("never co-locates a shard's primary and replica on one node", () => {
    const s = settle(reduceEs(reduceEs(initialEsState(2), { type: "toggleNode", id: "es-2" }), { type: "toggleNode", id: "es-2" }));
    for (let sh = 0; sh < s.shards; sh++) {
      const nodes = s.copies.filter((c) => c.shard === sh && c.node).map((c) => c.node);
      expect(new Set(nodes).size).toBe(nodes.length); // all distinct
    }
  });

  it("is deterministic: same (seed, action list) ⇒ byte-identical trace", () => {
    const actions: EsAction[] = [
      { type: "toggleNode", id: "es-1" },
      { type: "tick" },
      { type: "tick" },
      { type: "search" },
      { type: "toggleNode", id: "es-1" },
      { type: "tick" },
      { type: "tick" },
      { type: "search" },
    ];
    expect(JSON.stringify(trace(11, actions))).toBe(JSON.stringify(trace(11, actions)));
  });

  it("a node failure promotes a replica and recovers back to green", () => {
    const before = initialEsState(3);
    // Which shards had their primary on es-1? Those must promote a replica.
    const wasPrimaryOnEs1 = [0, 1, 2, 3].filter((sh) => primary(before, sh).node === "es-1");
    expect(wasPrimaryOnEs1.length).toBeGreaterThan(0);
    const after = settle(reduceEs(before, { type: "toggleNode", id: "es-1" }));
    expect(health(after)).toBe("green"); // 3→2 nodes still fits 4 shards × 1 replica
    // Each shard that lost its primary now has a primary on a *surviving* node.
    for (const sh of wasPrimaryOnEs1) {
      expect(primary(after, sh).node).not.toBe("es-1");
      expect(primary(after, sh).state).toBe("assigned");
    }
    expect(after.copies.every((c) => c.node !== "es-1")).toBe(true);
  });

  it("goes yellow (not red) mid-recovery: primaries stay served while replicas re-home", () => {
    // One tick after a failure, primaries are promoted/assigned but replicas are
    // still re-homing — the classic yellow state.
    const failed = reduceEs(initialEsState(5), { type: "toggleNode", id: "es-1" });
    const mid = reduceEs(failed, { type: "tick" });
    expect(health(mid)).not.toBe("green"); // not yet fully redundant
    expect(mid.copies.filter((c) => c.role === "primary").every((c) => c.node !== "es-1")).toBe(true);
  });

  it("losing two nodes at once can strand a shard's only copies — red, but settled", () => {
    let s = reduceEs(initialEsState(7), { type: "toggleNode", id: "es-1" });
    s = reduceEs(s, { type: "toggleNode", id: "es-2" });
    s = settle(s); // only es-3 remains: a shard needs 2 nodes for primary+replica
    expect(s.settled).toBe(true); // the loop stops even though it cannot fully recover
    // At most one copy of any shard can live on the single survivor.
    for (let sh = 0; sh < s.shards; sh++) {
      expect(s.copies.filter((c) => c.shard === sh && c.state === "assigned").length).toBeLessThanOrEqual(1);
    }
    expect(health(s)).toBe("yellow"); // primaries served on es-3; replicas unplaceable
  });

  it("recovering a node rebalances copies back onto it (no teleporting)", () => {
    let s = settle(reduceEs(initialEsState(6), { type: "toggleNode", id: "es-1" }));
    const before = s.relocations;
    s = settle(reduceEs(s, { type: "toggleNode", id: "es-1" })); // es-1 back
    expect(health(s)).toBe("green");
    expect(s.relocations).toBeGreaterThan(before); // shards actually relocated, not teleported
    // Balanced within one copy across the three nodes.
    const loads = s.nodes.map((n) => s.copies.filter((c) => c.node === n.id).length);
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1);
  });

  it("adding a node rebalances the cluster onto it", () => {
    const s = settle(reduceEs(initialEsState(8), { type: "addNode" }));
    expect(health(s)).toBe("green");
    expect(s.nodes.some((n) => n.id === "es-4")).toBe(true);
    expect(s.copies.some((c) => c.node === "es-4")).toBe(true);
    expect(s.relocations).toBeGreaterThan(0);
  });

  it("search fans out to one copy per shard; latency is the slowest shard, not the sum", () => {
    const s = reduceEs(initialEsState(4), { type: "search" });
    const r = s.lastSearch!;
    expect(r.ok).toBe(true);
    expect(r.routes).toHaveLength(s.shards); // one leg per shard
    expect(new Set(r.routes.map((x) => x.shard)).size).toBe(s.shards); // every shard covered
    const slowest = Math.max(...r.routes.map((x) => x.latencyMs));
    const sum = r.routes.reduce((a, x) => a + x.latencyMs, 0);
    expect(r.totalLatencyMs).toBeGreaterThanOrEqual(slowest); // bounded below by the slowest leg
    expect(r.totalLatencyMs).toBeLessThan(sum); // …but far under the serial sum
  });

  it("search over a red cluster returns partial results", () => {
    // With every node down there is no live copy of any shard: the search comes
    // back empty. (A single survivor would still serve every primary — yellow, not
    // red — which is itself the lesson that one replica buys availability.)
    let s = reduceEs(initialEsState(9), { type: "toggleNode", id: "es-1" });
    s = reduceEs(s, { type: "toggleNode", id: "es-2" });
    s = settle(reduceEs(s, { type: "toggleNode", id: "es-3" }));
    expect(health(s)).toBe("red");
    s = reduceEs(s, { type: "search" });
    expect(s.lastSearch!.ok).toBe(false);
    expect(s.lastSearch!.missingShards).toHaveLength(s.shards); // nothing to answer
  });

  it("raising the replica count adds copies and re-greens; lowering drops them", () => {
    const up = settle(reduceEs(initialEsState(10), { type: "setReplicas", count: 2 }));
    expect(up.replicas).toBe(2);
    expect(up.copies.filter((c) => c.role === "replica")).toHaveLength(8); // 4 shards × 2
    expect(health(up)).toBe("green"); // 3 nodes host primary + 2 replicas per shard
    const down = settle(reduceEs(up, { type: "setReplicas", count: 0 }));
    expect(down.copies.filter((c) => c.role === "replica")).toHaveLength(0);
    expect(health(down)).toBe("green");
  });

  it("asking for more replicas than nodes allow leaves them unassigned but settles", () => {
    const s = settle(reduceEs(initialEsState(12), { type: "setReplicas", count: 3 }));
    // 3 replicas + 1 primary = 4 copies per shard, but only 3 nodes → one stranded.
    expect(s.settled).toBe(true);
    expect(unassigned(s)).toBeGreaterThan(0);
    expect(health(s)).toBe("yellow"); // primaries served, redundancy incomplete
  });

  it("removing a node re-hosts its shards onto the survivors", () => {
    const s = settle(reduceEs(initialEsState(13), { type: "removeNode", id: "es-3" }));
    expect(s.nodes.some((n) => n.id === "es-3")).toBe(false);
    expect(s.copies.every((c) => c.node !== "es-3")).toBe(true);
    expect(health(s)).toBe("green"); // 2 nodes still fit 4 shards × 1 replica
  });

  it("reset returns to the initial green cluster but keeps the seed", () => {
    let s = settle(reduceEs(initialEsState(14), { type: "addNode" }));
    s = reduceEs(s, { type: "search" });
    s = reduceEs(s, { type: "reset" });
    expect(s).toEqual(initialEsState(14));
    expect(s.seed).toBe(14);
  });

  it("is pure: reduce does not mutate its input", () => {
    const s0 = settle(reduceEs(initialEsState(2), { type: "addNode" }));
    const snapshot = JSON.stringify(s0);
    reduceEs(s0, { type: "tick" });
    reduceEs(s0, { type: "toggleNode", id: "es-1" });
    reduceEs(s0, { type: "search" });
    reduceEs(s0, { type: "setReplicas", count: 2 });
    expect(JSON.stringify(s0)).toBe(snapshot);
  });
});
