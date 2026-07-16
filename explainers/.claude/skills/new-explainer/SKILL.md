---
name: new-explainer
description: Author a new interactive explainer story for the engine. Read this FIRST, before opening any engine source or existing story — it contains the full authoring API and the token-cheap workflow.
---

# Authoring a new explainer

This file is the complete authoring reference. Do NOT read `src/engine/*` or
ENGINE.md to author a story — everything a story file may use is listed below.
Only open engine source if you hit a genuine engine gap (then fix the engine,
not the story). `src/stories/kubernetes/story.ts` is the canonical example if
you need to see idiom, but prefer this cheatsheet.

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
   pixel positions — use the layout engine instead.

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
import { scene, defineStory, v, spot, appear /* … */ } from "../../engine";
import { meta } from "./meta";
const s1 = scene({ id: "…", chapter: "…", question: "…", title: "…",
  takeaway: "…", nextPrompt: "…", setup: (s, params) => { /* … */ } });
export default defineStory({ ...meta, scenes: [s1 /* … */] });
```

Import ONLY from `../../engine`. Stage is 960×520 (fixed viewBox); keep actors
inside x∈[80,880], y∈[70,460] so the camera has breathing room.

## Layout — the engine derives coordinates; you describe arrangements

Anchor the principals with named spots, arrange groups with layout calls,
derive the rest relationally. Hand-typed coordinates are a last resort.

- `spot(name, {dx?,dy?})` — named stage anchors: `topLeft top topRight left
  center right bottomLeft bottom bottomRight`. `at(fx, fy)` for fractions.
- `row({at, count, gap?})` / `column({at, count, gap?})` → `Point[]`.
- `grid({cols, rows, at?, gapX?, gapY?})` or `grid({cols, rows, in: regionRef,
  pad?})` → `Point[]` row-major (the `in` form fills a region's box).
- `radial({at, count, r?, startAngle?})` — rings (experts, peers, neurons).
- `stack({at, count, dx?, dy?})` — deck-of-cards offsets (replicas, layers).
- `inside(ref, fx?, fy?)` — a point inside an actor's footprint.
- `spread(a, b, count)` — points along the line between two actors.
- Relational points: `between(a, b, t?, {dx?,dy?})`, `below(ref, gap?)`,
  `above`, `leftOf`, `rightOf`.

## The visual vocabulary (presets) — same concept, same look, every story

`v.<preset>({ ...point, ...overrides })` — each has a fixed glyph/accent and a
default note; override `label/sub/note/w/h/accent` freely:
`v.users v.browser v.server v.database v.cache v.loadBalancer v.pod
v.controller v.queue v.worker`.

A story-local repeated concept deserves its own preset, defined once:
```ts
const edge = definePreset({ glyph: "cloud", sub: "edge cache", accent: "cyan", w: 132, note: "…" });
```

Raw factories for everything else (created in `setup` via
`s.cast({ id: factory(...) })`):
- `node({ x, y, label, sub?, glyph?, accent?, w?, h?, note?, visible? })` —
  the universal machine card (default 150×84).
- `bubble({ x, y, lines: string[], w?, accent? })` — speech from a machine.
- `label({ x, y, text, size?, color? })` — floating annotation.
- `region({ x, y, w, h, title?, accent? })` — dashed grouping box (x,y = center).
- `token({ x, y, text, accent? })` — small text pill.
- `dot({ x, y, r?, color? })` — primitive circle.

Glyphs: `laptop globe server database cache balancer chip lock doc book user
cloud box gear queue commit`. Accents: `cyan blue violet amber rose green ink
dim`. Both typed unions — a typo is a compile error. A missing glyph = add one
~20-line entry to `src/engine/glyphs.tsx`, nothing else.
Give every meaningful actor a `note` — hover shows it in the inspector line.

## Relationships — connections own packets; never hand-build request/response

- `const wire = s.connect(a, b, { bow?, pad?, color?, dashed? })` — a wire that
  knows its endpoints. Then, inside steps:
  - `wire.send({ color?, label?, dur?, keepAlive? })` — packet a→b (fresh
    packet per call; duration auto-derived from path length if omitted).
  - `wire.reply({...})` — packet b→a on the mirrored lane (default green).
  - `wire.exchange({ send?, reply?, gap? })` — request, breath, response.
- `s.send(from, to, { color?, label?, bow?, dur? })` — one-shot packet, no wire.
- `s.fanout(hub, targets, { dashed?, color?, bowSpread?, virtual? })` — one hub
  to many (Service→Pods, Router→Experts). Returns a fan:
  - `fan.draw({gap?, dur?})` — wires cascade in.
  - `fan.send({color?, label?, gap?, dur?})` — broadcast hub→targets.
  - `fan.gather({...})` — targets→hub (responses, votes, results).
  - `fan.pulse(forSec?)` — all targets pulse. `fan.wires[i]` for one lane.
  - `virtual: true` = routes only, no visible wires.
- Low level (rare): `s.route(from, to, {bow?, pad?})` + `s.packet(routeOrWire,
  opts)` + `travel(packetRef, dur?)` for a persistent packet you reuse.
- `s.step("caption sentence.", [ ...motions ], { hold?, view? })` — one beat.
  `view: [refs]` frames those actors while the step plays; `view: "all"`
  pulls back to the whole stage.

## Motions

Combinators: `seq(...)` one after another · `all(...)` simultaneous ·
`stagger(gap, ...)` cascade · `wait(s)` pacing. An array passed to `s.step`
is an implicit `seq`.

Narrative (GATE — next motion in a seq waits):
`appear(ref, dur=0.6)` · `vanish(ref)` · `show(ref)` (snap) ·
`fadeTo(ref, opacity)` · `move(ref, {x?,y?}, dur=0.8)` ·
`travel(packet, dur?, {keepAlive?})` · `draw(wire, dur?)` (both auto-time from
path length) · `focus(refOrPoint, {zoom=1.45})` ·
`frame([refs], {margin?})` (fit group) · `resetCam()`.

Semantic verbs (GATE — choreography with a name):
`crash(ref, {remains?})` — wobble, then lights out, faint ghost stays ·
`revive(ref)` — light returns with a recovery glow ·
`enter([refs], gap?)` / `exit([refs], gap?)` — cascade on/off stage.

Emphasis (LAYER — zero sequencing time, plays over what follows; wrap in
`wait()` to linger): `pulse(ref, forSec)` · `flash(ref)` · `glowOn/glowOff` ·
`dim(ref)` / `undim(ref)` · `shake(ref)` (rejection wobble).

Attention: `s.spotlight(ref1, ref2, …)` dims everything else on stage
(packets exempt); `s.clearSpotlight()` lifts every dim.

Idioms: end a step with `pulse(target, 2)` + nothing after it so the glow
plays out. Camera: `focus`/`view:` in, `view: "all"` before the scene's last
takeaway beat.

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
Prefer a new glyph over a new kind, and a preset over both.

## Quality bar (what made dns/kubernetes good)

- One caption = one sentence, present tense, concrete ("The question leaves
  your machine for the first time.").
- Every scene answers its `question`; the `takeaway` states the answer
  plainly; `nextPrompt` is the question pulling the learner forward.
- 12–25s per scene at 1×. Prefer fewer, richer scenes over many thin ones.
- Calm stage: 4–8 actors visible at once, dim what's not being discussed.
- A pitfall: a cast key may not reference another key from the same `s.cast`
  call (TDZ) — split into two casts when one actor's position derives from
  another (`below(node2, …)`).
