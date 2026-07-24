/**
 * The Assessment engine's rendering half: what a learner sees, clicks and types.
 * Everything here runs under `prefers-reduced-motion` (see `src/test-setup.ts`).
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizView } from "../QuizView";
import type { Assessment } from "../types";

afterEach(cleanup);

const assessment: Assessment = {
  lead: "Three questions.",
  questions: [
    {
      id: "first-look",
      type: "mcq",
      prompt: "Where does the browser look first?",
      options: ["A root server", "Its own cache", "The registry"],
      answer: 1,
      explain: "Local caches come first.",
    },
    {
      id: "walk",
      type: "order",
      prompt: "Order the walk.",
      steps: ["ask the resolver", "ask the root", "ask the registry", "ask google"],
      explain: "Each level knows who to ask next.",
    },
    {
      id: "who",
      type: "identify",
      prompt: "Who is authoritative?",
      parts: [
        { id: "resolver", glyph: "server", label: "Resolver" },
        { id: "auth", glyph: "server", label: "ns1.google.com", accent: "green" },
      ],
      answer: "auth",
      explain: "Only Google's own server holds the answer.",
    },
  ],
};

const check = () => screen.getByRole("button", { name: /check answer/i });
const next = () => screen.getByRole("button", { name: /next question|see how you did/i });

describe("QuizView · shape", () => {
  it("opens on the first question with progress and lead", () => {
    render(<QuizView assessment={assessment} />);
    expect(screen.getByText("Where does the browser look first?")).toBeTruthy();
    expect(screen.getByText("Question 1 of 3")).toBeTruthy();
    expect(screen.getByText("Three questions.")).toBeTruthy();
  });

  it("cannot be checked before an answer is chosen", () => {
    render(<QuizView assessment={assessment} />);
    expect((check() as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders a fallback rather than crashing on an empty assessment", () => {
    render(<QuizView assessment={{ questions: [] }} />);
    expect(screen.getByText(/no questions yet/i)).toBeTruthy();
  });

  it("skips a malformed question and runs the rest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <QuizView
        assessment={{
          questions: [
            { id: "bad", type: "mcq", prompt: "Broken", options: ["a", "b"], answer: 7, explain: "e" },
            assessment.questions[0],
          ],
        }}
      />,
    );
    expect(screen.queryByText("Broken")).toBeNull();
    expect(screen.getByText("Question 1 of 1")).toBeTruthy();
    expect(warn).toHaveBeenCalled();
  });
});

describe("QuizView · mcq", () => {
  it("grades a correct answer and explains it", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={assessment} />);
    await user.click(screen.getByRole("radio", { name: /its own cache/i }));
    await user.click(check());
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(screen.getByText("Local caches come first.")).toBeTruthy();
  });

  it("grades a wrong answer, explains anyway, and locks the options", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={assessment} />);
    await user.click(screen.getByRole("radio", { name: /a root server/i }));
    await user.click(check());
    expect(screen.getByText("Not quite")).toBeTruthy();
    expect(screen.getByText("Local caches come first.")).toBeTruthy();
    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("re-checking is impossible: the button becomes the way forward", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={assessment} />);
    await user.click(screen.getByRole("radio", { name: /its own cache/i }));
    await user.click(check());
    expect(screen.queryByRole("button", { name: /check answer/i })).toBeNull();
    expect(next()).toBeTruthy();
  });
});

describe("QuizView · keyboard and accessibility", () => {
  it("exposes one radiogroup labelled by the prompt", () => {
    render(<QuizView assessment={assessment} />);
    expect(screen.getByRole("radiogroup", { name: "Where does the browser look first?" })).toBeTruthy();
  });

  it("is one tab stop: only the active option is tabbable (roving tabindex)", () => {
    render(<QuizView assessment={assessment} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
  });

  it("moves selection with arrow keys and wraps at the ends", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={assessment} />);
    const radios = screen.getAllByRole("radio");
    radios[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(radios[2].getAttribute("aria-checked")).toBe("true");
    await user.keyboard("{Home}");
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    await user.keyboard("{End}");
    expect(radios[2].getAttribute("aria-checked")).toBe("true");
  });

  it("selects an option by its number key", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={assessment} />);
    const radios = screen.getAllByRole("radio");
    radios[0].focus();
    await user.keyboard("2");
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
  });

  it("submits with Enter, without reaching for the mouse", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={assessment} />);
    const radios = screen.getAllByRole("radio");
    radios[0].focus();
    await user.keyboard("2{Enter}");
    expect(screen.getByText("Correct")).toBeTruthy();
  });

  it("announces the verdict politely", async () => {
    const user = userEvent.setup();
    const { container } = render(<QuizView assessment={assessment} />);
    const live = container.querySelector("[aria-live='polite']")!;
    expect(live).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /its own cache/i }));
    await user.click(check());
    expect(live.textContent).toContain("Local caches come first.");
  });
});

describe("QuizView · order", () => {
  const only = (q: Assessment["questions"][number]): Assessment => ({ questions: [q] });
  const orderQ = assessment.questions[1];

  it("presents the steps shuffled — never already solved", () => {
    render(<QuizView assessment={only(orderQ)} />);
    const shown = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(shown).toHaveLength(4);
    expect(shown[0]).not.toContain("ask the resolver");
  });

  it("moves a step with its buttons and grades the arrangement", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={only(orderQ)} />);
    // Walk each step up to the top in reverse, producing the authored order.
    for (const step of ["ask google", "ask the registry", "ask the root", "ask the resolver"]) {
      let rows = screen.getAllByRole("listitem");
      let pos = rows.findIndex((r) => r.textContent?.includes(step));
      while (pos > 0) {
        await user.click(within(rows[pos]).getByRole("button", { name: /earlier/i }));
        rows = screen.getAllByRole("listitem");
        pos = rows.findIndex((r) => r.textContent?.includes(step));
      }
    }
    await user.click(check());
    expect(screen.getByText("Correct")).toBeTruthy();
  });

  it("marks a wrong arrangement and shows the real sequence", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={only(orderQ)} />);
    await user.click(check()); // submit the shuffled order as-is
    expect(screen.getByText("Not quite")).toBeTruthy();
    // The correct sequence is listed under the explanation.
    const lists = screen.getAllByRole("list");
    const answerList = lists[lists.length - 1];
    expect(within(answerList).getAllByRole("listitem").map((li) => li.textContent?.replace(/^\d/, ""))).toEqual([
      "ask the resolver",
      "ask the root",
      "ask the registry",
      "ask google",
    ]);
  });

  it("keeps boundary move buttons focusable (aria-disabled, not disabled)", () => {
    render(<QuizView assessment={only(orderQ)} />);
    const first = within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: /earlier/i });
    expect((first as HTMLButtonElement).disabled).toBe(false);
    expect(first.getAttribute("aria-disabled")).toBe("true");
  });

  it("announces each move", async () => {
    const user = userEvent.setup();
    const { container } = render(<QuizView assessment={only(orderQ)} />);
    const rows = screen.getAllByRole("listitem");
    const moving = rows[1].textContent;
    await user.click(within(rows[1]).getByRole("button", { name: /earlier/i }));
    const live = container.querySelector(".sr-only[aria-live='polite']")!;
    expect(live.textContent).toContain("moved to position 1 of 4");
    expect(moving).toContain(live.textContent!.split(" moved")[0]);
  });
});

describe("QuizView · identify", () => {
  it("renders the vocabulary cards and grades the pick", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={{ questions: [assessment.questions[2]] }} />);
    expect(screen.getByRole("radio", { name: /resolver/i })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /ns1\.google\.com/i }));
    await user.click(check());
    expect(screen.getByText("Correct")).toBeTruthy();
  });

  it("marks the learner's pick and the right one when wrong", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={{ questions: [assessment.questions[2]] }} />);
    await user.click(screen.getByRole("radio", { name: /resolver/i }));
    await user.click(check());
    expect(screen.getByText("✗ your pick")).toBeTruthy();
    expect(screen.getByText("✓ this one")).toBeTruthy();
  });
});

describe("QuizView · the run", () => {
  /** Answer the current mcq/identify question by its option label. */
  async function answer(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
    await user.click(screen.getByRole("radio", { name }));
    await user.click(check());
    await user.click(next());
  }

  it("walks every question, then reports how many were right", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={assessment} />);
    await answer(user, /its own cache/i); // right
    await user.click(check()); // order: submit shuffled → wrong
    await user.click(next());
    await answer(user, /ns1\.google\.com/i); // right
    expect(screen.getByText("2 of 3 right.")).toBeTruthy();
  });

  it("offers to re-ask only the questions that were missed", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={assessment} />);
    await answer(user, /a root server/i); // wrong
    await user.click(check()); // order → wrong
    await user.click(next());
    await answer(user, /ns1\.google\.com/i); // right
    expect(screen.getByText("1 of 3 right.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /retry those 2/i }));
    expect(screen.getByText("Question 1 of 2")).toBeTruthy();
    expect(screen.getByText("Where does the browser look first?")).toBeTruthy();
  });

  it("keeps earlier results when a retried question is finally right", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={{ questions: [assessment.questions[0], assessment.questions[2]] }} />);
    await answer(user, /a root server/i); // wrong
    await answer(user, /ns1\.google\.com/i); // right
    expect(screen.getByText("1 of 2 right.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /retry that one/i }));
    await user.click(screen.getByRole("radio", { name: /its own cache/i }));
    await user.click(check());
    await user.click(next());
    expect(screen.getByText("2 of 2 right.")).toBeTruthy();
  });

  it("offers the story only when the explainer has one", async () => {
    const user = userEvent.setup();
    const one: Assessment = { questions: [assessment.questions[0]] };
    const back = vi.fn();
    const { unmount } = render(<QuizView assessment={one} onReviewStory={back} />);
    await answer(user, /its own cache/i);
    await user.click(screen.getByRole("button", { name: /back to the story/i }));
    expect(back).toHaveBeenCalledOnce();
    unmount();

    render(<QuizView assessment={one} />);
    await answer(user, /its own cache/i);
    expect(screen.queryByRole("button", { name: /back to the story/i })).toBeNull();
  });

  it("starts the whole quiz over on request", async () => {
    const user = userEvent.setup();
    render(<QuizView assessment={{ questions: [assessment.questions[0]] }} />);
    await user.click(screen.getByRole("radio", { name: /its own cache/i }));
    fireEvent.click(check());
    await user.click(next());
    await user.click(screen.getByRole("button", { name: /start the quiz again/i }));
    expect(screen.getByText("Question 1 of 1")).toBeTruthy();
    expect((check() as HTMLButtonElement).disabled).toBe(true);
  });
});
