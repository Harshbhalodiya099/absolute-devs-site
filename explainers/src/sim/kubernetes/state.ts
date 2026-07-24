/**
 * Kubernetes simulation — the headless state (React-free, plain serializable
 * JSON). Like the DNS sim this is a Tier-0 scripted state machine, but a very
 * different *shape* of one: DNS builds a plan and walks it once; Kubernetes runs
 * a **reconciliation loop** that continuously drives the *actual* cluster toward
 * the *desired* replica count — scheduling pending pods, noticing dead nodes,
 * and replacing lost pods (self-healing). The reuse being validated is the
 * deterministic-reducer spine, not any DNS-specific idea (see PHASE4).
 *
 * State stays a flat JSON object so a `(seed, action list)` pair replays to a
 * byte-identical `JSON.stringify` trace — the same determinism contract the
 * kernel and DNS golden tests use.
 */

/** A worker node. `ready === false` is a NotReady node (a failure). */
export interface KubeNode {
  id: string;
  /** How many running/creating pods this node can hold. */
  capacity: number;
  /** A NotReady node runs nothing and takes no new pods until it recovers. */
  ready: boolean;
}

/**
 * A pod's lifecycle, mirroring the phases a learner sees in `kubectl get pods`:
 * - `Pending`     — created by the ReplicaSet, not yet placed on a node.
 * - `Creating`    — the scheduler picked a node; the container is starting.
 * - `Running`     — passed its readiness probe; serving.
 * - `Terminating` — chosen for removal (scale-down or a manual delete).
 * - `Lost`        — its node went NotReady; it will be garbage-collected.
 */
export type PodPhase = "Pending" | "Creating" | "Running" | "Terminating" | "Lost";

export interface Pod {
  id: string;
  phase: PodPhase;
  /** The node this pod is bound to, or null while still `Pending`. */
  node: string | null;
}

export interface KubeState {
  /** Monotonic action counter — bumped on every reduce, for trace ordering. */
  tick: number;
  /** The one randomness source (seeds the scheduler's tie-breaking). */
  seed: number;
  /** The desired replica count the ReplicaSet reconciles toward. */
  desired: number;
  nodes: KubeNode[];
  pods: Pod[];
  /** Next pod id to hand out — keeps ids deterministic and trace-stable. */
  nextPodId: number;
  /**
   * True once a `tick` reaches a fixed point (the cluster changed nothing). The
   * renderer's timer runs the loop only while this is false, so a converged —
   * or a genuinely stuck (unschedulable) — cluster stops ticking.
   */
  settled: boolean;
  /** The causal narration, one line per meaningful reconciliation event. */
  log: string[];
}

export type KubeAction =
  | { type: "tick" }
  /** Set the desired replica count (the ReplicaSet's target). */
  | { type: "scale"; desired: number }
  /** Manually delete a pod — the loop will bring a replacement back. */
  | { type: "killPod"; id: string }
  /** Toggle a node between Ready and NotReady (simulate a node failure). */
  | { type: "toggleNode"; id: string }
  | { type: "reset" };
