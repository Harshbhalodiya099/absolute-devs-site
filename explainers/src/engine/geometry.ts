/**
 * Authoring-time geometry. Stories describe relationships — "connect the
 * laptop to the resolver", "put this bubble below the root" — and this module
 * turns them into coordinates. Manual coordinate math in a story file is an
 * engine gap; grow this vocabulary instead.
 */
import type { ActorRef, Box, Point, RouteRef } from "./types";

/* ---------------- path constructors (low level) ---------------- */

/** A gentle arc between two points; bow > 0 bows upward. */
export function arc(x1: number, y1: number, x2: number, y2: number, bow = 70): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - bow;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

/** A straight segment. */
export function line(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

/* ---------------- anchors ---------------- */

export type Placeable = ActorRef | Point;

export function centerOf(p: Placeable): Point {
  return "spec" in p ? { x: p.spec.x, y: p.spec.y } : p;
}

function boxOf(p: Placeable): Box | undefined {
  return "spec" in p ? p.spec.box : undefined;
}

/** Point on the (padded) edge of a box, along the ray from its center toward `toward`. */
function edgePoint(center: Point, box: Box, toward: Point, pad: number): Point {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const hw = box.w / 2 + pad;
  const hh = box.h / 2 + pad;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy, 1); // never overshoot the midpoint of overlapping actors
  return { x: center.x + dx * s, y: center.y + dy * s };
}

export interface RouteOpts {
  /** Arc height; positive bows upward. Defaults to a gentle bow scaled by distance. */
  bow?: number;
  /** Gap between the actor's edge and the route endpoint. */
  pad?: number;
}

/**
 * A path from one actor/point to another. Endpoints land on actor *edges*
 * (derived from each actor's box), so stories never compute anchor points.
 */
export function route(from: Placeable, to: Placeable, opts: RouteOpts = {}): RouteRef {
  const c1 = centerOf(from);
  const c2 = centerOf(to);
  const pad = opts.pad ?? 12;
  const b1 = boxOf(from);
  const b2 = boxOf(to);
  const a = b1 ? edgePoint(c1, b1, c2, pad) : c1;
  const b = b2 ? edgePoint(c2, b2, c1, pad) : c2;
  const bow = opts.bow ?? Math.hypot(b.x - a.x, b.y - a.y) * 0.15;
  return { d: arc(a.x, a.y, b.x, b.y, bow), a, b };
}

/* ---------------- derived positions ---------------- */

/** Point a fraction `t` of the way from a to b (straight line), plus an offset. */
export function between(a: Placeable, b: Placeable, t = 0.5, offset: { dx?: number; dy?: number } = {}): Point {
  const p1 = centerOf(a);
  const p2 = centerOf(b);
  return { x: p1.x + (p2.x - p1.x) * t + (offset.dx ?? 0), y: p1.y + (p2.y - p1.y) * t + (offset.dy ?? 0) };
}

const edgeOffset = (ref: Placeable, axis: "w" | "h"): number => {
  const box = boxOf(ref);
  return box ? box[axis] / 2 : 0;
};

/** A point `gap` px below the actor's bottom edge. */
export function below(ref: Placeable, gap = 40): Point {
  const c = centerOf(ref);
  return { x: c.x, y: c.y + edgeOffset(ref, "h") + gap };
}

export function above(ref: Placeable, gap = 40): Point {
  const c = centerOf(ref);
  return { x: c.x, y: c.y - edgeOffset(ref, "h") - gap };
}

export function rightOf(ref: Placeable, gap = 40): Point {
  const c = centerOf(ref);
  return { x: c.x + edgeOffset(ref, "w") + gap, y: c.y };
}

export function leftOf(ref: Placeable, gap = 40): Point {
  const c = centerOf(ref);
  return { x: c.x - edgeOffset(ref, "w") - gap, y: c.y };
}

/** Bounding box (as min/max) of a set of actors, honoring their footprints. */
export function boundsOf(refs: ActorRef[]): { min: Point; max: Point } {
  const min = { x: Infinity, y: Infinity };
  const max = { x: -Infinity, y: -Infinity };
  for (const ref of refs) {
    const hw = (ref.spec.box?.w ?? 0) / 2;
    const hh = (ref.spec.box?.h ?? 0) / 2;
    min.x = Math.min(min.x, ref.spec.x - hw);
    min.y = Math.min(min.y, ref.spec.y - hh);
    max.x = Math.max(max.x, ref.spec.x + hw);
    max.y = Math.max(max.y, ref.spec.y + hh);
  }
  return { min, max };
}
