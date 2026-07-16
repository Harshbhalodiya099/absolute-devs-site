import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { compileScene } from "./timeline";
import { prefersReducedMotion, usePlayer } from "./player";
import { Stage } from "./Stage";
import { ControlButton, Scrubber } from "./StoryShell";
import type { Params, SceneDef, StoryDef } from "./types";

const SPEEDS = [0.25, 0.5, 1, 2];
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Reading mode: the same story as a scrolling essay. Prose leads, and each
 * scene is embedded as a living figure — paused until it scrolls into view,
 * then it plays; still fully scrubbable, steppable, and interactive.
 * Topic-agnostic, like StoryShell: everything comes from the story data.
 */
export function ArticleShell({ story }: { story: StoryDef }) {
  return (
    <MotionConfig reducedMotion="user">
      <article className="mx-auto w-full max-w-[46rem] px-6 pt-16 pb-24 sm:pt-24">
        {/* masthead */}
        <header>
          <p className="text-[11px] font-semibold tracking-[0.26em] text-teal-300/80 uppercase">
            {story.intro.eyebrow}
          </p>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-slate-100 sm:text-[2.6rem] sm:leading-[1.15]">
            {story.intro.title}
          </h1>
          <p className="mt-5 text-pretty text-base leading-[1.8] text-slate-400 sm:text-lg sm:leading-[1.8]">
            {story.intro.lead}
          </p>
          <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{story.scenes.length} interactive figures — every one can be paused, scrubbed, and poked</span>
            <span aria-hidden>·</span>
            <a
              href={window.location.pathname}
              className="underline decoration-slate-700 underline-offset-4 transition-colors hover:text-slate-300"
            >
              watch it as a guided story instead
            </a>
          </p>
          <div className="mt-10 h-px w-full bg-gradient-to-r from-slate-700/70 via-slate-800 to-transparent" />
        </header>

        {story.scenes.map((s) => (
          <ArticleSection key={s.id} scene={s} />
        ))}

        {/* outro */}
        {story.outro?.length ? (
          <footer className="mt-16">
            <div className="mb-10 h-px w-full bg-gradient-to-r from-slate-700/70 via-slate-800 to-transparent" />
            {story.outro.map((p, i) => (
              <p key={i} className="mt-5 text-pretty text-[1.02rem] leading-[1.85] text-slate-300">
                {p}
              </p>
            ))}
            <p className="mt-10 text-center text-slate-600" aria-hidden>
              ∎
            </p>
          </footer>
        ) : null}
      </article>
    </MotionConfig>
  );
}

/* ================= one scene as an essay section ================= */

function ArticleSection({ scene }: { scene: SceneDef }) {
  return (
    <section className="mt-14">
      <p className="text-[11px] font-semibold tracking-[0.22em] text-teal-300/70 uppercase">
        {scene.chapter} · {scene.question}
      </p>
      <h2 className="mt-2.5 text-balance text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
        {scene.title}
      </h2>
      {(scene.prose ?? []).map((p, i) => (
        <p key={i} className="mt-5 text-pretty text-[1.02rem] leading-[1.85] text-slate-300">
          {p}
        </p>
      ))}
      <EmbeddedScene scene={scene} />
      <aside className="mt-6 border-l-2 border-teal-300/40 pl-4">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">What just happened?</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{scene.takeaway}</p>
      </aside>
    </section>
  );
}

/* ================= the living figure ================= */

function EmbeddedScene({ scene }: { scene: SceneDef }) {
  const [params, setParams] = useState<Params>(() =>
    Object.fromEntries((scene.params ?? []).map((p) => [p.id, p.initial])),
  );
  const paramsKey = JSON.stringify(params);

  const compiled = useMemo(() => {
    const content = typeof scene.content === "function" ? scene.content(params) : scene.content;
    return compileScene(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, paramsKey]);

  // Figures wait for the reader: paused until ~half visible, then they play.
  // After activation, param changes replay immediately (autoplay = true).
  const [activated, setActivated] = useState(false);
  const player = usePlayer(compiled.duration, compiled.markers, `${scene.id}|${paramsKey}`, activated);
  const [note, setNote] = useState<string | null>(null);

  const figureRef = useRef<HTMLElement>(null);
  const playRef = useRef(player.play);
  playRef.current = player.play;

  useEffect(() => {
    if (activated || prefersReducedMotion()) return;
    const el = figureRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActivated(true);
          playRef.current();
          obs.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [activated]);

  const caption = compiled.captions[player.stepIndex] ?? "";

  return (
    <figure ref={figureRef} className="glass mt-7 rounded-2xl p-3 sm:p-4">
      {scene.params && (
        <div className="flex flex-wrap items-center justify-center gap-4 pt-1 pb-2">
          {scene.params.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5">
              <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{p.label}</span>
              <div className="flex items-center rounded-full border border-slate-700/70 p-0.5">
                {p.options.map((o) => (
                  <button
                    key={o.value}
                    aria-pressed={params[p.id] === o.value}
                    onClick={() => setParams((prev) => ({ ...prev, [p.id]: o.value }))}
                    className={`cursor-pointer rounded-full px-3 py-1 text-[11.5px] transition-colors ${
                      params[p.id] === o.value
                        ? "bg-slate-200 font-semibold text-slate-900"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Stage scene={compiled} time={player.time} ariaLabel={scene.title} onInspect={setNote} />

      <figcaption className="flex min-h-12 flex-col items-center gap-1 px-2 pt-1 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={player.stepIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="max-w-xl text-pretty text-[13px] leading-relaxed text-slate-400"
          >
            {caption}
          </motion.p>
        </AnimatePresence>
        <p
          aria-live="polite"
          className={`max-w-xl text-xs leading-relaxed transition-opacity duration-300 ${
            note ? "text-teal-200/90 opacity-100" : "text-slate-600 opacity-70"
          }`}
        >
          {note ?? "Hover anything on the stage to learn what it is."}
        </p>
      </figcaption>

      <div className="px-1 pt-1">
        <Scrubber player={player} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ControlButton onClick={player.toggle} label={player.playing ? "Pause" : "Play"} wide>
              {player.playing ? "❚❚" : "▶"}
            </ControlButton>
            <ControlButton onClick={player.stepBack} label="Previous step">
              ⇤
            </ControlButton>
            <ControlButton onClick={player.stepForward} label="Next step">
              ⇥
            </ControlButton>
            <ControlButton onClick={player.replay} label="Replay">
              ↻
            </ControlButton>
          </div>
          <div className="flex items-center rounded-full border border-slate-700/70 p-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => player.setSpeed(s)}
                aria-pressed={player.speed === s}
                className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] tabular-nums transition-colors ${
                  player.speed === s ? "bg-slate-200 font-semibold text-slate-900" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
