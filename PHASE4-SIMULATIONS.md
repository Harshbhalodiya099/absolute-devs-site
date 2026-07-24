# Phase 4 — Simulation Validation & Production

> **Purpose of this file:** a cold-start handoff. Drop it into a new chat and you
> have everything needed to build the Phase 4 simulations without re-deriving
> context. Read this top-to-bottom, then start at **Milestone 1**.

---

## 0. What this phase is

The Interactive Learning Engine already ships three things (all done, tested,
production-ready):

- **Story mode** — the existing animation engine (`explainers/src/engine/`).
- **Quiz mode** — the Assessment engine (`explainers/src/learn/assessment/`).
- **Simulation kernel** — Tier-0/1 headless deterministic kernel
  (`explainers/src/sim/`).

Phase 4 is **not** about building more infrastructure. It validates that the
architecture supports real, interactive simulations for **multiple** engineering
systems with minimal topic-specific code, and lets abstractions emerge from
**proven** reuse (Rule of Three) — not up-front design.

**Deliverables:** three production simulations (DNS, Kubernetes, Elasticsearch),
each integrated as a `Simulate` tab so the learning flow is
**Story → Quiz → Simulate → (back to Story)**; then an architecture review that
refactors *only* what three real sims proved reusable; then release **v0.3.0**.

**Working philosophy (from the brief — follow it strictly):** product first, ship
explainers, Rule of Three, build abstractions only after proven reuse, small
duplication is acceptable, deterministic systems, incremental development,
production deploy after each milestone. Think like a **product engineer**, not a
framework engineer. Do **not** redesign the engine unless implementation reveals
a genuine problem.

---

## 1. The one decision that shapes everything

The existing kernel `explainers/src/sim/metrics/solve.ts` is a **Tier-1
queueing/flow solver**: it computes steady-state latency/throughput/utilization
over a *static* graph in a single forward pass. It was built for
"reduce-read-latency-with-a-cache" throughput scenarios.

**DNS, Kubernetes, and Elasticsearch are not throughput problems.** They are
**interactive, action-driven state machines** — the plan's **Tier 0** ("scripted
state machine — DNS steps, Git graph ops"):

- **DNS** — a lookup *walks* resolver → root → TLD → authoritative; caches
  short-circuit the walk; breaking a nameserver makes it fail.
- **Kubernetes** — a *reconciliation loop* drives actual replicas toward desired;
  killing a pod / failing a node triggers rescheduling and self-healing.
- **Elasticsearch** — *shard placement + routing*; a node failure promotes a
  replica and rebalances; a search fans out across shards.

**So the reuse being validated is the deterministic-reducer spine, NOT the flow
solver.** Each sim is a pure reducer `step(state, action, rng) → state'` that
reuses:

- `makeRng` (seeded PRNG) from `explainers/src/sim/rng.ts` — the *only*
  randomness source; keeps traces reproducible.
- Plain serializable JSON state → golden `JSON.stringify` determinism tests.
- The shared visual vocabulary `explainers/src/vocab/` (`Glyph`, `accent`, `C`).
- The `Mode` contract from `explainers/src/learn/contracts.ts`.

The Tier-1 solver (`sim/metrics/solve.ts`, `sim/kernel/kernel.ts`) is **left
untouched** for future queueing scenarios. This is an honest finding to record in
the final architecture review, not a failure.

**Confirmed decisions (do not re-litigate):**

1. **Tier-0 pure reducer** per sim (not the flow solver).
2. **Bespoke SVG + `vocab`** rendering — no new dependencies (`motion` is already
   a dep; use it for packet animation). No React Flow.
3. **Milestone-by-milestone**: build DNS, verify, pause for the user's
   review/deploy, *then* Kubernetes, etc. Deploys are **user-triggered**
   (Cloudflare `wrangler pages deploy`) — do not deploy yourself.

---

## 2. Architecture you're plugging into (verified against live code)

