/**
 * `order` — put the steps of a process back in the right sequence.
 *
 * Reordering is done with per-row move buttons rather than drag-and-drop, on
 * purpose: it is operable by keyboard, touch and mouse with one implementation,
 * and every move is announced. Rows are keyed by *step identity*, so React
 * moves the existing DOM node — focus follows the row the learner is moving,
 * and `layout` animates it with the same easing the story uses.
 */
import { motion } from "motion/react";
import { useRef } from "react";
import type { OrderQuestion, Verdict } from "../types";

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function Order({
  question,
  order,
  onReorder,
  verdict,
}: {
  question: OrderQuestion;
  /** Indices into `question.steps`, in the order shown. */
  order: number[];
  onReorder: (next: number[]) => void;
  verdict: Verdict | null;
}) {
  const graded = verdict !== null;
  const announce = useRef<HTMLParagraphElement>(null);

  const move = (pos: number, dir: -1 | 1) => {
    const to = pos + dir;
    if (graded || to < 0 || to >= order.length) return;
    const next = order.slice();
    [next[pos], next[to]] = [next[to], next[pos]];
    onReorder(next);
    if (announce.current) {
      announce.current.textContent = `${question.steps[order[pos]]} moved to position ${to + 1} of ${order.length}.`;
    }
  };

  const misplaced = new Set(verdict?.misplaced ?? []);

  return (
    <div className="w-full">
      <ol className="flex w-full flex-col gap-2">
        {order.map((step, pos) => {
          const state = !graded ? "idle" : misplaced.has(pos) ? "wrong" : "right";
          return (
            <motion.li
              key={step}
              layout
              transition={{ duration: 0.28, ease: EASE_OUT }}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition-colors ${ROW[state]}`}
            >
              <span
                aria-hidden
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${BADGE[state]}`}
              >
                {state === "right" ? "✓" : state === "wrong" ? "✗" : pos + 1}
              </span>
              <span className="flex-1 text-pretty leading-relaxed">{question.steps[step]}</span>
              {!graded && (
                <span className="flex shrink-0 items-center gap-1">
                  <MoveButton
                    dir={-1}
                    disabled={pos === 0}
                    onMove={() => move(pos, -1)}
                    label={`Move “${question.steps[step]}” earlier`}
                  />
                  <MoveButton
                    dir={1}
                    disabled={pos === order.length - 1}
                    onMove={() => move(pos, 1)}
                    label={`Move “${question.steps[step]}” later`}
                  />
                </span>
              )}
            </motion.li>
          );
        })}
      </ol>
      <p ref={announce} aria-live="polite" className="sr-only" />
    </div>
  );
}

/**
 * Boundary buttons are `aria-disabled`, not `disabled`: a genuinely disabled
 * button drops keyboard focus the moment a row reaches the top or bottom, which
 * is exactly when the learner is still working.
 */
function MoveButton({
  dir,
  disabled,
  onMove,
  label,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onMove: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled}
      onClick={() => !disabled && onMove()}
      className={`flex size-7 cursor-pointer items-center justify-center rounded-full border border-slate-700/70 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-teal-300/60 focus-visible:outline-none ${
        disabled ? "cursor-default text-slate-700" : "text-slate-400 hover:border-slate-500 hover:text-slate-100"
      }`}
    >
      {dir === -1 ? "↑" : "↓"}
    </button>
  );
}

const ROW: Record<string, string> = {
  idle: "border-slate-700/70 text-slate-300",
  right: "border-emerald-300/50 bg-emerald-300/[0.05] text-slate-100",
  wrong: "border-rose-300/50 bg-rose-300/[0.05] text-slate-200",
};

const BADGE: Record<string, string> = {
  idle: "border border-slate-700 text-slate-500",
  right: "bg-emerald-300 text-slate-900",
  wrong: "bg-rose-300 text-slate-900",
};
