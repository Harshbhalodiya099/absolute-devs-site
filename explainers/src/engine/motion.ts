/**
 * The motion language. Stories never write timestamps: primitives return
 * Motions, and combinators (seq / all / stagger / wait) compose them into a
 * step. The compiler turns the composition into absolute keyframe tracks —
 * absolute time is an implementation detail of the engine, not the author.
 *
 * Two kinds of primitives, one rule:
 *  - narrative motions (appear, travel, draw, move, camera…) GATE — in a
 *    seq(), the next motion waits for them.
 *  - emphasis motions (pulse, flash, glow, dim, shake) LAYER — they take zero
 *    sequencing time and play over whatever follows. Wrap in wait() to linger.
 */
import { CAMERA, STAGE_H, STAGE_W, type Act, type ActorRef, type Point } from "./types";
import { boundsOf, centerOf, type Placeable } from "./geometry";

export interface Motion {
  /** Seconds this motion occupies in a seq(). Emphasis motions report 0. */
  readonly dur: number;
  /** Expand into keyframe acts starting at t0 (seconds from step start). */
  readonly emit: (t0: number) => Act[];
}

const motion = (dur: number, emit: (t0: number) => Act[]): Motion => ({ dur, emit });

/** A primitive: acts on one target, offsets relative to the motion's own start. */
type RelAct = Omit<Act, "target" | "at"> & { at?: number };
const prim = (target: string, dur: number, list: RelAct[]): Motion =>
  motion(dur, (t0) => list.map((a) => ({ target, ...a, at: t0 + (a.at ?? 0) })));

/* ---------------- combinators ---------------- */

/** Do nothing for `dur` seconds. The author's pacing tool. */
export const wait = (dur: number): Motion => motion(dur, () => []);

/** One after another. */
export function seq(...ms: Motion[]): Motion {
  return motion(
    ms.reduce((sum, m) => sum + m.dur, 0),
    (t0) => {
      const out: Act[] = [];
      let t = t0;
      for (const m of ms) {
        out.push(...m.emit(t));
        t += m.dur;
      }
      return out;
    },
  );
}

/** All at once; lasts as long as the longest. */
export function all(...ms: Motion[]): Motion {
  return motion(
    ms.reduce((max, m) => Math.max(max, m.dur), 0),
    (t0) => ms.flatMap((m) => m.emit(t0)),
  );
}

/** Each starts `gap` seconds after the previous starts (overlapping cascade). */
export function stagger(gap: number, ...ms: Motion[]): Motion {
  return motion(
    ms.reduce((max, m, i) => Math.max(max, i * gap + m.dur), 0),
    (t0) => ms.flatMap((m, i) => m.emit(t0 + i * gap)),
  );
}

/* ---------------- narrative primitives (gate) ---------------- */

/** Fade in with a rise and a settle-overshoot. */
export function appear(ref: ActorRef, dur = 0.6): Motion {
  return prim(ref.id, dur, [
    { channel: "opacity", at: 0, dur: dur * 0.75, from: 0, to: 1, ease: "out" },
    { channel: "lift", at: 0, dur, from: 14, to: 0, ease: "out" },
    { channel: "scale", at: 0, dur, from: 0.95, to: 1, ease: "backOut" },
  ]);
}

/** Fade out. */
export function vanish(ref: ActorRef, dur = 0.45): Motion {
  return prim(ref.id, dur, [{ channel: "opacity", dur, to: 0, ease: "out" }]);
}

/** Snap visible, no ceremony. */
export function show(ref: ActorRef): Motion {
  return prim(ref.id, 0.01, [{ channel: "opacity", dur: 0.01, to: 1, ease: "linear" }]);
}

/** Fade to a specific opacity. */
export function fadeTo(ref: ActorRef, to: number, dur = 0.5): Motion {
  return prim(ref.id, dur, [{ channel: "opacity", dur, to, ease: "out" }]);
}

