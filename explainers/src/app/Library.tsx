import { motion } from "motion/react";
import type { CSSProperties, FC } from "react";
import { library } from "../stories";

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Story URLs are path-based: /learn/<slug> (+ ?read for essay mode).
const storyHref = (slug: string) => `${import.meta.env.BASE_URL}${slug}`;

/* ------------------------------------------------------------------ */
/* Per-story flair: an accent hue + a small looping SVG vignette.      */
/* Purely presentational, so it lives here rather than in meta.ts.     */
/* ------------------------------------------------------------------ */

const LINE = "rgba(139,147,167,0.30)";

type Motif = FC<{ a: string }>;

/** dns — one lookup fanning out to three answers */
const DnsMotif: Motif = ({ a }) => (
  <svg viewBox="0 0 132 76" className="h-full w-full" fill="none">
    <path d="M14 38 H58" stroke={LINE} strokeWidth={1.2} />
    <path d="M58 38 C 76 38 82 16 102 16 M58 38 H102 M58 38 C 76 38 82 60 102 60" stroke={LINE} strokeWidth={1.2} />
    <circle cx={14} cy={38} r={4} stroke={a} strokeWidth={1.4} />
    {[16, 38, 60].map((y) => (
      <circle key={y} cx={106} cy={y} r={3.2} stroke={a} strokeWidth={1.2} opacity={0.6} />
    ))}
    {[
      { y: 16, d: 0 },
      { y: 38, d: 1.3 },
      { y: 60, d: 2.6 },
    ].map(({ y, d }) => (
      <motion.circle
        key={y}
        r={3}
        fill={a}
        initial={{ cx: 14, cy: 38, opacity: 0 }}
        animate={{ cx: [14, 14, 58, 102], cy: [38, 38, 38, y], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.7, delay: d, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
      />
    ))}
  </svg>
);

/** kubernetes — pods orbiting a control loop */
const KubernetesMotif: Motif = ({ a }) => (
  <svg viewBox="0 0 132 76" className="h-full w-full" fill="none">
    <circle cx={66} cy={38} r={24} stroke={LINE} strokeWidth={1.2} strokeDasharray="3 5" />
    <motion.circle
      cx={66}
      cy={38}
      r={6}
      stroke={a}
      strokeWidth={1.5}
      animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    />
    <motion.g
      animate={{ rotate: 360 }}
      transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    >
      <circle cx={66} cy={38} r={24} fill="none" stroke="none" />
      {[0, 120, 240].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return <circle key={deg} cx={66 + 24 * Math.cos(rad)} cy={38 + 24 * Math.sin(rad)} r={4} fill={a} opacity={0.85} />;
      })}
    </motion.g>
  </svg>
);

