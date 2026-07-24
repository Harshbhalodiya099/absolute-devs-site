# Explainers app

- The tool-neutral authoring reference is `AUTHORING.md` (usable by any LLM or
  developer). Before authoring or modifying any explainer story
  (`src/stories/*`), invoke the `new-explainer` skill FIRST — it points to
  `AUTHORING.md` and adds the agent workflow. Do not read `src/engine/*` or
  ENGINE.md for authoring.
- To build/run/screenshot the app, use the `verify` skill.
- ENGINE.md is the engine's architecture doc — relevant only when changing
  `src/engine/` itself.
- `src/learn/` is the composition layer (Interactive Learning Engine): it wraps
  the animation engine as a `story` mode and hosts the `quiz` mode (sim/tutor
  later). Read `src/learn/README.md` when adding a mode, changing the shell, or
  changing the Assessment engine; the umbrella architecture is repo-root
  `interactive-learning-engine-plan.md`.
- Quizzes are content, not code: `src/assessments/<slug>.ts` next to
  `src/stories/<slug>/` gives that explainer a "Check understanding" tab. The
  authoring guide is `AUTHORING.md` → "Adding a quiz"; don't read
  `src/learn/assessment/*` to write one.
- `npm test` runs Vitest (jsdom). Run it alongside the `verify` skill whenever
  you touch `src/learn/`.
