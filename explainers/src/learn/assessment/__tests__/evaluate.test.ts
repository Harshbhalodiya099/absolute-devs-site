/**
 * The Assessment engine's grading half: pure, deterministic, topic-blind.
 * If any test here needs a DOM or a clock, the engine has drifted.
 */
import { describe, expect, it, vi } from "vitest";
import {
  evaluate,
  score,
  shuffledOrder,
  usableQuestions,
  validateAssessment,
  validateQuestion,
} from "../evaluate";
import type { IdentifyQuestion, McqQuestion, OrderQuestion, Question } from "../types";

const mcq: McqQuestion = {
  id: "m1",
  type: "mcq",
  prompt: "Where does the browser look first?",
  options: ["Root server", "Its own cache", "The registry"],
  answer: 1,
  explain: "Local caches come first.",
};

const order: OrderQuestion = {
  id: "o1",
  type: "order",
  prompt: "Order the walk.",
  steps: ["ask resolver", "ask root", "ask registry", "ask google"],
  explain: "Each level knows who to ask next.",
};

const identify: IdentifyQuestion = {
  id: "i1",
  type: "identify",
  prompt: "Who is authoritative?",
  parts: [
    { id: "resolver", glyph: "server", label: "Resolver" },
    { id: "auth", glyph: "server", label: "ns1.google.com", accent: "green" },
  ],
  answer: "auth",
  explain: "Only the authoritative server holds the answer.",
};

describe("evaluate · mcq", () => {
  it("accepts the authored answer index", () => {
    expect(evaluate(mcq, { type: "mcq", choice: 1 })).toEqual({ correct: true, explain: mcq.explain });
  });

  it("rejects every other option, and still explains", () => {
    for (const choice of [0, 2]) {
      const v = evaluate(mcq, { type: "mcq", choice });
      expect(v.correct).toBe(false);
      expect(v.explain).toBe(mcq.explain);
    }
  });

  it("treats an out-of-range choice as wrong, not as a crash", () => {
    expect(evaluate(mcq, { type: "mcq", choice: 99 }).correct).toBe(false);
    expect(evaluate(mcq, { type: "mcq", choice: -1 }).correct).toBe(false);
  });
});

describe("evaluate · order", () => {
  it("accepts the authored sequence", () => {
    const v = evaluate(order, { type: "order", order: [0, 1, 2, 3] });
    expect(v.correct).toBe(true);
    expect(v.misplaced).toEqual([]);
  });

  it("reports which positions hold the wrong step", () => {
    const v = evaluate(order, { type: "order", order: [0, 2, 1, 3] });
    expect(v.correct).toBe(false);
    expect(v.misplaced).toEqual([1, 2]);
  });

  it("a single swap at the ends is still one wrong answer, not two questions", () => {
    expect(evaluate(order, { type: "order", order: [3, 1, 2, 0] }).misplaced).toEqual([0, 3]);
  });

  it("rejects a response that is not a permutation (stale UI state)", () => {
    expect(evaluate(order, { type: "order", order: [0, 1, 2] }).correct).toBe(false);
    expect(evaluate(order, { type: "order", order: [0, 0, 2, 3] }).correct).toBe(false);
    expect(evaluate(order, { type: "order", order: [0, 1, 2, 9] }).correct).toBe(false);
  });

  it("grades a two-step question", () => {
    const q: OrderQuestion = { ...order, id: "o2", steps: ["a", "b"] };
    expect(evaluate(q, { type: "order", order: [0, 1] }).correct).toBe(true);
    expect(evaluate(q, { type: "order", order: [1, 0] }).correct).toBe(false);
  });
});

describe("evaluate · identify", () => {
  it("accepts the authored part id and rejects the others", () => {
    expect(evaluate(identify, { type: "identify", pick: "auth" }).correct).toBe(true);
    expect(evaluate(identify, { type: "identify", pick: "resolver" }).correct).toBe(false);
    expect(evaluate(identify, { type: "identify", pick: "nope" }).correct).toBe(false);
  });
});

describe("evaluate · contract", () => {
  it("throws when a response cannot grade the question (programmer error)", () => {
    // `Question` and `Response` are separate unions, so nothing at the type
    // level correlates them — this is the runtime guard that does.
    expect(() => evaluate(mcq, { type: "order", order: [0] })).toThrow(/cannot grade/);
  });

  it("is pure: the same inputs give the same verdict every time", () => {
    const once = evaluate(order, { type: "order", order: [1, 0, 2, 3] });
    const twice = evaluate(order, { type: "order", order: [1, 0, 2, 3] });
    expect(once).toEqual(twice);
  });
});

