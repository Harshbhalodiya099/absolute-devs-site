/**
 * Kubernetes simulation — the pure reducer. `reduce(state, action, rng) => state`
 * never mutates its input, so a `(seed, action list)` pair replays to a
 * byte-identical trace. Only `tick` consumes randomness (the scheduler breaks
 * ties between equally-good nodes with the seeded generator); every other action
 * is deterministic on its own.
 *
 * The heart is `tick`: one turn of the reconciliation loop. It advances each pod
 * by **at most one phase per turn** so the learner watches the lifecycle
 * (Pending → Creating → Running) and self-healing happen step by step rather than
 * instantaneously — the same reason the DNS walk advances one hop at a time.
 *
 * The rng is a defaulted parameter so this doubles as an ordinary two-arg
 * `useReducer` reducer (`reduceKube`): React never threads a generator through
 * dispatch, and the seed still fully determines placement.
 */
import { makeRng } from "../rng";
import type { SeededRng } from "../contracts";
import type { KubeAction, KubeNode, KubeState, Pod, PodPhase } from "./state";

/** Phases that occupy a slot on a node (count against its capacity). */
const OCCUPIES: PodPhase[] = ["Creating", "Running"];

/** Phases the ReplicaSet counts as "alive" when comparing to desired. */
const ALIVE: PodPhase[] = ["Pending", "Creating", "Running"];

const nodeById = (nodes: KubeNode[], id: string | null) => nodes.find((n) => n.id === id);

/** How many occupying pods a node currently holds (excludes Lost/Terminating). */
function load(pods: Pod[], nodeId: string): number {
  return pods.filter((p) => p.node === nodeId && OCCUPIES.includes(p.phase)).length;
}

/**
 * Pick the least-loaded Ready node with free capacity (spread scheduling). Ties
 * are broken with the seeded rng, so placement is varied but fully replayable.
 * Returns null when nothing can host the pod — it stays Pending (unschedulable).
 */
function pickNode(nodes: KubeNode[], pods: Pod[], rng: SeededRng): KubeNode | null {
  const free = nodes.filter((n) => n.ready && load(pods, n.id) < n.capacity);
  if (free.length === 0) return null;
  const best = Math.max(...free.map((n) => n.capacity - load(pods, n.id)));
  const tied = free.filter((n) => n.capacity - load(pods, n.id) === best);
  return tied[rng.int(tied.length)];
}

