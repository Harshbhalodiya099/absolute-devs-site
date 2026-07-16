/**
 * Scene authoring. A scene's setup() receives a stage: it casts actors (typed
 * handles), connects them (geometry derived, never hand-computed), and writes
 * steps as motion compositions. The result compiles to the same pure
 * data-over-time object model the renderer has always consumed.
 */
import { packetSpec, wireSpec } from "./actors";
import { route as makeRoute, type Placeable, type RouteOpts } from "./geometry";
import { seq, type Motion } from "./motion";
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

/* ---------------- the stage builder ---------------- */

export interface ConnectionRef extends ActorRef {
  readonly route: RouteRef;
  readonly from: ActorRef;
  readonly to: ActorRef;
}

export interface ConnectOpts extends RouteOpts {
  color?: AccentName;
  dashed?: boolean;
}

export interface StageApi {
  /** Declare named actors; returns typed handles. Keys become actor ids. */
  cast<A extends Record<string, ActorSpec>>(actors: A): { [K in keyof A]: ActorRef };
  /** Add one anonymous actor (rarely needed — prefer cast for anything named in steps). */
  add(spec: ActorSpec): ActorRef;
  /** A wire between two actors. Endpoints anchor on their edges automatically. */
  connect(from: ActorRef, to: ActorRef, opts?: ConnectOpts): ConnectionRef;
  /** A travel path (no wire drawn) between actors/points. */
  route(from: Placeable, to: Placeable, opts?: RouteOpts): RouteRef;
  /** Something that travels a connection or route. */
  packet(along: ConnectionRef | RouteRef, opts?: { color?: AccentName; r?: number; label?: string; note?: string }): ActorRef;
  /** One narration beat: a caption plus a motion composition. */
  step(caption: string, motion: Motion | Motion[], opts?: { hold?: number }): void;
}

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

  connect = (from: ActorRef, to: ActorRef, opts: ConnectOpts = {}): ConnectionRef => {
    const route = makeRoute(from, to, opts);
    const ref = this.add(wireSpec(route.d, opts));
    return { ...ref, route, from, to };
  };

  packet = (
    along: ConnectionRef | RouteRef,
    opts: { color?: AccentName; r?: number; label?: string; note?: string } = {},
  ): ActorRef => {
    const d = "route" in along ? along.route.d : along.d;
    return this.add(packetSpec(d, opts));
  };

  step = (caption: string, m: Motion | Motion[], opts?: { hold?: number }): void => {
    const composed = Array.isArray(m) ? seq(...m) : m;
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
