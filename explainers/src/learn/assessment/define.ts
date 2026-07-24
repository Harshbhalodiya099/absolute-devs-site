/**
 * `defineAssessment` — the authoring front door for a quiz data file, matching
 * the engine's `defineStory` / `defineMeta` idiom: an identity function whose
 * only job is to type-check the literal you wrote, at the place you wrote it.
 * A wrong `answer` index or an unknown glyph is a compile error in the data
 * file, not a runtime surprise in the renderer.
 */
import type { Assessment } from "./types";

export const defineAssessment = (a: Assessment): Assessment => a;