```
explainers/src/
  engine/            EXISTING animation engine — untouched (becomes `story` mode)
  vocab/             shared visual language: glyphs.tsx (Glyph{name,color}),
                     accents.ts (C palette + accent(name)), presets.ts
  sim/               headless, deterministic, React-free
    rng.ts           makeRng(seed) → { next(), int(n) }   ← REUSE
    contracts.ts     SimNode/SimEdge/etc (Tier-1 types)
    metrics/solve.ts Tier-1 flow solver                    ← leave untouched
    kernel/kernel.ts createSim/step/run/serialize          ← leave untouched
    __tests__/       golden/determinism harness (pattern to mirror)
  learn/             composition layer (React)
    contracts.ts     Mode = { id, label, render(host): ReactNode }; HostServices
                     = { vocab, nav?, selection?, timeline?, controls? }
    createExplainer.ts   createExplainer(...) + fromStory(def, {read, assessment})
    host/ModeHost.tsx    tabs appear only when >1 mode; single mode = no chrome
    modes/story.tsx      story() mode factory
    modes/quiz.tsx       quiz() mode factory (lazy Suspense) ← PATTERN to copy
    assessment/          the Assessment engine + QuizView.tsx (nav "review story")
  assessments/       quiz data packs, glob-discovered
    index.ts         hasAssessment/loadAssessment via import.meta.glob ← PATTERN
    dns.ts           the DNS quiz (default-exports defineAssessment({...}))
  app/StoryLoader.tsx  loads story + assessment in Promise.all, runs fromStory →
                       ModeHost. Add sim loading here.
  stories/           dns/, kubernetes/, elasticsearch/ all exist (+ 10 others)
```

**How a mode reaches the screen:** `StoryLoader` (`slug`) → `loadStory` +
`loadAssessment` in parallel → `fromStory(story, {read, assessment})` composes
`[story, quiz?]` → `<ModeHost explainer={...} />` renders tabs. A quiz appears
purely because `src/assessments/<slug>.ts` exists. **Simulations follow the exact
same discovery pattern.**

**Key rule:** `sim/` and `vocab/` import **no React** (headless). `learn/`,
`sims/`, and `engine/` are the React layer. This keeps a future monorepo lift a
`git mv`. Preserve it: the headless reducer lives in `sim/<topic>/`; the React
view lives in `sims/<slug>.tsx` (or `learn/sim/`).

**Test/build:** from `explainers/`: `npm test` (Vitest, jsdom), `npm run build`
(`tsc -b && vite build`). Use the **`verify` skill** to build/run/screenshot the
app. Run `npm test` whenever you touch `src/learn/`.

---

## 3. Milestone 1 — DNS Simulation (BUILD THIS FIRST)

Add a **Simulate** tab to the existing DNS explainer. The learner can: trigger a
lookup and watch the packet walk resolver → root → TLD → authoritative; toggle the
resolver cache and clear its TTL (hit vs. miss); break a nameserver and watch the
lookup fail; read accumulated latency + a causal step log. Understanding, not
packet accuracy.

### 3a. Headless reducer — `explainers/src/sim/dns/` (React-free, tested)

- **`state.ts`** — plain serializable types:
  - `DnsNodeId = "client" | "resolver" | "root" | "tld" | "auth"`
  - `Hop { from: DnsNodeId; to: DnsNodeId; latencyMs: number; note: string }`
  - `DnsState { tick, seed, cacheEnabled, cached, down: Record<DnsNodeId,boolean>,
    phase: "idle"|"walking"|"answered"|"failed", plan: Hop[], activeHop: number,
    totalLatencyMs: number, log: string[] }`
  - `DnsAction = { type:"lookup" } | { type:"advance" } | { type:"toggleCache" }
    | { type:"clearCache" } | { type:"toggleDown"; node: DnsNodeId }
    | { type:"reset" }`
