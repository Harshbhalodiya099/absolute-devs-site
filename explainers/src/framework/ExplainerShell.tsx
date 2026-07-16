import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExplainerDef } from "./types";
import { SpeedContext } from "./speed";

const SPEEDS = [0.5, 1, 1.5, 2];

export function ExplainerShell({
  explainer,
  Intro,
}: {
  explainer: ExplainerDef;
  Intro: React.FC<{ onBegin: () => void }>;
}) {
  // ?scene=N deep-links straight into a scene (1-based), skipping the intro.
  const initialScene = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get("scene");
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 1 && n <= explainer.scenes.length ? n - 1 : null;
  }, [explainer.scenes.length]);
  const [started, setStarted] = useState(initialScene !== null);
  const [index, setIndex] = useState(initialScene ?? 0);
  const [speed, setSpeed] = useState(1);
  const [replayKey, setReplayKey] = useState(0);
  const [showTakeaway, setShowTakeaway] = useState(false);
  const [direction, setDirection] = useState(1);

  const scenes = explainer.scenes;
  const scene = scenes[index];

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= scenes.length) return;
      setDirection(next > index ? 1 : -1);
      setIndex(next);
      setShowTakeaway(false);
      setReplayKey((k) => k + 1);
    },
    [index, scenes.length],
  );

  const replay = useCallback(() => {
    setShowTakeaway(false);
    setReplayKey((k) => k + 1);
  }, []);

  // Reveal the takeaway once the scene's choreography has played out.
  useEffect(() => {
    if (!started) return;
    const ms = (scene.duration / speed) * 1000;
    const id = window.setTimeout(() => setShowTakeaway(true), ms);
    return () => window.clearTimeout(id);
  }, [started, index, replayKey, speed, scene.duration]);

  // Keyboard: ← → navigate, R replays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started) return;
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key.toLowerCase() === "r") replay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, index, go, replay]);

  const progress = useMemo(() => (index + 1) / scenes.length, [index, scenes.length]);

  if (!started) {
    return (
      <MotionConfig reducedMotion="user">
        <Intro onBegin={() => setStarted(true)} />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <SpeedContext.Provider value={speed}>
        <div className="flex min-h-dvh flex-col">
          {/* top rail */}
          <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-4 text-xs tracking-wide text-slate-400">
            <span className="font-medium text-slate-300">{explainer.title}</span>
            <span className="tabular-nums">
              {String(index + 1).padStart(2, "0")} / {scenes.length}
            </span>
          </header>

          {/* scene */}
          <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.section
                key={`${index}-${replayKey}`}
                custom={direction}
                initial={{ opacity: 0, x: direction * 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -32 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="flex w-full flex-1 flex-col items-center"
              >
                <div className="w-full pt-5 pb-3 text-center">
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
                    transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="mx-auto mt-3 max-w-2xl text-balance text-2xl font-semibold tracking-tight text-slate-100 sm:text-[2rem] sm:leading-tight"
                  >
                    {scene.title}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.45 }}
                    className="mx-auto mt-2 max-w-xl text-pretty text-sm leading-relaxed text-slate-400"
                  >
                    {scene.narration}
                  </motion.p>
                </div>

                <div className="flex w-full flex-1 items-center justify-center py-2">
                  <scene.Component />
                </div>

                {/* What just happened? */}
                <div className="flex min-h-20 w-full items-start justify-center pb-1">
                  <AnimatePresence>
                    {showTakeaway && (
                      <motion.aside
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="glass max-w-xl rounded-2xl px-5 py-4 text-center"
                      >
                        <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
                          What just happened?
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{scene.whatHappened}</p>
                      </motion.aside>
                    )}
                  </AnimatePresence>
                </div>
              </motion.section>
            </AnimatePresence>
          </main>

          {/* controls */}
          <footer className="mx-auto w-full max-w-5xl px-6 pb-4">
            {/* timeline */}
            <div className="mb-3 flex items-center gap-1.5" role="tablist" aria-label="Scenes">
              {scenes.map((s, i) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Scene ${i + 1}: ${s.title}`}
                  title={s.title}
                  onClick={() => go(i)}
                  className="group relative h-4 flex-1 cursor-pointer"
                >
                  <span
                    className={`absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full transition-all duration-300 ${
                      i < index
                        ? "bg-teal-400/50"
                        : i === index
                          ? "bg-teal-300"
                          : "bg-slate-700 group-hover:bg-slate-500"
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ControlButton onClick={() => go(index - 1)} disabled={index === 0} label="Previous scene">
                  ← Back
                </ControlButton>
                <ControlButton onClick={replay} label="Replay scene (R)">
                  ↻ Replay
                </ControlButton>
                <div className="ml-1 flex items-center rounded-full border border-slate-700/70 p-0.5">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSpeed(s);
                        replay();
                      }}
                      aria-pressed={speed === s}
                      className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] tabular-nums transition-colors ${
                        speed === s ? "bg-slate-200 font-semibold text-slate-900" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>

              {index < scenes.length - 1 ? (
                <motion.button
                  onClick={() => go(index + 1)}
                  animate={showTakeaway ? { scale: [1, 1.03, 1] } : {}}
                  transition={{ repeat: showTakeaway ? Infinity : 0, repeatDelay: 2.4, duration: 0.7 }}
                  className="cursor-pointer rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_0_24px_rgba(94,234,212,0.15)] transition-all hover:bg-white hover:shadow-[0_0_32px_rgba(94,234,212,0.3)]"
                >
                  {scene.nextPrompt} →
                </motion.button>
              ) : (
                <button
                  onClick={() => {
                    setStarted(false);
                    setIndex(0);
                    setShowTakeaway(false);
                    setReplayKey((k) => k + 1);
                  }}
                  className="cursor-pointer rounded-full border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-400"
                >
                  ↺ Start the journey again
                </button>
              )}
            </div>

            <div className="sr-only" aria-live="polite">
              Scene {index + 1} of {scenes.length}: {scene.title}. {showTakeaway ? scene.whatHappened : ""}
            </div>
            <motion.div
              className="mt-3 h-px w-full origin-left bg-gradient-to-r from-teal-400/60 to-sky-400/20"
              animate={{ scaleX: progress }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </footer>
        </div>
      </SpeedContext.Provider>
    </MotionConfig>
  );
}

function ControlButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="cursor-pointer rounded-full border border-slate-700/70 px-3.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