/** Glide to a new position. */
export function move(ref: ActorRef, to: { x?: number; y?: number }, dur = 0.8): Motion {
  const list: RelAct[] = [];
  if (to.x !== undefined) list.push({ channel: "x", dur, to: to.x });
  if (to.y !== undefined) list.push({ channel: "y", dur, to: to.y });
  return prim(ref.id, dur, list);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Default duration for a path-bound motion, from the path's length. */
const autoDur = (ref: ActorRef, pxPerSec: number, lo: number, hi: number, fallback: number): number => {
  const len = ref.spec.props?.len;
  return typeof len === "number" ? clamp(len / pxPerSec, lo, hi) : fallback;
};

/**
 * Send a packet along its route (progress 0→1) with automatic fade in/out.
 * Duration defaults from the route's length — longer journeys take longer.
 */
export function travel(ref: ActorRef, dur?: number, opts?: { keepAlive?: boolean; ease?: Act["ease"] }): Motion {
  dur ??= autoDur(ref, 420, 0.7, 1.7, 1.2);
  const list: RelAct[] = [
    { channel: "progress", at: 0, dur, from: 0, to: 1, ease: opts?.ease ?? "inOut" },
    { channel: "opacity", at: 0, dur: 0.18, to: 1, ease: "out" },
  ];
  if (!opts?.keepAlive) {
    list.push({ channel: "opacity", at: dur - 0.12, dur: 0.3, to: 0, ease: "out" });
  }
  return prim(ref.id, dur, list);
}

/** A wire draws itself. Duration defaults from the wire's length. */
export function draw(ref: ActorRef, dur?: number): Motion {
  dur ??= autoDur(ref, 900, 0.4, 0.9, 0.7);
  return prim(ref.id, dur, [
    { channel: "opacity", at: 0, dur: 0.15, to: 1, ease: "out" },
    { channel: "progress", at: 0, dur, from: 0, to: 1, ease: "inOut" },
  ]);
}

/* ---------------- emphasis primitives (layer) ---------------- */

/** Periodic glow for `forSec` seconds. Layers: takes no sequencing time. */
export function pulse(ref: ActorRef, forSec: number, period = 1.6): Motion {
  return prim(ref.id, 0, [{ channel: "glow", dur: Math.max(forSec, period), to: 1, loop: period, ease: "linear" }]);
}

/** One attention ping. */
export function flash(ref: ActorRef): Motion {
  return prim(ref.id, 0, [{ channel: "glow", dur: 0.9, to: 1, loop: 0.9, ease: "linear" }]);
}

export function glowOn(ref: ActorRef, dur = 0.4): Motion {
  return prim(ref.id, 0, [{ channel: "glow", dur, to: 1, ease: "out" }]);
}

export function glowOff(ref: ActorRef, dur = 0.4): Motion {
  return prim(ref.id, 0, [{ channel: "glow", dur, to: 0, ease: "out" }]);
}

/** De-emphasize (dim ≈ "not now"). Use dur 0.01 to pre-dim at step start. */
export function dim(ref: ActorRef, dur = 0.5): Motion {
  return prim(ref.id, 0, [{ channel: "dim", dur, to: 1, ease: "out" }]);
}

export function undim(ref: ActorRef, dur = 0.5): Motion {
  return prim(ref.id, 0, [{ channel: "dim", dur, to: 0, ease: "out" }]);
}

/** Error / rejection wobble. */
export function shake(ref: ActorRef): Motion {
  return prim(ref.id, 0, [{ channel: "wobble", dur: 0.5, to: 1, loop: 0.16, ease: "linear" }]);
}

/* ---------------- camera (gates) ---------------- */

const cameraTo = (p: Point, zoom: number, dur: number): Motion =>
  prim(CAMERA, dur, [
    { channel: "camX", dur, to: p.x, ease: "inOut" },
    { channel: "camY", dur, to: p.y, ease: "inOut" },
    { channel: "camZoom", dur, to: zoom, ease: "inOut" },
  ]);

/** Zoom the viewport toward an actor or point. Cinematic, scrub-safe. */
export function focus(target: Placeable, opts: { zoom?: number; dur?: number } = {}): Motion {
  return cameraTo(centerOf(target), opts.zoom ?? 1.45, opts.dur ?? 1.1);
}

/**
 * Frame a group: the camera centers on the group and zooms so every actor
 * (including its footprint) fits with a margin. Attention direction as intent.
 */
export function frame(refs: ActorRef[], opts: { margin?: number; zoom?: number; maxZoom?: number; dur?: number } = {}): Motion {
  const { min, max } = boundsOf(refs);
  const margin = opts.margin ?? 50;
  const w = max.x - min.x + margin * 2;
  const h = max.y - min.y + margin * 2;
  const fit = Math.min(STAGE_W / w, STAGE_H / h);
  const zoom = opts.zoom ?? Math.min(Math.max(fit, 0.7), opts.maxZoom ?? 2.4);
  return cameraTo({ x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 }, zoom, opts.dur ?? 1.1);
}

/**
 * Pull back to the scene's home framing — its content bounds fit with margin
 * (computed at compile time). `{ world: true }` pulls back to the literal
 * full stage instead.
 */
export function resetCam(opts: number | { world?: boolean; dur?: number } = {}): Motion {
  const o = typeof opts === "number" ? { dur: opts } : opts;
  const dur = o.dur ?? 1.1;
  if (o.world) return cameraTo({ x: STAGE_W / 2, y: STAGE_H / 2 }, 1, dur);
  // NaN is a sentinel the compiler resolves to the scene's home camera.
  return cameraTo({ x: NaN, y: NaN }, NaN, dur);
}
