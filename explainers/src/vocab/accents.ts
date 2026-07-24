/**
 * Accents — the shared colour vocabulary. Calm, dark, few hues. Accents are
 * referenced by name in story files (and, later, sim/quiz diagrams) so the
 * palette can evolve without touching content.
 *
 * This is the one genuinely React-free vocabulary primitive: pure data plus a
 * name→colour resolver. The Simulation engine can import it without pulling in
 * the React layer.
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
