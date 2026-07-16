import { useEffect, useState } from "react";
import { ArticleShell, StoryShell, type StoryDef } from "../engine";
import { loadStory } from "../stories";

/** Lazily loads one story chunk, then hands it to the right shell. */
export function StoryLoader({ slug, read }: { slug: string; read: boolean }) {
  const [story, setStory] = useState<StoryDef | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    loadStory(slug).then((s) => {
      if (!alive) return;
      if (s) setStory(s);
      else setMissing(true);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

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
  if (!story) return null; // chunks are small; a spinner would flash
  return read ? <ArticleShell story={story} /> : <StoryShell story={story} />;
}
