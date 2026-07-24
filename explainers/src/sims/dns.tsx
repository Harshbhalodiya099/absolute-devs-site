/**
 * DNS simulation — the React view, co-located with its registration (like an
 * assessment data file). Everything topic-specific lives here and in the
 * headless reducer it imports (`sim/dns`); the generic `simulate` mode and the
 * `sims/` discovery glob carry it to the screen unchanged.
 *
 * The stage is a fixed-layout SVG drawn from the shared `vocab` (glyphs +
 * accents), not a dashboard: five actors, the paths between them, and a single
 * packet walking the active hop. Motion is guarded by `prefers-reduced-motion`
 * (the answer simply appears instead of travelling).
 */
import { motion, MotionConfig } from "motion/react";
import { useEffect, useReducer } from "react";
import { simulate, type SimViewProps } from "../learn/modes/simulate";
import { initialDnsState, reduceDns, type DnsNodeId } from "../sim/dns";
import { C, Glyph } from "../vocab";

/** Fixed stage geometry — a climb up the hierarchy and a long arc home. */
const POS: Record<DnsNodeId, { x: number; y: number }> = {
  client: { x: 70, y: 214 },
  resolver: { x: 214, y: 214 },
  root: { x: 356, y: 92 },
  tld: { x: 496, y: 92 },
  auth: { x: 626, y: 214 },
};

const NODES: { id: DnsNodeId; glyph: string; label: string; sub: string; color: string }[] = [
  { id: "client", glyph: "laptop", label: "You", sub: "google.com?", color: C.blue },
  { id: "resolver", glyph: "server", label: "Resolver", sub: "does the walking", color: C.cyan },
  { id: "root", glyph: "book", label: "Root", sub: "knows every ending", color: C.amber },
  { id: "tld", glyph: "book", label: ".com registry", sub: "knows every .com", color: C.violet },
  { id: "auth", glyph: "server", label: "ns1.google.com", sub: "authoritative", color: C.green },
];

/** The drawn paths, keyed by an unordered node pair so hops can light them up. */
const EDGES: { a: DnsNodeId; b: DnsNodeId; d: string }[] = [
  { a: "client", b: "resolver", d: line("client", "resolver") },
  { a: "resolver", b: "root", d: line("resolver", "root") },
  { a: "root", b: "tld", d: line("root", "tld") },
  { a: "tld", b: "auth", d: line("tld", "auth") },
  { a: "auth", b: "resolver", d: `M ${POS.auth.x} ${POS.auth.y} Q 420 336 ${POS.resolver.x} ${POS.resolver.y}` },
];

function line(a: DnsNodeId, b: DnsNodeId): string {
  return `M ${POS[a].x} ${POS[a].y} L ${POS[b].x} ${POS[b].y}`;
}

const ukey = (a: DnsNodeId, b: DnsNodeId) => [a, b].sort().join("~");

/** How fast the walk auto-advances; the packet animation is a touch shorter. */
const TICK_MS = 720;

