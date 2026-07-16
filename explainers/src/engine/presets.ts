/**
 * The shared visual vocabulary. The same concept looks the same in every
 * explainer: a pod is always a green box card, a database always the amber
 * cylinder, users always the blue figure. Stories place presets and may
 * override copy (label/sub/note) — they never redefine visual identity.
 *
 * A story-local concept that repeats ("expert", "broker") deserves its own
 * definePreset() at the top of the story file; a concept that repeats across
 * stories deserves an entry here.
 */
import { node } from "./actors";
import type { ActorSpec, Point } from "./types";

type NodeArgs = Parameters<typeof node>[0];
type PresetDefaults = Omit<NodeArgs, "x" | "y"> ;
type PresetOverrides = Partial<Omit<NodeArgs, "x" | "y">>;

/** A node factory with a fixed visual identity and overridable copy. */
export function definePreset(defaults: PresetDefaults): (p: Point & PresetOverrides) => ActorSpec {
  return (p) => node({ ...defaults, ...p });
}

/** Real people using the system. */
const users = definePreset({
  glyph: "user",
  label: "Users",
  accent: "blue",
  note: "Real people using the system. They don't know or care how it works inside — only whether it responds.",
});

/** The client machine: a browser or laptop where requests begin. */
const browser = definePreset({
  glyph: "laptop",
  label: "Browser",
  accent: "blue",
  note: "Where the request begins: the user's machine.",
});

/** A machine that answers requests. */
const server = definePreset({
  glyph: "server",
  label: "Server",
  accent: "cyan",
  note: "A machine that accepts requests and answers them.",
});

/** The source of truth for data. */
const database = definePreset({
  glyph: "database",
  label: "Database",
  accent: "amber",
  note: "Where state lives. The one authoritative copy of the data — everything else can be rebuilt, this can't.",
});

/** Fast lookup memory in front of something slower. */
const cache = definePreset({
  glyph: "cache",
  label: "Cache",
  accent: "violet",
  note: "A fast memory in front of something slower. Answers repeat questions without doing the work twice.",
});

/** Spreads traffic across many backends behind one address. */
const loadBalancer = definePreset({
  glyph: "balancer",
  label: "Load balancer",
  accent: "cyan",
  note: "One stable address in front of many workers. It spreads incoming traffic across whichever backends are healthy.",
});

/** One running, disposable copy of an app. */
const pod = definePreset({
  glyph: "box",
  label: "pod",
  w: 132,
  accent: "green",
  note: "One running copy of the app. Disposable by design — it can be killed and recreated anywhere without ceremony.",
});

/** A control loop that reconciles desire with reality. */
const controller = definePreset({
  glyph: "gear",
  label: "Controller",
  accent: "violet",
  note: "A loop that compares desired state with actual state and acts to close the gap — continuously, forever.",
});

/** A buffer of pending work between producers and consumers. */
const queue = definePreset({
  glyph: "queue",
  label: "Queue",
  accent: "amber",
  note: "A waiting line for work. Producers append, consumers take from the front — the two never need to meet.",
});

/** A process that takes jobs and does the work. */
const worker = definePreset({
  glyph: "gear",
  label: "Worker",
  accent: "cyan",
  note: "A process that pulls a job, does the work, and asks for the next one.",
});

/**
 * The vocabulary, namespaced so preset names never shadow a story's own cast
 * variables: `s.cast({ users: v.users({ ...spot("left") }) })`.
 */
export const v = {
  users,
  browser,
  server,
  database,
  cache,
  loadBalancer,
  pod,
  controller,
  queue,
  worker,
} as const;