describe("score", () => {
  it("counts correct answers out of those answered", () => {
    expect(score([{ correct: true, explain: "" }, { correct: false, explain: "" }])).toEqual({
      correct: 1,
      total: 2,
    });
    expect(score([])).toEqual({ correct: 0, total: 0 });
  });
});

describe("shuffledOrder", () => {
  it("is deterministic for a given question id", () => {
    expect(shuffledOrder("o1", 5)).toEqual(shuffledOrder("o1", 5));
  });

  it("is a permutation of every index", () => {
    const perm = shuffledOrder("the-walk", 6);
    expect([...perm].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("never hands back the already-correct order", () => {
    for (const id of ["a", "b", "c", "d", "e", "the-walk", "o1", "steps-q"]) {
      for (const n of [2, 3, 4, 5]) {
        expect(shuffledOrder(id, n)).not.toEqual(Array.from({ length: n }, (_, i) => i));
      }
    }
  });

  it("uses no randomness — the sequence survives a broken Math.random", () => {
    const before = shuffledOrder("o1", 5);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(shuffledOrder("o1", 5)).toEqual(before);
  });

  it("handles degenerate lengths", () => {
    expect(shuffledOrder("x", 0)).toEqual([]);
    expect(shuffledOrder("x", 1)).toEqual([0]);
  });

  it("different questions get different orders", () => {
    expect(shuffledOrder("o1", 5)).not.toEqual(shuffledOrder("o2", 5));
  });
});

describe("validation", () => {
  it("passes well-formed questions of every type", () => {
    for (const q of [mcq, order, identify]) expect(validateQuestion(q)).toEqual([]);
  });

  it("catches an answer index that points nowhere", () => {
    expect(validateQuestion({ ...mcq, answer: 3 })).toEqual([expect.stringContaining("not an index")]);
    expect(validateQuestion({ ...mcq, answer: 1.5 })).toEqual([expect.stringContaining("not an index")]);
  });

  it("catches missing content", () => {
    expect(validateQuestion({ ...mcq, explain: "" })).toEqual([expect.stringContaining("explain")]);
    expect(validateQuestion({ ...mcq, prompt: "  " })).toEqual([expect.stringContaining("prompt")]);
    expect(validateQuestion({ ...mcq, id: "" })).toEqual([expect.stringContaining("id")]);
  });

  it("catches options and steps that cannot be told apart", () => {
    expect(validateQuestion({ ...mcq, options: ["a", "a"] })).toEqual([expect.stringContaining("duplicate")]);
    expect(validateQuestion({ ...order, steps: ["a", "a"] })).toEqual([expect.stringContaining("duplicate")]);
  });

  it("catches degenerate question shapes", () => {
    expect(validateQuestion({ ...mcq, options: ["only"] })).toEqual([expect.stringContaining("2 options")]);
    expect(validateQuestion({ ...order, steps: ["only"] })).toEqual([expect.stringContaining("2 steps")]);
    expect(validateQuestion({ ...identify, parts: [identify.parts[0]] })).toEqual([
      expect.stringContaining("2 parts"),
    ]);
  });

  it("catches an identify answer that names no part", () => {
    expect(validateQuestion({ ...identify, answer: "ghost" })).toEqual([expect.stringContaining("not one of the parts")]);
  });

  it("catches duplicate part ids", () => {
    const parts = [identify.parts[0], { ...identify.parts[1], id: "resolver" }];
    expect(validateQuestion({ ...identify, parts, answer: "resolver" })).toEqual([
      expect.stringContaining("duplicate part ids"),
    ]);
  });

  it("rejects an unknown question type", () => {
    expect(validateQuestion({ id: "x", type: "essay", prompt: "p", explain: "e" } as unknown as Question)).toEqual([
      expect.stringContaining("unknown question type"),
    ]);
  });

  it("survives outright garbage", () => {
    expect(validateQuestion(null as unknown as Question)).toEqual(["question is not an object"]);
    expect(validateAssessment({ questions: null } as unknown as never)).toEqual([
      "assessment has no questions array",
    ]);
  });

  it("catches duplicate question ids across an assessment", () => {
    const issues = validateAssessment({ questions: [mcq, { ...mcq }] });
    expect(issues).toEqual([expect.stringContaining("duplicate question ids: m1")]);
  });

  it("flags an empty assessment", () => {
    expect(validateAssessment({ questions: [] })).toEqual(["assessment has no questions"]);
  });
});

describe("usableQuestions", () => {
  it("drops malformed questions rather than blanking a learner's page", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = { ...mcq, id: "bad", answer: 99 };
    expect(usableQuestions([mcq, bad, order])).toEqual([mcq, order]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