/** One turn of the reconciliation loop. Pure: reads `state`, returns the next. */
function tick(state: KubeState, rng: SeededRng): KubeState {
  const startPhase: Record<string, PodPhase> = {};
  for (const p of state.pods) startPhase[p.id] = p.phase;

  const log: string[] = [];
  let nextPodId = state.nextPodId;

  // 1. Garbage-collect pods that were already leaving at the start of the turn.
  let pods: Pod[] = state.pods
    .map((p) => ({ ...p }))
    .filter((p) => {
      if (startPhase[p.id] === "Lost") {
        log.push(`${p.id} removed — it was lost when ${p.node} went NotReady`);
        return false;
      }
      if (startPhase[p.id] === "Terminating") {
        log.push(`${p.id} terminated`);
        return false;
      }
      return true;
    });

  // 2. Detect failures: pods bound to a NotReady node are now Lost.
  for (const p of pods) {
    if ((p.phase === "Running" || p.phase === "Creating") && p.node && !nodeById(state.nodes, p.node)?.ready) {
      p.phase = "Lost";
      log.push(`${p.id} lost — node ${p.node} is NotReady; the controller will replace it`);
    }
  }

  // 3. Reconcile the replica count against desired.
  const alive = pods.filter((p) => ALIVE.includes(p.phase));
  if (alive.length < state.desired) {
    const need = state.desired - alive.length;
    for (let i = 0; i < need; i++) pods.push({ id: `pod-${nextPodId++}`, phase: "Pending", node: null });
    log.push(`ReplicaSet creates ${need} pod${need > 1 ? "s" : ""} to reach desired = ${state.desired}`);
  } else if (alive.length > state.desired) {
    // Prefer to terminate the least-committed pods first: Pending, then Creating,
    // then Running — the same order Kubernetes' scale-down cost function favours.
    const order: PodPhase[] = ["Pending", "Creating", "Running"];
    const victims = [...alive]
      .sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase))
      .slice(0, alive.length - state.desired);
    const ids = new Set(victims.map((v) => v.id));
    for (const p of pods) if (ids.has(p.id)) p.phase = "Terminating";
    log.push(`scaled down: terminating ${ids.size} pod${ids.size > 1 ? "s" : ""} (desired = ${state.desired})`);
  }

  // 4. Schedule pods that were Pending at the start of the turn.
  for (const p of pods) {
    if (p.phase === "Pending" && startPhase[p.id] === "Pending") {
      const node = pickNode(state.nodes, pods, rng);
      if (node) {
        p.phase = "Creating";
        p.node = node.id;
        log.push(`scheduler places ${p.id} on ${node.id} (least loaded)`);
      }
    }
  }

  // 5. Advance pods that were Creating at the start of the turn to Running.
  for (const p of pods) {
    if (p.phase === "Creating" && startPhase[p.id] === "Creating") {
      p.phase = "Running";
      log.push(`${p.id} passed its readiness probe — now Running on ${p.node}`);
    }
  }

  // A turn that changed nothing is a fixed point: either fully converged, or
  // stuck with unschedulable Pending pods. Either way, stop the loop.
  const settled = JSON.stringify(pods) === JSON.stringify(state.pods);

  return {
    ...state,
    tick: state.tick + 1,
    pods,
    nextPodId,
    settled,
    log: settled ? state.log : [...state.log, ...log].slice(-60),
  };
}

export function reduce(state: KubeState, action: KubeAction, rng: SeededRng = makeRng(state.seed + state.tick)): KubeState {
  switch (action.type) {
    case "tick":
      return tick(state, rng);

    case "scale": {
      const max = state.nodes.length * (state.nodes[0]?.capacity ?? 0);
      const desired = Math.max(0, Math.min(action.desired, max));
      if (desired === state.desired) return state;
      return { ...state, tick: state.tick + 1, desired, settled: false, log: [...state.log, `desired replicas set to ${desired}`].slice(-60) };
    }

    case "killPod": {
      const target = state.pods.find((p) => p.id === action.id);
      if (!target || target.phase === "Terminating" || target.phase === "Lost") return state;
      const pods = state.pods.map((p) => (p.id === action.id ? { ...p, phase: "Terminating" as PodPhase } : p));
      return { ...state, tick: state.tick + 1, pods, settled: false, log: [...state.log, `you deleted ${action.id} — watch the ReplicaSet bring it back`].slice(-60) };
    }

    case "toggleNode": {
      const node = state.nodes.find((n) => n.id === action.id);
      if (!node) return state;
      const nodes = state.nodes.map((n) => (n.id === action.id ? { ...n, ready: !n.ready } : n));
      const line = node.ready ? `${action.id} marked NotReady — its pods will be rescheduled` : `${action.id} recovered — Ready again`;
      return { ...state, tick: state.tick + 1, nodes, settled: false, log: [...state.log, line].slice(-60) };
    }

    case "reset":
      return initialKubeState(state.seed);

    default:
      return state;
  }
}

/** A fresh cluster: three Ready nodes, three pods already Running (one each). */
export function initialKubeState(seed: number): KubeState {
  const nodes: KubeNode[] = [
    { id: "node-a", capacity: 3, ready: true },
    { id: "node-b", capacity: 3, ready: true },
    { id: "node-c", capacity: 3, ready: true },
  ];
  const pods: Pod[] = [
    { id: "pod-1", phase: "Running", node: "node-a" },
    { id: "pod-2", phase: "Running", node: "node-b" },
    { id: "pod-3", phase: "Running", node: "node-c" },
  ];
  return { tick: 0, seed, desired: 3, nodes, pods, nextPodId: 4, settled: true, log: [] };
}
