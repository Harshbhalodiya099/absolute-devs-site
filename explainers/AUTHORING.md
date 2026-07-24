# Authoring an explainer

The complete API reference for writing a story on the explainer engine. It is
tool-neutral: any developer, or any LLM assistant, can read this file alone and
author a working explainer. Nothing here is Claude-specific — you do **not**
need to read `.claude/`, `CLAUDE.md`, or engine source to use the engine.

- One import: everything hangs off `E` (`import { E } from "../../engine"`).
- One folder per explainer: `src/stories/<slug>/` with `meta.ts` + `story.ts`.
  Discovery is automatic (glob) — adding an explainer touches no other file.
- `src/stories/kubernetes/story.ts` is the canonical worked example.

Convention in this doc: a bare name like `spot(...)`, `appear(ref)`, `v.pod`
is reached as `E.spot`, `E.appear`, `E.v.pod`. Names shown as `s.something`
(`s.cast`, `s.step`, `s.connect`) are methods on the stage handed to `setup`,
not on `E`. Stage is 960×520 (fixed viewBox); keep actors inside x∈[80,880],
y∈[70,460] so the camera has breathing room.

## File shapes

```ts
// meta.ts — the tiny library-card record, loaded eagerly for the index.
import { E } from "../../engine";
export const meta = E.meta({
  slug: "kubernetes",
  title: "…",                       // library card title
  intro: { eyebrow: "An interactive explainer", title: "…", lead: "…", begin: "…" },
});

// story.ts — the scenes, loaded lazily as its own chunk.
import { E } from "../../engine";
import { meta } from "./meta";
const s1 = E.scene({ id: "…", chapter: "…", question: "…", title: "…",
  takeaway: "…", nextPrompt: "…", setup: (s, params) => { /* … */ } });
export default E.story({ ...meta, scenes: [s1 /* … */] });
```

## The one thing to understand: `setup` has two objects, `s` and `E`

- **`s` — the stage.** The scene you're building on. It remembers what you've
  added. You *do* things to it: `s.cast` (place actors), `s.connect` /
  `s.fanout` (wire them), `s.step` (write one beat of narration).
- **`E` — the kit.** Stateless tools you build *with*. It remembers nothing —
  every call just returns a value you hand to `s`: a shape to place
  (`E.v.pod`, `E.node`), a place to put it (`E.spot`, `E.grid`), or a move for a
  beat (`E.appear`, `E.draw`, `E.crash`).

Rule of thumb: **`s.` changes the scene; `E.` makes a thing to hand to `s`.**
`setup` also receives a second arg, `params`, only if the scene declares
interactive controls (see Interaction below).

A whole scene, annotated — this is all `setup` ever is:

```ts
E.scene({
  id: "one-server", chapter: "…", question: "…",
  title: "…", takeaway: "…", nextPrompt: "…",
  setup: (s) => {
    // 1. place actors — E makes them, s.cast puts them on the stage.
    //    The keys (users, app) become both the ids and typed handles.
    const { users, app } = s.cast({
      users: E.v.users(E.spot("left")),   // a preset, at a named anchor
      app:   E.v.pod({ x: 680, y: 262 }),
    });

    // 2. wire two actors together — the wire owns its packets.
    const link = s.connect(users, app);

    // 3. write a beat: one caption + a list of E.* moves that play in order.
    s.step("A request arrives; the one container answers.", [
      E.enter([users, app]),          // both fade onto the stage
      E.draw(link),                   // the wire draws itself
      link.send({ label: "GET /" }),  // a packet travels users → app
    ]);
    // more s.step(...) calls = more beats. That's the entire scene.
  },
});
```

## Full reference — every name on `E`

- **make**: `E.story` (= the whole explainer) · `E.meta` · `E.scene` · `E.explainer` (alias of `story`)
- **params**: `E.toggle` · `E.choice`
- **visuals**: `E.v.*` presets · `E.definePreset` · factories `E.node E.bubble E.label E.region E.token E.dot`
- **layout**: `E.spot E.at E.row E.column E.grid E.radial E.stack E.inside E.spread E.between E.below E.above E.leftOf E.rightOf`
- **motion**: combinators `E.seq E.all E.stagger E.wait`; narrative `E.appear E.vanish E.show E.fadeTo E.move E.travel E.draw`; emphasis `E.pulse E.flash E.glowOn E.glowOff E.dim E.undim E.shake`; camera `E.focus E.frame E.resetCam`
- **verbs**: `E.crash E.revive E.enter E.exit`
- **custom**: `E.defineActorKind`

