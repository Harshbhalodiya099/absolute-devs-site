/**
 * Elasticsearch simulation — the React view, co-located with its registration
 * (like an assessment data file). Everything topic-specific lives here and in the
 * headless reducer it imports (`sim/elasticsearch`); the generic `simulate` mode
 * and the `sims/` discovery glob carry it to the screen unchanged — no engine edit.
 *
 * Its own visual identity (PHASE4 §7): nodes are bins, and each shard *copy* is a
 * labelled block — a filled block is a **primary**, a hollow one a **replica** —
 * that glides between bins as the cluster promotes, recovers, and rebalances. A
 * health pill (green / yellow / red) reads the one number that matters. Hitting
 * Search fans a request out from a coordinator to one copy of every shard. A timer
 * turns the allocation crank only while the cluster is still settling. Motion is
 * guarded by `prefers-reduced-motion`.
 */
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useEffect, useReducer, useRef, useState } from "react";
import { simulate, type SimViewProps } from "../learn/modes/simulate";
import { health, initialEsState, reduceEs, type CopyState, type EsState, type ShardCopy } from "../sim/elasticsearch";
import { C, Glyph } from "../vocab";

/** How fast the allocation loop turns while the cluster is still settling. */
const TICK_MS = 820;
/** How long a search fan-out stays lit on the stage. */
const SEARCH_MS = 1700;

/* ── stage geometry (node bins widen the SVG, so add-node just scrolls) ── */
const BIN_W = 152;
const GAP = 18;
const X0 = 20;
const BIN_Y = 78;
const BIN_H = 206;
const BLOCK_W = 58;
const BLOCK_H = 30;
const nodeX = (i: number) => X0 + i * (BIN_W + GAP);
const stageW = (n: number) => X0 * 2 + n * BIN_W + Math.max(0, n - 1) * GAP;
const COORD_Y = 30;
const TRAY_Y = BIN_Y + BIN_H + 40;

/** One colour per copy state — the whole legend of the sim. */
const STATE_COLOR: Record<CopyState, string> = {
  assigned: C.green,
  initializing: C.amber,
  relocating: C.violet,
  unassigned: C.rose,
};

const HEALTH_COLOR = { green: C.green, yellow: C.amber, red: C.rose } as const;

/** Where every copy should sit right now: in a slot in its node, or in the tray. */
function layout(state: EsState): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const idx: Record<string, number> = {};
  state.nodes.forEach((n, i) => {
    const here = state.copies.filter((c) => c.node === n.id && c.state !== "unassigned").sort((a, b) => a.shard - b.shard || a.role.localeCompare(b.role));
    here.forEach((c, k) => {
      const col = k % 2;
      const row = Math.floor(k / 2);
      pos[c.id] = { x: nodeX(i) + 16 + col * 66 + BLOCK_W / 2, y: BIN_Y + 44 + row * 40 + BLOCK_H / 2 };
      idx[n.id] = k;
    });
  });
  let tray = 0;
  for (const c of state.copies) {
    if (!pos[c.id]) pos[c.id] = { x: X0 + BLOCK_W / 2 + tray++ * 66, y: TRAY_Y + BLOCK_H / 2 };
  }
  return pos;
}

