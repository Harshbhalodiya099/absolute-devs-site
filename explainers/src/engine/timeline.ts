import {
  CAMERA,
  STAGE_H,
  STAGE_W,
  type CameraChannel,
  type Channel,
  type CompiledActor,
  type CompiledScene,
  type Ease,
  type Keyframe,
  type SceneContent,
  type Track,
} from "./types";

/* ---------------- easing ---------------- */

const EASE: Record<Ease, (u: number) => number> = {
  linear: (u) => u,
  in: (u) => u * u * u,
  out: (u) => 1 - Math.pow(1 - u, 3),
  inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  backOut: (u) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
  },
};

/* ---------------- defaults ---------------- */

/** Value of a channel before any keyframe touches it. */
export function channelDefault(channel: Channel | CameraChannel, actor?: CompiledActor): number {
  switch (channel) {
    case "x":
      return actor?.spec.x ?? 0;
    case "y":
      return actor?.spec.y ?? 0;
    case "opacity":
      return actor?.spec.visible ? 1 : 0;
    case "scale":
    case "camZoom":
      return 1;
    case "camX":
      return STAGE_W / 2;
    case "camY":
      return STAGE_H / 2;
    default:
      return 0;
  }
}

/* ---------------- compile ---------------- */

/**
 * Lay steps end to end, land every act on its (actor, channel) track,
 * sort tracks, resolve implicit `from` values.
 */
export function compileScene(content: SceneContent): CompiledScene {
  const actorTracks = new Map<string, Partial<Record<Channel, Keyframe[]>>>();
  const camera: Partial<Record<CameraChannel, Keyframe[]>> = {};
  const markers: number[] = [];
  const captions: string[] = [];

  let cursor = 0;
  for (const step of content.steps) {
    markers.push(cursor);
    captions.push(step.caption);
    let stepEnd = cursor;
    for (const act of step.acts) {
      const t0 = cursor + act.at;
      const t1 = t0 + Math.max(act.dur, 0.0001);
      stepEnd = Math.max(stepEnd, t1);
      const kf: Keyframe = {
        t0,
        t1,
        from: act.from ?? Number.NaN, // resolved after sorting
        to: act.to,
        ease: act.ease ?? "inOut",
        loop: act.loop,
      };
      if (act.target === CAMERA) {
        const ch = act.channel as CameraChannel;
        (camera[ch] ??= []).push(kf);
      } else {
        const ch = act.channel as Channel;
        const tracks = actorTracks.get(act.target) ?? {};
        (tracks[ch] ??= []).push(kf);
        actorTracks.set(act.target, tracks);
      }
    }
    cursor = stepEnd + (step.hold ?? 0.6);
  }

  const finishTrack = (track: Keyframe[], initial: number): Track => {
    track.sort((a, b) => a.t0 - b.t0);
    let prev = initial;
    for (const kf of track) {
      if (Number.isNaN(kf.from)) kf.from = prev;
      prev = kf.loop ? kf.from : kf.to; // loops return to their base value
    }
    return track;
  };

  const actors: CompiledActor[] = Object.entries(content.actors).map(([id, spec]) => {
    const compiled: CompiledActor = { id, spec, tracks: {} };
    const tracks = actorTracks.get(id);
    if (tracks) {
      for (const [ch, kfs] of Object.entries(tracks) as [Channel, Keyframe[]][]) {
        compiled.tracks[ch] = finishTrack(kfs, channelDefault(ch, compiled));
      }
    }
    return compiled;
  });

  // Warn (in dev) about acts that target actors that don't exist.
  for (const id of actorTracks.keys()) {
    if (!(id in content.actors)) {
      console.warn(`[engine] acts target unknown actor "${id}"`);
    }
  }

  for (const [ch, kfs] of Object.entries(camera) as [CameraChannel, Keyframe[]][]) {
    camera[ch] = finishTrack(kfs, channelDefault(ch));
  }

  return { actors, camera, markers, captions, duration: cursor };
}

/* ---------------- sample ---------------- */

/**
 * Value of a track at time t. Values hold after their last keyframe, so
 * scrubbing in either direction is exact.
 */
export function sampleTrack(track: Track | undefined, t: number, initial: number): number {
  if (!track || track.length === 0) return initial;
  if (t < track[0].t0) return initial;

  // binary search: last keyframe with t0 <= t
  let lo = 0;
  let hi = track.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (track[mid].t0 <= t) lo = mid;
    else hi = mid - 1;
  }
  const kf = track[lo];

  if (kf.loop) {
    // periodic window: base → to → base each period, silent outside the window
    if (t >= kf.t1) return kf.from;
    const phase = ((t - kf.t0) % kf.loop) / kf.loop;
    const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    return kf.from + (kf.to - kf.from) * wave;
  }
  if (t >= kf.t1) return kf.to;
  const u = (t - kf.t0) / (kf.t1 - kf.t0);
  return kf.from + (kf.to - kf.from) * EASE[kf.ease](u);
}

export function sampleActor(actor: CompiledActor, channel: Channel, t: number): number {
  return sampleTrack(actor.tracks[channel], t, channelDefault(channel, actor));
}
