# Interactive Explainers

A small React + TypeScript + Tailwind + Motion framework for scene-based,
interactive explainers, plus the first one: **"What happens when you type
google.com into your browser?"**

## Develop

```sh
npm install
npm run dev        # http://localhost:5173/google/
```

## Build

```sh
npm run build      # emits static files into ../google/ (served at /google/ on the site)
```

## Architecture

- `src/engine/` — the educational runtime: typed story DSL (`scene`, `cast`,
  `connect`, motion combinators), timeline compiler + sampler, camera,
  player, story/article shells, actor renderer registry. Topic-agnostic.
  **See `ENGINE.md` for the full architecture.**
- `src/stories/<slug>/` — one explainer per folder: `meta.ts` (title +
  intro) and `story.ts` (the scenes). Discovered by glob, lazily loaded —
  adding an explainer touches no engine or app code.
- `src/app/` — the library index page and the story loader/router.
- `src/framework/` + `src/scenes/` — the original v0 hand-coded explainer,
  kept for comparison behind `?v0`.

To build a new explainer (TCP, Git, Docker…), copy the shape of
`src/stories/dns/`: cast actors, connect them, compose steps from motion
primitives. If a story seems to need coordinates, timestamps, or engine
internals, that's an engine gap — extend the engine instead.
