/**
 * Public engine API. Story files import ONLY from here; if a story needs a
 * deeper import, that's an engine gap — fix the engine, not the story.
 */
export * from "./types";
export * from "./motion";
export * from "./verbs";
export * from "./geometry";
export * from "./layout";
export * from "./scene";
export * from "./actors";
export { definePreset, v } from "../vocab";
export { defineMeta, defineStory, type StoryMeta, type StoryCategory } from "./story";
export { E } from "./api";
export { defineActorKind, registerActor, type RenderCtx } from "./registry";
export { C, accent, type AccentName, type GlyphName } from "../vocab";
export { StoryShell } from "./StoryShell";
export { ArticleShell } from "./ArticleShell";