- **`reduce.ts`** — pure `reduce(state, action, rng) => state` (never mutate input):
  - `lookup` builds the full deterministic **plan** (hops + per-hop latency with
    small seeded jitter from `makeRng`), sets `phase:"walking"`, `activeHop:0`,
    resets `totalLatencyMs`/`log`.
    - **Cache hit** (`cacheEnabled && cached`) → single client→resolver hop, fast
      (~a few ms); log "resolver cache hit — TTL still valid".
    - **Miss** → client→resolver, resolver→root, root→tld, tld→auth,
      auth→resolver (answer), resolver→client. If a required server is `down`, the
      plan ends early and resolves to `phase:"failed"` with a log line explaining
      the timeout at that hop.
  - `advance` moves `activeHop`, accumulates `totalLatencyMs` from the hop it just
    completed, appends a log line; at the end sets `phase:"answered"|"failed"`, and
    on a **successful miss with cache enabled** writes `cached:true` (TTL
    write-back → the next lookup is a fast hit).
  - `clearCache` → `cached:false` (expire TTL). `toggleCache` flips `cacheEnabled`
    (and, if turning off, clears `cached`). `toggleDown` flips one server. `reset`
    → clean idle state (keep `seed`).
- **`index.ts`** — export `initialDnsState(seed)`, `reduceDns` (alias of reduce),
  and the types. Import `makeRng` from `../rng` — **do not** duplicate the PRNG.
- **`__tests__/dns.test.ts`** — mirror `sim/__tests__/kernel.test.ts`:
  - determinism: same `(seed, action list)` ⇒ byte-identical `JSON.stringify`
    trace across two runs;
  - miss latency ≫ hit latency;
  - broken root ⇒ `phase:"failed"` and no answer;
  - successful miss with cache on ⇒ the next `lookup` is a hit;
  - reducer purity (input object unchanged after `reduce`).

### 3b. Generic `simulate` mode factory — `explainers/src/learn/modes/simulate.tsx`

Copy the shape of `modes/quiz.tsx`: thin, lazy-loaded, returns a `Mode`
`{ id:"simulate", label: opts.label ?? "Simulate", render(host) =>
<Suspense fallback={null}>…</Suspense> }`. Accept a lazy view component so an
explainer with no sim never downloads the chunk. Pass `host` into the view so it
can offer "Back to the story" via `host.nav?.go("story")` (mirrors `QuizView`'s
`onReviewStory` in `learn/assessment/QuizView.tsx`).

### 3c. DNS renderer + registration — `explainers/src/sims/dns.tsx` (React layer)

Co-locate the topic view with its registration (like an assessment data file);
import the headless reducer from `sim/dns`:

- `DnsSim({ host })` — `useReducer(reduceDns, undefined, () => initialDnsState(seed))`.
  Fixed-layout SVG stage drawing the five nodes with `Glyph` + `accent`/`C` from
  `vocab`; edges as SVG paths; an animated packet dot travelling the active hop
  with `motion` (instant when `prefers-reduced-motion`). A `useEffect` timer
  dispatches `advance` (~700ms) while `phase==="walking"`. Controls: **Look up
  google.com**, cache on/off toggle, **Clear cache (expire TTL)**, per-server
  **Break/Restore**, **Reset**. Readouts: total latency + the causal step log.
  Down/failed use rose/amber accents; healthy uses cyan/green.
- `export default simulate(() => <DnsSim />, { label: "Simulate" })`.

Suggested node glyphs (from `vocab/glyphs.tsx`): client=`laptop`, resolver=`server`,
root/tld=`book`, auth=`server` (or `globe`). Accents from `accents.ts` `C`.

### 3d. Discovery + wiring (mirror `src/assessments/`)

- **`explainers/src/sims/index.ts`** — `import.meta.glob` over `./*.tsx` (exclude
  `index`): `hasSim(slug)`, `loadSim(slug): Promise<Mode|null>`, `simSlugs`. Direct
  analogue of `src/assessments/index.ts`.
- **`explainers/src/learn/createExplainer.ts`** — extend `fromStory` opts with
  `sim?: Mode | null`; compose modes in order **`[story, quiz?, simulate?]`**;
  skip sim in `read` mode (same rule as quiz).
- **`explainers/src/app/StoryLoader.tsx`** — add `loadSim(slug)` to the existing
  `Promise.all`, hold in state, pass to `fromStory`. Keeps all chunks in flight.
- **`explainers/src/learn/index.ts`** — export `simulate` + its options type.

### 3e. Files (Milestone 1)

