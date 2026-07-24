# Releases — Interactive Learning Engine

Newest first. Each entry is what shipped to `absolutedevs.in/learn/`, verified
against production, not just locally.

---

## v0.5.0 — Interactive Learning Platform (Phases 3 + 4, milestone) · 2026-07-24

The milestone release: the reusable **Simulation** platform is complete, and
with it FlatLearn stops being an animation engine that hosts explainers and
becomes an **Interactive Learning Platform** — Story, Quiz, and Simulation all
running as peer *modes* on one composition shell. This entry folds in Phase 3
(the headless simulation kernel) and Phase 4 (the three interactive Simulate
tabs), which shipped incrementally without their own release notes. Version
skips to **0.5.0** to mark the architecture milestone rather than the file
count. No new capability is added here beyond stabilization, docs, and release.

### What now ships

- **Simulation Mode** on three explainers — `absolutedevs.in/learn/{dns,
  kubernetes,elasticsearch}` each gain a **Simulate** tab alongside their story.
- **A headless simulation kernel** (`src/sim/`) — deterministic, seeded,
  golden-tested reducers with metrics and rules, entirely React-free and
  DOM-free.
- **Three simulation paradigms** proven on one reducer model: DNS recursive
  resolution (a walk), Kubernetes reconciliation (a control loop), and
  Elasticsearch sharding/fan-out (distribution).

### Files added

- `src/sim/kernel/`, `src/sim/rules/`, `src/sim/metrics/` — the headless Tier-1
  kernel: `(state, event) → state`, seeded RNG, and derived metrics.
- `src/sim/{dns,kubernetes,elasticsearch}/` — the three domain reducers, each
  with `__tests__/` golden trajectories.
- `src/sims/{dns,kubernetes,elasticsearch}.tsx` + `src/sims/index.ts` — the
  interactive Simulate-tab views (Tier-0 reducers) and their glob discovery.
- `src/learn/modes/simulate.tsx` — the mode adapter; lazily chunks each sim.
- `src/engine/api.ts` — the stable authoring surface (`import { E }`).

### Files modified

- `src/learn/` — `simulate` registered through the same `ModeHost` contract
  quiz proved; no shell rewrite.
- Engine layout/verbs refactor: `actors.ts`, `scene.ts`, `story.ts`,
  `registry.tsx`, `StoryShell.tsx`, `ArticleShell.tsx`, `index.ts`, and every
  `src/stories/*/meta.ts` adapted to it; `vocab/` (presets · glyphs · accents)
  now carries the shared visual language.
- Four new curiosity explainers added: `haunted-filesystem`, `jury-duty`,
  `multitasking-illusion`, `scaling-the-summit`.
- Docs: `README.md` (now "Interactive Learning Platform"), `CLAUDE.md`,
  `AUTHORING.md`, `ENGINE.md`, `package.json` → `0.5.0`.
- **Zero engine changes were required to integrate Kubernetes or Elasticsearch
  simulations.** Still the point.

### Architecture decisions

- **The reducer model is the whole simulation abstraction.** Three unrelated
  domains fit `(state, event) → state` with a seeded RNG; nothing more general
  earned its keep (Rule of Three: the abstraction was confirmed *after* the
  third case, not designed before the first).
- **Simulations are discovered, not registered.** A file in `src/sims/`
  appearing next to its story is the entire integration.
- **Kernel is headless and deterministic.** No clock, no DOM, no
  `Math.random`; golden tests pin exact trajectories, so replay is reproducible.
- **Each Simulate view stayed bespoke.** No generic `Stage` / simulation-UI /
  shared-visualization framework was built — three concrete views cost less
  than one premature abstraction, and the shared play/step loop is earmarked as
  `useSimLoop` for whenever a fourth sim needs it.
- **Every mode and simulation is a lazy chunk.** Learners who never open a tab
  download none of it.

### Testing

`npm test` — **115 Vitest tests across 9 files**, all passing. Adds the sim
kernel golden tests (`sim/__tests__/kernel.test.ts`,
`sim/__tests__/composition.test.ts`) and per-domain trajectories
(`sim/{dns,kubernetes,elasticsearch}/__tests__/*`, 9 + 11 + 15 tests) to the
existing assessment and shell suites. Component tests run under
`prefers-reduced-motion`.

### Production verification

