/**
 * The simulation library. Sims are discovered, never registered by hand:
 * dropping `src/sims/<slug>.tsx` next to an existing `src/stories/<slug>/`
 * gives that explainer a Simulate mode — the same "add a file, ship a feature"
 * integration stories and quizzes have.
 *
 * Each sim file default-exports a composed `simulate(...)` mode, so the whole
 * topic view (SVG stage + reducer) is its own chunk: a learner who never opens
 * the tab never downloads it.
 */
import type { Mode } from "../learn/contracts";

const modules = import.meta.glob<{ default: Mode }>(["./*.tsx", "!./index.ts"]);

const key = (slug: string) => `./${slug}.tsx`;

/** Slugs that have a sim — used to decide whether to compose a simulate mode. */
export const simSlugs: string[] = Object.keys(modules)
  .map((p) => p.slice(2, -4))
  .sort();

/** True if this explainer has a sim, without loading it. */
export const hasSim = (slug: string): boolean => key(slug) in modules;

/** One explainer's simulate mode, or null if it has none. */
export async function loadSim(slug: string): Promise<Mode | null> {
  const load = modules[key(slug)];
  return load ? (await load()).default : null;
}
