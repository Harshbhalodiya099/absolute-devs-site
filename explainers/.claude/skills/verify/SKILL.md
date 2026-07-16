---
name: verify
description: Build, run, and visually verify the explainers app (Vite + React) in this directory.
---

# Verifying the explainers app

Build (from `explainers/`): `npx vite build` — emits to `../google/`.
(`npm run build` also runs `tsc -b` across all of `src/`; fine when the tree is clean.)

Serve the build: `npx vite preview --port 4173 --strictPort` (background),
then the app is at `http://localhost:4173/google/`.

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
