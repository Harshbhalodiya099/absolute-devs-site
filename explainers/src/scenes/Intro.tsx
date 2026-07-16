import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

const URL = "google.com";

/**
 * The opening shot: an empty dark screen, an address bar, and one action.
 * Types out "google.com" and waits for Enter.
 */
export function Intro({ onBegin }: { onBegin: () => void }) {
  const [typed, setTyped] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const done = typed >= URL.length;

  useEffect(() => {
    if (done) return;
    const id = window.setTimeout(() => setTyped((n) => n + 1), typed === 0 ? 900 : 110);
    return () => window.clearTimeout(id);
  }, [typed, done]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && done) begin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const begin = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onBegin, 650);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <AnimatePresence>
        {!leaving && (
          <motion.div
            exit={{ opacity: 0, scale: 1.06, filter: "blur(6px)" }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.6, 1] }}
            className="flex w-full flex-col items-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="glass flex w-full max-w-xl items-center gap-3 rounded-2xl px-5 py-4"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="6.5" stroke="#4a5165" strokeWidth="1.4" />
                <path d="M8 1.5v13M1.5 8h13" stroke="#4a5165" strokeWidth="1.4" />
              </svg>
              <span className="font-mono text-lg tracking-tight text-slate-100">
                {URL.slice(0, typed)}
                <motion.span
                  aria-hidden
                  animate={{ opacity: [1, 1, 0, 0] }}
                  transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
                  className="ml-px inline-block h-5 w-[2px] translate-y-[3px] bg-teal-300"
                />
              </span>
            </motion.div>

            <div className="mt-10 flex h-16 flex-col items-center">
              <AnimatePresence>
                {done && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.7 }}
                    onClick={begin}
                    className="group cursor-pointer text-sm text-slate-400 transition-colors hover:text-slate-200"
                  >
                    press{" "}
                    <kbd className="mx-1 rounded-md border border-slate-600 bg-slate-800/60 px-2 py-1 font-mono text-xs text-slate-200 transition-shadow group-hover:shadow-[0_0_16px_rgba(94,234,212,0.25)]">
                      Enter ↵
                    </kbd>{" "}
                    to follow what happens next
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.4, duration: 1.2 }}
              className="mt-16 max-w-sm text-center text-xs leading-relaxed text-slate-600"
            >
              In the next half-second, this one line of text will cross the planet and come back.
              You're about to watch it happen — slowly.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
