import type { ReactNode } from "react";

/**
 * The engine palette. Calm, dark, few hues. Accents are referenced by name in
 * story files so the palette can evolve without touching content.
 */
export const C = {
  ink: "#e8ecf4",
  dim: "#8b93a7",
  faint: "#4a5165",
  line: "rgba(139,147,167,0.28)",
  cyan: "#5eead4",
  blue: "#7dd3fc",
  violet: "#c4b5fd",
  amber: "#fcd34d",
  rose: "#fda4af",
  green: "#86efac",
  card: "rgba(148,163,184,0.10)",
  cardEdge: "rgba(148,163,184,0.30)",
} as const;

export type AccentName = "cyan" | "blue" | "violet" | "amber" | "rose" | "green" | "ink" | "dim";

export function accent(name?: string): string {
  return (C as Record<string, string>)[name ?? "blue"] ?? C.blue;
}

/** Names stories may use for glyphs. Derived from the library: an invalid name cannot compile. */
export type GlyphName = keyof typeof glyphs;

/**
 * Vocabulary of small line-drawn glyphs, all centered on (0,0), ~26px box.
 * Growing the visual vocabulary of the engine = adding one entry here.
 */
export const glyphs = {
  laptop: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x={-13} y={-11} width={26} height={16} rx={2.5} />
      <path d="M -17 8 H 17" />
    </g>
  ),
  globe: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round">
      <circle r={11} />
      <ellipse rx={5} ry={11} />
      <path d="M -10.5 -4 H 10.5 M -10.5 4 H 10.5" />
    </g>
  ),
  server: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round">
      <rect x={-12} y={-12} width={24} height={9} rx={2.5} />
      <rect x={-12} y={2} width={24} height={9} rx={2.5} />
      <circle cx={-7} cy={-7.5} r={1.1} fill={c} stroke="none" />
      <circle cx={-7} cy={6.5} r={1.1} fill={c} stroke="none" />
    </g>
  ),
  database: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round">
      <ellipse cy={-8} rx={11} ry={4.5} />
      <path d="M -11 -8 V 8 A 11 4.5 0 0 0 11 8 V -8" />
      <path d="M -11 0 A 11 4.5 0 0 0 11 0" />
    </g>
  ),
  cache: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 2 -13 L -7 2 H 0 L -2 13 L 7 -2 H 0 Z" />
    </g>
  ),
  balancer: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx={-9} cy={0} r={3.2} />
      <circle cx={9} cy={-8} r={3.2} />
      <circle cx={9} cy={0} r={3.2} />
      <circle cx={9} cy={8} r={3.2} />
      <path d="M -5.8 -1 L 5.8 -7 M -5.8 0 H 5.8 M -5.8 1 L 5.8 7" />
    </g>
  ),
  chip: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round">
      <rect x={-9} y={-9} width={18} height={18} rx={3} />
      <path d="M -4 -13 V -9 M 0 -13 V -9 M 4 -13 V -9 M -4 13 V 9 M 0 13 V 9 M 4 13 V 9 M -13 -4 H -9 M -13 0 H -9 M -13 4 H -9 M 13 -4 H 9 M 13 0 H 9 M 13 4 H 9" />
    </g>
  ),
  lock: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round">
      <rect x={-9} y={-3} width={18} height={13} rx={3} />
      <path d="M -5 -3 V -7 a 5 5 0 0 1 10 0 V -3" />
    </g>
  ),
  doc: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M -8 -12 H 3 L 8 -7 V 12 H -8 Z" />
      <path d="M -4 -2 H 4 M -4 3 H 4 M -4 8 H 1" />
    </g>
  ),
  book: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 0 -9 C -3 -12 -9 -12 -12 -10 V 9 C -9 7 -3 7 0 10 C 3 7 9 7 12 9 V -10 C 9 -12 3 -12 0 -9 Z" />
      <path d="M 0 -9 V 10" />
    </g>
  ),
  user: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round">
      <circle cy={-5} r={5} />
      <path d="M -9 12 C -9 4 9 4 9 12" />
    </g>
  ),
  cloud: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M -8 8 A 5.5 5.5 0 0 1 -7 -3 A 8 8 0 0 1 8 -4 A 5 5 0 0 1 9 8 Z" />
    </g>
  ),
  box: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 0 -12 L 11 -6 V 6 L 0 12 L -11 6 V -6 Z" />
      <path d="M -11 -6 L 0 0 L 11 -6 M 0 0 V 12" />
    </g>
  ),
  gear: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round">
      <circle r={4} />
      <path d="M 0 -11 V -7 M 0 11 V 7 M -11 0 H -7 M 11 0 H 7 M -7.8 -7.8 L -5 -5 M 7.8 7.8 L 5 5 M -7.8 7.8 L -5 5 M 7.8 -7.8 L 5 -5" />
    </g>
  ),
  queue: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x={-12} y={-3.5} width={7} height={7} rx={1.5} />
      <rect x={-2.5} y={-3.5} width={7} height={7} rx={1.5} />
      <rect x={7} y={-3.5} width={7} height={7} rx={1.5} />
      <path d="M -12 -9 H 14 M -12 9 H 14" opacity={0.55} />
    </g>
  ),
  commit: (c) => (
    <g stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round">
      <circle r={4.5} />
      <path d="M 0 -12 V -4.5 M 0 12 V 4.5" />
    </g>
  ),
} satisfies Record<string, (color: string) => ReactNode>;

/**
 * Glyphs are authored on a ~26px box; render them at ~34px so the glyph, not
 * the empty card, carries the actor. Scaling also thickens the 1.6 stroke
 * to ~2.1 — the presence bump is one transform.
 */
const GLYPH_SCALE = 34 / 26;

export function Glyph({ name, color }: { name?: string; color: string }) {
  if (!name) return null;
  const draw = (glyphs as Record<string, (color: string) => ReactNode>)[name];
  if (!draw) {
    console.warn(`[engine] unknown glyph "${name}"`);
    return null;
  }
  return <g transform={`scale(${GLYPH_SCALE})`}>{draw(color)}</g>;
}
