---
name: verify
description: Build, run, and visually verify the explainers app (Vite + React) in this directory.
---

# Verifying the explainers app

Tests (from `explainers/`): `npm test` (Vitest + jsdom) — the Assessment
engine, the composition shell, and every shipped quiz. Run it before the
browser pass whenever `src/learn/` or `src/assessments/` changed.

Build (from `explainers/`): `npx vite build` — emits to `../learn/`.
(`npm run build` also runs `tsc -b` across all of `src/`; fine when the tree is clean.)

Serve the build: `npx vite preview --port 4173 --strictPort` (background),
then the app is at `http://localhost:4173/learn/`.

Note: `vite preview` has no SPA fallback, so the production-style path route
`/learn/<slug>` 404s locally. Use `?story=<slug>` when testing the preview
build; path routes work on Cloudflare Pages and should be checked there.

Screenshots: Chrome's `--virtual-time-budget` does NOT advance Motion
(framer-motion) animations — everything stays at opacity 0. Use
puppeteer-core (npm i in scratchpad) pointed at
`C:/Program Files/Google/Chrome/Application/chrome.exe` with real
`setTimeout` waits, then `page.screenshot()`.

The default app is the engine-driven story (`src/engine/` + `src/stories/`).
`?story=<slug>` opens a specific explainer (stories are discovered from
`src/stories/*/` via glob; each is a lazy chunk). With exactly one story in
the library the root goes straight to it; with more, the root is a library
index page. `?v0` serves the original hand-coded explainer (`src/framework/`).

Every explainer renders through the composition shell (`src/learn/ModeHost`),
but with a single `story` mode the shell emits no DOM of its own — the handles
below are unchanged from the pre-shell path.

Useful handles (engine app):
- `?scene=N` (1-based) deep-links past the intro straight into scene N.
- Intro's begin button is the only button whose text contains `→`.
- Keyboard: space play/pause, ArrowLeft/Right step, Shift+Arrows change
  scene, `r` replays.
- The timeline is `input[type=range]`; scrub by dispatching `pointerdown`,
  setting `.value` via the native setter, then dispatching `input`.
- The takeaway card appears when the playhead reaches the scene's end
  (scene durations are computed; ~12–25s at 1×; use 2× to shorten waits).
- Hover inspector text lands in the `[aria-live=polite]` line under the
  stage.
- Params (e.g. scene 3's First/Second visit) are segmented buttons above
  the stage; click by exact text.

Quiz handles (explainers with `src/assessments/<slug>.ts`, e.g. `dns`):
- Mode tabs are `[role=tab]` ("Story", "Check understanding"). An explainer
  without a quiz has **no** tablist at all — that absence is the
  backward-compatibility check.
- Options are `[role=radio]` inside a `[role=radiogroup]`; number keys 1–9
  select, arrows move, Enter checks the answer.
- The verdict word renders uppercase via CSS, so `innerText` reads
  `CORRECT` / `NOT QUITE` — match case-insensitively.
- `order` questions expose per-row "Move … earlier/later" buttons; boundary
  ones are `aria-disabled`, not `disabled`.
