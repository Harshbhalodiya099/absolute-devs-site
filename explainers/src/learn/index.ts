/**
 * learn/ — the Interactive Learning Engine (composition layer).
 *
 * The one front door + the mode host + the shared contracts. Modes live in
 * `./modes/*`; the Assessment engine that backs the quiz mode lives in
 * `./assessment/*`. `vocab/` and (future) `sim/` import no React; `learn/` and
 * `engine/` are the React layer (plan §14).
 */
export { createExplainer, fromStory, type CreateExplainerInput } from "./createExplainer";
export { ModeHost } from "./host/ModeHost";
export { story, type StoryModeOptions } from "./modes/story";
export { quiz, type QuizModeOptions } from "./modes/quiz";
export { simulate, type SimulateModeOptions, type SimViewProps } from "./modes/simulate";
export { defineAssessment, evaluate, score, validateAssessment, validateQuestion } from "./assessment";
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
} from "./assessment";
export type {
  ExplainerDef,
  ExplainerMeta,
  Mode,
  ModeNav,
  HostServices,
  Vocab,
  Selection,
  Timeline,
  Controls,
  EntityRef,
} from "./contracts";
