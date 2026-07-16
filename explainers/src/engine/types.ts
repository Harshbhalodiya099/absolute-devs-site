/**
 * Engine object model. See ENGINE.md.
 *
 * A Story is pure data: Scenes → Steps → Acts. The engine compiles Acts into
 * per-actor keyframe tracks and renders any moment as a pure function of time.
 * Nothing in this file knows about DNS, HTTP, transformers, or any topic.
 */

/** Stage coordinate space. Every scene choreographs inside this box. */
export const STAGE_W = 960;
export const STAGE_H = 520;

export type Ease = "linear" | "in" | "out" | "inOut" | "backOut";

/**
 * Channels every actor exposes. The sampler is agnostic to actor kind;
 * renderers decide what each channel means visually.
 */
export type Channel =
  | "x"
  | "y"
  | "opacity"
  | "scale"
  | "glow" // 0..1 highlight ring / emphasis
  | "dim" // 0..1 de-emphasis
  | "progress" // 0..1 generic: wire draw, packet travel, fill level
  | "lift" // extra y offset in px, used by entrance/exit rises
  | "wobble"; // 0..1 shake intensity

/** Camera channels live on the reserved target id "camera". */
export const CAMERA = "camera";
export type CameraChannel = "camX" | "camY" | "camZoom";

export interface Point {
  x: number;
  y: number;
}

/** Bounding box (centered on the actor's position). Lets geometry derive anchors. */
export interface Box {
  w: number;
  h: number;
}

export interface ActorSpec {
  kind: string; // registry key: node | packet | wire | bubble | label | region | token | dot | custom…
  x: number;
  y: number;
  /** Renderer-specific props (label, glyph, accent, path, text, w, h…). */
  props?: Record<string, unknown>;
  /** Hover explanation shown in the inspector line. The learn-by-poking layer. */
  note?: string;
  /** Actors start invisible and are brought in with appear()/show(). */
  visible?: boolean;
  /** Footprint used by connect()/route() to anchor wires on edges, not centers. */
  box?: Box;
}

/**
 * A typed handle to an actor in a scene. Every animation primitive takes refs,
 * never raw id strings — a reference to a nonexistent actor cannot compile.
 */
export interface ActorRef {
  readonly id: string;
  readonly spec: ActorSpec;
}

/** A path between two points/actors that packets can travel and wires can render. */
export interface RouteRef {
  readonly d: string;
  readonly a: Point;
  readonly b: Point;
}

/** One keyframe on one channel of one actor. The atom of choreography. */
export interface Act {
  target: string; // actor id, or CAMERA
  channel: Channel | CameraChannel;
  at: number; // seconds from step start
  dur: number;
  to: number;
  from?: number; // defaults to the track's previous value
  ease?: Ease;
  /** Periodic window (pulse): value oscillates 0→to→0 with this period until `at + dur`. */
  loop?: number;
}

export interface StepDef {
  /** One sentence of narration for this beat. */
  caption: string;
  acts: Act[];
  /** Extra seconds of rest after the last act (default 0.6). */
  hold?: number;
}

export interface ParamOption {
  value: string;
  label: string;
}

export interface ParamDef {
  id: string;
  label: string;
  kind: "choice" | "toggle";
  options: ParamOption[]; // toggle uses exactly two
  initial: string;
}

export type Params = Record<string, string>;

export interface SceneContent {
  actors: Record<string, ActorSpec>;
  steps: StepDef[];
}

export interface SceneDef {
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
  /** Interactive controls. Changing one rebuilds and replays the scene. */
  params?: ParamDef[];
  /** Static content, or a builder re-run whenever params change. */
  content: SceneContent | ((params: Params) => SceneContent);
  /**
   * Essay paragraphs shown before this scene's figure in reading mode
   * (ArticleShell). Optional: scenes without prose still embed fine.
   */
  prose?: string[];
}

export interface StoryDef {
  slug: string;
  title: string;
  intro: {
    eyebrow: string;
    title: string;
    lead: string;
    begin: string;
  };
  scenes: SceneDef[];
  /** Closing paragraphs for reading mode, after the last scene. */
  outro?: string[];
}

/* ---------------- compiled form ---------------- */

export interface Keyframe {
  t0: number; // absolute seconds
  t1: number;
  from: number;
  to: number;
  ease: Ease;
  loop?: number;
}

export type Track = Keyframe[];

export interface CompiledActor {
  id: string;
  spec: ActorSpec;
  tracks: Partial<Record<Channel, Track>>;
}

export interface CompiledScene {
  actors: CompiledActor[];
  camera: Partial<Record<CameraChannel, Track>>;
  /** Absolute start time of each step. */
  markers: number[];
  captions: string[];
  duration: number;
}