function EsSim({ host }: SimViewProps) {
  const [state, dispatch] = useReducer(reduceEs, undefined, () => initialEsState(20260724));
  // The search that is currently lit on the stage (keyed by the tick it fired).
  const [searchAt, setSearchAt] = useState<number | null>(null);

  // Turn the allocation crank while the cluster is still settling; the moment it
  // reaches a fixed point (`settled`) the timer clears and the stage rests.
  useEffect(() => {
    if (state.settled) return;
    const t = setTimeout(() => dispatch({ type: "tick" }), TICK_MS);
    return () => clearTimeout(t);
  }, [state.settled, state.tick]);

  const logRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log.length]);

  const runSearch = () => {
    dispatch({ type: "search" });
    setSearchAt(Date.now());
  };
  // Clear the search overlay after it has played.
  useEffect(() => {
    if (searchAt === null) return;
    const t = setTimeout(() => setSearchAt(null), SEARCH_MS);
    return () => clearTimeout(t);
  }, [searchAt]);

  const pos = layout(state);
  const h = health(state);
  const up = state.nodes.filter((n) => !n.down).length;
  const unassigned = state.copies.filter((c) => c.state === "unassigned").length;
  const replicaCopies = state.copies.filter((c) => c.role === "replica").length;
  const search = searchAt !== null ? state.lastSearch : null;
  const coordX = stageW(state.nodes.length) / 2;
  const storyMode = host.nav?.modes.find((m) => m.id === "story");

  const nodeCenterX = (nodeId: string) => {
    const i = state.nodes.findIndex((n) => n.id === nodeId);
    return i < 0 ? coordX : nodeX(i) + BIN_W / 2;
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-6 py-10">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-teal-300/80 uppercase">Simulate</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">Watch Elasticsearch keep your data searchable</h2>
        <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-slate-400">
          An index is split into <span className="text-slate-200">shards</span>; each shard is copied onto another node as a{" "}
          <span className="text-slate-200">replica</span>. Fail a node and watch a replica get promoted to primary and the cluster re-home its
          shards — green to yellow to green. Run a search to see it fan out to one copy of every shard and merge the answers.
        </p>

        {/* ── health pill ─────────────────────────────────────────── */}
        <div className="mt-5 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ color: HEALTH_COLOR[h], background: `${HEALTH_COLOR[h]}1a`, border: `1px solid ${HEALTH_COLOR[h]}55` }}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: HEALTH_COLOR[h] }} />
            cluster {h}
          </span>
          <span className="text-xs text-slate-500">{state.settled ? (h === "green" ? "fully redundant" : "settled") : "reallocating…"}</span>
        </div>

        {/* ── stage ───────────────────────────────────────────────── */}
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800/70 bg-slate-950/40">
          <svg viewBox={`0 0 ${stageW(state.nodes.length)} ${TRAY_Y + 70}`} className="w-full" role="img" aria-label="Elasticsearch cluster stage">
            {/* the coordinator that fans a search out across the shards */}
            <g transform={`translate(${coordX} ${COORD_Y})`}>
              <Glyph name="balancer" color={search ? C.cyan : C.dim} />
              <text textAnchor="middle" y={-16} fontSize={11} fill={C.dim}>
                coordinator
              </text>
            </g>

            {/* search fan-out: coordinator → one live copy per shard */}
            <AnimatePresence>
              {search &&
                search.routes.map((r) => (
                  <motion.line
                    key={`ln-${r.shard}`}
                    x1={coordX}
                    y1={COORD_Y + 16}
                    x2={nodeCenterX(r.node)}
                    y2={BIN_Y + 6}
                    stroke={C.cyan}
                    strokeWidth={1.4}
                    strokeDasharray="3 4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.8 }}
                    exit={{ opacity: 0 }}
                  />
                ))}
            </AnimatePresence>

            {/* node bins */}
            {state.nodes.map((n, i) => {
              const edge = n.down ? C.rose : C.cardEdge;
              const count = state.copies.filter((c) => c.node === n.id && c.state !== "unassigned").length;
              return (
                <g key={n.id}>
                  <rect x={nodeX(i)} y={BIN_Y} width={BIN_W} height={BIN_H} rx={14} fill={C.card} stroke={edge} strokeWidth={n.down ? 1.6 : 1} strokeDasharray={n.down ? "5 5" : undefined} />
                  <g transform={`translate(${nodeX(i) + 24} ${BIN_Y + 24})`}>
                    <Glyph name="database" color={n.down ? C.rose : C.blue} />
                  </g>
                  <text x={nodeX(i) + 46} y={BIN_Y + 22} fontSize={12} fontWeight={600} fill={n.down ? C.rose : C.ink}>
                    {n.id}
                  </text>
                  <text x={nodeX(i) + 46} y={BIN_Y + 36} fontSize={10} fill={n.down ? C.rose : C.dim}>
                    {n.down ? "down" : `${count} shard${count === 1 ? "" : "s"}`}
                  </text>
                </g>
              );
            })}

            {/* tray label */}
            {unassigned > 0 && (
              <text x={X0} y={TRAY_Y - 14} fontSize={10} fill={C.rose}>
                unassigned — waiting for a node with room
              </text>
            )}

            {/* shard copies */}
            {state.copies.map((c) => (
              <ShardBlock key={c.id} copy={c} to={pos[c.id]} lit={!!search && search.routes.some((r) => r.copyId === c.id)} />
            ))}
          </svg>
        </div>

        {/* ── controls ────────────────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={runSearch} className={PRIMARY}>
            Run a search
          </button>
          <button type="button" onClick={() => dispatch({ type: "addNode" })} className={SECONDARY}>
            + Add node
          </button>
          <button type="button" onClick={() => dispatch({ type: "reset" })} className={SECONDARY}>
            Reset
          </button>
          <span className="ml-1 text-[11px] tracking-[0.18em] text-slate-500 uppercase">Replicas</span>
          <button type="button" onClick={() => dispatch({ type: "setReplicas", count: state.replicas - 1 })} disabled={state.replicas <= 0} className={SECONDARY}>
            −
          </button>
          <span className="min-w-[2ch] text-center text-base font-semibold tabular-nums text-slate-100">{state.replicas}</span>
          <button type="button" onClick={() => dispatch({ type: "setReplicas", count: state.replicas + 1 })} disabled={state.replicas >= 3} className={SECONDARY}>
            +
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">Nodes</span>
          {state.nodes.map((n) => (
            <span key={n.id} className="inline-flex overflow-hidden rounded-full border border-slate-700/70">
              <button type="button" onClick={() => dispatch({ type: "toggleNode", id: n.id })} className={CHIP(n.down)}>
                {n.down ? "Recover" : "Fail"} {n.id}
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "removeNode", id: n.id })}
                disabled={state.nodes.length <= 1}
                className="cursor-pointer border-l border-slate-700/70 px-2.5 py-2 text-xs text-slate-500 transition-colors hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Remove ${n.id}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        {/* ── readouts ────────────────────────────────────────────── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 px-5 py-4">
            <p className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">Cluster</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-sm">
              <dt className="text-slate-500">Nodes up</dt>
              <dd className="text-right tabular-nums text-slate-200">{up}</dd>
              <dt className="text-slate-500">Primaries</dt>
              <dd className="text-right tabular-nums text-slate-200">{state.shards}</dd>
              <dt className="text-slate-500">Replicas</dt>
              <dd className="text-right tabular-nums text-slate-200">{replicaCopies}</dd>
              <dt className="text-slate-500">Unassigned</dt>
              <dd className={`text-right tabular-nums ${unassigned ? "text-rose-300" : "text-slate-200"}`}>{unassigned}</dd>
              <dt className="text-slate-500">Relocations</dt>
              <dd className="text-right tabular-nums text-slate-200">{state.relocations}</dd>
              <dt className="text-slate-500">Last search</dt>
              <dd className="text-right tabular-nums text-slate-200">{state.lastSearch ? `${state.lastSearch.totalLatencyMs} ms` : "—"}</dd>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 px-5 py-4">
            <p className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">Cluster log</p>
            {state.log.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Fail a node, add a node, or run a search — then watch the cluster respond.</p>
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
          {(["assigned", "initializing", "relocating", "unassigned"] as CopyState[]).map((st) => (
            <span key={st} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: STATE_COLOR[st] }} />
              {st}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: C.ink }} /> primary (filled)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px] border" style={{ borderColor: C.ink }} /> replica (hollow)
          </span>
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

/**
 * One shard copy: a labelled block that glides to its slot as the cluster
 * reallocates. A primary is filled in its state colour; a replica is hollow with
 * a coloured border — so promotion (hollow → filled) is visible at a glance.
 */
function ShardBlock({ copy, to, lit }: { copy: ShardCopy; to: { x: number; y: number }; lit: boolean }) {
  const color = STATE_COLOR[copy.state];
  const isPrimary = copy.role === "primary";
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1, x: to.x - BLOCK_W / 2, y: to.y - BLOCK_H / 2 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 210, damping: 26 }}
    >
      <rect
        width={BLOCK_W}
        height={BLOCK_H}
        rx={7}
        fill={isPrimary ? color : "transparent"}
        fillOpacity={isPrimary ? 0.22 : 0}
        stroke={color}
        strokeWidth={isPrimary ? 2 : 1.4}
        strokeDasharray={isPrimary ? undefined : "4 3"}
      />
      {lit && <rect width={BLOCK_W} height={BLOCK_H} rx={7} fill="none" stroke={C.cyan} strokeWidth={2.4} />}
      <text x={BLOCK_W / 2} y={BLOCK_H / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={600} fill={C.ink}>
        S{copy.shard}
        <tspan fontSize={9} fontWeight={500} fill={color} dx={2}>
          {isPrimary ? "P" : "R"}
        </tspan>
      </text>
    </motion.g>
  );
}

const PRIMARY =
  "cursor-pointer rounded-full border border-teal-400/50 bg-teal-400/10 px-4 py-2.5 text-sm font-medium text-teal-100 transition-colors hover:bg-teal-400/20";
const SECONDARY =
  "cursor-pointer rounded-full border border-slate-700/70 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40";
const CHIP = (down: boolean) =>
  `cursor-pointer px-3.5 py-2 text-xs font-medium transition-colors ${
    down ? "bg-rose-400/10 text-rose-200" : "text-slate-300 hover:bg-slate-700/40 hover:text-slate-100"
  }`;

export default simulate(EsSim, { label: "Simulate" });
