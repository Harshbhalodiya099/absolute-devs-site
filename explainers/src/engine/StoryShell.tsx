import { AnimatePresence, MotionConfig, motion, useMotionValueEvent } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compileScene } from "./timeline";
import { usePlayer, type Player } from "./player";
import { Stage } from "./Stage";
import type { Params, SceneDef, StoryDef } from "./types";

const SPEEDS = [0.25, 0.5, 1, 2];
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * The chrome around any story: intro, narrative header, stage, step captions,
 * inspector line, params, scrubber, controls, takeaway. Topic-agnostic.
 */
export function StoryShell({ story }: { story: StoryDef }) {
  const initialScene = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get("scene");
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 1 && n <= story.scenes.length ? n - 1 : null;
  }, [story.scenes.length]);

  const [started, setStarted] = useState(initialScene !== null);
  const [index, setIndex] = useState(initialScene ?? 0);
  const [direction, setDirection] = useState(1);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= story.scenes.length) return;
      setDirection(next > index ? 1 : -1);
      setIndex(next);
    },
    [index, story.scenes.length],
  );

  if (!started) {
    return (
      <MotionConfig reducedMotion="user">
        <Intro story={story} onBegin={() => setStarted(true)} />
      </MotionConfig>
    );
  }

  const scene = story.scenes[index];
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-5 text-xs tracking-wide text-slate-400">
        <span className="font-medium text-slate-300">{story.title}</span>
        <span className="tabular-nums">
          {String(index + 1).padStart(2, "0")} / {story.scenes.length}
        </span>
      </header>
      <ScenePlayer
        key={scene.id}
        scene={scene}
        direction={direction}
        onPrev={index > 0 ? () => go(index - 1) : undefined}
        onNext={index < story.scenes.length - 1 ? () => go(index + 1) : undefined}
        onRestart={() => {
          setStarted(false);
          setIndex(0);
        }}
        sceneMeta={{ index, total: story.scenes.length, goTo: go, titles: story.scenes.map((s) => s.title) }}
      />
    </div>
  );
}

/* ================= one scene: compile → play ================= */

function ScenePlayer({
  scene,
  direction,
  onPrev,
  onNext,
  onRestart,
  sceneMeta,
}: {
  scene: SceneDef;
  direction: number;
  onPrev?: () => void;
  onNext?: () => void;
  onRestart: () => void;
  sceneMeta: { index: number; total: number; goTo: (i: number) => void; titles: string[] };
}) {
  const [params, setParams] = useState<Params>(() =>
    Object.fromEntries((scene.params ?? []).map((p) => [p.id, p.initial])),
  );
  const paramsKey = JSON.stringify(params);

  const compiled = useMemo(() => {
    const content = typeof scene.content === "function" ? scene.content(params) : scene.content;
    return compileScene(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, paramsKey]);

  const player = usePlayer(compiled.duration, compiled.markers, `${scene.id}|${paramsKey}`);
  const [note, setNote] = useState<string | null>(null);

  // Keyboard: space play/pause, ←/→ step, shift+←/→ scene, R replay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(input|textarea|button|select)$/i.test(e.target.tagName)) return;
      if (e.key === " ") {
        e.preventDefault();
        player.toggle();
      } else if (e.key === "ArrowRight") (e.shiftKey ? onNext : player.stepForward)?.();
      else if (e.key === "ArrowLeft") (e.shiftKey ? onPrev : player.stepBack)?.();
      else if (e.key.toLowerCase() === "r") player.replay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, onNext, onPrev]);

  const caption = compiled.captions[player.stepIndex] ?? "";

  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6">
        <motion.section
          initial={{ opacity: 0, x: direction * 32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
          className="flex w-full flex-1 flex-col items-center"
        >
          {/* narrative header */}
          <div className="w-full pt-7 pb-3 text-center">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-[11px] font-semibold tracking-[0.22em] text-teal-300/80 uppercase"
            >
              {scene.chapter} · {scene.question}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: EASE_OUT }}
              className="mx-auto mt-3 max-w-2xl text-balance text-2xl font-semibold tracking-tight text-slate-100 sm:text-[1.9rem] sm:leading-tight"
            >
              {scene.title}
            </motion.h1>
          </div>

          {/* params */}
          {scene.params && (
            <div className="flex flex-wrap items-center justify-center gap-4 pb-2">
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

          {/* stage */}
          <div className="flex w-full flex-1 items-center justify-center py-1">
            <Stage scene={compiled} time={player.time} ariaLabel={scene.title} onInspect={setNote} />
          </div>

          {/* step caption + inspector line */}
          <div className="flex min-h-16 w-full flex-col items-center gap-1.5 pb-1 text-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={player.stepIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
                className="max-w-xl text-pretty text-sm leading-relaxed text-slate-400"
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
          </div>

          {/* takeaway */}
          <div className="flex min-h-24 w-full items-start justify-center pb-2">
            <AnimatePresence>
              {player.ended && (
                <motion.aside
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE_OUT }}
                  className="glass max-w-xl rounded-2xl px-5 py-4 text-center"
                >
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
                    What just happened?
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{scene.takeaway}</p>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </motion.section>
      </main>

      {/* transport */}
      <footer className="mx-auto w-full max-w-5xl px-6 pb-5">
        <Scrubber player={player} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <ControlButton onClick={player.toggle} label={player.playing ? "Pause (space)" : "Play (space)"} wide>
              {player.playing ? "❚❚" : "▶"}
            </ControlButton>
            <ControlButton onClick={player.stepBack} label="Previous step (←)">
              ⇤
            </ControlButton>
            <ControlButton onClick={player.stepForward} label="Next step (→)">
              ⇥
            </ControlButton>
            <ControlButton onClick={player.replay} label="Replay scene (R)">
              ↻
            </ControlButton>
            <div className="ml-1.5 flex items-center rounded-full border border-slate-700/70 p-0.5">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => player.setSpeed(s)}
                  aria-pressed={player.speed === s}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] tabular-nums transition-colors ${
                    player.speed === s
                      ? "bg-slate-200 font-semibold text-slate-900"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onPrev && (
              <button
                onClick={onPrev}
                className="cursor-pointer rounded-full border border-slate-700/70 px-4 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
              >
                ← Back
              </button>
            )}
            {onNext ? (
              <motion.button
                onClick={onNext}
                animate={player.ended ? { scale: [1, 1.03, 1] } : {}}
                transition={{ repeat: player.ended ? Infinity : 0, repeatDelay: 2.4, duration: 0.7 }}
                className="cursor-pointer rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_0_24px_rgba(94,234,212,0.15)] transition-all hover:bg-white hover:shadow-[0_0_32px_rgba(94,234,212,0.3)]"
              >
                {scene.nextPrompt} →
              </motion.button>
            ) : (
              <button
                onClick={onRestart}
                className="cursor-pointer rounded-full border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-400"
              >
                ↺ {scene.nextPrompt || "Start again"}
              </button>
            )}
          </div>
        </div>

        {/* scene dots */}
        <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="Scenes">
          {Array.from({ length: sceneMeta.total }, (_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === sceneMeta.index}
              aria-label={`Scene ${i + 1}: ${sceneMeta.titles[i]}`}
              title={sceneMeta.titles[i]}
              onClick={() => sceneMeta.goTo(i)}
              className={`h-1.5 cursor-pointer rounded-full transition-all duration-300 ${
                i === sceneMeta.index ? "w-6 bg-teal-300" : "w-1.5 bg-slate-700 hover:bg-slate-500"
              }`}
            />
          ))}
        </div>

        <div className="sr-only" aria-live="polite">
          {scene.title}. {caption} {player.ended ? scene.takeaway : ""}
        </div>
      </footer>
    </>
  );
}