And on the stage handle `s` (inside `setup`): `s.cast s.add s.connect s.route
s.packet s.send s.fanout s.spotlight s.clearSpotlight s.step`.

Reading a story back out (app side) is the mirror endpoint in `src/stories`:
`listExplainers()` for the library, `getExplainer(slug)` for one story's scenes.

## Layout — describe arrangements; the engine derives coordinates

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
const edge = E.definePreset({ glyph: "cloud", sub: "edge cache", accent: "cyan", w: 132, note: "…" });
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
~20-line entry to `src/vocab/glyphs.tsx`, nothing else.
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
  opts)` + `E.travel(packetRef, dur?)` for a persistent packet you reuse.
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
params: { visit: E.toggle("Cache", [["cold", "First visit"], ["warm", "Second visit"]]) },
setup: (s, params) => { if (params.visit === "warm") { /* different cast/steps */ } }
```
`toggle` = two options, `choice` = several. Changing one re-runs `setup` and
replays the scene. Values are inferred string unions.

## Adding a quiz — `src/assessments/<slug>.ts`

An explainer gains a **Check understanding** tab by one file appearing next to
it, exactly like a story appears by its folder appearing. No registration, no
change to `story.ts`, no engine code.

```ts
// src/assessments/dns.ts — same slug as src/stories/dns/
import { defineAssessment } from "../learn";

export default defineAssessment({
  lead: "Four questions about the walk you just watched.",   // optional
  questions: [ /* … */ ],
});
```

Three question types. Every question needs `id`, `prompt` and `explain`.

```ts
// 1. multiple choice — `answer` is an index into `options`
{ id: "first-look", type: "mcq",
  prompt: "Where does your machine look first?",
  options: ["A root server", "Its own caches", "Your ISP's resolver"],
  answer: 1,
  explain: "Nothing leaves the machine until the local caches miss." }

// 2. order the steps — write `steps` CORRECT; the learner sees them shuffled
{ id: "the-walk", type: "order",
  prompt: "Put the resolver's walk back in order.",
  steps: ["Ask the resolver", "Ask a root server", "Ask the .com registry"],
  explain: "Each level knows exactly one thing: who to ask next." }

// 3. identify on a diagram — parts are drawn with the shared vocabulary
{ id: "who-is-certain", type: "identify",
  prompt: "Which one answers with certainty rather than a referral?",
  parts: [
    { id: "resolver", glyph: "server", label: "Resolver", sub: "does the walking", accent: "cyan" },
    { id: "auth", glyph: "server", label: "ns1.google.com", accent: "green" },
  ],
  answer: "auth",
  explain: "Only the authoritative server holds an answer, not a referral." }
```

`glyph` and `accent` are the same names story files use (`E.v.*` presets are
built from them), so a cache looks like a cache in both places.

Rules that keep quizzes worth taking:

- **Answerable from the explainer alone.** A question needing outside knowledge
  tests reading history, not understanding.
- **`explain` is the point.** Write it as the sentence you'd say to someone who
  just got it wrong — and say slightly more than the question asked. It is shown
  for right answers too. (A regression test fails if it's a stub.)
- **Three to five questions.** The quiz is a check, not an exam.
- **No trick options.** Wrong options should be things a learner might
  plausibly believe after watching.
- Feedback is deterministic — same answer, same verdict, always. There is no
  scoring beyond "n of m right", by design: no points, streaks or badges.

Malformed data is loud in `npm run dev` (the mode throws, naming every issue)
and skipped in production, so a typo can never blank a learner's page. Run
`npm test` — `src/assessments/__tests__/library.test.ts` validates every shipped
quiz.

## Custom visuals

Only when no composition of existing kinds works:
`E.defineActorKind(kind, renderer)` in the story file registers a renderer that
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
  another (`E.below(node2, …)`).

## Verify

`npx tsc -b` (types) + `npx vite build` (bundles), then `npm run dev` and open
the story — a dev-only validator throws, naming the scene/step/actor, on empty
steps, unknown actors, never-visible actors, negative timing, or overlapping
solid actors. Fix overlaps by anchoring with `above/below/leftOf/rightOf`,
never raw x/y near another card.
