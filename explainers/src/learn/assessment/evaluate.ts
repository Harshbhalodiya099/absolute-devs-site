/**
 * Deterministic evaluation — the whole "engine" half of the Assessment engine.
 *
 * Three rules hold this file honest:
 *   1. **Pure.** Same question + same response ⇒ same verdict, always. No
 *      clock, no `Math.random`, no network, no storage.
 *   2. **Topic-blind.** Nothing here knows what a resolver or a pod is.
 *   3. **React-free.** It runs in a test file with no DOM.
 *
 * Shuffling lives here too, because "which order did the learner see?" must be
 * reproducible: it is derived from the question `id`, not from randomness.
 */
import type { Assessment, Question, Response, Verdict } from "./types";

/* ================= evaluation ================= */

/** Grade one response. Throws only on a programmer error (mismatched types). */
export function evaluate(question: Question, response: Response): Verdict {
  if (question.type !== response.type) {
    throw new Error(
      `[assessment] response "${response.type}" cannot grade a "${question.type}" question (${question.id})`,
    );
  }
  switch (question.type) {
    case "mcq":
      return { correct: (response as { choice: number }).choice === question.answer, explain: question.explain };

    case "order": {
      const order = (response as { order: number[] }).order;
      // A response that isn't a permutation of the steps is wrong, not a crash:
      // it can only come from a stale UI state, and the learner still deserves
      // the explanation.
      const complete = order.length === question.steps.length && isPermutation(order, question.steps.length);
      const misplaced = question.steps.map((_, i) => i).filter((i) => order[i] !== i);
      return { correct: complete && misplaced.length === 0, explain: question.explain, misplaced };
    }

    case "identify":
      return { correct: (response as { pick: string }).pick === question.answer, explain: question.explain };
  }
}

function isPermutation(order: number[], n: number): boolean {
  const seen = new Set<number>();
  for (const i of order) {
    if (!Number.isInteger(i) || i < 0 || i >= n || seen.has(i)) return false;
    seen.add(i);
  }
  return seen.size === n;
}

/** How many of a set of verdicts were correct. Used only for the summary line. */
export function score(verdicts: Iterable<Verdict>): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const v of verdicts) {
    total++;
    if (v.correct) correct++;
  }
  return { correct, total };
}

/* ================= deterministic presentation order ================= */

/** xmur3 — a small, well-known string hash. Stable across engines and runs. */
function hash(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 — 32-bit PRNG; deterministic given the seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The order the learner sees an `order` question's steps in: a permutation of
 * `0..n-1` derived from `seed` (the question id). Never the already-correct
 * order — being handed the answer is not a question.
 */
export function shuffledOrder(seed: string, n: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return idx;
  const next = rng(hash(seed));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  if (idx.every((v, i) => v === i)) [idx[0], idx[1]] = [idx[1], idx[0]];
  return idx;
}

/* ================= authoring-time validation ================= */

/** Human-readable problems with one question. Empty array = well-formed. */
export function validateQuestion(q: Question): string[] {
  const issues: string[] = [];
  const at = (m: string) => `${q?.id ?? "(no id)"}: ${m}`;

  if (!q || typeof q !== "object") return ["question is not an object"];
  if (!q.id) issues.push("missing id");
  if (!q.prompt?.trim()) issues.push(at("missing prompt"));
  if (!q.explain?.trim()) issues.push(at("missing explain — the explanation is the teaching"));

  switch (q.type) {
    case "mcq":
      if (!Array.isArray(q.options) || q.options.length < 2) issues.push(at("mcq needs at least 2 options"));
      else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)
        issues.push(at(`answer ${q.answer} is not an index into ${q.options.length} options`));
      if (Array.isArray(q.options) && new Set(q.options).size !== q.options.length)
        issues.push(at("mcq has duplicate options"));
      break;

    case "order":
      if (!Array.isArray(q.steps) || q.steps.length < 2) issues.push(at("order needs at least 2 steps"));
      else if (new Set(q.steps).size !== q.steps.length)
        issues.push(at("order has duplicate steps — they cannot be told apart"));
      break;

    case "identify": {
      if (!Array.isArray(q.parts) || q.parts.length < 2) issues.push(at("identify needs at least 2 parts"));
      else {
        if (new Set(q.parts.map((p) => p.id)).size !== q.parts.length)
          issues.push(at("identify has duplicate part ids"));
        if (q.parts.some((p) => !p.glyph || !p.label)) issues.push(at("every identify part needs a glyph and a label"));
        if (!q.parts.some((p) => p.id === q.answer)) issues.push(at(`answer "${q.answer}" is not one of the parts`));
      }
      break;
    }

    default:
      issues.push(at(`unknown question type "${(q as { type: string }).type}"`));
  }
  return issues;
}

/** Problems with a whole assessment, including cross-question ones. */
export function validateAssessment(a: Assessment): string[] {
  if (!a || !Array.isArray(a.questions)) return ["assessment has no questions array"];
  const issues = a.questions.flatMap(validateQuestion);
  if (a.questions.length === 0) issues.push("assessment has no questions");
  const ids = a.questions.map((q) => q?.id).filter(Boolean);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) issues.push(`duplicate question ids: ${[...new Set(dupes)].join(", ")}`);
  return issues;
}

/**
 * Keep only well-formed questions. A typo in one question must never blank a
 * learner's page — in dev it is loud, in production it is skipped.
 */
export function usableQuestions(questions: Question[]): Question[] {
  return questions.filter((q) => {
    const issues = validateQuestion(q);
    if (issues.length) console.warn(`[assessment] skipping malformed question — ${issues.join("; ")}`);
    return issues.length === 0;
  });
}
