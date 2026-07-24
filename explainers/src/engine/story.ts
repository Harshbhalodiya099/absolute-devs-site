/**
 * Story-level definitions. Every explainer lives in src/stories/<slug>/ as
 * two files:
 *
 *   meta.ts   — defineMeta({...})   tiny; eagerly loaded for the library page
 *   story.ts  — defineStory({...})  the scenes; lazily loaded per route
 *
 * The app discovers both via import.meta.glob — adding an explainer never
 * touches engine or app code.
 */
import type { StoryDef } from "./types";

/** The topic buckets shown as sections on the library page. */
export type StoryCategory =
  | "networking"
  | "deployment-cloud"
  | "databases-search"
  | "dev-tools"
  | "ai-ml"
  | "systems";

/** What the library page needs to list a story without loading its scenes. */
export interface StoryMeta {
  slug: string;
  title: string;
  category?: StoryCategory;
  intro: {
    eyebrow: string;
    title: string;
    lead: string;
    begin: string;
  };
}

export const defineMeta = (meta: StoryMeta): StoryMeta => meta;

export const defineStory = (story: StoryDef): StoryDef => story;
