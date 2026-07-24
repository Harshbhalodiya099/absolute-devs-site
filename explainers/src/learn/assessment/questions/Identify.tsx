/**
 * `identify` — point at the right part of a diagram.
 *
 * This is the question type that pays for the shared vocabulary: the cards are
 * drawn with the same `Glyph` + `accent` the animation engine draws its actors
 * with, so a cache in the quiz is the same violet lightning bolt it was in the
 * story. No new visual system, which is why this type is cheap (plan §9).
 */
import { accent, C, Glyph } from "../../../vocab";
import { RadioGroup } from "../RadioGroup";
import type { IdentifyQuestion, Verdict } from "../types";

export function Identify({
  question,
  pick,
  onPick,
  verdict,
}: {
  question: IdentifyQuestion;
  pick: string | null;
  onPick: (id: string) => void;
  verdict: Verdict | null;
}) {
  const graded = verdict !== null;
  const value = pick === null ? null : question.parts.findIndex((p) => p.id === pick);

  return (
    <RadioGroup
      ariaLabel={question.prompt}
      count={question.parts.length}
      value={value === -1 ? null : value}
      onChange={(i) => onPick(question.parts[i].id)}
      disabled={graded}
      className="flex w-full flex-wrap items-stretch justify-center gap-2.5"
      renderOption={(i, radio) => {
        const part = question.parts[i];
        const picked = pick === part.id;
        const isAnswer = part.id === question.answer;
        const state = !graded ? (picked ? "picked" : "idle") : isAnswer ? "right" : picked ? "wrong" : "muted";
        const color = accent(part.accent);
        return (
          <button
            key={part.id}
            {...radio}
            className={`flex w-36 cursor-pointer flex-col items-center gap-1 rounded-2xl border px-3 py-3 text-center transition-colors focus-visible:ring-2 focus-visible:ring-teal-300/60 focus-visible:outline-none disabled:cursor-default ${CARD[state]}`}
          >
            <svg viewBox="-22 -22 44 44" className="size-9" aria-hidden focusable="false">
              <Glyph name={part.glyph} color={state === "muted" ? C.faint : color} />
            </svg>
            <span className="text-[13px] leading-snug font-semibold text-slate-100">{part.label}</span>
            {part.sub && <span className="text-[11px] leading-snug text-slate-500">{part.sub}</span>}
            {graded && (isAnswer || picked) && (
              <span
                aria-hidden
                className={`text-[11px] font-semibold ${isAnswer ? "text-emerald-300" : "text-rose-300"}`}
              >
                {isAnswer ? "✓ this one" : "✗ your pick"}
              </span>
            )}
          </button>
        );
      }}
    />
  );
}

const CARD: Record<string, string> = {
  idle: "border-slate-700/70 bg-white/[0.02] hover:border-slate-500",
  picked: "border-teal-300/60 bg-white/[0.05]",
  right: "border-emerald-300/60 bg-emerald-300/[0.06]",
  wrong: "border-rose-300/60 bg-rose-300/[0.06]",
  muted: "border-slate-800 opacity-60",
};