- **New:** `src/sim/dns/{state.ts,reduce.ts,index.ts,__tests__/dns.test.ts}` ·
  `src/learn/modes/simulate.tsx` · `src/sims/{index.ts,dns.tsx}`
- **Edit:** `src/learn/createExplainer.ts` · `src/app/StoryLoader.tsx` ·
  `src/learn/index.ts`
- **Reuse (no change):** `sim/rng.ts`, `vocab/*`, `learn/contracts.ts`,
  `modes/quiz.tsx` (pattern), `assessments/index.ts` (pattern). Tier-1 solver
  untouched.

### 3f. Verification (Milestone 1)

- `npm test` — new `sim/dns` golden/determinism tests pass; existing suites
  (kernel, ModeHost, assessments) stay green.
- `verify` skill — `tsc -b` + `vite build` clean; screenshot the DNS **Simulate** tab.
- Manual (dev): DNS explainer tabs read **Story · Check understanding · Simulate**.
  In Simulate: lookup → packet walks the hierarchy, latency ~tens of ms; enable
  cache + lookup again → fast cache hit; Clear cache → slow again; Break the root →
  next lookup fails with an explanatory log line; Reset. Reduced-motion collapses
  animation to instant. Other explainers (no sim file) show **no** Simulate tab.

Then **stop** and let the user review + deploy before Milestone 2.

---

## 4. Milestone 2 — Kubernetes Simulation ✅ DONE (Phase 4.1)

Same spine, different reducer — this is where reuse gets *validated*. Interactions:
scale replicas, kill a pod, node failure, scheduler placement, service routing,
rolling update, observe self-healing. Model as a **reconciliation loop**: state
holds nodes, pods (desired vs. running), and a controller; `advance`/`tick` moves
actual toward desired and reschedules pods off failed nodes. Reuse the M1 spine
(reducer + `makeRng` + SVG stage helpers + `simulate` mode + `sims/` discovery).
**Add abstractions only if K8s genuinely forces them** — otherwise accept small
duplication with the DNS view. `src/sim/kubernetes/` + `src/sims/kubernetes.tsx`.

### Completion report (Phase 4.1)

**Built.** A reconciliation-loop reducer that drives *actual* replicas toward
*desired*: `tick` advances each pod at most one lifecycle phase per turn
(Pending → Creating → Running), garbage-collects Lost/Terminating pods, detects
pods on NotReady nodes, and schedules Pending pods onto the least-loaded Ready
node (ties broken by the shared seeded rng). Interactions: scale ±, kill a pod
(self-heals), fail/recover a node (reschedules), reset. A `settled` flag marks
the loop's fixed point so a converged **or** genuinely stuck (unschedulable)
cluster stops ticking — capacity pressure (desired > free slots) is a first-class
teaching state, not a hang.

**Engine-modification report — ZERO engine changes.** The primary Phase 4 metric.
Nothing under `src/sim/` core (`rng.ts`, `contracts.ts`, `kernel/`, `metrics/`,
`rules/`), `src/learn/` (`createExplainer`, `ModeHost`, `modes/simulate.tsx`,
`contracts.ts`), `src/sims/index.ts`, `src/app/StoryLoader.tsx`, or `vocab/` was
touched. Kubernetes plugged into the M1 spine entirely through **two new files**
(plus its test) — proving the discovery + `simulate`-mode + reducer architecture
is not DNS-specific.

- **New:** `src/sim/kubernetes/{state.ts,reduce.ts,index.ts,__tests__/kubernetes.test.ts}`
  · `src/sims/kubernetes.tsx`
- **Modified (engine):** none. **Modified (other):** this doc + memory only.
- **Reused unchanged:** `sim/rng.ts` (`makeRng`), `vocab/*` (`C`, `Glyph`),
  `learn/modes/simulate.tsx`, `learn/contracts.ts` (`HostServices`/`Mode`),
  `sims/index.ts` glob discovery, `createExplainer` sim composition.

**Reuse observations (for the Phase 4.2 review — do not refactor yet).**
- The **reducer spine** (pure `reduce(state, action, rng)`, seeded `makeRng`,
  flat-JSON state, golden `JSON.stringify` determinism tests) transferred with
  zero friction — this is the validated reusable primitive.
