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

  // The default camera frames the scene's content, not the whole world.
  // resetCam() emits NaN keyframes as a "return home" sentinel — resolve them
  // now that the content bounds are known.
  const home = computeHome(actors);
  const homeOf: Record<CameraChannel, number> = { camX: home.x, camY: home.y, camZoom: home.zoom };
  for (const [ch, kfs] of Object.entries(camera) as [CameraChannel, Keyframe[]][]) {
    for (const kf of kfs) {
      if (Number.isNaN(kf.to)) kf.to = homeOf[ch];
    }
    camera[ch] = finishTrack(kfs, homeOf[ch]);
  }

  return { actors, camera, home, markers, captions, duration: cursor };
}

/* ---------------- home camera ---------------- */

const HOME_MARGIN = 50;
const HOME_MAX_ZOOM = 2.2;

/**
 * The scene's default framing: fit the bounds of every actor that ever
 * becomes visible (footprints included, travel positions of moving actors
 * included). Packets and wires are excluded — they live between actors and
 * would only re-add the space the framing removes.
 */
function computeHome(actors: CompiledActor[]): CompiledScene["home"] {
  const min = { x: Infinity, y: Infinity };
  const max = { x: -Infinity, y: -Infinity };
  for (const a of actors) {
    if (a.spec.kind === "packet" || a.spec.kind === "wire") continue;
    const opacity = a.tracks.opacity;
    const revealed = a.spec.visible || (opacity?.some((kf) => kf.to > 0.1) ?? false);
    if (!revealed) continue;
    const hw = (a.spec.box?.w ?? 0) / 2;
    const hh = (a.spec.box?.h ?? 0) / 2;
    for (const x of trackValues(a.tracks.x, a.spec.x)) {
      min.x = Math.min(min.x, x - hw);
      max.x = Math.max(max.x, x + hw);
    }
    for (const y of trackValues(a.tracks.y, a.spec.y)) {
      min.y = Math.min(min.y, y - hh);
      max.y = Math.max(max.y, y + hh);
    }
  }
  if (!Number.isFinite(min.x) || !Number.isFinite(min.y)) {
    return { x: STAGE_W / 2, y: STAGE_H / 2, zoom: 1, w: STAGE_W, h: STAGE_H };
  }
  const w = max.x - min.x + HOME_MARGIN * 2;
  const h = max.y - min.y + HOME_MARGIN * 2;
  const fit = Math.min(STAGE_W / w, STAGE_H / h);
  return {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    zoom: Math.min(Math.max(fit, 0.8), HOME_MAX_ZOOM),
    w,
    h,
  };
}

/** Every value a (finished) track visits, plus the channel's resting value. */
function trackValues(track: Track | undefined, resting: number): number[] {
  const values = [resting];
  for (const kf of track ?? []) values.push(kf.from, kf.to);
  return values;
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