/* ================= scrubber ================= */

export function Scrubber({ player }: { player: Player }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasPlaying = useRef(false);

  useMotionValueEvent(player.time, "change", (t) => {
    const pct = player.duration > 0 ? (t / player.duration) * 100 : 0;
    if (fillRef.current) fillRef.current.style.width = `${pct}%`;
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = String(t);
    }
  });
  useEffect(() => {
    const t = player.time.get();
    if (fillRef.current) fillRef.current.style.width = `${(t / player.duration) * 100}%`;
  });

  return (
    <div className="group relative h-5 w-full">
      <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-slate-800">
        <div ref={fillRef} className="h-full rounded-full bg-gradient-to-r from-teal-400/80 to-sky-400/70" />
      </div>
      {/* step ticks */}
      {player.markers.map((m, i) =>
        i === 0 ? null : (
          <span
            key={i}
            className="absolute top-1/2 h-[7px] w-px -translate-y-1/2 bg-slate-600"
            style={{ left: `${(m / player.duration) * 100}%` }}
          />
        ),
      )}
      <input
        ref={inputRef}
        type="range"
        min={0}
        max={player.duration}
        step={0.01}
        defaultValue={0}
        aria-label="Timeline"
        onPointerDown={() => {
          wasPlaying.current = player.playing;
          player.pause();
        }}
        onPointerUp={() => {
          if (wasPlaying.current) player.play();
        }}
        onChange={(e) => player.seek(Number(e.target.value))}
        className="scrubber absolute inset-0 w-full cursor-pointer opacity-0 focus-visible:opacity-100"
      />
    </div>
  );
}

/* ================= controls ================= */

export function ControlButton({
  children,
  onClick,
  label,
  wide,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`cursor-pointer rounded-full border border-slate-700/70 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 ${
        wide ? "px-4" : "px-3"
      }`}
    >
      {children}
    </button>
  );
}

/* ================= intro ================= */

function Intro({ story, onBegin }: { story: StoryDef; onBegin: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-[11px] font-semibold tracking-[0.26em] text-teal-300/80 uppercase"
      >
        {story.intro.eyebrow}
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.7, ease: EASE_OUT }}
        className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-slate-100 sm:text-5xl sm:leading-tight"
      >
        {story.intro.title}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="mt-5 max-w-xl text-pretty text-sm leading-relaxed text-slate-400 sm:text-base"
      >
        {story.intro.lead}
      </motion.p>
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.6, ease: EASE_OUT }}
        onClick={onBegin}
        className="mt-10 cursor-pointer rounded-full bg-slate-100 px-7 py-3 text-sm font-semibold text-slate-900 shadow-[0_0_32px_rgba(94,234,212,0.2)] transition-all hover:bg-white hover:shadow-[0_0_44px_rgba(94,234,212,0.35)]"
      >
        {story.intro.begin} →
      </motion.button>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        className="mt-6 text-xs text-slate-600"
      >
        space to pause · ← → to step · drag the timeline to scrub
      </motion.p>
      {story.scenes.some((s) => s.prose?.length) && (
        <motion.a
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          href="?read"
          className="mt-8 text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-slate-300"
        >
          prefer reading? open this as an essay
        </motion.a>
      )}
    </div>
  );
}
