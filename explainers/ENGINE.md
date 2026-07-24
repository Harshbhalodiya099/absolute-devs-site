# The Explainer Engine

A scene-based interactive learning engine. One engine, hundreds of explainers.
This document is the architecture: what exists today, why it cannot scale, and
the design that replaces it.

---

## 1. Diagnosis of v0 (`src/framework/`, `src/scenes/`)

v0 (the google.com journey) produced genuinely good output — calm visual
language, narration that creates curiosity, a takeaway rhythm. Those qualities
are kept. But its foundation fails the "300 explainers" test in three ways:

**1. Time is trapped inside the animation library.**
Every scene schedules itself with `delay`/`duration` props on Motion
components. Once mounted, the choreography is fire-and-forget. Consequences:

- Pause is impossible.
- Scrubbing is impossible.
- Step-back is impossible.
- "Replay" is a component remount (`replayKey`), which is a reset, not a seek.
- Speed change requires a remount too.

A timeline you cannot inspect is not a timeline; it is a screensaver.

**2. Scenes are hand-written JSX choreography.**
`SceneResolver` is ~40 lines of bespoke coordinates, paths, and delays. A new
explainer means writing 15 of these by hand. At 300 explainers that is ~4,500
bespoke components. Content and mechanism are entangled: you cannot change
"how packets look" without editing every scene that uses one.

**3. There is no interaction model.**
The only interactions are navigation and hover-tooltips. Nothing in the
architecture lets a learner change a parameter and watch the system respond.

**What v0 got right (and v1 keeps):** the narrative chrome
(question → cinematic title → animation → "What just happened?"), the
`Term` hover-for-depth pattern, the fixed SVG coordinate stage, the palette
and glass aesthetic, keyboard navigation, deep links.

---

## 2. First principle of v1: **rendering is a pure function of time**

Everything else follows from one decision:

> A scene is **data** — actors plus keyframe tracks. The engine owns a single
> clock `t`. The frame you see is `render(scene, t)`, nothing more.

Because the picture at `t = 3.2s` is computable without having played
`0 → 3.2s`, we get for free: pause, resume, scrub, step forward/back,
slow-motion, fast-forward, replay, jump-to-step, and deterministic rendering
under React StrictMode.

Implementation: the clock is a single Motion `MotionValue<number>` advanced by
`requestAnimationFrame`. Every animated attribute is a `useTransform` of it.
No React re-render happens per frame — React renders the scene *structure*
once; Motion writes sampled values straight to the DOM. That is the 60 fps
path.

---

## 3. The object model

```
Story                      one explainer ("How the internet finds google.com")
 └─ Scene                  one stage layout + one camera world
     ├─ params?            interactive controls (toggle / choice / slider)
     ├─ actors             id → ActorSpec { kind, x, y, props, note }
     └─ Step[]             narration beats on the shared stage
         ├─ caption        one sentence of narration
         └─ Act[]          timed primitive animations
```

- **Story** carries the title, intro copy, and scene order.
- **Scene** owns its actors and chrome (chapter, question, title, takeaway).
  Scenes are the unit of navigation; the camera never crosses a scene border.
- **Step** is the unit of narration. v0's "three DNS hierarchy scenes sharing
  one layout" becomes one scene with three steps — the layout persists, the
  camera and narration move.
- **Act** is the compiled atom: one keyframe on one channel of one actor.
  Authors never write Acts — they compose **Motions** (`appear`, `travel`,
  `draw`, `pulse`, `focus`… combined with `seq`/`all`/`stagger`/`wait`),
  which the step compiler expands into Acts.

A scene may be **static** (`actors` + `steps` inline) or **built**
(`build(params) → { actors, steps }`). Changing a param re-runs `build`,
recompiles the timeline, and replays. That single mechanism covers "toggle the
cache", "add more servers", "change the number of experts" — interaction as
*re-simulation*, which is exactly how you want learners to think.

## 4. Actors: one registry, not thirty components

Every actor is `{ kind, x, y, props }` where `kind` indexes a **registry** of
renderers. The registry is deliberately small; variety comes from composition:

