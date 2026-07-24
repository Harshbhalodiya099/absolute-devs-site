import { useEffect, useMemo, useState } from "react";
import { loadAssessment } from "../assessments";
import { type StoryDef } from "../engine";
import { fromStory, ModeHost, type Assessment, type Mode } from "../learn";
import { loadSim } from "../sims";
import { loadStory } from "../stories";

/**
 * Lazily loads one story chunk — plus its quiz, if `src/assessments/<slug>.ts`
 * exists — then runs both through the composition shell. Every explainer flows
 * through `ModeHost`; with only a `story` mode it renders identically to the
 * old direct-shell path, and an explainer gains a quiz purely by a data file
 * appearing next to it.
 */
export function StoryLoader({ slug, read }: { slug: string; read: boolean }) {
  const [story, setStory] = useState<StoryDef | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sim, setSim] = useState<Mode | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    setStory(null);
    setAssessment(null);
    setSim(null);
    // All chunks in flight at once: neither the quiz nor the sim delays the story.
    Promise.all([loadStory(slug), loadAssessment(slug), loadSim(slug)]).then(([s, a, sm]) => {
      if (!alive) return;
      if (s) {
        setAssessment(a);
        setSim(sm);
        setStory(s);
      } else setMissing(true);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  // Modes will hold state (a quiz in progress, a sim mid-walk); rebuilding the
  // def each render would be a new `Mode` object every time.
  const explainer = useMemo(
    () => (story ? fromStory(story, { read, assessment, sim }) : null),
    [story, read, assessment, sim],
  );

  if (missing) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg text-slate-300">No explainer called “{slug}” here.</p>
        <a href="./" className="text-sm text-teal-300 underline decoration-slate-700 underline-offset-4">
          Browse the library
        </a>
      </div>
    );
  }
  if (!explainer) return null; // chunks are small; a spinner would flash
  return <ModeHost explainer={explainer} />;
}
