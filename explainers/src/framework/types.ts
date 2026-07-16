import type { FC } from "react";

/**
 * A single beat of the story. The shell renders the chrome (question, title,
 * takeaway, controls); the Component renders the animated stage.
 */
export interface SceneDef {
  id: string;
  /** Small eyebrow label grouping scenes into chapters, e.g. "DNS" */
  chapter: string;
  /** The question this scene answers. Shown above the title. */
  question: string;
  /** Cinematic title, e.g. "Your browser doesn't know where Google lives." */
  title: string;
  /** One supporting line under the title. Keep it to a sentence. */
  narration: string;
  /** Answer to "What just happened?" — one or two concise sentences. */
  whatHappened: string;
  /** Label for the Next button: the question that pulls the user forward. */
  nextPrompt: string;
  /** Seconds (at 1× speed) before the takeaway card fades in. */
  duration: number;
  Component: FC;
}

export interface ExplainerDef {
  slug: string;
  title: string;
  scenes: SceneDef[];
}
