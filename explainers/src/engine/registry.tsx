import { motion, useTransform, type MotionValue } from "motion/react";
import type { FC } from "react";
import { C, Glyph, accent } from "./glyphs";
import type { ActorSpec, Box } from "./types";

/**
 * Actor renderers. Each receives its static props plus the channel
 * MotionValues the sampler drives. ActorView owns position/opacity/scale;
 * renderers draw centered on (0,0) and decide what glow/progress mean.
 *
 * A new visual shape = one new entry here. It inherits every channel and
 * every animation primitive automatically.
 */

export interface RenderCtx {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  p: Record<string, any>;
  glow: MotionValue<number>;
  progress: MotionValue<number>;
}

/* ---------------- node: the universal machine card ---------------- */

const NodeR: FC<RenderCtx> = ({ p, glow }) => {
  const w: number = p.w ?? 150;
  const h: number = p.h ?? 84;
  const a = accent(p.accent);
  const ringOpacity = useTransform(glow, (g) => g * 0.85);
  return (
    <g>
      <motion.rect
        x={-w / 2 - 5}
        y={-h / 2 - 5}
        width={w + 10}
        height={h + 10}
        rx={19}
        fill="none"
        stroke={a}
        strokeWidth={1.2}
        style={{ opacity: ringOpacity }}
      />
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={16}
        fill={C.card}
        stroke={p.accent ? a : C.cardEdge}
        strokeOpacity={p.accent ? 0.4 : 1}
        strokeWidth={1}
      />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={16} fill="url(#nodeSheen)" opacity={0.5} />
      {p.glyph && (
        <g transform="translate(0, -16)">
          <Glyph name={p.glyph} color={a} />
        </g>
      )}
      <text y={p.glyph ? 18 : -2} textAnchor="middle" fill={C.ink} fontSize={13.5} fontWeight={600}>
        {p.label}
      </text>
      {p.sub && (
        <text y={p.glyph ? 33 : 15} textAnchor="middle" fill={C.dim} fontSize={10.5}>
          {p.sub}
        </text>
      )}
    </g>
  );
};

/* ---------------- packet: anything that travels ---------------- */

const PacketR: FC<RenderCtx> = ({ p }) => {
  const a = accent(p.color);
  const r: number = p.r ?? 8;
  return (
    <g>
      <circle r={r * 2.6} fill={a} opacity={0.2} />
      <circle r={r} fill={a} style={{ filter: `drop-shadow(0 0 10px ${a})` }} />
      {p.label && (
        <text y={-14} textAnchor="middle" fill={a} fontSize={11} fontWeight={600} letterSpacing="0.05em">
          {p.label}
        </text>
      )}
    </g>
  );
};

/* ---------------- wire: draws itself via progress ---------------- */

const WireR: FC<RenderCtx> = ({ p, progress }) => {
  const dashoffset = useTransform(progress, (v) => 1 - v);
  return (
    <motion.path
      d={p.d}
      fill="none"
      stroke={p.color ? accent(p.color) : C.line}
      strokeWidth={1.5}
      pathLength={1}
      strokeDasharray={p.dashed ? "0.03 0.045" : "1 0"}
      style={{ strokeDashoffset: dashoffset }}
    />
  );
};

/* ---------------- bubble: a machine speaks ---------------- */

const BubbleR: FC<RenderCtx> = ({ p }) => {
  const lines: string[] = p.lines ?? [];
  const w: number = p.w ?? 240;
  const h = 20 + lines.length * 18;
  const a = accent(p.accent ?? "ink");
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={12} fill="rgba(10,13,22,0.85)" stroke={C.cardEdge} />
      {lines.map((line, i) => (
        <text
          key={i}
          y={-h / 2 + 24 + i * 18}
          textAnchor="middle"
          fill={i === 0 ? a : C.dim}
          fontSize={i === 0 ? 13 : 11.5}
          fontWeight={i === 0 ? 600 : 400}
          fontStyle={i === 0 ? "italic" : "normal"}
        >
          {line}
        </text>
      ))}
    </g>
  );
};

