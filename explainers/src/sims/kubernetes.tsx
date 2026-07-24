/**
 * Kubernetes simulation — the React view, co-located with its registration (like
 * an assessment data file). Everything topic-specific lives here and in the
 * headless reducer it imports (`sim/kubernetes`); the generic `simulate` mode and
 * the `sims/` discovery glob carry it to the screen unchanged — no engine edit.
 *
 * The stage is an explainer, not a dashboard (PHASE4 §7): worker nodes as bins,
 * pods as coloured dots that move between them, and a ReplicaSet reading desired
 * vs. running. A timer turns the reconciliation crank (`tick`) only while the
 * cluster is still settling, so a converged — or genuinely stuck — cluster goes
 * quiet. Motion is guarded by `prefers-reduced-motion`.
 */
import { motion, MotionConfig } from "motion/react";
import { useEffect, useReducer, useRef } from "react";
import { simulate, type SimViewProps } from "../learn/modes/simulate";
import { initialKubeState, reduceKube, type KubeState, type Pod, type PodPhase } from "../sim/kubernetes";
import { C, Glyph } from "../vocab";

/** How fast the reconciliation loop turns while the cluster is settling. */
const TICK_MS = 780;

/* ── stage geometry ─────────────────────────────────────────────────── */
const BOX_W = 202;
const BOX_H = 168;
const BOX_Y = 66;
const NODE_X: Record<string, number> = { "node-a": 22, "node-b": 246, "node-c": 470 };
/** Three capacity slots across the middle of a node box. */
const SLOT_DX = [-56, 0, 56];
const slotPos = (nodeId: string, slot: number) => ({
  x: NODE_X[nodeId] + BOX_W / 2 + (SLOT_DX[slot] ?? 0),
  y: BOX_Y + BOX_H / 2 + 6,
});
/** The unscheduled tray along the bottom — where Pending pods wait. */
const trayPos = (i: number) => ({ x: 90 + i * 48, y: 320 });

/** One colour per lifecycle phase — the whole legend of the sim. */
const PHASE_COLOR: Record<PodPhase, string> = {
  Running: C.green,
  Creating: C.amber,
  Pending: C.blue,
  Terminating: C.violet,
  Lost: C.rose,
};

/** Where every pod should sit right now: on a slot in its node, or in the tray. */
function layout(state: KubeState): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  let trayIdx = 0;
  for (const n of state.nodes) {
    const here = state.pods.filter((p) => p.node === n.id);
    here.forEach((p, slot) => (pos[p.id] = slotPos(n.id, slot)));
  }
  for (const p of state.pods) {
    if (!pos[p.id]) pos[p.id] = trayPos(trayIdx++); // Pending / unbound
  }
  return pos;
}

const podNum = (id: string) => id.replace(/^pod-/, "");

