/**
 * `mcq` — pick one of several options.
 *
 * Before grading, the only state is "which option is selected". After grading
 * the same rows carry the verdict: the learner's pick is marked, and when it
 * was wrong the right one is marked too. Nothing moves; the answer arrives in
 * place, which is what makes it readable.
 */
import type { McqQuestion, Verdict } from "../types";
import { RadioGroup } from "../RadioGroup";

export function Mcq({
  question,
  choice,
  onChoose,
  verdict,
}: {
  question: McqQuestion;
  choice: number | null;
  onChoose: (i: number) => void;
  verdict: Verdict | null;
}) {
  const graded = verdict !== null;

  return (
    <RadioGroup
      ariaLabel={question.prompt}
      count={question.options.length}
      value={choice}
      onChange={onChoose}
      disabled={graded}
      className="flex w-full flex-col gap-2"
      renderOption={(i, radio) => {
        const picked = choice === i;
        const isAnswer = i === question.answer;
        const state = !graded ? (picked ? "picked" : "idle") : isAnswer ? "right" : picked ? "wrong" : "muted";
        return (
          <button
            key={i}
            {...radio}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-teal-300/60 focus-visible:outline-none disabled:cursor-default ${STYLE[state]}`}
          >
            <span
              aria-hidden
              className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${BADGE[state]}`}
            >
              {state === "right" ? "✓" : state === "wrong" ? "✗" : i + 1}
            </span>
            <span className="text-pretty leading-relaxed">{question.options[i]}</span>
          </button>
        );
      }}
    />
  );
}

const STYLE: Record<string, string> = {
  idle: "border-slate-700/70 text-slate-300 hover:border-slate-500 hover:text-slate-100",
  picked: "border-teal-300/60 bg-white/[0.05] text-slate-100",
  right: "border-emerald-300/60 bg-emerald-300/[0.06] text-slate-100",
  wrong: "border-rose-300/60 bg-rose-300/[0.06] text-slate-200",
  muted: "border-slate-800 text-slate-500",
};

const BADGE: Record<string, string> = {
  idle: "border border-slate-700 text-slate-500",
  picked: "bg-teal-300 text-slate-900",
  right: "bg-emerald-300 text-slate-900",
  wrong: "bg-rose-300 text-slate-900",
  muted: "border border-slate-800 text-slate-600",
};