/* ---------------- label / region / token / dot ---------------- */

const LabelR: FC<RenderCtx> = ({ p }) => (
  <text textAnchor="middle" fill={p.color ? accent(p.color) : C.dim} fontSize={p.size ?? 12.5}>
    {p.text}
  </text>
);

const RegionR: FC<RenderCtx> = ({ p, glow }) => {
  const a = accent(p.accent ?? "dim");
  const edge = useTransform(glow, (g) => 0.35 + g * 0.55);
  return (
    <g>
      <motion.rect
        x={-p.w / 2}
        y={-p.h / 2}
        width={p.w}
        height={p.h}
        rx={18}
        fill="rgba(148,163,184,0.03)"
        stroke={a}
        strokeDasharray="5 7"
        strokeWidth={1}
        style={{ opacity: edge }}
      />
      {p.title && (
        <text x={-p.w / 2 + 16} y={-p.h / 2 + 22} fill={C.dim} fontSize={10.5} letterSpacing="0.14em">
          {String(p.title).toUpperCase()}
        </text>
      )}
    </g>
  );
};

const TokenR: FC<RenderCtx> = ({ p, glow }) => {
  const a = accent(p.accent ?? "cyan");
  const w = Math.max(34, String(p.text).length * 7.5 + 18);
  const ring = useTransform(glow, (g) => g * 0.9);
  return (
    <g>
      <motion.rect
        x={-w / 2 - 4}
        y={-17}
        width={w + 8}
        height={34}
        rx={17}
        fill="none"
        stroke={a}
        style={{ opacity: ring }}
      />
      <rect x={-w / 2} y={-13} width={w} height={26} rx={13} fill={C.card} stroke={C.cardEdge} />
      <text textAnchor="middle" y={4} fill={a} fontSize={11.5} fontWeight={600}>
        {p.text}
      </text>
    </g>
  );
};

const DotR: FC<RenderCtx> = ({ p }) => <circle r={p.r ?? 5} fill={p.color ? accent(p.color) : C.dim} />;

const registry = new Map<string, FC<RenderCtx>>([
  ["node", NodeR],
  ["packet", PacketR],
  ["wire", WireR],
  ["bubble", BubbleR],
  ["label", LabelR],
  ["region", RegionR],
  ["token", TokenR],
  ["dot", DotR],
]);

/** Register a renderer for a new actor kind. Idempotent per kind. */
export function registerActor(kind: string, render: FC<RenderCtx>): void {
  if (import.meta.env.DEV && registry.has(kind) && registry.get(kind) !== render) {
    throw new Error(`[engine] actor kind "${kind}" is already registered`);
  }
  registry.set(kind, render);
}

export function getRenderer(kind: string): FC<RenderCtx> | undefined {
  return registry.get(kind);
}

/**
 * The extension point for genuinely new shapes (a neuron ring, a B-tree page):
 * register a renderer and get back a typed spec factory. The new kind inherits
 * every channel and every motion primitive — no engine fork, no special cases.
 */
export function defineActorKind<P extends Record<string, unknown>>(
  kind: string,
  render: FC<RenderCtx>,
  opts?: { box?: (props: P) => Box },
): (p: P & { x: number; y: number; note?: string; visible?: boolean }) => ActorSpec {
  registerActor(kind, render);
  return ({ x, y, note, visible, ...props }) => ({
    kind,
    x,
    y,
    props,
    note,
    visible,
    box: opts?.box?.(props as unknown as P),
  });
}

/** Shared defs available to every renderer. */
export function StageDefs() {
  return (
    <defs>
      <linearGradient id="nodeSheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(255,255,255,0.07)" />
        <stop offset="45%" stopColor="rgba(255,255,255,0)" />
      </linearGradient>
    </defs>
  );
}
