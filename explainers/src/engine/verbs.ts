/**
 * Semantic motion. Verbs name what *happens* in a system — crash, revive —
 * instead of forcing every story to re-invent the choreography. Each verb is
 * nothing but a composition of the low-level primitives in motion.ts, which is
 * the architecture for growing this vocabulary: a new verb (electLeader,
 * replicate, cacheMiss…) is a pure function returning a Motion, never a new
 * channel or renderer concept.
 */
import { all, appear, fadeTo, glowOff, glowOn, seq, shake, stagger, vanish, wait, type Motion } from "./motion";
import type { ActorRef } from "./types";

/**
 * Something dies: a wobble of distress, then the lights go out. Leaves a
 * faint ghost (`remains`) so the hole it left stays legible on stage.
 */
export function crash(ref: ActorRef, opts: { remains?: number } = {}): Motion {
  return seq(shake(ref), wait(0.55), all(glowOff(ref), fadeTo(ref, opts.remains ?? 0.12, 0.6)));
}

/** A crashed thing comes back: light returns with a glow of recovery. */
export function revive(ref: ActorRef, dur = 0.6): Motion {
  return seq(all(fadeTo(ref, 1, dur), glowOn(ref, dur)));
}

/** A group walks on stage as a cascade. The standard way to introduce actors. */
export function enter(refs: ActorRef[], gap = 0.18): Motion {
  return stagger(gap, ...refs.map((r) => appear(r)));
}

/** A group leaves the stage as a cascade. */
export function exit(refs: ActorRef[], gap = 0.12): Motion {
  return stagger(gap, ...refs.map((r) => vanish(r)));
}
