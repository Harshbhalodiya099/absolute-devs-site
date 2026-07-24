/**
 * The composition shell, now that a second mode actually exists.
 *
 * The load-bearing guarantee is still Phase 1's: a single-mode explainer emits
 * no chrome, so the twelve story-only explainers render exactly as before.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { StoryDef } from "../../engine";
import { createExplainer, fromStory } from "../createExplainer";
import type { Mode } from "../contracts";
import { ModeHost } from "../host/ModeHost";
import { quiz } from "../modes/quiz";

afterEach(cleanup);

const panel = (id: string, label: string, text: string): Mode => ({
  id,
  label,
  render: (host) => (
    <div>
      <p>{text}</p>
      <button type="button" onClick={() => host.nav?.go("quiz")}>
        jump to quiz
      </button>
    </div>
  ),
});

const assessment = {
  questions: [
    {
      id: "q1",
      type: "mcq" as const,
      prompt: "Where does the browser look first?",
      options: ["Root", "Its own cache"],
      answer: 1,
      explain: "Local caches come first.",
    },
  ],
};

const explainer = createExplainer({
  meta: { slug: "dns", title: "DNS" },
  modes: [panel("story", "Story", "the animation"), quiz(assessment)],
});

describe("ModeHost · single mode", () => {
  it("emits no chrome at all", () => {
    const one = createExplainer({
      meta: { slug: "dns", title: "DNS" },
      modes: [panel("story", "Story", "the animation")],
    });
    render(<ModeHost explainer={one} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("the animation")).toBeTruthy();
  });
});

describe("ModeHost · two modes", () => {
  it("shows a tab per mode, story first and selected", () => {
    render(<ModeHost explainer={explainer} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Story", "Check understanding"]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("the animation")).toBeTruthy();
  });

  it("switches modes on click", async () => {
    const user = userEvent.setup();
    render(<ModeHost explainer={explainer} />);
    await user.click(screen.getByRole("tab", { name: "Check understanding" }));
    // The quiz renderer is a lazy chunk (see modes/quiz.tsx), hence `findBy`.
    expect(await screen.findByText("Where does the browser look first?")).toBeTruthy();
    expect(screen.queryByText("the animation")).toBeNull();
  });

  it("moves between tabs with arrow keys, wrapping", async () => {
    const user = userEvent.setup();
    render(<ModeHost explainer={explainer} />);
    screen.getAllByRole("tab")[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getAllByRole("tab")[1].getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getAllByRole("tab")[0].getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{End}");
    expect(screen.getAllByRole("tab")[1].getAttribute("aria-selected")).toBe("true");
  });

  it("is one tab stop, and the panel points back at its tab", () => {
    render(<ModeHost explainer={explainer} />);
    expect(screen.getAllByRole("tab").map((t) => t.getAttribute("tabindex"))).toEqual(["0", "-1"]);
    const tabpanel = screen.getByRole("tabpanel");
    expect(tabpanel.getAttribute("aria-labelledby")).toBe("mode-tab-story");
  });

  it("lets a mode navigate to a sibling through `nav`", async () => {
    const user = userEvent.setup();
    render(<ModeHost explainer={explainer} />);
    await user.click(screen.getByRole("button", { name: "jump to quiz" }));
    expect(await screen.findByText("Where does the browser look first?")).toBeTruthy();
    expect(screen.getAllByRole("tab")[1].getAttribute("aria-selected")).toBe("true");
  });

  it("returns to the first mode when the explainer changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ModeHost explainer={explainer} />);
    await user.click(screen.getByRole("tab", { name: "Check understanding" }));
    const other = createExplainer({
      meta: { slug: "kubernetes", title: "Kubernetes" },
      modes: [panel("story", "Story", "another animation"), quiz(assessment)],
    });
    rerender(<ModeHost explainer={other} />);
    expect(screen.getByText("another animation")).toBeTruthy();
  });
});

describe("fromStory · composition", () => {
  const def = { slug: "dns", title: "DNS", scenes: [] } as unknown as StoryDef;

  it("stays a single-mode explainer when there is no quiz", () => {
    expect(fromStory(def).modes.map((m) => m.id)).toEqual(["story"]);
    expect(fromStory(def, { assessment: null }).modes.map((m) => m.id)).toEqual(["story"]);
  });

  it("adds a quiz mode when an assessment was discovered", () => {
    expect(fromStory(def, { assessment }).modes.map((m) => m.id)).toEqual(["story", "quiz"]);
  });

  it("leaves reading mode alone — an essay is not a session", () => {
    expect(fromStory(def, { assessment, read: true }).modes.map((m) => m.id)).toEqual(["story"]);
  });
});
