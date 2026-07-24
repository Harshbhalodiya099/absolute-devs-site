/**
 * Golden-trace + determinism harness for the DNS simulation, mirroring the
 * kernel harness. If a number or a phase here changes, the state machine
 * changed — a deliberate, reviewed edit, not an accident.
 */
import { describe, expect, it } from "vitest";
import { initialDnsState, reduceDns, type DnsAction, type DnsState } from "../index";

/** Replay a list of actions from a fresh seed, returning every intermediate state. */
function trace(seed: number, actions: DnsAction[]): DnsState[] {
  const states: DnsState[] = [initialDnsState(seed)];
  for (const a of actions) states.push(reduceDns(states[states.length - 1], a));
  return states;
}

/** Drive a lookup to completion, then return the final state. */
function runLookup(seed: number, before: DnsAction[] = []): DnsState {
  let s = initialDnsState(seed);
  for (const a of [...before, { type: "lookup" } as const]) s = reduceDns(s, a);
  // Walk every remaining hop.
  while (s.phase === "walking") s = reduceDns(s, { type: "advance" });
  return s;
}

describe("DNS simulation", () => {
  it("is deterministic: same (seed, action list) ⇒ byte-identical trace", () => {
    const actions: DnsAction[] = [{ type: "lookup" }, { type: "advance" }, { type: "advance" }, { type: "advance" }];
    const a = trace(7, actions);
    const b = trace(7, actions);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("a full miss walks the whole hierarchy and answers", () => {
    const s = runLookup(1);
    expect(s.phase).toBe("answered");
    expect(s.plan).toHaveLength(6); // client→resolver→root→tld→auth→resolver→client
    expect(s.plan[0]).toMatchObject({ from: "client", to: "resolver" });
    expect(s.plan.at(-1)).toMatchObject({ from: "resolver", to: "client" });
  });

  it("miss latency ≫ hit latency", () => {
    const miss = runLookup(3); // cache empty ⇒ full walk
    // A successful miss with caching on writes the answer back…
    expect(miss.cached).toBe(true);
    // …so the very next lookup is a single fast hop.
    let s = miss;
    s = reduceDns(s, { type: "lookup" });
    while (s.phase === "walking") s = reduceDns(s, { type: "advance" });
    expect(s.plan).toHaveLength(1);
    expect(s.phase).toBe("answered");
    expect(s.totalLatencyMs).toBeLessThan(miss.totalLatencyMs);
  });

  it("a broken root server fails the lookup with no answer", () => {
    const s = runLookup(2, [{ type: "toggleDown", node: "root" }]);
    expect(s.phase).toBe("failed");
    // Walk stops at the unreachable server: client→resolver, resolver→root(timeout).
    expect(s.plan).toHaveLength(2);
    expect(s.plan.at(-1)).toMatchObject({ from: "resolver", to: "root" });
    expect(s.log.join("\n")).toMatch(/unreachable/);
    expect(s.cached).toBe(false); // nothing to cache
  });

  it("a successful miss with caching on turns the next lookup into a hit", () => {
    const first = runLookup(5);
    expect(first.cached).toBe(true);
    const second = reduceDns(first, { type: "lookup" });
    expect(second.plan).toHaveLength(1);
    expect(second.plan[0].note).toMatch(/cache hit/);
  });

  it("clearCache expires the TTL so the next lookup walks again", () => {
    const cached = runLookup(5);
    const cleared = reduceDns(cached, { type: "clearCache" });
    expect(cleared.cached).toBe(false);
    const next = reduceDns(cleared, { type: "lookup" });
    expect(next.plan.length).toBeGreaterThan(1);
  });

  it("toggling caching off drops the held answer", () => {
    const cached = runLookup(5);
    const off = reduceDns(cached, { type: "toggleCache" });
    expect(off.cacheEnabled).toBe(false);
    expect(off.cached).toBe(false);
  });

  it("reset returns to idle but keeps the seed", () => {
    const s = reduceDns(runLookup(9), { type: "reset" });
    expect(s.phase).toBe("idle");
    expect(s.plan).toEqual([]);
    expect(s.totalLatencyMs).toBe(0);
    expect(s.seed).toBe(9);
  });

  it("is pure: reduce does not mutate its input", () => {
    const s0 = initialDnsState(4);
    const snapshot = JSON.stringify(s0);
    reduceDns(s0, { type: "lookup" });
    expect(JSON.stringify(s0)).toBe(snapshot);
  });
});