| kind     | covers                                                        |
|----------|---------------------------------------------------------------|
| `node`   | browser, server, database, cache, router, load balancer, CPU, GPU, pod, worker… — a glass card with a **glyph**, label, sublabel, accent |
| `packet` | anything that travels a path: request, response, DNS query, token in flight |
| `wire`   | connections; draw themselves via a `progress` channel          |
| `bubble` | speech — the narrative voice of a machine                      |
| `label`  | floating annotation text                                       |
| `region` | dashed grouping (a datacenter, a machine boundary, a layer)    |
| `token`  | small pill of text (tokens, records, commits, keys)            |
| `dot`    | primitive circle (neurons, queue items)                        |

The taxonomy trap is making `Browser`, `Server`, `Database`… thirty bespoke
components — they would drift apart visually and each need its own animation
support. Instead there is **one card renderer + a glyph library**. Adding
"Elasticsearch shard" to the vocabulary = drawing one 20-line SVG glyph.
Genuinely new *shapes* (a neuron ring, a B-tree page) = registering one new
renderer that automatically inherits every channel and primitive.

Every actor uniformly exposes **channels** — `x, y, opacity, scale, glow,
dim, progress` — and the sampler doesn't know or care what kind it is. That is
why primitives compose across all actors, present and future.

Every actor may carry a `note`. Hovering any actor shows its note in a calm
inspector line under the stage (no popup clutter, no coordinate math fighting
the camera). This is the "learn by poking" layer.

## 5. The motion language

Authors never write timestamps. Primitives return **Motions**; combinators
compose them; the compiler flattens the composition into per-actor,
per-channel keyframe tracks with absolute times. Absolute time is an
implementation detail of the engine, not the author.

```
seq(...m)                  one after another
all(...m)                  simultaneously; lasts as long as the longest
stagger(gap, ...m)         overlapping cascade, each starts `gap` later
wait(s)                    pacing
```

Primitives take **typed actor refs** (see §8), never id strings:

```
appear(ref) / vanish / show / fadeTo     entrances & exits          (gate)
move(ref, {x, y})                        reposition                 (gate)
travel(ref, dur)                         packet along its route     (gate)
draw(ref)                                wire draws itself          (gate)
focus(refOrPoint, {zoom})                camera moves toward        (gate)
frame([refs])                            camera fits a group        (gate)
resetCam()                               pull back to full stage    (gate)
pulse(ref, secs) / flash / glowOn/Off    emphasis                   (layer)
dim / undim / shake                      emphasis                   (layer)
```

One rule governs sequencing: **narrative motions gate** (in a `seq`, the next
motion waits for them); **emphasis motions layer** (they take zero sequencing
time and play over whatever follows — wrap in `wait()` to linger).

Compilation: `steps` are laid end-to-end; each motion's relative offset
becomes absolute; keyframes land on `(actor, channel)` tracks, sorted.
Sampling is a binary search + easing interpolation; values hold after their
last keyframe (so scrubbing backwards is exact, not approximate). Periodic
effects (pulse) are windowed functions of `t`, so they too scrub correctly.

