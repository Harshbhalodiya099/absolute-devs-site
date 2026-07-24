/**
 * The `quiz` mode — the Assessment engine mounted as a mode.
 *
 * Authoring it is meant to feel like authoring a story: content in, nothing
 * else. Everything topic-specific lives in the questions.
 *
 *   quiz({
 *     lead: "Three questions. The explanations say more than the questions do.",
 *     questions: [
 *       { id: "cache", type: "mcq", prompt: "…", options: [...], answer: 1, explain: "…" },
 *     ],
 *   })
 *
 * Malformed data follows the engine's convention (`engine/validate.ts`): loud
 * in development, survivable in production — a bad question throws while you
 * are writing it, and is skipped rather than blanking a learner's page if one
 * ever reaches prod.
 */
import { lazy, Suspense } from "react";
import { validateAssessment } from "../assessment/evaluate";
import type { Assessment } from "../assessment/types";
import type { Mode } from "../contracts";

/**
 * The renderer is a separate chunk: an explainer with no quiz — and a learner
 * who never opens the quiz tab — never downloads it. Only the tiny React-free
 * validator is linked statically.
 */
const QuizView = lazy(() => import("../assessment/QuizView").then((m) => ({ default: m.QuizView })));

export interface QuizModeOptions {
  /** Tab label (default "Check understanding"). */
  label?: string;
}

/** Compose a quiz mode from declarative question data. */
export function quiz(input: Assessment | (() => Assessment), opts: QuizModeOptions = {}): Mode {
  const resolve = typeof input === "function" ? input : () => input;
  return {
    id: "quiz",
    label: opts.label ?? "Check understanding",
    render(host) {
      const assessment = resolve();
      if (import.meta.env.DEV) {
        const issues = validateAssessment(assessment);
        if (issues.length) throw new Error(`[assessment] invalid quiz:\n  - ${issues.join("\n  - ")}`);
      }
      const story = host.nav?.modes.find((m) => m.id === "story");
      return (
        // The chunk is a couple of kilobytes; a spinner would only flash.
        <Suspense fallback={null}>
          <QuizView assessment={assessment} onReviewStory={story ? () => host.nav?.go(story.id) : undefined} />
        </Suspense>
      );
    },
  };
}
