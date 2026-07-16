/**
 * The story library. Stories are discovered, never registered by hand:
 * dropping a new src/stories/<slug>/ folder (meta.ts + story.ts) is the whole
 * integration. Metas load eagerly (they are tiny); scenes load lazily, so
 * each explainer is its own code-split chunk.
 */
import type { StoryDef, StoryMeta } from "../engine";

const metaModules = import.meta.glob<{ meta: StoryMeta }>("./*/meta.ts", { eager: true });
const storyModules = import.meta.glob<{ default: StoryDef }>("./*/story.ts");

export const library: StoryMeta[] = Object.values(metaModules)
  .map((m) => m.meta)
  .sort((a, b) => a.title.localeCompare(b.title));

export async function loadStory(slug: string): Promise<StoryDef | null> {
  const load = storyModules[`./${slug}/story.ts`];
  return load ? (await load()).default : null;
}
