/**
 * Scene authoring. A scene's setup() receives a stage: it casts actors (typed
 * handles), connects them (geometry derived, never hand-computed), and writes
 * steps as motion compositions. The result compiles to the same pure
 * data-over-time object model the renderer has always consumed.
 *
 * Relationships are first-class here: a connection knows how to send, reply
 * and exchange; a fanout knows how to draw, broadcast and gather. Stories
 * declare who talks to whom — the engine owns routing, lanes and pacing.
 */
import { packetSpec, wireSpec } from "./actors";
import { reverseRoute, route as makeRoute, type Placeable, type RouteOpts } from "./geometry";
import { all, dim, frame, pulse, resetCam, seq, stagger, travel, undim, wait, draw as drawWire, type Motion } from "./motion";
import { validateContent } from "./validate";
import type { AccentName } from "./glyphs";
import type { ActorRef, ActorSpec, ParamDef, Params, RouteRef, SceneContent, SceneDef, StepDef } from "./types";

/* ---------------- typed params ---------------- */

export interface ParamSpec<V extends string = string> {
  label: string;
  kind: "choice" | "toggle";
  options: { value: V; label: string }[];
  initial: V;
}

type Options<V extends string> = readonly (readonly [V, string])[];

const paramSpec = <V extends string>(kind: "choice" | "toggle", label: string, options: Options<V>, initial?: V): ParamSpec<V> => ({
  label,
  kind,
  options: options.map(([value, text]) => ({ value, label: text })),
  initial: initial ?? options[0][0],
});

/** Two-state switch. Value type is inferred from the options. */
export const toggle = <const V extends string>(label: string, options: Options<V>, initial?: V): ParamSpec<V> =>
  paramSpec("toggle", label, options, initial);

/** Multi-choice control. Value type is inferred from the options. */
export const choice = <const V extends string>(label: string, options: Options<V>, initial?: V): ParamSpec<V> =>
  paramSpec("choice", label, options, initial);

export type ParamValues<P extends Record<string, ParamSpec>> = {
  [K in keyof P]: P[K] extends ParamSpec<infer V> ? V : never;
};

/* ---------------- semantic connections ---------------- */

export interface SendOpts {
  color?: AccentName;
  label?: string;
  r?: number;
  note?: string;
  /** Travel seconds. Defaults from the route's length. */
  dur?: number;
  /** Keep the packet visible at its destination instead of fading out. */
  keepAlive?: boolean;
}

export interface ConnectionRef extends ActorRef {
  readonly route: RouteRef;
  readonly from: ActorRef;
  readonly to: ActorRef;
  /** A packet travels from → to. Each call creates a fresh packet. */
  send(opts?: SendOpts): Motion;
  /** A packet travels to → from on the mirrored lane, so it never overlaps a request. */
  reply(opts?: SendOpts): Motion;
  /** Request/response in one beat: send, a breath, reply. */
  exchange(opts?: { send?: SendOpts; reply?: SendOpts; gap?: number }): Motion;
}

export interface ConnectOpts extends RouteOpts {
  color?: AccentName;
  dashed?: boolean;
}

/* ---------------- fanout ---------------- */

export interface FanoutOpts extends ConnectOpts {
  /** No visible wires — routes only (a pure broadcast). */
  virtual?: boolean;
  /** Total bow spread between the outermost wires (default 26px per gap). A fixed `bow` overrides. */
  bowSpread?: number;
}

export interface FanoutRef {
  readonly hub: ActorRef;
  readonly targets: ActorRef[];
  /** One wire per target (empty for virtual fanouts). */
  readonly wires: ConnectionRef[];
  /** All wires draw themselves as a cascade. */
  draw(opts?: { gap?: number; dur?: number }): Motion;
  /** One packet per target, hub → targets, as a cascade. */
  send(opts?: SendOpts & { gap?: number }): Motion;
  /** One packet per target, targets → hub, as a cascade (responses, votes, results). */
  gather(opts?: SendOpts & { gap?: number }): Motion;
  /** Every target pulses at once. */
  pulse(forSec?: number): Motion;
}

/* ---------------- the stage builder ---------------- */