- Two view-layer patterns now appear in **both** sims (Rule of Three: not yet):
  (1) the `TICK_MS` auto-advance `useEffect` keyed on a "still-moving" flag
  (`phase==="walking"` for DNS, `!settled` for K8s); (2) the button style
  constants `SECONDARY`/`CHIP` and the SVG stage scaffold (nodes from `Glyph`,
  phase→colour map, step-log panel). Left **duplicated on purpose** — a shared
  `<Stage>`/`useSimLoop` should emerge only if the third sim (Elasticsearch) also
  needs them. One awkwardness worth noting: DNS *plans then walks*; K8s
  *continuously reconciles* — a single generic loop abstraction would have to
  span both shapes, so premature extraction would likely be wrong.

**Tests:** 11 new golden/determinism/regression tests (`kubernetes.test.ts`);
full suite **100 passing**. `tsc -b` + `vite build` clean; K8s is its own
10.35 kB lazy chunk. Verified in-browser: scale-up spreads pods, node failure
reschedules onto survivors, over-capacity leaves an unschedulable Pending pod and
settles, reduced-motion respected.

**Deploy:** ready but **not** run (deploys are user-triggered — `wrangler pages
deploy`). **Stop condition reached — awaiting review before Phase 4.3
(Elasticsearch).**

---

## 5. Milestone 3 — Elasticsearch Simulation (after M2 review)

A contrasting system that stresses different concepts: shards, replicas, search
routing, node failures, cluster rebalancing, query distribution. Reducer models
shard placement across nodes; node failure promotes a replica + rebalances; a
search fans out across primaries. Maximize reuse; extend the engine only when
necessary. `src/sim/elasticsearch/` + `src/sims/elasticsearch.tsx`.

### Completion report (Phase 4.3)

**Built.** A shard-allocation reducer that reconciles *copy placement* toward a
green cluster. An index of 4 shards, each with a configurable replica count, is a
flat list of `ShardCopy` objects; every copy must live on a node and a shard's
primary and replica may never co-locate. `tick` runs one turn of the loop,
advancing each copy by **at most one state per turn** (gated on its state at the
start of the turn, exactly as the K8s pod loop does): it detects copies orphaned
by a down/removed node, **promotes** a surviving replica to primary (demoting the
lost primary copy to replica so there is always exactly one primary), allocates
unassigned copies onto the least-loaded legal node (`unassigned → initializing →
assigned`), completes relocations, and — only once the cluster is otherwise quiet
— **rebalances** one copy off the busiest node onto the emptiest when the load gap
is ≥ 2. `health` is a pure selector (red = a shard with no assigned primary;
yellow = a replica short of full redundancy; green = every copy assigned). A
`settled` flag marks the loop's fixed point so a recovered — or a genuinely stuck
(too few nodes for the replicas) — cluster stops ticking; unplaceable replicas are
a first-class yellow teaching state, not a hang. `search` is a separate,
non-mutating scatter/gather: the coordinator picks one live copy of every shard,
and the recorded latency is the **slowest leg + a merge cost**, not the sum — the
lesson that a fan-out is bounded by its slowest shard. A red cluster returns a
partial result.

**Engine-modification report — ZERO engine changes.** The primary Phase 4 metric,
now validated across three fundamentally different distributed systems. Nothing
under `src/sim/` core (`rng.ts`, `contracts.ts`, `kernel/`, `metrics/`, `rules/`),
`src/learn/` (`createExplainer`, `ModeHost`, `modes/simulate.tsx`, `contracts.ts`),
`src/sims/index.ts`, `src/app/StoryLoader.tsx`, or `vocab/` was touched.
Elasticsearch plugged into the M1 spine entirely through **two new files** (plus
its test).

- **New:** `src/sim/elasticsearch/{state.ts,reduce.ts,index.ts,__tests__/elasticsearch.test.ts}`
  · `src/sims/elasticsearch.tsx`
