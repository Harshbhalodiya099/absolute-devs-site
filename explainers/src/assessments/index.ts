/**
 * The assessment library. Quizzes are discovered, never registered by hand:
 * dropping `src/assessments/<slug>.ts` next to an existing `src/stories/<slug>/`
 * gives that explainer a quiz mode — the same "add a folder, ship a feature"
 * integration stories have.
 *
 * Assessments load lazily, like scenes: a learner who never opens the quiz
 * never downloads it.
 */
import type { Assessment } from "../learn/assessment";

const modules = import.meta.glob<{ default: Assessment }>(["./*.ts", "!./index.ts"]);

const key = (slug: string) => `./${slug}.ts`;

/** Slugs that have a quiz — used to decide whether to compose a quiz mode. */
export const assessmentSlugs: string[] = Object.keys(modules)
  .map((p) => p.slice(2, -3))
  .sort();

/** True if this explainer has a quiz, without loading it. */
export const hasAssessment = (slug: string): boolean => key(slug) in modules;

/** One explainer's quiz, or null if it has none. */
export async function loadAssessment(slug: string): Promise<Assessment | null> {
  const load = modules[key(slug)];
  return load ? (await load()).default : null;
}
