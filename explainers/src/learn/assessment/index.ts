/**
 * assessment/ — the Assessment engine (plan §5, §9).
 *
 * Two halves, deliberately separable:
 *   · `types` + `evaluate` — declarative question data and pure, deterministic
 *     grading. React-free, DOM-free, testable in isolation.
 *   · `QuizView` + `questions/*` — the reusable renderer, which reuses `vocab`
 *     for diagram questions and introduces no visual system of its own.
 *
 * The engine never contains topic knowledge. Content lives in assessment data
 * files (`src/assessments/<slug>.ts`).
 */
export { QuizView } from "./QuizView";
export { defineAssessment } from "./define";
export { evaluate, score, shuffledOrder, usableQuestions, validateAssessment, validateQuestion } from "./evaluate";
export { RadioGroup, type RadioProps } from "./RadioGroup";
export type {
  Assessment,
  DiagramPart,
  IdentifyQuestion,
  McqQuestion,
  OrderQuestion,
  Question,
  QuestionType,
  Response,
  Verdict,
} from "./types";