export interface StepOpts {
  /** Extra seconds of rest after the last act (default 0.6). */
  hold?: number;
  /**
   * Opt-in directing: frame these actors while the step plays ("all" pulls
   * back to the whole stage). Sugar for layering frame()/resetCam().
   */
  view?: ActorRef[] | "all";
}

export interface StageApi {
  /** Declare named actors; returns typed handles. Keys become actor ids. */
  cast<A extends Record<string, ActorSpec>>(actors: A): { [K in keyof A]: ActorRef };
  /** Add one anonymous actor (rarely needed — prefer cast for anything named in steps). */
  add(spec: ActorSpec): ActorRef;
  /** A wire between two actors that knows how to send/reply/exchange. */
  connect(from: ActorRef, to: ActorRef, opts?: ConnectOpts): ConnectionRef;
  /** A travel path (no wire drawn) between actors/points. */
  route(from: Placeable, to: Placeable, opts?: RouteOpts): RouteRef;
  /** Something that travels a connection or route. Prefer connection.send(). */
  packet(along: ConnectionRef | RouteRef, opts?: SendOpts): ActorRef;
  /** One-shot packet from A to B with no wire — fire and forget. */
  send(from: Placeable, to: Placeable, opts?: SendOpts & RouteOpts): Motion;
  /** One hub fanning out to many targets: Service → Pods, Router → Experts. */
  fanout(hub: ActorRef, targets: ActorRef[], opts?: FanoutOpts): FanoutRef;
  /** Dim everything except these actors (packets are exempt). */
  spotlight(...keep: ActorRef[]): Motion;
  /** Lift every dim — the whole stage matters again. */
  clearSpotlight(): Motion;
  /** One narration beat: a caption plus a motion composition. */
  step(caption: string, motion: Motion | Motion[], opts?: StepOpts): void;
}

/** Bows spread symmetrically across a fan so wires never lie on each other. */
const fanBow = (i: number, n: number, spread?: number): number => {
  if (n <= 1) return 0;
  const per = spread !== undefined ? spread / (n - 1) : 26;
  return ((n - 1) / 2 - i) * per;
};

class StageBuilder implements StageApi {
  readonly actors: Record<string, ActorSpec> = {};
  readonly steps: StepDef[] = [];
  private auto = 0;

  add = (spec: ActorSpec, id?: string): ActorRef => {
    const key = id ?? `_${spec.kind}${++this.auto}`;
    if (key in this.actors) {
      throw new Error(`[engine] duplicate actor id "${key}" — every cast key must be unique in the scene`);
    }
    this.actors[key] = spec;
    return { id: key, spec };
  };

  cast = <A extends Record<string, ActorSpec>>(actors: A): { [K in keyof A]: ActorRef } => {
    const refs = {} as { [K in keyof A]: ActorRef };
    for (const key of Object.keys(actors) as (keyof A)[]) {
      refs[key] = this.add(actors[key], key as string);
    }
    return refs;
  };

  route = (from: Placeable, to: Placeable, opts?: RouteOpts): RouteRef => makeRoute(from, to, opts);

  /** Create a packet on `along` and return its travel motion. */
  private flow = (along: RouteRef, opts: SendOpts): Motion => {
    const ref = this.add(packetSpec(along, opts));
    return travel(ref, opts.dur, { keepAlive: opts.keepAlive });
  };

  connect = (from: ActorRef, to: ActorRef, opts: ConnectOpts = {}): ConnectionRef => {
    const route = makeRoute(from, to, opts);
    const ref = this.add(wireSpec(route, opts));
    const send = (o: SendOpts = {}): Motion => this.flow(route, { color: opts.color ?? "blue", ...o });
    const reply = (o: SendOpts = {}): Motion => this.flow(reverseRoute(route, { mirror: true }), { color: "green", ...o });
    return {
      ...ref,
      route,
      from,
      to,
      send,
      reply,
      exchange: (o = {}) => seq(send(o.send), wait(o.gap ?? 0.25), reply(o.reply)),
    };
  };

  packet = (along: ConnectionRef | RouteRef, opts: SendOpts = {}): ActorRef => {
    const route = "route" in along ? along.route : along;
    return this.add(packetSpec(route, opts));
  };

