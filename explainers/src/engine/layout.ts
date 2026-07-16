/**
 * The layout engine. Stories describe arrangements — "a column of three pods
 * on the right", "a 3×2 grid inside the cluster" — and this module derives
 * the coordinates. A literal coordinate pair in a story should mark either a
 * stage anchor (spot / at) or a genuine one-off; everything else is layout.
 */
import { STAGE_H, STAGE_W, type Point } from "./types";
import { centerOf, type Placeable } from "./geometry";

/* ---------------- stage anchors ---------------- */

/** Fractional stage position: at(0.5, 0.5) is the stage center. */
export function at(fx: number, fy: number): Point {
  return { x: Math.round(STAGE_W * fx), y: Math.round(STAGE_H * fy) };
}

const SPOTS = {
  topLeft: at(0.16, 0.25),
  top: at(0.5, 0.25),
  topRight: at(0.84, 0.25),
  left: at(0.16, 0.5),
  center: at(0.5, 0.5),
  right: at(0.84, 0.5),
  bottomLeft: at(0.16, 0.77),
  bottom: at(0.5, 0.77),
  bottomRight: at(0.84, 0.77),
} as const;

export type SpotName = keyof typeof SPOTS;

/**
 * A named stage anchor with breathing room for the camera. The vocabulary for
 * "the browser sits on the left, the server on the right".
 */
export function spot(name: SpotName, offset: { dx?: number; dy?: number } = {}): Point {
  const p = SPOTS[name];
  return { x: p.x + (offset.dx ?? 0), y: p.y + (offset.dy ?? 0) };
}

/* ---------------- arrangements ---------------- */

export interface LineOpts {
  /** Center of the arrangement. */
  at: Point;
  count: number;
  /** Center-to-center spacing. */
  gap?: number;
}

/** `count` points in a horizontal line, centered on `at`. */
export function row({ at: c, count, gap = 170 }: LineOpts): Point[] {
  const x0 = c.x - ((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * gap, y: c.y }));
}

/** `count` points in a vertical line, centered on `at`. */
export function column({ at: c, count, gap = 120 }: LineOpts): Point[] {
  const y0 = c.y - ((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: c.x, y: y0 + i * gap }));
}

export interface GridOpts {
  cols: number;
  rows: number;
  /** Center of the grid, with explicit spacing… */
  at?: Point;
  gapX?: number;
  gapY?: number;
  /** …or an actor with a footprint (usually a region) the grid fills. */
  in?: Placeable;
  /** Inset from the box edge when filling `in`. */
  pad?: number;
}

/** Row-major grid of cols×rows points — centered on `at`, or filling `in`. */
export function grid(opts: GridOpts): Point[] {
  const { cols, rows } = opts;
  let center: Point;
  let gapX = opts.gapX ?? 160;
  let gapY = opts.gapY ?? 120;
  if (opts.in) {
    center = centerOf(opts.in);
    const box = "spec" in opts.in ? opts.in.spec.box : undefined;
    if (box) {
      const pad = opts.pad ?? 60;
      gapX = cols > 1 ? (box.w - pad * 2) / (cols - 1) : 0;
      gapY = rows > 1 ? (box.h - pad * 2) / (rows - 1) : 0;
    }
  } else {
    center = opts.at ?? spot("center");
  }
  const x0 = center.x - ((cols - 1) * gapX) / 2;
  const y0 = center.y - ((rows - 1) * gapY) / 2;
  const pts: Point[] = [];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      pts.push({ x: x0 + col * gapX, y: y0 + r * gapY });
    }
  }
  return pts;
}

/** `count` points on a circle around `at` — expert rings, neuron layers, peers. */
export function radial({ at: c, count, r = 150, startAngle = -90 }: LineOpts & { r?: number; startAngle?: number }): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = ((startAngle + (360 / count) * i) * Math.PI) / 180;
    return { x: c.x + Math.cos(angle) * r, y: c.y + Math.sin(angle) * r };
  });
}

/** `count` points offset like a deck of cards — replicas, queued items, layers. */
export function stack({ at: c, count, dx = 10, dy = -10 }: { at: Point; count: number; dx?: number; dy?: number }): Point[] {
  const x0 = c.x - ((count - 1) * dx) / 2;
  const y0 = c.y - ((count - 1) * dy) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * dx, y: y0 + i * dy }));
}

/** A point inside an actor's footprint: inside(cluster, 0.5, 0.25) = mid-top. */
export function inside(ref: Placeable, fx = 0.5, fy = 0.5): Point {
  const c = centerOf(ref);
  const box = "spec" in ref ? ref.spec.box : undefined;
  if (!box) return c;
  return { x: c.x + (fx - 0.5) * box.w, y: c.y + (fy - 0.5) * box.h };
}

/** `count` points evenly spaced along the straight line between two placeables. */
export function spread(a: Placeable, b: Placeable, count: number): Point[] {
  const p1 = centerOf(a);
  const p2 = centerOf(b);
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1);
    return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
  });
}
