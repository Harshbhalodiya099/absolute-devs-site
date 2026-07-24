/**
 * Golden-trace + determinism harness for the Kubernetes simulation, mirroring
 * the DNS and kernel harnesses. Every fixed bug gets a regression test here (a
 * Phase 4 requirement), and any change to a count or a phase means the state
 * machine changed — a deliberate, reviewed edit, not an accident.
 */
import { describe, expect, it } from "vitest";
import { initialKubeState, reduceKube, type KubeAction, type KubeState } from "../index";

/** Replay a list of actions from a fresh seed, returning every intermediate state. */
function trace(seed: number, actions: KubeAction[]): KubeState[] {
  const states: KubeState[] = [initialKubeState(seed)];
  for (const a of actions) states.push(reduceKube(states[states.length - 1], a));
  return states;
}

/** Run the reconciliation loop to a fixed point (with a guard against runaway). */
function settle(s0: KubeState): KubeState {
  let s = s0;
  for (let i = 0; i < 200 && !s.settled; i++) s = reduceKube(s, { type: "tick" });
  return s;
}

const running = (s: KubeState) => s.pods.filter((p) => p.phase === "Running").length;
const alive = (s: KubeState) => s.pods.filter((p) => ["Pending", "Creating", "Running"].includes(p.phase)).length;

describe("Kubernetes simulation", () => {
  it("starts converged: three pods Running, one per node, and settled", () => {
    const s = initialKubeState(1);
    expect(s.settled).toBe(true);
    expect(running(s)).toBe(3);
    expect(new Set(s.pods.map((p) => p.node)).size).toBe(3);
  });

  it("is deterministic: same (seed, action list) ⇒ byte-identical trace", () => {
    const actions: KubeAction[] = [
      { type: "scale", desired: 7 },
      { type: "tick" },
      { type: "tick" },
      { type: "toggleNode", id: "node-b" },
      { type: "tick" },
      { type: "tick" },
      { type: "tick" },
    ];
    expect(JSON.stringify(trace(11, actions))).toBe(JSON.stringify(trace(11, actions)));
  });

  it("scaling up creates pods and the loop converges to desired Running", () => {
    const s = settle(reduceKube(initialKubeState(3), { type: "scale", desired: 8 }));
    expect(s.settled).toBe(true);
    expect(running(s)).toBe(8);
    // Spread across all three Ready nodes, none over capacity.
    for (const n of s.nodes) {
      expect(s.pods.filter((p) => p.node === n.id && ["Creating", "Running"].includes(p.phase)).length).toBeLessThanOrEqual(n.capacity);
    }
  });

  it("scaling down terminates the excess and converges", () => {
    const up = settle(reduceKube(initialKubeState(3), { type: "scale", desired: 6 }));
    const down = settle(reduceKube(up, { type: "scale", desired: 2 }));
    expect(running(down)).toBe(2);
    expect(alive(down)).toBe(2);
  });

  it("killing a pod self-heals: the ReplicaSet restores desired", () => {
    const before = initialKubeState(4);
    const victim = before.pods[0].id;
    const after = settle(reduceKube(before, { type: "killPod", id: victim }));
    expect(after.pods.some((p) => p.id === victim)).toBe(false); // the killed pod is gone
    expect(running(after)).toBe(3); // …but a replacement brought us back to desired
  });

  it("a node failure reschedules its pods onto the survivors", () => {
    const failed = settle(reduceKube(initialKubeState(5), { type: "toggleNode", id: "node-a" }));
    expect(running(failed)).toBe(3);
    // Nothing runs on the NotReady node; everything is on the two survivors.
    expect(failed.pods.every((p) => p.node !== "node-a")).toBe(true);
    expect(new Set(failed.pods.map((p) => p.node))).toEqual(new Set(["node-b", "node-c"]));
  });

  it("recovering a node lets the cluster spread back out on a rescale", () => {
    let s = settle(reduceKube(initialKubeState(6), { type: "toggleNode", id: "node-a" }));
    s = settle(reduceKube(s, { type: "toggleNode", id: "node-a" })); // node-a Ready again
    s = settle(reduceKube(s, { type: "scale", desired: 9 })); // fill the cluster
    expect(running(s)).toBe(9);
    expect(s.nodes.every((n) => s.pods.filter((p) => p.node === n.id && p.phase === "Running").length === 3)).toBe(true);
  });

  it("desired beyond total capacity leaves unschedulable pods but still settles", () => {
    // Fail one node (6 slots left), then ask for more than fits.
    let s = settle(reduceKube(initialKubeState(7), { type: "toggleNode", id: "node-c" }));
    s = settle(reduceKube(s, { type: "scale", desired: 8 }));
    expect(s.settled).toBe(true); // the loop stops even though it cannot fully converge
    expect(running(s)).toBe(6); // only what capacity allows
    expect(s.pods.some((p) => p.phase === "Pending")).toBe(true); // the rest wait, unschedulable
  });

  it("scale is clamped to the total cluster capacity", () => {
    const s = reduceKube(initialKubeState(8), { type: "scale", desired: 999 });
    expect(s.desired).toBe(9); // 3 nodes × capacity 3
  });

  it("reset returns to the initial converged cluster but keeps the seed", () => {
    let s = settle(reduceKube(initialKubeState(9), { type: "scale", desired: 8 }));
    s = reduceKube(s, { type: "reset" });
    expect(s).toEqual(initialKubeState(9));
    expect(s.seed).toBe(9);
  });

  it("is pure: reduce does not mutate its input", () => {
    const s0 = settle(reduceKube(initialKubeState(2), { type: "scale", desired: 5 }));
    const snapshot = JSON.stringify(s0);
    reduceKube(s0, { type: "tick" });
    reduceKube(s0, { type: "toggleNode", id: "node-a" });
    reduceKube(s0, { type: "killPod", id: s0.pods[0].id });
    expect(JSON.stringify(s0)).toBe(snapshot);
  });
});
