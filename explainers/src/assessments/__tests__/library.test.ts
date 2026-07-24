/**
 * Regression guard for shipped quiz content.
 *
 * The engine skips a malformed question at runtime so a typo can never blank a
 * learner's page — which is exactly why a typo needs to fail *here* instead of
 * silently shrinking a quiz in production.
 */
import { describe, expect, it } from "vitest";
import { validateAssessment } from "../../learn/assessment";
import { library } from "../../stories";
import { assessmentSlugs, hasAssessment, loadAssessment } from "../index";

describe("the assessment library", () => {
  it("discovers quizzes by glob, and index.ts is not one of them", () => {
    expect(assessmentSlugs).toContain("dns");
    expect(assessmentSlugs).not.toContain("index");
  });

  it("only names explainers that exist — a quiz with no story is unreachable", () => {
    const slugs = new Set(library.map((m) => m.slug));
    for (const slug of assessmentSlugs) expect(slugs.has(slug)).toBe(true);
  });

  it("answers `hasAssessment` without loading the chunk", () => {
    expect(hasAssessment("dns")).toBe(true);
    expect(hasAssessment("nothing-here")).toBe(false);
  });

  it("returns null rather than throwing for an explainer with no quiz", async () => {
    await expect(loadAssessment("nothing-here")).resolves.toBeNull();
  });

  it.each(assessmentSlugs)("%s is well-formed", async (slug) => {
    const assessment = await loadAssessment(slug);
    expect(assessment).not.toBeNull();
    expect(validateAssessment(assessment!)).toEqual([]);
  });

  it.each(assessmentSlugs)("%s explains every question in full sentences", async (slug) => {
    for (const q of (await loadAssessment(slug))!.questions) {
      // The explanation is the teaching; a stub one is a content bug.
      expect(q.explain.length).toBeGreaterThan(40);
      expect(q.prompt.trim().endsWith("?") || q.prompt.trim().endsWith(".")).toBe(true);
    }
  });
});
