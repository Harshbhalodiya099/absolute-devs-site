/**
 * The quiz runner — one question at a time, answer, immediate feedback, next.
 *
 * It is deliberately **not** a game: no points, no streaks, no celebration. The
 * only feedback is whether the answer was right and *why*, because the
 * explanation is the reason the quiz exists at all. The summary reports how
 * many are right and offers to re-ask the ones that aren't.
 *
 * All grading goes through `evaluate()`; this component holds no correctness
 * logic of its own, and no knowledge of any topic.
 */
import { motion, MotionConfig } from "motion/react";
import { useMemo, useState } from "react";
import { evaluate, score, shuffledOrder, usableQuestions } from "./evaluate";
import { Identify } from "./questions/Identify";
import { Mcq } from "./questions/Mcq";
import { Order } from "./questions/Order";
import type { Assessment, Question, Response, Verdict } from "./types";

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** The response a question starts from: order questions start pre-arranged. */
function initialDraft(q: Question | undefined): Response | null {
  if (q?.type === "order") return { type: "order", order: shuffledOrder(q.id, q.steps.length) };
  return null;
}

export function QuizView({
  assessment,
  onReviewStory,
}: {
  assessment: Assessment;
  /** Offered on the summary when the explainer also has a story mode. */
  onReviewStory?: () => void;
}) {
  // Malformed questions are dropped rather than blanking the page (see evaluate).
  const questions = useMemo(() => usableQuestions(assessment.questions), [assessment]);

  const [queue, setQueue] = useState<Question[]>(questions);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Response | null>(() => initialDraft(questions[0]));
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [done, setDone] = useState(false);

  const question = queue[index];

  const start = (next: Question[]) => {
    setQueue(next);
    setIndex(0);
    setDraft(initialDraft(next[0]));
    setVerdict(null);
    setDone(false);
  };

  const submit = () => {
    if (!question || !draft || verdict) return;
    const v = evaluate(question, draft);
    setVerdict(v);
    setVerdicts((prev) => ({ ...prev, [question.id]: v }));
  };

  const advance = () => {
    if (index + 1 < queue.length) {
      const next = queue[index + 1];
      setIndex(index + 1);
      setDraft(initialDraft(next));
      setVerdict(null);
    } else {
      setDone(true);
    }
  };

  if (questions.length === 0) {
    return (
      <Frame>
        <p className="text-sm text-slate-400">This quiz has no questions yet.</p>
      </Frame>
    );
  }

  if (done) {
    const missed = questions.filter((q) => verdicts[q.id] && !verdicts[q.id].correct);
    const { correct, total } = score(questions.map((q) => verdicts[q.id]).filter(Boolean));
    return (
      <Frame>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="w-full"
        >
          <Eyebrow>How you did</Eyebrow>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
            {correct} of {total} right.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {missed.length === 0
              ? "Every one. The explanations are worth a second read anyway — they say a little more than the questions asked."
              : "The ones below are worth another look. Re-asking them is not a punishment; it's how the explanation sticks."}
          </p>

          <ul className="mt-6 flex flex-col gap-2">
            {questions.map((q) => {
              const v = verdicts[q.id];
              return (
                <li key={q.id} className="flex items-start gap-3 text-sm">
                  <span
                    aria-hidden
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      !v
                        ? "border border-slate-800 text-slate-600"
                        : v.correct
                          ? "bg-emerald-300 text-slate-900"
                          : "bg-rose-300 text-slate-900"
                    }`}
                  >
                    {!v ? "–" : v.correct ? "✓" : "✗"}
                  </span>
                  <span className={`text-pretty leading-relaxed ${v?.correct ? "text-slate-400" : "text-slate-300"}`}>
                    <span className="sr-only">{!v ? "Not answered: " : v.correct ? "Correct: " : "Incorrect: "}</span>
                    {q.prompt}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            {missed.length > 0 && (
              <button type="button" onClick={() => start(missed)} className={PRIMARY}>
                Retry {missed.length === 1 ? "that one" : `those ${missed.length}`} →
              </button>
            )}
            <button type="button" onClick={() => start(questions)} className={SECONDARY}>
              ↺ Start the quiz again
            </button>
            {onReviewStory && (
              <button type="button" onClick={onReviewStory} className={SECONDARY}>
                ← Back to the story
              </button>
            )}
          </div>
        </motion.div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="flex w-full items-center justify-between gap-4">
        <Eyebrow>{assessment.title ?? "Check your understanding"}</Eyebrow>
        <span className="text-[11px] tabular-nums text-slate-500">
          Question {index + 1} of {queue.length}
        </span>
      </div>
      {assessment.lead && index === 0 && !verdict && (
        <p className="mt-2 w-full text-pretty text-sm leading-relaxed text-slate-400">{assessment.lead}</p>
      )}

      <form
        className="mt-6 w-full"
        onSubmit={(e) => {
          e.preventDefault();
          if (verdict) advance();
          else submit();
        }}
        // Options are `type="button"` (a click must select, not submit), so
        // Enter on one would do nothing. Answering by keyboard alone is the
        // whole point of the number-key shortcuts — Enter has to submit.
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).getAttribute("role") === "radio") {
            e.preventDefault();
            e.currentTarget.requestSubmit();
          }
        }}
      >
        {/* Keyed: a new question remounts and animates in. No exit transition —
            two questions must never be on screen at once. */}
        <motion.div
          key={question.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="w-full"
        >
          <h2 className="mb-4 text-pretty text-lg leading-snug font-semibold tracking-tight text-slate-100">
            {question.prompt}
          </h2>

          {question.type === "mcq" && (
            <Mcq
              question={question}
              choice={draft?.type === "mcq" ? draft.choice : null}
              onChoose={(choice) => setDraft({ type: "mcq", choice })}
              verdict={verdict}
            />
          )}
          {question.type === "order" && (
            <Order
              question={question}
              order={draft?.type === "order" ? draft.order : shuffledOrder(question.id, question.steps.length)}
              onReorder={(order) => setDraft({ type: "order", order })}
              verdict={verdict}
            />
          )}
          {question.type === "identify" && (
            <Identify
              question={question}
              pick={draft?.type === "identify" ? draft.pick : null}
              onPick={(pick) => setDraft({ type: "identify", pick })}
              verdict={verdict}
            />
          )}
        </motion.div>

        {/* feedback: the point of the whole exercise */}
        <div aria-live="polite" className="min-h-24">
          {verdict && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className={`mt-5 rounded-2xl border px-4 py-3.5 ${
                verdict.correct
                  ? "border-emerald-300/30 bg-emerald-300/[0.04]"
                  : "border-rose-300/30 bg-rose-300/[0.04]"
              }`}
            >
              <p
                className={`text-[11px] font-semibold tracking-[0.2em] uppercase ${
                  verdict.correct ? "text-emerald-300/90" : "text-rose-300/90"
                }`}
              >
                {verdict.correct ? "Correct" : "Not quite"}
              </p>
              <p className="mt-1.5 text-pretty text-sm leading-relaxed text-slate-300">{verdict.explain}</p>
              {!verdict.correct && question.type === "order" && (
                <ol className="mt-3 flex flex-col gap-1 text-xs text-slate-400">
                  {question.steps.map((s, n) => (
                    <li key={s}>
                      <span className="mr-2 tabular-nums text-slate-600">{n + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              )}
            </motion.div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <Dots total={queue.length} index={index} />
          <button type="submit" disabled={!verdict && !draft} className={PRIMARY}>
            {!verdict ? "Check answer" : index + 1 < queue.length ? "Next question →" : "See how you did →"}
          </button>
        </div>
      </form>
    </Frame>
  );
}

/* ================= chrome ================= */

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-start px-6 py-10">{children}</div>
    </MotionConfig>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold tracking-[0.22em] text-teal-300/80 uppercase">{children}</p>;
}

/** The same progress language the story uses for scenes — status, not buttons. */
function Dots({ total, index }: { total: number; index: number }) {
  return (
    <div aria-hidden className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === index ? "w-6 bg-teal-300" : i < index ? "w-1.5 bg-slate-600" : "w-1.5 bg-slate-800"
          }`}
        />
      ))}
    </div>
  );
}

const PRIMARY =
  "cursor-pointer rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500";
const SECONDARY =
  "cursor-pointer rounded-full border border-slate-700/70 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100";
