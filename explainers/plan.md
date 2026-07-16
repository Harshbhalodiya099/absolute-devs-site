# Stage & Visual Hierarchy Refinement — Implementation Plan

Goal: make the interactive stage the hero of every explainer. Do NOT redesign
the engine or the interaction model. The diagnosis (from a full review with
screenshots at 1440×900, 1280×720, and 390×844): the stage SVG box is already
large — the problem is that the **camera shows the whole 960×520 world at
zoom 1 while scenes only occupy a small band of it**, plus fixed chrome
reserves push the transport below the fold, plus actors are low-contrast
cards. Camera problem first, layout-reserve problem second, actor-contrast
problem third. Never solve by enlarging the stage world or actor footprints.

Verification for every phase: use the `explainers:verify` skill — build with
`npx vite build`, serve `npx vite preview --port 4173 --strictPort`, screenshot
via puppeteer-core (real setTimeout waits; `--virtual-time-budget` does NOT
advance Motion animations). Compare these states before/after:
- `?story=kubernetes&scene=1` at 1440×900 and 390×844 (mobile)
- `?story=dns&scene=2` at 1440×900
- `?story=gradient-descent&scene=1` at 1440×900
- 1280×720 laptop for fold check

---

## Phase 1 — Content-aware default camera framing (root cause, engine)

Files: `src/engine/motion.ts`, `src/engine/scene.ts` (maybe `timeline.ts`).

Today: camera defaults to center/zoom 1 (full 960×520 world); `frame()`
(motion.ts ~line 186) uses `margin: 80`, clamps `maxZoom: 1.6`; `resetCam()`
means "zoom 1, whole world". Scenes rarely opt into `view:`.

Changes:
1. At scene compile/setup time, compute the bounds of the scene's cast
   (actor specs + their `box` footprints; exclude packets/wires or actors that
   never become visible). Make this the **default camera**: the scene opens
   framing its content bounds with margin (~50px), not the full world.
2. Redefine `resetCam()` = "fit the scene's content bounds with margin".
   Keep an escape hatch `resetCam({ world: true })` for literal full-world.
3. Raise `frame()` defaults: `maxZoom` 1.6 → ~2.2–2.5, default margin 80 → ~50.
4. Zero story-file changes. Existing explicit `focus`/`frame`/`view` calls
   must still win over the default.

Expected visible result: k8s scene 1's two cards go from ~20% of the frame to
filling it; packet travel distance on screen roughly doubles.

## Phase 2 — One-screen layout: viewport-fit stage + merged chrome (shell only)

File: `src/engine/StoryShell.tsx` (+ possibly `Stage.tsx` for the SVG sizing).

Today: caption+hint reserve `min-h-16`, takeaway reserves `min-h-24` (~160px
of mostly-empty band during playback); at 900px viewport height the transport
controls and Continue button are cut off below the fold.

Changes:
1. Cap the stage's rendered height so the whole scene (header → stage →
   caption → transport) fits one viewport: e.g. SVG gets
   `max-height: calc(100dvh - <chrome height>)` (it scales via viewBox; width
   adjusts with h-auto/w-auto handling).
2. Remove the reserved takeaway band: crossfade the takeaway INTO the caption
   slot when `player.ended` (they never need full strength simultaneously).
3. Demote the hover hint line: show once, fade to near-invisible after first
   hover, never occupy layout when empty.
4. Tighten the narrative header (~140px today) — smaller top padding, tighter
   eyebrow/title spacing. Do not shrink the title's type scale.

Expected visible result: at 1440×900 AND 1280×720, transport + Continue are
fully visible without scrolling; the page reads as a presentation slide.

## Phase 3 — Mobile zoom bias (small new engine capability)

File: `src/engine/Stage.tsx` (`CameraRig`, ~lines 42–66).

Today: the 960-wide world uniformly downscales to 390px → actors ~60px,
labels ~5.5px; unreadable, feels like an embedded widget.

Changes:
1. Give CameraRig a viewport-aware zoom bias: on narrow viewports multiply
   the sampled zoom by ~1.6–1.8 and crop rather than letterbox — fixed-height
   container + `preserveAspectRatio="xMidYMid slice"`, or a portrait viewBox
   window. It composes with Phase 1 since it's all one transform.
2. Stage should claim ~55–60% of mobile viewport height; caption immediately
   beneath (or overlaid).
3. Keep it resize-reactive (listen to container size, not window UA sniffing).

## Phase 4 — Actor presence: glyph share + contrast (renderer constants)

Files: `src/engine/registry.tsx`, `src/engine/glyphs.tsx`.

Today: node = 150×84 card, 7%-opacity fill, 22%-opacity edge, 26px line glyph
(~17% of card area), 13.5px label. Reads as faint rectangles from a distance.

Changes:
1. Glyph 26px → ~34–36px within the same card; glyph strokeWidth 1.6 → ~2.
2. Card contrast one notch up: fill rgba ~0.07 → ~0.10, edge ~0.22 → ~0.30.
3. Accent tints the card edge as well as the glyph (accent identity readable
   when small).
4. Packet default radius 6 → 8 with slightly stronger halo. Spotlight dim
   factor 0.68 → ~0.75 (in Stage.tsx ActorView opacity math / verbs).
5. Do NOT enlarge card footprints (fights layout spacing defaults; camera
   already delivers apparent size).

## Phase 5 — Width inversion (shell only)

File: `src/engine/StoryShell.tsx`.

Today: stage, title, caption all share `max-w-5xl` → flat hierarchy.

Change: let the stage alone break the column (`max-w-6xl`+ / near full-bleed)
while captions stay `max-w-xl` and the title `max-w-2xl`. Media wide, text
narrow (Apple/Stripe inversion).

---

## Do NOT change

- Stage world dimensions (960×520) — stories have authored coordinates.
- The borderless stage — no visible box/card around it. If empty corners feel
  unowned after Phase 1, at most a barely-there radial vignette.
- The interaction model, headline type scale, or caption-below-stage order.
- Don't add more motion — the calm is a feature; the problem was distance.

## Order & scope summary

1 (engine: framing) → 2 (shell: fold fit) → 3 (Stage.tsx: mobile) →
4 (registry: contrast) → 5 (shell: widths). Phases 2/3/5 touch only
StoryShell.tsx/Stage.tsx; 1 and 4 are small engine edits; zero story files.
Re-screenshot the same five states after each phase and compare.