`travel` needs a position along an SVG path at arbitrary `t`. CSS
`offset-path` (v0's approach) cannot be scrubbed. Instead paths are sampled
once via `getPointAtLength` into a memoized lookup table; position at any
progress is a table interpolation. Scrub-safe, cheap, compatible.

## 6. The camera

The camera is a track like any other: keyframes of `{x, y, zoom}` applied as
a transform on the stage's root group, easing with a long cinematic curve.
`focus(at, { x: 420, y: 90, zoom: 1.5 })` zooms into the root server;
`resetCam(at)` pulls back to the whole diagram. Because it's sampled from the
same clock, the camera scrubs, pauses, and reverses with everything else.

## 7. The player

`usePlayer(duration, markers)` owns the clock:

- rAF loop advances `time` by `dt × speed` while playing; auto-pauses at the end.
- `seek`, `stepForward`, `stepBack` (markers = step boundaries), `replay`, speed 0.5–2×.
- Current step index derives from `time` crossing markers → narration captions
  crossfade at exactly the right moment, even while scrubbing.

The shell renders: chapter/question/title header → stage → step caption →
inspector line → footer with a **real scrubber** (drag anywhere in time, step
ticks marked), play/pause, step back/forward, replay, speed, scene dots, and
the takeaway card when a scene completes.

Keyboard: `space` play/pause, `←/→` step, `shift+←/→` scene, `R` replay.
Accessibility: the scrubber is a native range input; live region announces
steps; `prefers-reduced-motion` starts each scene paused at its final frame —
the learner steps through completed pictures instead of watching motion.

## 8. Authoring a new explainer

A new explainer is **one folder** under `src/stories/<slug>/` — `meta.ts`
(title + intro, eagerly loaded for the library page) and `story.ts` (the
scenes, lazily loaded as its own chunk). Both are discovered via
`import.meta.glob`: adding an explainer touches zero engine or app code.

```ts
const resolver = scene({
  id: "resolver",
  chapter: "Finding the address",
  question: "Who do you ask when nobody knows?",
  title: "Your browser doesn't know where Google lives.",
  takeaway: "Your computer sent a DNS query to a recursive resolver…",
  nextPrompt: "Where does the resolver start?",
  setup: (s) => {
    const { laptop, resolver } = s.cast({
      laptop:   v.browser({ ...spot("left"), label: "Your computer" }),
      resolver: v.server({ ...spot("right"), label: "DNS resolver" }),
    });
    const wire = s.connect(laptop, resolver, { bow: 90, dashed: true });

    s.step("The question leaves your machine for the first time.", [
      enter([laptop, resolver], 0.3),
      draw(wire),
      wire.send({ color: "cyan", label: "where is google.com?" }),
      pulse(resolver, 2.0),
    ]);
  },
});

export default defineStory({ ...meta, scenes: [resolver] });
```

The safety and geometry properties of this shape:

- **References are typed handles.** `cast()` returns refs; every primitive
  takes refs. A typo'd actor, glyph, or accent name is a compile error.
- **Geometry is derived.** `connect()` anchors wires on actor edges (every
  actor factory records its footprint) and owns its packets (`send/reply/
  exchange`); the layout engine (`spot/row/column/grid/radial/inside…`)
  derives positions from arrangements. A story states intent, not arithmetic.
- **Interaction is typed re-simulation.** `params: { visit: toggle(...) }`
  gives `setup` a typed `params.visit` with the value union inferred from the
  options. Changing a control re-runs setup, recompiles, replays.
- **Custom shapes don't fork the engine.** `defineActorKind(kind, renderer)`
  registers a renderer and returns a typed spec factory; the new kind inherits
  every channel and every motion primitive.

Authoring stays TypeScript (not JSON/YAML) on purpose: the type system is the
story linter, helpers stay composable, comments survive, and layouts can be
computed. The format *is* declarative data; TS is just the syntax.

## 8a. The v1.0 authoring layers (the stabilization sprint)

Motion primitives alone still left stories doing four kinds of manual work:
placing coordinates, wiring request/response packets, mapping over fanout
targets, and re-inventing choreography like "it crashes". v1.0 moved each into
an engine layer. A story now reads as: *place presets with layout, connect
them, narrate with verbs.*

**Layout (`layout.ts`).** Stories describe arrangements; the engine derives
geometry. `spot(name)` / `at(fx, fy)` anchor principals; `row / column /
grid / radial / stack` arrange groups (grid can fill a region's footprint:
`grid({ in: cluster, cols: 3, rows: 2 })`); `inside / spread / between /
below / above / leftOf / rightOf` derive relational positions. A literal
coordinate in a story marks a one-off, not the norm.

**Semantic connections (`scene.ts`).** A `ConnectionRef` owns its traffic:
`wire.send(opts)` creates a fresh packet and travels it a→b; `wire.reply()`
travels b→a on the *mirrored lane* (the engine reflects the curve's control
point so responses never overlap requests); `wire.exchange()` is
request-breath-response. `s.send(a, b)` is a one-shot packet with no wire.
Routes carry their control point and length (`RouteRef.c`, `.len`), which is
what makes reversal, mirroring, and auto-pacing engine responsibilities.

**Fanout (`scene.ts`).** `s.fanout(hub, targets, opts)` models one-to-many
(Service→Pods, Router→Experts, Bundle→CDN). The fan spreads bows
symmetrically so wires never coincide, and exposes `draw` (cascading wires),
`send` (broadcast), `gather` (targets→hub — responses, votes), `pulse`, and
`wires[i]` for per-lane control. `virtual: true` gives routes without visible
wires.

**Semantic verbs (`verbs.ts`).** Named system events compose the low-level
primitives: `crash` (wobble, lights out, faint ghost), `revive`, `enter` /
`exit` (cascaded group entrances). The architectural rule: a verb is a pure
function returning a Motion — growing the vocabulary (electLeader, replicate,
cacheMiss…) never adds channels or renderer concepts.

**Visual vocabulary (`src/vocab/`).** Extracted out of the engine so future
modes (simulation, assessment) can share the same look without importing the
animation engine — `accents.ts` (colours), `glyphs.tsx` (SVG), `presets.ts`
(named entities). The engine imports them back through `engine/index.ts`, so
stories are unaffected. The same concept looks the same in every
story: `v.pod`, `v.database`, `v.users`, `v.server`, `v.cache`,
`v.loadBalancer`, `v.controller`, `v.queue`, `v.worker`, `v.browser` — fixed
glyph/accent plus a default note, with copy overridable. `definePreset()`
creates story-local presets for domain concepts ("expert", "broker"). The
namespace `v` exists so preset names never shadow a story's cast variables.

**Automatic direction (opt-in, overridable).** `travel` and `draw` derive
their default duration from the path's length, so far things take longer than
near things without the author pacing them. `s.step(…, { view: [refs] })`
frames those actors while the step plays (`view: "all"` pulls back);
`s.spotlight(...keep)` dims everything else on stage (packets exempt), and
`s.clearSpotlight()` lifts it. Explicit durations, `focus`, `frame`, and
manual `dim` remain available everywhere — intelligence defaults, manual
direction always wins.

## 8b. Validation

What types cannot catch, the dev-mode validator does — at scene build time,
before a human ever scrubs the timeline: steps with no motion or no caption,
acts targeting unknown actors, negative timing, and actors that never become
visible. Failures throw in development and name the scene, the step, and the
actor. Production builds skip validation entirely.

## 9. Weaknesses I found while designing, and the refinements

1. **A closed set of "ops" can't cover every future visual** (morphing a
   B-tree split, attention heat maps). *Refinement:* the registry escape
   hatch — any custom renderer receives the same channels + raw `time`, so a
   bespoke visual can live inside one actor without forking the engine.
   Primitives cover 90%; the escape hatch covers the rest without leaking.
