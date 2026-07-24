/**
 * learn/ — the Interactive Learning Engine (composition layer).
 *
 * This file is the entire coupling surface between the host and its modes: the
 * four small contracts from the architecture plan (§8). Keep it tiny. A mode
 * receives `HostServices` and uses only what it needs; a mode that shares
 * nothing (a static quiz) ignores the services it doesn't touch.
 *
 * Phase 2 note (Rule of Three): `vocab` and `nav` have real consumers, so they
 * are the built members of `HostServices` — `nav` graduated when the quiz mode
 * needed to send a learner back to the story. `Selection`, `Timeline` and
 * `Controls` are declared here as the agreed target shape, but are NOT built as
 * services yet — the animation engine's `StoryShell` already owns its own
 * player and inspector internally, so extracting them now would add indirection
 * with no second consumer. They graduate from type to real service in the phase
 * where a mode first reads them (quiz inspection / sim ticks). Until then a mode
 * receives them as `undefined`.
 */
import type { ReactNode } from "react";
import type * as vocab from "../vocab";

/** The shared visual language, resolved the same way in every mode (§8.1). */
export type Vocab = typeof vocab;

/** A thing a learner can point at across modes: a node, actor, packet, token. */
export interface EntityRef {
  kind: string;
  id: string;
}

/**
 * Selection + inspection bus (§8.2) — one inspection surface across modes.
 * DECLARED, not built in Phase 1 (no mode emits through it yet).
 */
export interface Selection {
  select(ref: EntityRef | null): void;
  subscribe(cb: (sel: EntityRef | null) => void): () => void;
}

/**
 * One time axis story & sim both drive (§8.3). DECLARED, not built in Phase 1 —
 * `StoryShell` still owns its own player; the real shared service arrives with
 * the sim mode (its true second consumer).
 */
export interface Timeline {
  play(): void;
  pause(): void;
  seek(t: number): void;
  step(dir: 1 | -1): void;
  readonly length: number;
  subscribe(cb: (t: number) => void): () => void;
}

/** Shared interactive controls (toggle · choice · slider). DECLARED, not built. */
export interface Controls {
  // Intentionally empty until the first cross-mode consumer defines its needs.
  readonly _reserved?: never;
}

/**
 * Mode navigation — how a mode moves the learner to a sibling mode (Phase 2).
 * Small on purpose: a mode may ask to go somewhere, but the host owns which
 * mode is showing and renders all the chrome for it.
 */
export interface ModeNav {
  readonly modes: ReadonlyArray<{ id: string; label: string }>;
  readonly activeId: string;
  /** No-op if there is no mode with that id. */
  go(id: string): void;
}

/**
 * What every mode receives. `vocab` and `nav` are real; the rest are present in
 * the type but absent (`undefined`) until the phase that builds them (file doc).
 */
export interface HostServices {
  vocab: Vocab;
  nav?: ModeNav;
  selection?: Selection;
  timeline?: Timeline;
  controls?: Controls;
}

/**
 * The mode contract (§8.4), adapted to the engine's React reality: a mode
 * renders a React node given the host services, instead of imperatively
 * mounting into a raw container. Same intent, idiomatic for this codebase.
 */
export interface Mode {
  /** "story" | "quiz" | "simulate" | "tutor" … */
  id: string;
  /** Tab label shown by the Mode Host when more than one mode is present. */
  label: string;
  render(host: HostServices): ReactNode;
}

/** Minimal library-card metadata the host needs to frame an explainer. */
export interface ExplainerMeta {
  slug: string;
  title: string;
}

/** An explainer = meta + an ordered set of modes. The unit `createExplainer` returns. */
export interface ExplainerDef {
  meta: ExplainerMeta;
  modes: Mode[];
}