Clean `tsc -b` + `vite build`. Deployed to `absolutedevs.in/learn/` via direct
`wrangler pages deploy` of a staged clean directory. Verified on production:
story, quiz, and Simulate tabs on the three simulation explainers; the other
nine explainers render unchanged; routing, lazy loading, responsive layout at
390 px, and reduced-motion all intact; no regressions from v0.2.0. Deployed
`index-DL5uzQ2u.js` matches the local build hash.

### Known limitations / technical debt carried forward

1. Only DNS has a **quiz**; the other eleven explainers have the engine but no
   content yet.
2. `src/sims/*` views duplicate a small play/pause/step loop — `useSimLoop` is
   the earmarked extraction (§6), deferred deliberately until a fourth sim.
3. `src/framework/` + `src/scenes/` (v0 hand-coded explainer behind `?v0`)
   still bundled; superseded, slated for removal.
4. Carried from v0.2.0: no persistence across visits, no story-completion hook,
   `order` questions reorder by buttons not drag.

### Recommended release version

**v0.5.0** — the architecture milestone (reusable Simulation platform), not a
routine minor. Additive: no breaking change to any existing explainer or
authoring API.

### Next

Phase 5 — **AI Tutor**, as a `tutor` mode registered through `createExplainer`,
reusing the `ModeHost` contract the other three modes proved. No engine or story
changes expected. Begins from this stable, production-ready platform.

---

## v0.2.0 — Assessment engine (Phase 2) · 2026-07-24

The first new user-facing capability of the learning engine. `absolutedevs.in/learn/dns`
now has two modes: the story it always had, and **Check understanding** — four
questions with immediate, deterministic feedback. Every other explainer is
byte-for-byte the experience it was.

### Files added

- `src/learn/assessment/types.ts` — the declarative question model
  (`mcq` · `order` · `identify`), React-free.
- `src/learn/assessment/evaluate.ts` — pure grading, seeded shuffling, and
  validation. No clock, no `Math.random`, no DOM.
- `src/learn/assessment/QuizView.tsx` — the runner (question → feedback →
  next → summary).
- `src/learn/assessment/questions/{Mcq,Order,Identify}.tsx` — one renderer per
  type; `Identify` draws its cards with `vocab` glyphs and accents.
- `src/learn/assessment/RadioGroup.tsx` — the shared WAI-ARIA radiogroup.
- `src/learn/assessment/{define,index}.ts` — `defineAssessment()` + barrel.
- `src/learn/modes/quiz.tsx` — the mode adapter; lazily chunks the renderer.
- `src/assessments/index.ts` + `src/assessments/dns.ts` — glob discovery and
  the first production quiz.
- Tests: `assessment/__tests__/evaluate.test.ts`,
  `assessment/__tests__/QuizView.test.tsx`, `learn/__tests__/ModeHost.test.tsx`,
  `assessments/__tests__/library.test.ts`, `src/test-setup.ts`.

### Files modified

- `src/learn/contracts.ts` — added `ModeNav`; `nav` graduated from declared to
  built (the quiz is its first consumer).
- `src/learn/host/ModeHost.tsx` — provides `nav`, resets to the first mode when
  the explainer changes, and the (previously unexercised) tab branch gained
  roving tabindex, arrow/Home/End navigation, and a labelled `tabpanel`.
- `src/learn/createExplainer.ts` — `fromStory(def, { assessment })` appends a
  quiz mode when one was discovered; reading mode stays single-mode.
- `src/app/StoryLoader.tsx` — loads story and quiz chunks in parallel and
  memoizes the `ExplainerDef` (a stateful mode needs a stable def).
- `src/learn/index.ts`, `README.md`, `AUTHORING.md`, `CLAUDE.md`,
  `.claude/skills/verify/SKILL.md`, `vite.config.ts`, `package.json`.
- **Zero story files and zero engine files changed.** Still the point.

### Architecture decisions

- **Grading is pure and lives apart from rendering.** `evaluate()` is
  React-free and DOM-free; the renderer holds no correctness logic. Question
  content lives entirely in `src/assessments/`, so the engine knows no topics.
- **Presentation order is derived, not random.** `order` questions are shuffled
  from a hash of the question `id`, so "what the learner saw" is reproducible
  and testable — and never the already-correct order.
- **Quizzes are discovered like stories.** `src/assessments/<slug>.ts` appearing
  next to `src/stories/<slug>/` is the entire integration. Nothing registers.