function KubeSim({ host }: SimViewProps) {
  const [state, dispatch] = useReducer(reduceKube, undefined, () => initialKubeState(1337));

  // Turn the reconciliation crank while the cluster is still settling. The moment
  // it reaches a fixed point (`settled`), the timer clears and the stage rests.
  useEffect(() => {
    if (state.settled) return;
    const t = setTimeout(() => dispatch({ type: "tick" }), TICK_MS);
    return () => clearTimeout(t);
  }, [state.settled, state.tick]);

  // Keep the newest reconciliation event — the one the learner just triggered —
  // in view, since the log is the causal narration of what the loop is doing.
  const logRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log.length]);

  const pos = layout(state);
  const running = state.pods.filter((p) => p.phase === "Running").length;
  const pending = state.pods.filter((p) => p.phase === "Pending").length;
  const storyMode = host.nav?.modes.find((m) => m.id === "story");

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-6 py-10">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-teal-300/80 uppercase">Simulate</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">Watch Kubernetes keep your app alive</h2>
        <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-slate-400">
          You declare a desired number of replicas; a control loop makes reality match it. Scale up and the scheduler
          places new pods on the least-loaded node. Delete a pod, or fail a whole node, and the loop notices and reschedules
          — self-healing, one reconciliation at a time.
        </p>

        {/* ── stage ───────────────────────────────────────────────── */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-800/70 bg-slate-950/40">
          <svg viewBox="0 0 700 360" className="w-full" role="img" aria-label="Kubernetes cluster stage">
            {/* the ReplicaSet controller, reading desired vs running */}
            <g transform="translate(350 28)">
              <Glyph name="gear" color={state.settled ? C.dim : C.cyan} />
              <text textAnchor="middle" y={-18} fontSize={11} fill={C.dim}>
                ReplicaSet
              </text>
              <text textAnchor="middle" x={64} y={4} fontSize={12} fontWeight={600} fill={C.ink}>
                desired {state.desired} · running {running}
              </text>
            </g>

            {/* worker nodes as capacity bins */}
            {state.nodes.map((n) => {
              const x = NODE_X[n.id];
              const edge = n.ready ? C.cardEdge : C.rose;
              return (
                <g key={n.id}>
                  <rect
                    x={x}
                    y={BOX_Y}
                    width={BOX_W}
                    height={BOX_H}
                    rx={14}
                    fill={C.card}
                    stroke={edge}
                    strokeWidth={n.ready ? 1 : 1.6}
                    strokeDasharray={n.ready ? undefined : "5 5"}
                  />
                  <g transform={`translate(${x + 26} ${BOX_Y + 24})`}>
                    <Glyph name="server" color={n.ready ? C.blue : C.rose} />
                  </g>
                  <text x={x + 48} y={BOX_Y + 22} fontSize={12} fontWeight={600} fill={n.ready ? C.ink : C.rose}>
                    {n.id}
                  </text>
                  <text x={x + 48} y={BOX_Y + 37} fontSize={10} fill={n.ready ? C.dim : C.rose}>
                    {n.ready ? `Ready · ${n.capacity} slots` : "NotReady"}
                  </text>
                  {/* faint capacity slots */}
                  {SLOT_DX.map((_, s) => {
                    const p = slotPos(n.id, s);
                    return <circle key={s} cx={p.x} cy={p.y} r={15} fill="none" stroke={C.line} strokeDasharray="3 4" />;
                  })}
                </g>
              );
            })}

            {/* tray label */}
            {pending > 0 && (
              <text x={22} y={324} fontSize={10} fill={C.dim}>
                unscheduled
              </text>
            )}

            {/* pods */}
            {state.pods.map((p) => (
              <PodDot key={p.id} pod={p} to={pos[p.id]} />
            ))}
          </svg>
        </div>

        {/* ── controls ────────────────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">Replicas</span>
          <button type="button" onClick={() => dispatch({ type: "scale", desired: state.desired - 1 })} disabled={state.desired <= 0} className={SECONDARY}>
            − Scale down
          </button>
          <span className="min-w-[2ch] text-center text-lg font-semibold tabular-nums text-slate-100">{state.desired}</span>
          <button type="button" onClick={() => dispatch({ type: "scale", desired: state.desired + 1 })} className={SECONDARY}>
            + Scale up
          </button>
          <button type="button" onClick={() => dispatch({ type: "reset" })} className={SECONDARY}>
            Reset
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">Fail a node</span>
          {state.nodes.map((n) => (
            <button key={n.id} type="button" onClick={() => dispatch({ type: "toggleNode", id: n.id })} className={CHIP(!n.ready, true)}>
              {n.ready ? "Fail" : "Recover"} {n.id}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const victim = state.pods.find((p) => p.phase === "Running");
              if (victim) dispatch({ type: "killPod", id: victim.id });
            }}
            disabled={running === 0}
            className={SECONDARY}
          >
            Kill a running pod
          </button>
        </div>

        {/* ── readouts ────────────────────────────────────────────── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 px-5 py-4">
            <p className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">Cluster</p>
            <p className={`mt-1 text-3xl font-semibold tabular-nums ${running === state.desired ? "text-emerald-300" : "text-amber-300"}`}>
              {running}
              <span className="text-base font-normal text-slate-500"> / {state.desired}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {state.settled ? (running === state.desired ? "converged" : pending > 0 ? `${pending} unschedulable` : "settled") : "reconciling…"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 px-5 py-4">
            <p className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">Reconciliation log</p>
            {state.log.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Scale, kill a pod, or fail a node — then watch the loop respond.</p>
            ) : (
              <ol ref={logRef} className="mt-2 flex max-h-44 flex-col gap-1.5 overflow-y-auto text-sm leading-relaxed text-slate-300">
                {state.log.map((entry, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-px tabular-nums text-slate-600">{i + 1}</span>
                    <span className="text-pretty">{entry}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* legend */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
          {(["Running", "Creating", "Pending", "Terminating", "Lost"] as PodPhase[]).map((ph) => (
            <span key={ph} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PHASE_COLOR[ph] }} />
              {ph}
            </span>
          ))}
        </div>

        {storyMode && (
          <div className="mt-8">
            <button type="button" onClick={() => host.nav?.go(storyMode.id)} className={SECONDARY}>
              ← Back to the story
            </button>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}

/** A single pod: a coloured dot that glides to its slot as the loop reschedules. */
function PodDot({ pod, to }: { pod: Pod; to: { x: number; y: number } }) {
  const color = PHASE_COLOR[pod.phase];
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1, x: to.x, y: to.y }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
    >
      <circle r={13} fill={C.card} stroke={color} strokeWidth={2} />
      <circle r={5} fill={color} opacity={pod.phase === "Running" ? 1 : 0.5} />
      <text textAnchor="middle" y={26} fontSize={9} fill={C.dim}>
        {podNum(pod.id)}
      </text>
    </motion.g>
  );
}

const SECONDARY =
  "cursor-pointer rounded-full border border-slate-700/70 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40";
const CHIP = (on: boolean, danger = false) =>
  `cursor-pointer rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
    on
      ? danger
        ? "border-rose-400/50 bg-rose-400/10 text-rose-200"
        : "border-teal-400/50 bg-teal-400/10 text-teal-200"
      : "border-slate-700/70 text-slate-300 hover:border-slate-500 hover:text-slate-100"
  }`;

export default simulate(KubeSim, { label: "Simulate" });
