import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

/**
 * An underlined term that reveals a deeper explanation on hover/focus.
 * Used inside stage captions for the "hover for more" layer of the story.
 */
export function Term({ children, tip }: { children: ReactNode; tip: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="cursor-help rounded-sm underline decoration-teal-400/50 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-teal-300/60"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {children}
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="glass absolute bottom-full left-1/2 z-20 mb-2 block w-64 -translate-x-1/2 rounded-xl px-4 py-3 text-left text-xs leading-relaxed font-normal text-slate-300 shadow-xl"
          >
            {tip}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