  send = (from: Placeable, to: Placeable, opts: SendOpts & RouteOpts = {}): Motion =>
    this.flow(makeRoute(from, to, opts), opts);

  fanout = (hub: ActorRef, targets: ActorRef[], opts: FanoutOpts = {}): FanoutRef => {
    const bowOf = (i: number): number => opts.bow ?? fanBow(i, targets.length, opts.bowSpread);
    const routes = targets.map((t, i) => makeRoute(hub, t, { ...opts, bow: bowOf(i) }));
    const wires = opts.virtual ? [] : targets.map((t, i) => this.connect(hub, t, { ...opts, bow: bowOf(i) }));
    const cascade = (gap: number, ms: Motion[]): Motion => (ms.length ? stagger(gap, ...ms) : wait(0));
    return {
      hub,
      targets,
      wires,
      draw: ({ gap = 0.12, dur } = {}) => cascade(gap, wires.map((w) => drawWire(w, dur))),
      send: ({ gap = 0.15, ...o } = {}) => cascade(gap, routes.map((r) => this.flow(r, { color: opts.color ?? "blue", ...o }))),
      gather: ({ gap = 0.15, ...o } = {}) =>
        cascade(gap, routes.map((r) => this.flow(reverseRoute(r), { color: "green", ...o }))),
      pulse: (forSec = 1.8) => all(...targets.map((t) => pulse(t, forSec))),
    };
  };

  spotlight = (...keep: ActorRef[]): Motion => {
    const keepIds = new Set(keep.map((r) => r.id));
    const others = Object.entries(this.actors)
      .filter(([id, spec]) => !keepIds.has(id) && spec.kind !== "packet")
      .map(([id, spec]) => ({ id, spec }));
    return all(...others.map((r) => dim(r)), ...keep.map((r) => undim(r)));
  };

  clearSpotlight = (): Motion =>
    all(
      ...Object.entries(this.actors)
        .filter(([, spec]) => spec.kind !== "packet")
        .map(([id, spec]) => undim({ id, spec })),
    );

  step = (caption: string, m: Motion | Motion[], opts?: StepOpts): void => {
    let composed = Array.isArray(m) ? seq(...m) : m;
    if (opts?.view) {
      const cam = opts.view === "all" ? resetCam() : frame(opts.view);
      composed = all(cam, composed);
    }
    this.steps.push({ caption, acts: composed.emit(0), hold: opts?.hold });
  };
}

/* ---------------- scene definition ---------------- */

export interface SceneSpec<P extends Record<string, ParamSpec>> {
  id: string;
  /** Eyebrow label grouping scenes into chapters. */
  chapter: string;
  /** The question this scene answers. */
  question: string;
  /** Cinematic title. */
  title: string;
  /** Answer to "What just happened?" — shown when the scene completes. */
  takeaway: string;
  /** Label for the Next button: the question pulling the learner forward. */
  nextPrompt: string;
  /** Essay paragraphs for reading mode. */
  prose?: string[];
  /** Interactive controls. Changing one re-runs setup and replays: interaction as re-simulation. */
  params?: P;
  /** Build the scene: cast actors, connect them, write steps. */
  setup: (stage: StageApi, params: ParamValues<P>) => void;
}

export function scene<P extends Record<string, ParamSpec> = Record<string, never>>(def: SceneSpec<P>): SceneDef {
  const paramDefs: ParamDef[] | undefined = def.params
    ? Object.entries(def.params).map(([id, p]) => ({ id, ...p }))
    : undefined;

  const content = (params: Params): SceneContent => {
    const stage = new StageBuilder();
    def.setup(stage, params as ParamValues<P>);
    const built: SceneContent = { actors: stage.actors, steps: stage.steps };
    if (import.meta.env.DEV) validateContent(def.id, built);
    return built;
  };

  return {
    id: def.id,
    chapter: def.chapter,
    question: def.question,
    title: def.title,
    takeaway: def.takeaway,
    nextPrompt: def.nextPrompt,
    prose: def.prose,
    params: paramDefs,
    content,
  };
}