/** deployment — hopping up the laptop → VM → container → cluster ladder */
const DeploymentMotif: Motif = ({ a }) => (
  <svg viewBox="0 0 132 76" className="h-full w-full" fill="none">
    {[
      { x: 30, y: 60 },
      { x: 62, y: 44 },
      { x: 94, y: 28 },
    ].map(({ x, y }) => (
      <rect key={x} x={x - 14} y={y} width={28} height={5} rx={2.5} stroke={LINE} strokeWidth={1.2} />
    ))}
    <motion.circle
      r={4.5}
      fill={a}
      animate={{ cx: [30, 46, 62, 78, 94, 94], cy: [54, 30, 38, 14, 22, 22] }}
      transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
    />
    <motion.circle
      cx={94}
      cy={22}
      r={9}
      stroke={a}
      strokeWidth={1.2}
      animate={{ opacity: [0, 0, 0.7, 0], scale: [0.6, 0.6, 1.3, 1.5] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeOut" }}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    />
  </svg>
);

/** git — a DAG of sealed commits with a branch pointer sliding forward */
const GitMotif: Motif = ({ a }) => (
  <svg viewBox="0 0 132 76" className="h-full w-full" fill="none">
    <path d="M16 54 H108" stroke={LINE} strokeWidth={1.2} />
    <path d="M44 54 C 58 54 58 28 72 28 H 108" stroke={LINE} strokeWidth={1.2} />
    {[16, 44, 72, 100].map((x) => (
      <circle key={x} cx={x} cy={54} r={4} stroke={a} strokeWidth={1.3} opacity={0.65} />
    ))}
    {[72, 104].map((x) => (
      <circle key={x} cx={x} cy={28} r={4} fill={a} opacity={0.9} />
    ))}
    <motion.g animate={{ x: [0, 0, 32, 32, 0] }} transition={{ duration: 4.5, times: [0, 0.35, 0.5, 0.9, 1], repeat: Infinity, ease: "easeInOut" }}>
      <rect x={58} y={6} width={28} height={13} rx={4} stroke={a} strokeWidth={1.2} />
      <text x={72} y={15.5} textAnchor="middle" fill={a} fontSize={8} fontWeight={600}>
        main
      </text>
      <path d="M72 19 V 22" stroke={a} strokeWidth={1.2} />
    </motion.g>
  </svg>
);

/** gradient descent — a ball settling into the valley */
const GradientMotif: Motif = ({ a }) => (
  <svg viewBox="0 0 132 76" className="h-full w-full" fill="none">
    <path d="M 10 14 C 40 74, 90 74, 122 26" stroke={LINE} strokeWidth={1.2} />
    <motion.circle
      r={5}
      fill={a}
      animate={{
        cx: [14, 38, 65, 82, 56, 72, 62, 66],
        cy: [17, 48, 60, 55, 57, 59, 59.5, 60],
      }}
      transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
    />
    <path d="M 60 68 H 72" stroke={a} strokeWidth={1.2} opacity={0.5} strokeDasharray="2 3" />
  </svg>
);

/** mixture of experts — a router dispatching tokens to specialists */
const MoeMotif: Motif = ({ a }) => (
  <svg viewBox="0 0 132 76" className="h-full w-full" fill="none">
    <path d="M14 38 H46" stroke={LINE} strokeWidth={1.2} />
    <path d="M70 38 C 82 38 84 14 96 14 M70 38 H96 M70 38 C 82 38 84 62 96 62" stroke={LINE} strokeWidth={1.2} />
    <path d="M58 27 L69 38 L58 49 L47 38 Z" stroke={a} strokeWidth={1.4} />
    {[14, 38, 62].map((y) => (
      <rect key={y} x={98} y={y - 6} width={20} height={12} rx={4} stroke={a} strokeWidth={1.2} opacity={0.6} />
    ))}
    {[
      { y: 14, d: 0 },
      { y: 62, d: 1.4 },
      { y: 38, d: 2.8 },
    ].map(({ y, d }) => (
      <motion.circle
        key={y}
        r={3}
        fill={a}
        initial={{ cx: 14, cy: 38, opacity: 0 }}
        animate={{ cx: [14, 14, 58, 104], cy: [38, 38, 38, y], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.8, delay: d, repeat: Infinity, repeatDelay: 2.7, ease: "easeInOut" }}
      />
    ))}
  </svg>
);

/** operating systems — the timer's square wave, drawn tick by tick */
const OsMotif: Motif = ({ a }) => (
  <svg viewBox="0 0 132 76" className="h-full w-full" fill="none">
    <path d="M 10 56 H 122" stroke={LINE} strokeWidth={1} strokeDasharray="2 4" />
    <motion.path
      d="M 10 50 H 26 V 26 H 44 V 50 H 62 V 26 H 80 V 50 H 98 V 26 H 122"
      stroke={a}
      strokeWidth={1.6}
      strokeLinejoin="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: [0, 1] }}
      transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.2, ease: "linear" }}
    />
    <motion.circle
      cx={10}
      cy={50}
      r={4}
      fill={a}
      animate={{ opacity: [1, 0.25, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
    />
  </svg>
);

/** elasticsearch — a magnifier sweeping indexed rows, lighting up matches */
const ElasticsearchMotif: Motif = ({ a }) => (
  <svg viewBox="0 0 132 76" className="h-full w-full" fill="none">
    {[20, 38, 56].map((y) => (
      <path key={y} d={`M 44 ${y} H 118`} stroke={LINE} strokeWidth={1.4} strokeLinecap="round" />
    ))}
    {[
      { y: 20, x: 62, w: 18, d: 0.55 },
      { y: 56, x: 88, w: 22, d: 2.15 },
    ].map(({ y, x, w, d }) => (
      <motion.path
        key={y}
        d={`M ${x} ${y} H ${x + w}`}
        stroke={a}
        strokeWidth={2.4}
        strokeLinecap="round"
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.6, delay: d, repeat: Infinity, repeatDelay: 2.6, ease: "easeInOut" }}
      />
    ))}
    <motion.g
      animate={{ y: [0, 0, 36, 36, 0] }}
      transition={{ duration: 4.2, times: [0, 0.2, 0.55, 0.85, 1], repeat: Infinity, ease: "easeInOut" }}
    >
      <circle cx={24} cy={16} r={8} stroke={a} strokeWidth={1.5} />
      <path d="M 30 22 L 36 28" stroke={a} strokeWidth={1.5} strokeLinecap="round" />
    </motion.g>
  </svg>
);

/** fallback for any story added without bespoke flair */
const DefaultMotif: Motif = ({ a }) => (
  <svg viewBox="0 0 132 76" className="h-full w-full" fill="none">
    <path d="M14 38 H118" stroke={LINE} strokeWidth={1.2} />
    <motion.circle
      r={4}
      cy={38}
      fill={a}
      animate={{ cx: [14, 118] }}
      transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
    />
  </svg>
);

const FLAIR: Record<string, { accent: string; Motif: Motif }> = {
  dns: { accent: "#5eead4", Motif: DnsMotif },
  kubernetes: { accent: "#7dd3fc", Motif: KubernetesMotif },
  deployment: { accent: "#fcd34d", Motif: DeploymentMotif },
  "git-internals": { accent: "#fda4af", Motif: GitMotif },
  "gradient-descent": { accent: "#86efac", Motif: GradientMotif },
  "mixture-of-experts": { accent: "#c4b5fd", Motif: MoeMotif },
  "operating-systems": { accent: "#93c5fd", Motif: OsMotif },
  elasticsearch: { accent: "#fdba74", Motif: ElasticsearchMotif },
};

const DEFAULT_FLAIR = { accent: "#7dd3fc", Motif: DefaultMotif };

/* ------------------------------------------------------------------ */

/** The index of every explainer. Grows automatically as stories are added. */
export function Library() {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-4xl flex-col justify-center px-6 py-16">
      {/* faint dot grid, fading out toward the bottom */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(148,163,184,0.11) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 90% 65% at 50% 0%, black 25%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 65% at 50% 0%, black 25%, transparent 78%)",
        }}
      />

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-[11px] font-semibold tracking-[0.26em] text-teal-300/80 uppercase"
      >
        Interactive explainers
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6, ease: EASE_OUT }}
        className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl"
      >
        Systems, explained <span className="shimmer-text">in motion.</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.6, ease: EASE_OUT }}
        className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-400"
      >
        Not articles — little machines. Pause them, scrub them, break them on purpose.{" "}
        <span className="text-slate-500">{library.length} systems and counting.</span>
      </motion.p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {library.map((m, i) => {
          const { accent, Motif } = FLAIR[m.slug] ?? DEFAULT_FLAIR;
          return (
            <motion.a
              key={m.slug}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.07, duration: 0.55, ease: EASE_OUT }}
              href={storyHref(m.slug)}
              style={{ "--acc": accent } as CSSProperties}
              className="glass story-card group relative flex flex-col overflow-hidden rounded-2xl"
            >
              {/* accent hairline along the top edge */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px opacity-60 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
              />
              {/* corner glow that wakes up on hover */}
              <div
                aria-hidden
                className="absolute -top-20 -right-14 h-48 w-48 rounded-full blur-3xl transition-opacity duration-500"
                style={{ background: accent, opacity: 0.06 }}
              />
              <div
                aria-hidden
                className="absolute -top-20 -right-14 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.16]"
                style={{ background: accent }}
              />

              <div className="relative flex h-24 items-center border-b border-white/[0.06] px-4">
                <span className="absolute top-3 left-5 font-mono text-[10px] tracking-[0.2em] text-slate-600">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Motif a={accent} />
              </div>

              <div className="flex flex-1 flex-col p-6 pt-5">
                <p className="text-lg font-semibold text-slate-100 transition-colors group-hover:text-white">{m.title}</p>
                <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-slate-400">{m.intro.lead}</p>
                <p className="mt-auto pt-4 text-xs font-medium" style={{ color: accent }}>
                  {m.intro.begin}{" "}
                  <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                  <span className="ml-3 text-slate-500">or</span>{" "}
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `${storyHref(m.slug)}?read`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") window.location.href = `${storyHref(m.slug)}?read`;
                    }}
                    className="text-slate-400 underline decoration-slate-700 underline-offset-4 hover:text-slate-200"
                  >
                    read it as an essay
                  </span>
                </p>
              </div>
            </motion.a>
          );
        })}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.8 }}
        className="mt-12 text-center text-xs text-slate-600"
      >
        Built by{" "}
        <a href="/" className="text-slate-500 underline decoration-slate-700 underline-offset-4 hover:text-slate-300">
          Absolute Devs
        </a>{" "}
        — new systems added regularly.
      </motion.p>
    </div>
  );
}