- **Malformed data: loud in dev, survivable in prod.** The mode throws during
  authoring (the engine's `validate.ts` convention); in production a bad
  question is skipped rather than blanking the page. A regression test makes
  the prod path unreachable for shipped content.
- **The renderer is a lazy chunk.** Explainers without a quiz — and learners who
  never open the tab — download none of it.
- **`nav` over a bigger service.** The quiz needed exactly one thing from the
  host: "show me the story". `Selection`/`Timeline`/`Controls` stayed unbuilt.
- **Reading mode gets no quiz tab.** An essay is not a session.

### Testing

`npm test` — 71 Vitest tests, 4 files. Grading (correct, incorrect, boundary
and non-permutation responses, purity, the response/question type guard);
determinism (stable across runs, survives a mocked `Math.random`, never the
identity permutation); validation (bad answer indices, missing prompts and
explanations, duplicate options/steps/part ids, unknown types, outright
garbage); rendering and interaction per question type; keyboard (arrows,
Home/End, number keys, Enter-to-submit); accessibility (radiogroup roles and
labels, roving tabindex, `aria-live` verdicts, move announcements,
`aria-disabled` at list boundaries); the full run including retry-what-you-
missed; shell regressions (no chrome for one mode, tab keyboard nav, reset on
explainer change, `fromStory` composition); and a content guard that validates
every shipped quiz. Component tests run under `prefers-reduced-motion`.

### Production verification

Clean `tsc -b` + `vite build`. Driven headlessly on `absolutedevs.in`: the
`/learn/dns` path route shows both tabs; the quiz answers by keyboard alone,
grades, reorders, identifies, summarises, and returns to the story; the
renderer and question chunks load only on opening the tab; 390 px viewport has
no horizontal overflow; `?read` shows no quiz tab; `kubernetes` (and the other
eleven explainers) render with no tablist at all; the library still lists 12
cards. Zero console errors and zero failed requests other than the
pre-existing `/favicon.ico` 404. The deployed `index-C3Rm26vY.js` matches the
local build hash.

Bundle: index chunk 440.07 kB / 137.75 kB gzip (+1.7 kB raw, +0.8 kB gzip vs.
v0.1.0 — the validator and mode plumbing). New lazy chunks: `QuizView`
14.56 kB / 4.91 kB gzip, `dns` questions 2.69 kB / 1.24 kB gzip.

### Known limitations

1. The quiz keeps no state across visits — leaving the tab restarts the run.
   Persistence implies identity and progress tracking; that is a product
   decision, not a Phase 2 one.
2. Reaching the quiz is a tab, not a story ending: `StoryShell` exposes no
   completion hook, so the final scene cannot offer "check your understanding".
   That hook is the first justified edit to the frozen engine — left for the
   phase that also needs the shared Timeline.
3. `order` questions reorder by ↑/↓ buttons, not pointer drag. One
   implementation serves keyboard, touch and mouse; drag is a nice-to-have.
4. One quiz per explainer, all questions, always in the authored sequence — no
   pools, no branching, no adaptivity (by design).
5. Only DNS has a quiz. The other eleven explainers each need a data file.
6. `Selection` / `Timeline` / `Controls` are still types, not services, and
   `vocab/` is still not engine-independent (both carried from v0.1.0).

### Technical debt introduced

- **A test toolchain now exists** (Vitest, jsdom, Testing Library — 92 dev
  packages) but covers only `learn/` and `assessments/`. The animation engine
  remains untested; that gap is now visible rather than implicit.
- `src/test-setup.ts` forces `prefers-reduced-motion` for every test, so no
  test exercises the full-motion path. Acceptable (motion is decorative), worth
  remembering when a mode's behaviour depends on an animation completing.
- The repo has no formatter config; the new files were formatted at the
  surrounding 120-column style by hand-run Prettier. A checked-in config would
  make that reproducible.

### Recommended release version

**v0.2.0** — additive minor: a new capability, no breaking change to any
existing explainer or authoring API.

### Next

Phase 3 — the Simulation Tier 0/1 kernel (headless, deterministic), then the
`simulate` mode. Awaiting approval before starting.

---

## v0.1.0 — Composition shell (Phases 0 + 1) · 2026-07-24

The architectural foundation for multi-mode explainers, shipped with **zero
user-visible change**. Every explainer now renders through the composition
shell instead of calling `StoryShell` directly, but with a single `story` mode
the shell emits no DOM of its own — so the rendered output is unchanged.

### Completed phases

| Phase | Scope | State |
|---|---|---|
| 0 | `vocab/` extracted out of `engine/` (presets · glyphs · accents) | Done |
| 1 | `createExplainer` + `ModeHost` + `story` adapter | Done |

### Files added

- `src/learn/createExplainer.ts` — the authoring front door, plus `fromStory()`
  which wraps a plain `StoryDef` as a single-mode explainer.
- `src/learn/contracts.ts` — `Mode`, `HostServices`, and the `Selection` /
  `Timeline` / `Controls` interfaces (declared, not yet built).
- `src/learn/host/ModeHost.tsx` — mounts the active mode; tab chrome only when
  an explainer has more than one mode.
- `src/learn/modes/story.tsx` — the adapter over the animation engine.
- `src/learn/index.ts`, `src/learn/README.md`.
- `src/vocab/{index,accents,glyphs,presets}.ts(x)` — moved from `engine/`.

### Files modified

- `src/engine/index.ts`, `actors.ts`, `registry.tsx`, `scene.ts` — import paths
  only, pointing at `../vocab`. No behavior change.
- `src/app/StoryLoader.tsx` — routes each story through `fromStory` + `ModeHost`.
- `src/engine/{glyphs.tsx,presets.ts}` — deleted (moved to `vocab/`).
- **Zero story files changed.** That was the point.

### Architectural improvements

- One authoring front door (`createExplainer`) replaces the implicit contract
  "a story is whatever `StoryShell` accepts."
- The animation engine is now a *mode*, not *the* runtime. Adding quiz, sim or
  tutor means adding a `modes: [...]` entry — never editing a story file.
- The shared visual vocabulary is no longer owned by the animation engine, so
  future non-animation modes can render the same database, pod or queue.
- Coupling between shell and modes is capped at one file (`contracts.ts`).

### Verification

Clean `tsc -b` + `vite build`; no warnings, no circular runtime imports, no
duplicate bundles (the vocab table appears exactly once, in the shared chunk).
All 12 explainers driven headlessly on production: load, intro, scene deep
link, keyboard step, scene navigation, reading mode, and a 390 px viewport —
zero console errors, zero failed requests, no horizontal overflow. Local and
production runs produced identical actor counts and playhead positions.

Bundle: index chunk 438.4 kB / 137.0 kB gzip (+4.9 kB raw vs. the previous
deploy, which also includes a new explainer and the library category UI — the
shell itself is under a kilobyte).

### Known limitations

1. `Selection` / `Timeline` / `Controls` are types, not services. `StoryShell`
   still owns its player and inspector, so a second mode cannot yet share a
   time axis with the story. Deliberate (Rule of Three) — building them now
   would mean the first real edit to the frozen engine with no consumer.
2. `vocab/` is not engine-independent: `vocab/presets.ts` imports `node` from
   `engine/actors`, and `vocab/glyphs.tsx` is React. A headless simulation
   kernel cannot import `vocab/` as-is. Split identity from its `ActorSpec`
   projection when Phase 3 needs it.
3. `ModeHost`'s multi-mode tab branch has never rendered in production. It also
   keeps its `active` index across explainer changes.
4. `fromStory()` rebuilds the `ExplainerDef` on every `StoryLoader` render.
   Harmless today; memoize before a stateful mode lands.

### Technical debt (pre-existing, not introduced here)

- `src/framework/` + `src/scenes/` — the v0 hand-coded explainer behind `?v0`,
  still bundled into the index chunk. Superseded; removing it is the single
  biggest easy bundle win.
- `functions/learn/[[path]].js` returns the app shell with **200** for any
  unmatched path under `/learn/`, including missing `/learn/assets/*` files. A
  stale chunk therefore surfaces as a confusing MIME-type error instead of a
  clean 404. Worth excluding `/learn/assets/` from the fallback.
- `/favicon.ico` 404s site-wide.
- `explainers/plan.md` is an old visual-polish plan whose "Phase" numbering
  collides with the learning-engine phases, and it references
  `src/engine/glyphs.tsx`, which no longer exists.

### Lessons learned

- The "shell adds no DOM when there is one mode" rule is what made a zero-risk
  refactor possible. Any chrome in the single-mode path would have turned this
  into a visual-regression review across 12 explainers.
- Declaring `Selection`/`Timeline`/`Controls` as types while refusing to build
  them kept Phase 1 honest: the contract is agreed, the indirection is not paid
  for until a second consumer exists.
- Extracting `vocab/` proved the boundary is *not yet* where the plan wants it.
  Better to have discovered that with a documented back-import than to have
  assumed the layering was clean.

### Next

Phase 2 — the Assessment (quiz) engine, added to one live explainer.
