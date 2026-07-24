# FlatLearn — Interactive Learning Platform

A React + TypeScript + Tailwind + Motion platform for scene-based, interactive
learning. An explainer is no longer just an animation: it is a set of **modes**
— **Story**, **Quiz**, and **Simulation** — sharing one visual language and one
composition shell. Twelve explainers ship today, served at **`/learn/`** on the
site. AI Tutor is the next planned mode.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173/learn/
```

## Build

```sh
npm run build      # tsc -b && vite build → ../learn/ (served at /learn/ on the site)
```

Deploy is a direct `wrangler pages deploy` of a staged clean directory — see
the repo-root deploy notes, not a git-triggered build.

## Architecture

Three layers, outermost first. Each one wraps the next; none reaches past it.

- `src/learn/` — **the composition layer** (Interactive Learning Engine). An
  explainer is `meta` + an ordered set of **modes**; `createExplainer` is the
  single authoring front door and `ModeHost` mounts the active mode. Three
  modes ship today: `story` (a thin adapter over the animation engine), `quiz`
  (the Assessment engine, driven by data files), and `simulate` (interactive,
  deterministic simulations). `tutor` (AI Tutor) lands here next without
  touching engine or story files. **See `src/learn/README.md`**; umbrella
  architecture is repo-root `interactive-learning-engine-plan.md`.
- `src/sim/` — the **headless simulation kernel**: deterministic, seeded,
  golden-tested reducers (DNS resolution, Kubernetes reconciliation,
  Elasticsearch sharding). `src/sims/` holds the interactive Simulate-tab views
  that drive it. Three paradigms validated with zero engine changes.
- `src/assessments/<slug>.ts` — **quiz content** (MCQ + ordering), discovered
  next to its story to give that explainer a "Check understanding" tab.
- `src/engine/` — the animation runtime: typed story DSL (`scene`, `cast`,
  `connect`, motion combinators), timeline compiler + sampler, camera, player,
  story/article shells, actor renderer registry. Topic-agnostic and **frozen**
  for composition-layer work. **See `ENGINE.md`.**
- `src/vocab/` — the shared visual language (presets · glyphs · accents), so a
  database is the same amber cylinder in every mode, not just in the animation.
  Extracted out of `engine/` in Phase 0; the engine imports it back.
- `src/stories/<slug>/` — one explainer per folder: `meta.ts` (title + intro)
  and `story.ts` (the scenes). Discovered by glob, lazily loaded — adding an
  explainer touches no engine, shell or app code.
- `src/app/` — the library index page and the story loader/router. `StoryLoader`
  wraps each `StoryDef` with `fromStory()` so every explainer runs through the
  composition shell.
- `src/framework/` + `src/scenes/` — the original v0 hand-coded explainer, kept
  for comparison behind `?v0`. Superseded; slated for removal.

### Routing

`/learn/<slug>` opens one explainer (`?read` for essay mode, `?scene=N` to deep
link past the intro). Legacy `?story=<slug>` still works. With more than one
story the root is the library index.

## Authoring a new explainer

**See [`AUTHORING.md`](./AUTHORING.md)** — the complete, tool-neutral API
reference. Any developer or LLM assistant can read that one file and write a
working explainer: everything hangs off a single import (`import { E } from
"../../engine"`), and each explainer is one folder under `src/stories/<slug>/`
(`meta.ts` + `story.ts`), discovered by glob. `src/stories/kubernetes/` is the
canonical worked example.

If a story seems to need raw coordinates, timestamps, or engine internals,
that's an engine gap — extend the engine instead.
