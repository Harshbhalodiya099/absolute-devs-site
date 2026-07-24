/**
 * `createExplainer` — the Lego front door (plan §3).
 *
 * An explainer is a composition of modes sharing one vocabulary, one selection
 * surface and one timeline. This is the direct descendant of the engine's
 * `E.story({...})` facade, widened from "a story" to "a composition of modes".
 *
 * Phase 1 keeps it deliberately thin: it only needs to support the first
 * explainer (a single `story` mode). It will grow `simulate`/`quiz`/`tutor`
 * entries additively as those modes land — never by rewriting existing
 * explainers.
 */
import type { StoryDef } from "../engine";
import type { Assessment } from "./assessment";
import type { ExplainerDef, ExplainerMeta, Mode } from "./contracts";
import { quiz } from "./modes/quiz";
import { story } from "./modes/story";

export interface CreateExplainerInput {
  meta: ExplainerMeta;
  modes: Mode[];
}

/** Compose an explainer from meta + an ordered set of modes. */
export function createExplainer(input: CreateExplainerInput): ExplainerDef {
  if (input.modes.length === 0) {
    throw new Error("[learn] createExplainer needs at least one mode");
  }
  return { meta: input.meta, modes: input.modes };
}

/**
 * Backward-compatible bridge: wrap an existing `StoryDef` as an explainer with
 * no change to the story file. With no assessment it is a one-mode explainer
 * that renders exactly as it did before (see `ModeHost`, which shows no tab
 * chrome for one mode); pass `assessment` — discovered by slug from
 * `src/assessments/` — and the explainer grows a quiz mode. Still additive:
 * the story file never learns that a quiz exists.
 */
export function fromStory(
  def: StoryDef,
  opts: { read?: boolean; assessment?: Assessment | null; sim?: Mode | null } = {},
): ExplainerDef {
  const modes: Mode[] = [story(def, { read: opts.read, hasQuiz: !!opts.assessment })];
  // Reading mode is an essay, not a session — a quiz or a sim tab there would be
  // chrome around prose the learner may not have finished. Modes compose in a
  // deliberate learning order: watch it, check it, then drive it yourself.
  if (opts.assessment && !opts.read) modes.push(quiz(opts.assessment));
  if (opts.sim && !opts.read) modes.push(opts.sim);
  return createExplainer({ meta: { slug: def.slug, title: def.title }, modes });
}
