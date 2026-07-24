/**
 * The `story` mode — the narrative spine most explainers open with.
 *
 * It is a thin adapter over the EXISTING animation engine: it renders
 * `StoryShell` (or `ArticleShell` in reading mode) with no change to any story
 * file and no change to the engine. This is the "migration is strictly
 * additive" guarantee (plan §7, §12) made literal: a current `E.story({...})`
 * becomes a mode by being wrapped here, never by being rewritten.
 */
import { ArticleShell, StoryShell, type StoryDef } from "../../engine";
import type { Mode } from "../contracts";

export interface StoryModeOptions {
  /** Render the essay (reading) shell instead of the interactive one. */
  read?: boolean;
  /** Tab label if this explainer grows a second mode (default "Story"). */
  label?: string;
  /**
   * Whether a quiz exists for this explainer. In reading mode the quiz is not a
   * mounted mode, so the essay can't discover it through `nav`; this lets the
   * article offer a "check your understanding" link back to the interactive quiz.
   */
  hasQuiz?: boolean;
}

/**
 * Wrap a `StoryDef` (or a thunk returning one) as a mountable mode. The def can
 * be lazy so the story chunk is only built when the mode actually renders.
 */
export function story(def: StoryDef | (() => StoryDef), opts: StoryModeOptions = {}): Mode {
  const resolve = typeof def === "function" ? def : () => def;
  return {
    id: "story",
    label: opts.label ?? "Story",
    // StoryShell owns its own player and inspector; the only host service it
    // needs is `nav`, so a finished story can hand the learner to the next mode
    // (Check understanding → Simulate) instead of leaving them at a dead end.
    render(host) {
      const s = resolve();
      if (opts.read) {
        // Drop ?read and open the quiz tab directly; only offered if a quiz exists.
        const quizHref = opts.hasQuiz ? `${window.location.pathname}?mode=quiz` : undefined;
        return <ArticleShell story={s} quizHref={quizHref} />;
      }
      const modes = host.nav?.modes ?? [];
      const selfIndex = modes.findIndex((m) => m.id === "story");
      const upcoming = selfIndex >= 0 ? modes[selfIndex + 1] : undefined;
      const next = upcoming ? { label: upcoming.label, go: () => host.nav?.go(upcoming.id) } : undefined;
      return <StoryShell story={s} next={next} />;
    },
  };
}