- **Modified (engine):** none. **Modified (other):** this doc + memory only.
- **Reused unchanged:** `sim/rng.ts` (`makeRng`), `vocab/*` (`C`, `Glyph`),
  `learn/modes/simulate.tsx`, `learn/contracts.ts` (`HostServices`/`Mode`),
  `sims/index.ts` glob discovery, `createExplainer` sim composition.

**Rule of Three evaluation — the review this phase exists to trigger.** Three real
sims now exist. Re-examining the two view-layer patterns flagged after K8s:

1. **The `TICK_MS` auto-advance `useEffect` keyed on a "still-moving" flag.** All
   three share the *shape* (`useEffect` → `setTimeout(dispatch(tick), MS)` → clear)
   but the trigger differs: DNS keys on `phase==="walking"` and dispatches
   `advance`; K8s and ES key on `!settled` and dispatch `tick`. A `useSimLoop(active,
   onTick, ms)` hook (~6 lines) would now legitimately fold all three — this is the
   one extraction the Rule of Three genuinely justifies. **Deferred to §6** (the
   post-M3 refactor pass) rather than smuggled in here, so the diff for M3 stays
   two-files/zero-engine and the extraction lands as a reviewed change of its own.
2. **The SVG stage scaffold + button-style constants (`SECONDARY`/`CHIP`) + the
   step-log panel.** Superficially repeated three times, but the *stages* diverge
   hard: DNS draws a fixed 5-node path with a travelling packet; K8s draws three
   fixed capacity bins with dots in slots; ES draws a **variable** number of node
   bins (add/remove) with two-per-shard labelled blocks, a health pill, a tray, and
   a coordinator fan-out overlay. A generic `<Stage>` would need to parameterise
   node count, per-node internal layout, edge/packet vs. block rendering, and an
   optional overlay — i.e. it would reconstruct each bespoke view through config.
   The shared surface is really just `C`/`Glyph` (already shared) and ~10 lines of
   Tailwind class strings. **Not extracted** — duplicating three class constants is
   cheaper and clearer than a premature layout framework. The button constants
   *could* move to a tiny `sims/controls.ts` if a fourth sim appears; not yet.

Net: exactly one abstraction (`useSimLoop`) is now warranted, and it is a *view*
helper, not an engine change — the headless reducer spine needed nothing.

**Architecture scorecard (critical).**
- **Runtime reuse — A.** Zero engine edits across three sims. The
  discovery/mode/reducer spine is demonstrably topic-agnostic.
- **Reducer flexibility — A−.** One `reduce(state, action, rng)` contract absorbed
  a one-shot walk (DNS), a count reconciler (K8s), and a placement reconciler (ES)
  with no shared base type and no friction. The A− (not A): all three re-implement
  the same `settled`/`log.slice(-60)`/`tick++` bookkeeping by hand — reusable in
  principle, but there is deliberately no `InteractiveSim<S,A>` base yet (Rule of
  Three on the *reducer* is arguably met; see the recommendation below).
- **State modeling — A.** ES models its own domain (copies, roles, health) with no
  K8s concepts forced in; the `ON_NODE`/`LIVE`/promotion logic reads like the
  domain.
- **Simulation independence — A.** Each sim is a self-contained folder + view;
  deleting one touches nothing else.
- **Performance — A.** Deterministic, golden-tested; the loop settles in a bounded
  number of ticks; renders are driven only by `state.tick`/`settled`; the ES view
  is a 15.6 kB lazy chunk loaded only when the tab opens.
- **Maintainability — B+.** The reducers are clear and well-commented, but the
  hand-rolled loop/log bookkeeping is copy-pasted three ways; the pending
  `useSimLoop` + an optional `InteractiveSim` base would lift this to A−.

**Architectural weaknesses discovered (do not overstate success).**
- The `settled = JSON.stringify(a) === JSON.stringify(b)` fixed-point check
  (shared by K8s and ES) is O(state) per tick and a little blunt — fine at this
  scale, but it is a smell that both reducers lack an explicit "did anything
  change" signal.
