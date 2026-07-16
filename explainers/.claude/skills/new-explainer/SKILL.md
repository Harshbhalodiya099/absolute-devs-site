---
name: new-explainer
description: Author a new interactive explainer story for the engine. Read this FIRST, before opening any engine source or existing story — it contains the full authoring API and the token-cheap workflow.
---

# Authoring a new explainer

This file is the complete authoring reference. Do NOT read `src/engine/*` or
ENGINE.md to author a story — everything a story file may use is listed below.
Only open engine source if you hit a genuine engine gap (then fix the engine,
not the story). `src/stories/dns/story.ts` is the canonical example if you
need to see idiom, but prefer this cheatsheet.

## Workflow — two phases, in this order

**Phase 1 — script (plain text, no code).** Write the full scene plan and show
it to the user for approval BEFORE writing any TypeScript:
- 3–5 scenes; each with: chapter, question, title, takeaway, nextPrompt.
- Per scene: 3–6 steps, each step = one caption sentence + a note of what
  appears/moves on stage.
- The arc that works: pain/problem → mechanism → anatomy → payoff. Narration
  creates curiosity ("who do you ask when nobody knows?"), takeaways answer it.

**Phase 2 — code, once.** Only after the script is approved:
1. Create `src/stories/<slug>/meta.ts` + `src/stories/<slug>/story.ts`.
   Discovery is automatic via glob — touch NO other file.
2. Translate the script scene by scene. Never invent new narrative in code.
3. Verify cheaply: `npx tsc -b` + `npx vite build`, then run dev and check the
   validator (it throws in dev naming scene/step/actor for empty steps,
   unknown actors, never-visible actors, negative timing).
4. Screenshots are the expensive loop: at most ONE screenshot pass, per scene,
   at the very end, via the `verify` skill. Never screenshot-iterate on
   pixel positions — use the geometry helpers instead.

## File shapes

```ts
// meta.ts
import { defineMeta } from "../../engine";
export const meta = defineMeta({
  slug: "kubernetes",
  title: "…",                       // library card title
  intro: { eyebrow: "An interactive explainer", title: "…", lead: "…", begin: "…" },
});

// story.ts
import { scene, defineStory, node, appear, seq /* … */ } from "../../engine";
import { meta } from "./meta";
const s1 = scene({ id: "…", chapter: "…", question: "…", title: "…",
  takeaway: "…", nextPrompt: "…", setup: (s, params) => { /* … */ } });
export default defineStory({ ...meta, scenes: [s1 /* … */] });
```

Import ONLY from `../../engine`. Stage is 960×520 (fixed viewBox); keep actors
inside x∈[80,880], y∈[70,460] so the camera has breathing room.

## Actors (created in `setup` via `s.cast({ id: factory(...) })`)

- `node({ x, y, label, sub?, glyph?, accent?, w?, h?, note?, visible? })` —
  the universal machine card (default 150×84).
- `bubble({ x, y, lines: string[], w?, accent? })` — speech from a machine.
- `label({ x, y, text, size?, color? })` — floating annotation.
- `region({ x, y, w, h, title?, accent? })` — dashed grouping box (x,y = center).
- `token({ x, y, text, accent? })` — small text pill.
- `dot({ x, y, r?, color? })` — primitive circle.
- Wires/packets are NOT cast: `const w = s.connect(a, b, { bow?, pad?, color?, dashed? })`,
  `const p = s.packet(wOrRoute, { color?, r?, label?, note? })`,
  `const r = s.route(from, to, { bow?, pad? })` (travel path, no wire drawn).
- `s.step("caption sentence.", [ ...motions ], { hold? })` — one narration beat.

Glyphs: `laptop globe server database cache balancer chip lock doc book user
cloud box gear commit`. Accents: `cyan blue violet amber rose green ink dim`.
Both are typed unions — a typo is a compile error. A missing glyph = add one
~20-line entry to `src/engine/glyphs.tsx`, nothing else.
Give every meaningful actor a `note` — hover shows it in the inspector line.

## Geometry — never hand-compute coordinates beyond the initial layout

`between(a, b, t?, {dx?,dy?})`, `below(ref, gap?)`, `above`, `leftOf`,
`rightOf`. Place the first row of actors with round numbers; derive the rest.

## Motions

Combinators: `seq(...)` one after another · `all(...)` simultaneous ·
`stagger(gap, ...)` cascade · `wait(s)` pacing. An array passed to `s.step`
is an implicit `seq`.

Narrative (GATE — next motion in a seq waits):
`appear(ref, dur=0.6)` · `vanish(ref)` · `show(ref)` (snap) ·
`fadeTo(ref, opacity)` · `move(ref, {x?,y?}, dur=0.8)` ·
`travel(packet, dur=1.5, {keepAlive?})` (auto fade in/out unless keepAlive) ·
`draw(wire, dur=0.8)` · `focus(refOrPoint, {zoom=1.45})` ·
`frame([refs], {margin?})` (fit group) · `resetCam()`.

Emphasis (LAYER — zero sequencing time, plays over what follows; wrap in
`wait()` to linger): `pulse(ref, forSec)` · `flash(ref)` · `glowOn/glowOff` ·
`dim(ref)` / `undim(ref)` · `shake(ref)` (rejection wobble).

Idioms: end a step with `pulse(target, 2)` + nothing after it so the glow
plays out. Pre-dim background actors with `dim(ref, 0.01)` at step start.
Camera: `focus` in, `resetCam` before the scene's last takeaway beat.

## Interaction (params) — use when a "what if" genuinely teaches

```ts
params: { visit: toggle("Cache", [["cold", "First visit"], ["warm", "Second visit"]]) },
setup: (s, params) => { if (params.visit === "warm") { /* different cast/steps */ } }
```
`toggle` = two options, `choice` = several. Changing one re-runs setup and
replays the scene. Values are inferred string unions.

## Custom visuals

Only when no composition of existing kinds works:
`defineActorKind(kind, renderer)` in the story file registers a renderer that
inherits every channel (`x y opacity scale glow dim progress`) + raw time.
Prefer a new glyph over a new kind.

## Quality bar (what made dns/kubernetes good)

- One caption = one sentence, present tense, concrete ("The question leaves
  your machine for the first time.").
- Every scene answers its `question`; the `takeaway` states the answer
  plainly; `nextPrompt` is the question pulling the learner forward.
- 12–25s per scene at 1×. Prefer fewer, richer scenes over many thin ones.
- Calm stage: 4–8 actors visible at once, dim what's not being discussed.