function DnsSim({ host }: SimViewProps) {
  const [state, dispatch] = useReducer(reduceDns, undefined, () => initialDnsState(1337));

  // While walking, advance one hop at a time on a timer — the packet finishes
  // travelling, then the next hop begins. Cleared the moment the walk settles.
  useEffect(() => {
    if (state.phase !== "walking") return;
    const t = setTimeout(() => dispatch({ type: "advance" }), TICK_MS);
    return () => clearTimeout(t);
  }, [state.phase, state.activeHop]);

  const hop = state.phase === "walking" ? state.plan[state.activeHop] : undefined;
  const activePair = hop ? ukey(hop.from, hop.to) : null;
  const donePairs = new Set(state.plan.slice(0, state.activeHop).map((h) => ukey(h.from, h.to)));
  const walking = state.phase === "walking";

  const storyMode = host.nav?.modes.find((m) => m.id === "story");

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-6 py-10">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-teal-300/80 uppercase">Simulate</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">Walk a lookup for google.com</h2>
        <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-slate-400">
          Trigger a lookup and watch the question climb the hierarchy. Turn the resolver's cache on and a second lookup
          skips the whole walk; break a server and the lookup times out where it stalls.
        </p>

        {/* ── stage ───────────────────────────────────────────────── */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-800/70 bg-slate-950/40">
          <svg viewBox="0 0 700 300" className="w-full" role="img" aria-label="DNS resolution stage">
            {EDGES.map((e) => {
              const k = ukey(e.a, e.b);
              const active = k === activePair;
              const done = donePairs.has(k) && !active;
              return (
                <path
                  key={k}
                  d={e.d}
                  fill="none"
                  strokeWidth={active ? 2.4 : 1.4}
                  stroke={active ? C.cyan : done ? C.green : C.line}
                  strokeDasharray={active || done ? undefined : "4 5"}
                  opacity={active ? 1 : done ? 0.8 : 0.6}
                />
              );
            })}

            {/* the packet, travelling the active hop */}
            {walking && hop && (
              <motion.circle
                key={`packet-${state.tick}`}
                r={6}
                fill={state.down[hop.to] ? C.rose : C.cyan}
                initial={{ cx: POS[hop.from].x, cy: POS[hop.from].y }}
                animate={{ cx: POS[hop.to].x, cy: POS[hop.to].y }}
                transition={{ duration: 0.55, ease: "easeInOut" }}
              />
            )}

            {NODES.map((n) => {
              const down = state.down[n.id];
              const touched = hop && (hop.from === n.id || hop.to === n.id);
              const answered = state.phase === "answered" && (n.id === "client" || n.id === "resolver");
              const color = down ? C.rose : touched ? C.cyan : answered ? C.green : n.color;
              const p = POS[n.id];
              return (
                <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
                  <circle r={26} fill={C.card} stroke={touched ? color : C.cardEdge} strokeWidth={touched ? 1.8 : 1} />
                  <Glyph name={n.glyph} color={color} />
                  <text textAnchor="middle" y={44} fontSize={12} fill={down ? C.rose : C.ink} fontWeight={600}>
                    {n.label}
                  </text>
                  <text textAnchor="middle" y={59} fontSize={10} fill={C.dim}>
                    {down ? "unreachable" : n.sub}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* ── controls ────────────────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => dispatch({ type: "lookup" })} disabled={walking} className={PRIMARY}>
            Look up google.com
          </button>
          <button type="button" onClick={() => dispatch({ type: "toggleCache" })} className={CHIP(state.cacheEnabled)}>
            Cache {state.cacheEnabled ? "on" : "off"}
          </button>
          <button type="button" onClick={() => dispatch({ type: "clearCache" })} disabled={!state.cached} className={SECONDARY}>
            Clear cache (expire TTL)
          </button>
          <button type="button" onClick={() => dispatch({ type: "reset" })} className={SECONDARY}>
            Reset
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">Break a server</span>
          {(["resolver", "root", "tld", "auth"] as DnsNodeId[]).map((id) => (
            <button key={id} type="button" onClick={() => dispatch({ type: "toggleDown", node: id })} className={CHIP(state.down[id], true)}>
              {state.down[id] ? "Restore" : "Break"} {NODES.find((n) => n.id === id)!.label}
            </button>
          ))}
        </div>

        {/* ── readouts ────────────────────────────────────────────── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 px-5 py-4">
            <p className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">Total latency</p>
            <p
              className={`mt-1 text-3xl font-semibold tabular-nums ${
                state.phase === "failed" ? "text-rose-300" : state.phase === "answered" ? "text-emerald-300" : "text-slate-100"
              }`}
            >
              {state.totalLatencyMs}
              <span className="ml-1 text-base font-normal text-slate-500">ms</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {state.phase === "failed" ? "lookup failed" : state.phase === "answered" ? "answered" : walking ? "walking…" : "idle"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 px-5 py-4">
            <p className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">Step log</p>
            {state.log.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Press “Look up google.com” to begin.</p>
            ) : (
              <ol className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed text-slate-300">
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

const PRIMARY =
  "cursor-pointer rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500";
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

export default simulate(DnsSim, { label: "Simulate" });
