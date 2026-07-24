/**
 * The `simulate` mode — an interactive, deterministic simulation mounted as a
 * mode. Like the quiz, it is thin: everything topic-specific lives in the view
 * and its headless reducer (`sim/<topic>/`); this factory only wraps a lazy
 * view in the `Mode` contract.
 *
 * Authoring one feels like authoring a quiz — drop `src/sims/<slug>.tsx` next to
 * `src/stories/<slug>/` and the Simulate tab appears (see `src/sims/index.ts`).
 * The view is passed the `host` so it can offer "Back to the story" the same way
 * `QuizView` does.
 */
import { Suspense, type ComponentType } from "react";
import type { HostServices, Mode } from "../contracts";

/** Props every sim view receives: the shared host services. */
export interface SimViewProps {
  host: HostServices;
}

export interface SimulateModeOptions {
  /** Tab label (default "Simulate"). */
  label?: string;
}

/**
 * Compose a simulate mode from a (typically lazy) view component. The view is
 * its own chunk, so an explainer with no sim — and a learner who never opens
 * the tab — never downloads it.
 */
export function simulate(view: ComponentType<SimViewProps>, opts: SimulateModeOptions = {}): Mode {
  const View = view;
  return {
    id: "simulate",
    label: opts.label ?? "Simulate",
    render(host) {
      return (
        <Suspense fallback={null}>
          <View host={host} />
        </Suspense>
      );
    },
  };
}
