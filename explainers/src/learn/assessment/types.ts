/**
 * The Assessment engine's data model (plan §9).
 *
 * Questions are **declarative data**: an assessment file contains content and
 * nothing else. The engine holds rendering and deterministic evaluation only —
 * it never knows what DNS or Kubernetes is. If you find yourself wanting to add
 * a topic-specific field here, the question type is wrong, not the engine.
 *
 * This file is React-free on purpose (like `vocab/accents.ts`), so evaluation
 * can be tested — and later reused headlessly — without a DOM.
 */
import type { AccentName, GlyphName } from "../../vocab";

/** What every question carries, whatever its type. */
interface QuestionBase {
  /** Stable within its assessment. Also seeds deterministic shuffling. */
  id: string;
  /** The question itself, in the same plain voice as a scene caption. */
  prompt: string;
  /** Shown after answering — right or wrong. This is the actual teaching. */
  explain: string;
}

/** Pick one of several options. The workhorse. */
export interface McqQuestion extends QuestionBase {
  type: "mcq";
  options: string[];
  /** Index into `options`. */
  answer: number;
}

/** Put the steps of a process back in order. */
export interface OrderQuestion extends QuestionBase {
  type: "order";
  /**
   * The steps **in the correct order**. Authors write the truth; the runner
   * presents them shuffled (deterministically, from `id`).
   */
  steps: string[];
}

/** One part of an `identify` diagram, drawn from the shared vocabulary. */
export interface DiagramPart {
  id: string;
  /** A glyph from `vocab/glyphs` — the same drawing the story uses. */
  glyph: GlyphName;
  label: string;
  sub?: string;
  accent?: AccentName;
}

/** Point at the right thing in a diagram built from `vocab`. */
export interface IdentifyQuestion extends QuestionBase {
  type: "identify";
  parts: DiagramPart[];
  /** The `id` of the correct part. */
  answer: string;
}

export type Question = McqQuestion | OrderQuestion | IdentifyQuestion;
export type QuestionType = Question["type"];

/* ---------------- learner responses ---------------- */

export type Response =
  | { type: "mcq"; choice: number }
  /** Indices into `steps`, in the order the learner arranged them. */
  | { type: "order"; order: number[] }
  | { type: "identify"; pick: string };

/** The engine's answer to "was that right?" — deterministic, no side effects. */
export interface Verdict {
  correct: boolean;
  /** The question's `explain`, surfaced so the renderer needs no lookup. */
  explain: string;
  /** For `order`: positions (0-based) holding the wrong step. */
  misplaced?: number[];
}

/* ---------------- authored assessments ---------------- */

/** One explainer's quiz: what `quiz({ ... })` receives and a data file exports. */
export interface Assessment {
  /** Optional heading above the questions (defaults to a neutral one). */
  title?: string;
  /** One line under the heading, in the story's voice. */
  lead?: string;
  questions: Question[];
}
