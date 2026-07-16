/**
 * Factories for the built-in actor vocabulary. Each factory produces an
 * ActorSpec and records the actor's footprint (box) so geometry can anchor
 * connections on edges. Glyph and accent names are typed unions — an invalid
 * name is a compile error, not a blank spot on the stage.
 */
import type { AccentName, GlyphName } from "./glyphs";
import type { ActorSpec, Point, RouteRef } from "./types";

interface Common {
  note?: string;
  visible?: boolean;
}

/** The universal machine card: browser, server, cache, pod, GPU… */
export function node(
  p: Point &
    Common & {
      glyph?: GlyphName;
      label: string;
      sub?: string;
      accent?: AccentName;
      w?: number;
      h?: number;
    },
): ActorSpec {
  const { x, y, note, visible, ...props } = p;
  return { kind: "node", x, y, props, note, visible, box: { w: p.w ?? 150, h: p.h ?? 84 } };
}

/** Speech — the narrative voice of a machine. */
export function bubble(p: Point & Common & { w?: number; lines: string[]; accent?: AccentName }): ActorSpec {
  const { x, y, note, visible, ...props } = p;
  return { kind: "bubble", x, y, props, note, visible, box: { w: p.w ?? 240, h: 20 + p.lines.length * 18 } };
}

/** Floating annotation text. */
export function label(p: Point & Common & { text: string; size?: number; color?: AccentName }): ActorSpec {
  const { x, y, note, visible, ...props } = p;
  return { kind: "label", x, y, props, note, visible };
}

/** Dashed grouping: a datacenter, a machine boundary, a layer. */
export function region(p: Point & Common & { w: number; h: number; title?: string; accent?: AccentName }): ActorSpec {
  const { x, y, note, visible, ...props } = p;
  return { kind: "region", x, y, props, note, visible, box: { w: p.w, h: p.h } };
}

/** Small pill of text: tokens, records, commits, keys. */
export function token(p: Point & Common & { text: string; accent?: AccentName }): ActorSpec {
  const { x, y, note, visible, ...props } = p;
  const w = Math.max(34, p.text.length * 7.5 + 18) + 8;
  return { kind: "token", x, y, props, note, visible, box: { w, h: 34 } };
}

/** Primitive circle: neurons, queue items. */
export function dot(p: Point & Common & { r?: number; color?: AccentName }): ActorSpec {
  const { x, y, note, visible, ...props } = p;
  const d = (p.r ?? 5) * 2;
  return { kind: "dot", x, y, props, note, visible, box: { w: d, h: d } };
}

/* Wires and packets are not placed — they are derived from relationships, so
   their factories are internal to the scene builder (connect / packet). Both
   carry their route's length so motion can derive travel/draw durations. */

export function wireSpec(route: RouteRef, opts: { color?: AccentName; dashed?: boolean } = {}): ActorSpec {
  return { kind: "wire", x: 0, y: 0, props: { d: route.d, len: route.len, color: opts.color, dashed: opts.dashed } };
}

export function packetSpec(
  route: RouteRef,
  opts: { color?: AccentName; r?: number; label?: string; note?: string } = {},
): ActorSpec {
  const { note, ...props } = opts;
  return { kind: "packet", x: 0, y: 0, props: { ...props, path: route.d, len: route.len }, note };
}
