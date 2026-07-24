# learn/ — Interactive Learning Engine (composition layer)

The composition shell that turns an explainer into a set of **modes** sharing
one vocabulary, one selection surface and one timeline. It wraps — never
replaces — the existing animation engine. Architecture: repo-root
`interactive-learning-engine-plan.md` (§3–§4, §8, §14).

## The model

An **explainer** = `meta` + an ordered set of **modes**. A **mode** is a named,
renderable panel backed by a capability (`story`, `quiz`, later `simulate`,
`tutor`). Every mode receives the same `HostServices` and uses only what it
needs.

```ts
import { createExplainer, quiz, story } from "../learn";

export default createExplainer({
  meta: { slug: "dns", title: "DNS" },
  modes: [
    story(dnsStory),          // existing animation engine, unchanged
    quiz({ questions }),      // Assessment engine
    // simulate({ ... }),     // Phase 4
  ],
});
```

In practice no explainer writes that by hand yet: `StoryLoader` composes it
from what it discovers by slug (`src/stories/<slug>/` + `src/assessments/<slug>.ts`)
via `fromStory()`.

## What ships today (Phases 1–2)

- `createExplainer({ meta, modes })` — the front door.
- `fromStory(def, { read, assessment })` — wraps a plain `StoryDef`, adding a
  quiz mode when an assessment was discovered. Reading mode stays single-mode.
- `ModeHost` — renders the active mode; tab chrome **only when there is more
  than one mode**, so story-only explainers are pixel-identical to before.
  Owns tab keyboard navigation (arrows/Home/End) and the `nav` service.
- `story(def)` — adapter rendering `StoryShell`/`ArticleShell`. No story file
  and no engine code changes.
- `quiz(assessment)` — the Assessment engine as a mode, lazily chunked.

## The Assessment engine (`assessment/`)

Two halves, deliberately separable:

| File | Role |
|---|---|
| `types.ts` | The declarative question model (`mcq` · `order` · `identify`). React-free. |
| `evaluate.ts` | Deterministic grading, seeded shuffling, validation. Pure, DOM-free. |
| `QuizView.tsx` | The runner: one question, answer, feedback, next, summary. |
| `questions/*.tsx` | One renderer per type. `Identify` draws from `vocab/`. |
| `RadioGroup.tsx` | The shared WAI-ARIA radiogroup used by `mcq` and `identify`. |
| `define.ts` | `defineAssessment()` — the authoring identity function. |

**Rules the engine holds to.** Grading is pure: same question + response ⇒ same
verdict, with no clock, no `Math.random`, no storage. Presentation order is
derived from the question `id`, so "what the learner saw" is reproducible. The
engine contains no topic knowledge — content lives entirely in
`src/assessments/<slug>.ts`, discovered by glob and loaded lazily.

**Lifecycle of one question:** `initialDraft` (an `order` question starts
pre-shuffled; others start unanswered) → learner edits the draft `Response` →
`Check answer` calls `evaluate(question, response)` → the `Verdict` locks the
inputs and renders the explanation → `Next question` advances, or the run ends
in a summary that can re-ask only what was missed.

**Extension points.** A fourth question type = a variant in `types.ts`, a case
in `evaluate`, a renderer in `questions/`, and a branch in `QuizView` — no
change to the mode, the host, or any story. A new diagram shape = a new glyph
in `vocab/glyphs.tsx`, which the story engine gains at the same time.

Authoring guide for content: `AUTHORING.md` → "Adding a quiz".

## Contracts (`contracts.ts`, plan §8)

`Mode`, `HostServices`, `ModeNav`, and the `Selection` / `Timeline` /
`Controls` interfaces. `vocab` and `nav` are real services;
`Selection`/`Timeline`/`Controls` are declared as the agreed target shape but
**not built yet** — `StoryShell` still owns its own player and inspector, and
the quiz needs neither. They become real in the phase where a mode first reads
them (sim ticks).

## Folder structure

```
src/
  learn/                 # THIS LAYER — composition (React)
    createExplainer.ts   #   the front door + fromStory() bridge
    contracts.ts         #   Mode · HostServices · ModeNav · Selection/Timeline/Controls
    host/ModeHost.tsx    #   mounts the active mode; tabs only when modes > 1
    modes/story.tsx      #   adapter → engine (StoryShell / ArticleShell)
    modes/quiz.tsx       #   adapter → assessment/ (lazy chunk)
    assessment/          #   the Assessment engine (data model · grading · renderer)
  engine/                # animation runtime — FROZEN for composition work
  vocab/                 # shared visual language (presets · glyphs · accents)
  stories/<slug>/        # explainers: meta.ts + story.ts, glob-discovered
  assessments/<slug>.ts  # quizzes, glob-discovered, lazily loaded
  app/                   # Library index + StoryLoader (calls fromStory)
```

Data flow for every explainer today:

`main.tsx` → `StoryLoader` → `loadStory(slug)` + `loadAssessment(slug)` →
`fromStory(def, { assessment })` → `ModeHost` → the active mode.

## Phase status

| Phase | Scope | State |
|---|---|---|
| 0 | `vocab/` extraction out of `engine/` | **Done** |
| 1 | `createExplainer` + `ModeHost` + `story` adapter | **Done** |
| 2 | Assessment (quiz) engine, live on one explainer | **Done** |
| 3–4 | Simulation Tier 0/1 kernel + `simulate` mode | Next |
| 5 | AI Tutor (read-only projection → prose) | Planned |

## Tests

`npm test` (Vitest + jsdom + Testing Library). Component tests run under
`prefers-reduced-motion` via `src/test-setup.ts`, which keeps Motion instant.

- `assessment/__tests__/evaluate.test.ts` — grading, determinism, validation.
- `assessment/__tests__/QuizView.test.tsx` — rendering, keyboard, a11y, the run.
- `__tests__/ModeHost.test.tsx` — chrome, tabs, `nav`, `fromStory` composition.
- `src/assessments/__tests__/library.test.ts` — every shipped quiz is valid.

## Adding a mode to an explainer

Additive, one explainer at a time: add an entry to `modes: [...]`. Never
rewrite the story file. `sim/` and `vocab/` should stay React-free; `learn/`
and `engine/` are the React layer.

## Current limitations (read before Phase 3)

1. **`Selection` / `Timeline` / `Controls` are types, not services.** A mode
   that needs to share a time axis or an inspection surface with the story
   cannot do so yet; `StoryShell` still owns its player and inspector. Building
   them means touching the frozen engine — wait for the mode that needs it.
2. **`vocab/` is not yet engine-independent.** `vocab/presets.ts` imports `node`
   from `engine/actors`, and `vocab/glyphs.tsx` is React. A headless simulation
   kernel cannot import `vocab/` as-is; split visual identity from its
   `ActorSpec` projection when Phase 3 needs it.
3. **The quiz keeps no state across visits.** Leaving the tab and coming back
   restarts the run; nothing is persisted. Deliberate — persistence implies
   identity and progress tracking, which is a product decision, not a Phase 2 one.
4. **Reaching the quiz is a tab, not a story ending.** The final scene cannot
   offer "check your understanding" because `StoryShell` exposes no completion
   hook. That hook is the first justified edit to the engine; it was left for
   the phase that also needs the shared Timeline.
5. **`order` questions have no pointer drag.** Reordering is by ↑/↓ buttons
   (keyboard-, touch- and mouse-operable with one implementation). Drag is a
   nice-to-have, not a missing capability.
6. **One quiz per explainer, all questions in order.** No question pools, no
   branching, no randomised subsets — and no adaptivity by design.