2. **Fully declarative *branching* interaction (drag a packet, choose a
   route) fights the keyframe model.** *Refinement:* interaction v1 is
   parameter-driven re-simulation (`build(params)`) — deterministic,
   scrub-safe, covers toggles/sliders/choices. Free-form drag becomes a later
   actor capability (`draggable` → emits param changes), not a new paradigm.
3. **Per-frame sampling cost.** Naive per-channel React state would melt.
   *Refinement:* one MotionValue clock + `useTransform` per channel; DOM
   writes only, zero renders per frame; paths pre-sampled into tables.
4. **Camera + hover tooltips conflict** (screen-space popups over a moving
   world). *Refinement:* the inspector line — hover meaning lives in a fixed
   chrome slot, not floating in camera space. Calmer, too.
5. **Step captions vs. scene narration ambiguity.** v0 had one narration per
   scene; real stories need beats. *Refinement:* scene keeps
   question/title/takeaway; each step owns one caption that crossfades as the
   playhead crosses its marker.

## 10. What "done" means for the engine core

- `src/engine/` has zero knowledge of DNS, HTTP, or any topic.
- The demo story imports only `defineStory` + DSL helpers.
- Deleting the demo story leaves a compiling, reusable engine.
- Adding the next explainer (TCP, MoE, Raft…) = adding one `stories/*/story.ts`
  file, plus at most a few new glyphs.
