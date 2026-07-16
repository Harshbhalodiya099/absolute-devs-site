import { motion } from "motion/react";
import { library } from "../stories";

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Story URLs are path-based: /learn/<slug> (+ ?read for essay mode).
const storyHref = (slug: string) => `${import.meta.env.BASE_URL}${slug}`;

/** The index of every explainer. Grows automatically as stories are added. */
export function Library() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 py-16">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-[11px] font-semibold tracking-[0.26em] text-teal-300/80 uppercase"
      >
        Interactive explainers
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6, ease: EASE_OUT }}
        className="mt-4 max-w-xl text-balance text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl"
      >
        Systems, explained in motion.
      </motion.h1>
      <div className="mt-10 flex flex-col gap-4">
        {library.map((m, i) => (
          <motion.a
            key={m.slug}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08, duration: 0.5, ease: EASE_OUT }}
            href={storyHref(m.slug)}
            className="glass group rounded-2xl px-6 py-5 transition-colors hover:border-slate-500"
          >
            <p className="text-lg font-semibold text-slate-100 transition-colors group-hover:text-white">{m.title}</p>
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-400">{m.intro.lead}</p>
            <p className="mt-3 text-xs font-medium text-teal-300/80">
              {m.intro.begin} → <span className="ml-3 text-slate-500">or</span>{" "}
              <span
                role="link"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `${storyHref(m.slug)}?read`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") window.location.href = `${storyHref(m.slug)}?read`;
                }}
                className="text-slate-400 underline decoration-slate-700 underline-offset-4 hover:text-slate-200"
              >
                read it as an essay
              </span>
            </p>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