- Search latency is a plausible *teaching* model, not a queueing result — the
  Tier-1 flow solver (`metrics/solve.ts`) still sits unused, as predicted in §1.
  Honest finding, not a failure: none of the three Tier-0 sims are throughput
  problems.
- `setReplicas` down-scaling keeps the first N replicas by original array order;
  correct and deterministic, but the ordering rule is implicit.

**Tests:** 15 new golden/determinism/regression tests
(`elasticsearch.test.ts`) — determinism replay, no primary/replica co-location,
replica promotion, green/yellow/red transitions, node failure + recovery +
rebalance (relocations actually increment), add/remove node, replica-count toggle,
over-replication stranding, fan-out routing + slowest-leg latency, partial search
on red, reset, purity. Full suite **115 passing** (was 100). `tsc -b` + `vite
build` clean; ES is its own 15.63 kB lazy chunk. Verified in-browser: green start,
node failure → yellow with promotion narrated in the log → recovery to green,
add-node rebalance with real relocations, search fan-out lighting one copy per
shard with slowest-leg latency, reduced-motion respected.

**Deploy:** ready but **not** run (deploys are user-triggered — `wrangler pages
deploy`). **Stop condition reached — awaiting architectural review before the AI
Tutor phase.** Recommended next engine evolution (for §6, not done here): extract
`useSimLoop` (view helper, warranted now) and *consider* an optional
`InteractiveSim<State, Action>` reducer contract that standardises
`tick`/`settled`/bounded-`log` bookkeeping — the reducer spine has now been proven
three times, so this is the first structural extraction the Rule of Three permits.
Leave the Tier-1 flow solver untouched until a genuine throughput sim needs it.

---

## 6. Architecture Validation & Release (after M3)

Only **after all three** exist, review and identify: APIs reused across all sims;
APIs used once; awkward abstractions; repeated patterns; acceptable duplication;
engine improvements justified by real usage. **Then** refactor (Rule of Three) —
likely candidates: a shared SVG **Stage** (nodes/edges/packets from `vocab`) and a
tiny `InteractiveSim<State,Action>` reducer contract, *if* three sims proved them.
Do not generalize from one. Finally: update docs (`AUTHORING.md` "Adding a
simulation" section, `learn/README.md`), add a `RELEASES.md` entry, bump
`explainers/package.json` to **v0.3.0**.

---

## 7. UI principles (applies to every sim)

Simulations must feel like **explainers, not dashboards**. Teach through nodes,
connections, packets, requests/responses, flow, signals, status indicators, and
highlighted execution paths. **Avoid** admin panels, data-heavy dashboards,
complex charts, generic monitoring UIs. Every visual element must directly teach a
concept. Guard motion behind `prefers-reduced-motion`.

---

## 8. Engineering constraints (the gate before any new abstraction)

Before introducing any new abstraction, ask: *"Will this be reused by at least one
more simulation?"* If no → implement the simplest topic-specific solution and
refactor only after reuse is demonstrated. Keep reducers **pure** and the engine
**deterministic**. Maintain full test coverage and backward compatibility
(existing explainers keep working; a sim appears only where a `src/sims/<slug>.tsx`
exists).

---

## 9. Success criteria

- Three production simulations exist (DNS, Kubernetes, Elasticsearch).
- The engine required **minimal** changes between topics.
- Reusable abstractions emerged **naturally** (validated by three real sims).
- Story · Quiz · Simulate feel seamless in one `createExplainer` flow.
- The architecture was validated by real explainers, not theoretical design.

---

## 10. Reference docs in the repo (read if you need depth)

- `interactive-learning-engine-plan.md` (repo root) — the umbrella architecture:
  `createExplainer({ modes })`, mode host, shared services, tiers.
- `sim-engine-plan.md` (repo root) — the Simulation module deep-dive (Tier
  definitions, determinism contract, rule/metric model). Note: its Tier-1 flow
  solver is **not** what M1–M3 use; they are Tier-0 reducers (see §1 above).
- `explainers/CLAUDE.md` — app conventions (use the `new-explainer` and `verify`
  skills; `AUTHORING.md` is the tool-neutral authoring reference).
- `explainers/src/learn/README.md` — read when adding a mode or changing the shell.
