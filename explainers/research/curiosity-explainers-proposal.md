# Five curiosity-driven explainers — expanded proposal & build plan

> **What this is.** An expanded version of the "five story explainers" research
> report, rewritten against the engine that actually exists. The original draft
> assumed an ECS + click-inspector + live-scale-slider engine. This one maps
> every story onto the real primitives (scenes → narration beats →
> actors/presets/wires, camera `focus`/`frame`, hover-inspector `note` lines,
> and `toggle`/`choice` params that re-run a scene). Read `AUTHORING.md` before
> building any of these; invoke the `new-explainer` skill first.

---

## How the engine constrains these stories (read this first)

The report's stronger claims don't survive contact with the engine. The
corrections below apply to **all five** stories, so they're stated once here
instead of being repeated (wrongly) per story.

| Report assumed | Engine reality | Consequence for these stories |
|---|---|---|
| ECS entities with components | Actors are cards/presets placed on a fixed 960×520 stage | "Entities with `TokenType`/`Value` components" → just actors with a `note` and a `label`. |
| Click any entity → inspector panel | Hover shows a single `note` line per actor | Put the payoff fact in each actor's `note`; don't design flows around click-drilling. |
| Live scale slider dragging RPS | `toggle`/`choice` params re-run `setup` and replay the scene | "Scaling" becomes 2–4 discrete stages you switch between, not a continuous drag. |
| Side-by-side "twin" compare mode | One stage, one timeline | Compare via a `toggle` that swaps the whole cast, not two stages at once. |
| Free timeline scrubbing to any phase | Scenes are linear beats (`s.step`); the shell plays/pauses/steps | Each "phase" is its own beat or its own scene. |

**The one interaction that is real and powerful:** a `param` where changing the
knob changes the *system's story* — kill a node and watch consensus stall,
switch "cold vs warm cache," pick "vertical vs horizontal." Design each story's
interactivity around exactly one such knob, per the house rule in
`research/README.md`.

**Effort reality.** A new explainer is *one `story.ts` data file* plus a
`meta.ts`; discovery is automatic. So the report's "2–3 engineers for 4 weeks"
estimates are wrong by an order of magnitude. Real cost is **research + writing
+ choreography for one author**, plus occasional engine work (a new glyph, a new
preset, rarely a new actor kind). Estimates below are re-scoped to that.

---

## Ranked recommendation

Build order, optimizing for originality × payoff × low engine-risk:

1. **Haunted Filesystem** — highest "I've been lied to" payoff, no new engine
   primitives, one clean toggle (delete → recover). *Build first.*
2. **The Multitasking Illusion** — foundational, cheap, reuses timeline heavily;
   the "one chef" reveal lands instantly.
3. **Jury Duty for Servers (consensus)** — highest originality, but the
   hardest to choreograph; do it after warming up on 1–2.
4. **Scaling the Summit** — high system-design value; needs a multi-stage
   `choice` and several new presets but no new kinds.
5. **From Code to Circuit (compiler)** — highest value for devs, but the AST is
   the one place the fixed stage fights you (tree layout); may need a small
   custom actor kind.

---

## 1. Haunted Filesystem — *The secret lives of deleted files*

**Core truth (the hook):** `rm` does not erase your data. It removes a
*directory entry* and decrements a link count. The bytes sit on disk, fully
intact, until something else reuses those blocks. "Delete" is a bookkeeping
edit, not an act of destruction — which is exactly why recovery tools work, and
exactly why "empty the trash" is not the same as "shred."

### Deeper technical reality (what most tutorials skip)

- **The three-layer indirection.** A name in a directory is just an entry
  `(filename → inode number)`. The **inode** holds the metadata (size,
  permissions, timestamps, link count) and the **block pointers**. The data
  blocks hold the bytes. `rm` touches layers 1 and 2 only; layer 3 is untouched.
- **Hard links make "delete" obviously wrong.** If two names point to the same
  inode (`ln a b`), `rm a` cannot possibly erase data — `b` still works. This is
  the cleanest proof that unlink ≠ erase, and a great beat.
- **`unlink()` vs open file handles.** A file with zero directory entries but a
  live open fd is *still alive* — space is reclaimed only when the last
  reference (link **or** open handle) goes away. This is why deleting a running
  program's log file doesn't free space until the process exits (`lsof +L1`).
- **Journaling ≠ shredding.** A journaling filesystem (ext4, XFS) logs the
  *metadata* change so a crash mid-delete leaves a consistent filesystem — it
  does not overwrite your data blocks. Journaling protects structure, not
  secrecy.
- **Why SSDs change the story.** On spinning disks, unallocated blocks keep old
  data indefinitely. On SSDs, `TRIM` tells the drive a block is free so the
  controller can erase it ahead of time (for wear-leveling and speed) — so on a
  TRIM-enabled SSD the ghost often *does* get exorcised, and forensic recovery is
  far less reliable. Great "it depends on your hardware" nuance.
- **Real erasure = overwrite.** `shred`, `wipe`, or full-disk encryption are the
  only reliable erasures; on SSDs even overwrite is unreliable due to
  remapping, which is why crypto-erase (throw away the key) wins.

### Narrative

A library where removing a book's *catalog card* doesn't remove the *book from
the shelf*. The card is the directory entry; the shelf label is the inode; the
book is the data. Delete the card and the book is now unfindable-by-normal-means
but physically present — a ghost in the stacks. A librarian who remembers the
shelf number (a recovery tool reading the inode/blocks) walks right to it.

### Scene plan (real beats)

1. **"Where does a file live?"** — Cast `directory` (a `node`, glyph `doc`),
   `inode` (new preset, glyph `book` or `gear`), and a row of `dot` data blocks.
   Draw the two wires: name→inode, inode→blocks. Takeaway: three layers, one
   name.
2. **"What `rm` actually touches."** — `crash`/`vanish` the directory→inode wire
   only; leave inode + blocks glowing. Caption: "The name is gone. The bytes
   are not." Pulse the still-present blocks.
3. **The hard-link proof** *(param `choice`: "one name" / "two names")* — with
   two names, `rm` one and the file still resolves. The knob teaches
   link-counting directly.
4. **Recovery** *(the toggle payoff)* — `param toggle: [delete, recover]`.
   Recover re-draws the entry from the surviving inode; the blocks were always
   there. Caption lands the whole thesis.
5. **"Then how do you really erase it?"** — overwrite the blocks (flip each
   `dot` to a scrambled state), or the SSD-TRIM variant. Takeaway: erasure =
   overwrite/crypto-erase, not unlink.

### Engine work needed

- **New preset:** `inode` (glyph `book`, accent `violet`, `note` = "metadata +
  block pointers; the real 'file'").
- Everything else is `node`, `dot`, `s.connect`, `crash`, `vanish`, `pulse`,
  and one `toggle`. **No new actor kind.**

### Effort

**Low.** ~1 author-day of choreography once the brief is written. No engine
risk.

### References (primary)

- Arpaci-Dusseau & Arpaci-Dusseau, *Operating Systems: Three Easy Pieces*,
  "File System Implementation" & "Locality and The Fast File System" chapters —
  inodes, directory entries, link counts. Free: https://pages.cs.wisc.edu/~remzi/OSTEP/
- POSIX / Linux `unlink(2)` man page — defines that space is freed only when
  link count *and* open handles both reach zero: https://man7.org/linux/man-pages/man2/unlink.2.html
- `rm(1)`, `ln(1)`, `shred(1)` man pages — the actual contracts.
- ext4 documentation (kernel.org) — journaling is metadata-consistency, not data
  erasure: https://www.kernel.org/doc/html/latest/filesystems/ext4/
- `lsof` FAQ / `+L1` — recovering an unlinked-but-open file via `/proc/<pid>/fd`.
- TRIM: Linux `fstrim(8)` and the ATA TRIM command background (SSD block
  reclamation).

---

## 2. The Multitasking Illusion — *why your computer is lying*

**Core truth (the hook):** on a single core, nothing runs "at the same time."
One chef cooks one dish at a time and rotates so fast the guests believe every
dish is cooking at once. Concurrency (juggling) is not parallelism (many hands).

### Deeper technical reality

- **A context switch is a save/restore, and it isn't free.** The kernel saves
  the running task's registers + program counter to its task struct, loads the
  next task's, and jumps. Direct cost is microseconds; the *hidden* cost is cold
  caches and TLB flushes afterward — the new task runs slow until its working set
  is back in cache. This is why "just add more threads" can go *backwards*.
- **What triggers a switch:** the time-slice timer interrupt (preemption), a
  blocking syscall (I/O wait — the task voluntarily yields), or a
  higher-priority task becoming runnable.
- **Scheduling policy is a visible knob.** Round-robin gives equal slices;
  priority/`nice` skews them; Linux's CFS picks the task with least virtual
  runtime so far. Different policies → visibly different CPU-time distributions
  on the same three tasks.
- **I/O-bound vs CPU-bound is the real lesson.** A task waiting on disk/network
  isn't "using" the CPU — it's parked. Interleaving one CPU-bound and two
  I/O-bound tasks is *why* time-slicing feels like magic: the CPU stays busy
  while others wait.
- **Multi-core changes the claim, not the mechanism.** N cores → up to N tasks
  truly parallel, but the scheduler still time-slices when runnable tasks >
  cores, and coordination/locking claws back some of the speedup (Amdahl).

### Narrative

One chef, many orders. She sets a timer (the time-slice), stirs pot A, the timer
dings, she writes down exactly where she left pot A (save registers), moves to
pan B, and so on. The diners see a full kitchen firing at once. Then a delivery
arrives mid-task (an interrupt) and she has to re-plan. Finally: hire a second
chef (second core) — now two dishes really do cook at once, but they still fight
over the one stove (shared resource).

### Scene plan

1. **The illusion** — three task cards (`worker` preset) + one `chip` (CPU).
   All three appear "busy." Caption sells the feeling of simultaneity.
2. **Pull back the curtain** — only one task glows at a time; the CPU's
   `focus`/spotlight follows whichever holds it. A running context readout
   (`label`: PC/registers) updates each slice.
3. **The switch has a cost** — animate save→load between two tasks; a small
   "context-switch tax" counter ticks up. Caption: switching isn't free.
4. **Policy knob** *(param `choice`: round-robin / priority / CFS-ish)* — same
   three tasks, visibly different share of CPU time. The knob *is* the lesson.
5. **I/O-bound vs CPU-bound** *(param `toggle`)* — mark one task "waiting on
   disk"; show the CPU skipping it and staying busy. Takeaway: concurrency hides
   waiting.
6. **Second core** — add a second `chip`; two tasks glow at once; note the
   shared-resource contention. Takeaway: concurrency ≠ parallelism.

### Engine work needed

- Reuse `worker`, `chip` glyph, `label`, `spotlight`, `focus`, `pulse`. A
  running-register readout is just a `label` whose text changes per beat.
- One optional new preset `task` (alias of `worker` with a scheduling `note`).
  **No new actor kind.**

### Effort

**Low.** Timeline + spotlight are exactly what the engine is best at.

### References (primary)

- OSTEP, "Scheduling: Introduction," "Multi-level Feedback Queue," and
  "Scheduling: Proportional Share" chapters — round-robin, MLFQ, CFS intuition.
  https://pages.cs.wisc.edu/~remzi/OSTEP/
- OSTEP, "Mechanism: Limited Direct Execution" — the exact save/restore of a
  context switch and why the timer interrupt is what enables preemption.
- Tanenbaum & Bos, *Modern Operating Systems* — processes, threads, scheduling.
- Linux CFS design notes (`Documentation/scheduler/sched-design-CFS.rst`,
  kernel.org) and `nice(1)` — the policy knob made concrete.
- Rob Pike, "Concurrency Is Not Parallelism" (talk) — the one-line thesis of the
  whole story.

---

## 3. Jury Duty for Servers — *how distributed machines agree on the truth*

**Core truth (the hook):** several computers, some of which may crash or lag,
can still agree on a single ordered history — *without* a boss they all trust in
advance — as long as a **majority** is reachable. Agreement is a *protocol*, not
a vote of confidence.

### Deeper technical reality (favor Raft — it was designed to be understandable)

- **Replicated state machine.** Every server runs the same commands in the same
  order → same state. Consensus is really "agree on the order of the log," and
  the state machine falls out for free.
- **Three roles, one at a time:** follower (default), candidate (ran out of
  patience, seeking votes), leader (won a majority). Time is chopped into
  **terms**; each term has at most one leader.
- **Leader election.** A follower whose election timer fires becomes a
  candidate, bumps the term, and requests votes. A server grants at most one
  vote per term → at most one winner. Randomized timeouts break ties.
- **Log replication + commit.** The leader appends a command and replicates it;
  once a **majority** has it, it's *committed* and applied. Majority is the whole
  trick: any two majorities overlap in at least one server, so a committed entry
  can never be lost by a later leader.
- **Fault tolerance is arithmetic.** 2f+1 servers tolerate f failures. 3 servers
  survive 1; 5 survive 2. Below majority, the system correctly *refuses to
  decide* (availability lost, consistency kept) — the CAP trade made visible.
- **Split-brain is prevented, not risked.** A partitioned minority can't get a
  majority of votes, so it can't elect a leader or commit anything; when the
  partition heals it catches up from the real leader's log.

### Narrative

A council/jury that must return one verdict. A juror who gets impatient stands
and asks the room to back them (candidate → requests votes). Once more than half
raise a hand, they hold the gavel for this session (term). They read out
proposed entries; each becomes law only when more than half have written it in
their own notebook (commit). Sequester one juror (partition) and the rest still
reach a verdict; sequester *the majority* and no verdict is possible — the
system would rather stall than lie.

### Scene plan

1. **The problem** — 3 `server` cards, each with a different proposed value.
   Caption: "Three machines, three answers. We need exactly one."
2. **Election** — one server's timer fires (`pulse`), becomes candidate,
   `fanout` vote-requests, `gather` votes; on majority it gets a leader glow.
3. **Replication & commit** — leader `fanout.send` an entry; `gather`
   acknowledgements; the entry only "locks in" (flips to committed color) after
   the majority acks. This beat *is* the core idea.
4. **Kill a follower** *(param `toggle`: healthy / one down)* — `crash` one
   server; show the remaining two still form a majority and keep committing.
5. **Kill the majority** *(param `choice` extends #4)* — `crash` two of three;
   the leader tries to commit and *can't*; entries stay uncommitted. Takeaway:
   it stalls instead of splitting.
6. **Heal & catch up** — `revive` the downed servers; they copy the leader's
   log. Takeaway: majority overlap guarantees no committed entry is ever lost.

### Engine work needed

- Reuse `server` preset, `s.fanout` (draw/send/gather/pulse), `crash`/`revive`,
  `pulse`, `focus`. Committed-vs-uncommitted = an accent/glow swap on a `token`
  log entry per server.
- Possibly a small `logEntry` preset (`token` with committed/uncommitted note).
  **No new actor kind**; the fan-out + crash verbs already exist (they power the
  Kubernetes story). This is choreography-heavy, not primitive-heavy.

### Effort

**Medium.** The mechanics all exist, but making election + commit legible in
6 calm beats is the writing challenge. Build after 1–2 warm-ups.

### References (primary)

- Diego Ongaro & John Ousterhout, "In Search of an Understandable Consensus
  Algorithm (Raft)," USENIX ATC 2014 — the canonical, readable source:
  https://raft.github.io/raft.pdf
- Raft site (visualizations, papers, implementations): https://raft.github.io/
- *The Secret Lives of Data* — Raft, walked through frame by frame; the best
  existing interactive to learn pacing from (don't copy, learn the beat order):
  http://thesecretlivesofdata.com/raft/
- Leslie Lamport, "Paxos Made Simple" (2001) — the ancestor; cite for depth:
  https://lamport.azurewebsites.net/pubs/paxos-simple.pdf
- Ongaro's PhD thesis, "Consensus: Bridging Theory and Practice" (Stanford,
  2014) — for the fault-tolerance arithmetic and membership changes.

---

## 4. Scaling the Summit — *how web apps grow to millions*

**Core truth (the hook):** you don't scale by buying one god-machine; past a
point you scale by adding *ordinary* machines and spreading the load — which
only works if your app forgets who it's talking to (statelessness). The hard
part of scaling isn't the web tier; it's the database and the state.

### Deeper technical reality

- **Vertical vs horizontal.** Vertical (bigger box) is simplest and hits a hard
  ceiling (and a single point of failure). Horizontal (more boxes) scales
  further and adds redundancy, at the cost of coordination.
- **Statelessness is the enabler.** If any request can hit any server, a load
  balancer can spray traffic freely. Session state must move *out* of the app
  (to a shared cache/DB or a signed token) before horizontal scaling works —
  this is the step tutorials skip.
- **The load balancer** distributes across healthy instances (round-robin /
  least-connections), health-checks them, and removes dead ones — it's also how
  you deploy without downtime.
- **Caching is the highest-leverage move.** A cache in front of the DB absorbs
  the read-heavy majority of traffic; the story should show *reads* getting cheap
  before anything else.
- **The database is the real wall.** Reads scale with **read replicas**;
  **writes** are the bottleneck, forcing **sharding** (partition by key) — which
  reintroduces the consensus/consistency problems of story #3. Good cross-link.
- **Statelessness ≠ no state; it relocates state.** Name where state lives at
  each stage (in-process → shared cache → replicated DB → sharded DB).

### Narrative

A mountain expedition. One base camp serves a handful of climbers. The crowd
grows: add a route-splitter at the trailhead (load balancer), more identical
camps (app instances), a supply cache stocked near the top (cache), then split
the summit register into copies (read replicas) and finally into
region-by-region ledgers (shards). Each new stage answers the failure of the
last.

### Scene plan (a staged `choice`, not a live slider)

Model "scale" as a `choice` param with 4 stages; each stage rebuilds the cast:

1. **1 box** — `users` → `server` → `database`. Caption: fine for now. Show it
   redlining under load (`pulse`/`shake` the server).
2. **Add a load balancer + 2nd app** — `loadBalancer` fans to two `server`s,
   both to one `database`. Introduce the statelessness rule explicitly.
3. **Add a cache** — a `cache` in front of the DB absorbs reads; show a read
   hitting cache and never reaching the DB. Highest-leverage beat.
4. **Replicas + shards** — read replicas fan out; then split into shards by key.
   Takeaway: the DB is the wall, and crossing it borrows consensus from
   story #3.

A within-stage `toggle` (`vertical` / `horizontal`) on stage 1→2 makes the
central trade-off a knob: bigger box (ceiling + SPOF) vs more boxes
(coordination).

### Engine work needed

- Reuses `users`, `server`, `database`, `cache`, `loadBalancer` presets (all
  exist) plus `s.fanout`. A **new preset** `replica` (glyph `database`, accent
  `dim`, note "read-only copy") and `shard` (glyph `database`, note "owns a key
  range"). **No new actor kind.**
- The `choice`-rebuilds-cast pattern is the same one the Kubernetes/Deployment
  stories already use.

### Effort

**Medium.** Straightforward primitives; the work is keeping 4 stages calm
(≤8 actors each) and writing the trade-off knob honestly.

### References (primary)

- Martin Kleppmann, *Designing Data-Intensive Applications* (O'Reilly, 2017) —
  Ch. 5 (replication), Ch. 6 (partitioning/sharding), Ch. 1 (scalability
  definitions). The definitive source for the DB-is-the-wall thesis.
- AWS Well-Architected Framework, *Reliability* & *Performance Efficiency*
  pillars — horizontal scaling, statelessness, load balancing as first
  principles: https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
- Martin Fowler, "Patterns of Enterprise Application Architecture" +
  martinfowler.com on load balancing / stateless services.
- Google SRE Book, "Load Balancing at the Frontend / Datacenter" chapters:
  https://sre.google/sre-book/
- "The Art of Scalability" (Abbott & Fisher) — the AKF scale cube (x/y/z-axis
  scaling) for the sharding framing.

---

## 5. From Code to Circuit — *the compiler's secret workshop*

**Core truth (the hook):** the "magic" of turning text into a running program is
a fixed pipeline of small, boring, verifiable steps — characters → tokens →
tree → checked tree → lowered instructions. Nothing is magic; every stage has a
name and a job.

### Deeper technical reality

- **Lexing (scanner).** A stream of characters → a stream of **tokens**
  (`if`, `(`, identifier `x`, `<`, number `0`). Whitespace/comments are dropped.
  This is regular-language work — no structure yet.
- **Parsing.** Tokens → **AST** by the grammar. The AST is where precedence and
  nesting become real: `x = -x` becomes an assignment node over a negation node.
  This is context-free-language work.
- **Semantic analysis.** Walk the AST with a **symbol table**: does `x` exist,
  what's its type, is `x < 0` well-typed? Most "compiler errors" you actually see
  are born here, not in parsing.
- **IR + optimization.** Lower the AST to an **intermediate representation**
  (e.g. three-address code / SSA), then transform it: constant folding, dead-code
  elimination, common-subexpression elimination. Optional, but where "the
  compiler is smarter than me" moments live.
- **Code generation.** IR → target instructions, plus register allocation. The
  same IR can target x86, ARM, or WASM — which is *why* IR exists (decouple front
  end from back end).
- **The great insight to leave them with:** front end (language-specific) and
  back end (machine-specific) meet at the IR waist. That's how one compiler
  framework (LLVM) serves many languages and many chips.

### Narrative

An alchemist's workshop / assembly line. A raw manuscript (source) is torn into
labeled word-tiles (tokens), the tiles are assembled into a blueprint (AST), an
inspector checks the blueprint against the rulebook (semantic analysis), an
efficiency expert crosses out redundant steps (optimization), and a smith stamps
out the final machine instructions (codegen). Show the *same* blueprint feeding
two different smiths (x86 vs ARM) to reveal the IR waist.

### Scene plan

1. **Source → tokens** — a `label` of source text; tiles (`token` actors) peel
   off it one by one. Caption: structure-free, just words with names.
2. **Tokens → AST** — tiles arrange into a small tree (root assignment, child
   negation). This is the hard-layout beat (see engine note).
3. **Semantic check** — walk the tree; `pulse` each node as the symbol-table
   check passes; `shake` a deliberately-undeclared variant. Caption: this is
   where your "errors" come from.
4. **Optimize** *(param `toggle`: off / on)* — with optimization on, a constant
   subtree folds to a single value node; dead branch vanishes. The knob shows
   the compiler outsmarting you.
5. **Codegen at the IR waist** *(param `choice`: x86 / ARM / WASM)* — the *same*
   AST/IR emits different instruction lists. This is the payoff: one front end,
   many back ends.

### Engine work needed

- Tokens/labels/pulse/shake all exist. **The one real risk:** the AST in scene
  2–4 is a tree, and the engine's layout helpers (`row/column/grid/radial/stack`)
  don't do trees. Options, cheapest first:
  1. Hand-place a *small, fixed* 3–5 node tree with `between`/`below` relational
     points (a `x = -x` tree is tiny — this is probably enough).
  2. If a general tree is wanted, add a small **custom actor kind**
     (`E.defineActorKind`) that draws parent→child edges — the only story here
     that might justify one.
- **New preset:** `astNode` (`node`, glyph `gear`/`box`, compact). Codegen output
  is a `label`/`token` list.

### Effort

**Medium-high** *for this engine* — not because compilers are hard to write
about, but because tree layout is the one thing the fixed stage resists. Do it
last; by then you'll know whether a custom kind is worth it.

### References (primary)

- Aho, Lam, Sethi, Ullman, *Compilers: Principles, Techniques, and Tools* (the
  "Dragon Book") — the canonical phase breakdown (lexing → parsing → semantic →
  IR → optimization → codegen).
- Robert Nystrom, *Crafting Interpreters* — the best free, readable,
  build-it-yourself treatment of scanning/parsing/AST; steal its *pacing* and its
  worked `-x` style examples: https://craftinginterpreters.com/
- LLVM documentation — the front-end/IR/back-end "waist," and why IR exists:
  https://llvm.org/docs/ and the LLVM Kaleidoscope tutorial:
  https://llvm.org/docs/tutorial/
- Cooper & Torczon, *Engineering a Compiler* — modern, optimization-forward.
- Matt Godbolt's Compiler Explorer (godbolt.org) — for grounding the codegen
  beat in *real* emitted assembly per target (reference, not to embed).

---

## Corrected comparison table (engine-honest)

Originality and educational impact carry over from the report; **buildability**
and **reuse** are re-scored against the real engine (higher = easier / more
reuse). "New primitives" is the real cost driver.

| Story | Originality | Educational impact | Buildability (this engine) | New primitives needed | Best interactive knob |
|---|---|---|---|---|---|
| **Haunted Filesystem** | High | High — kills a real misconception | **High** | 1 preset (`inode`) | delete ⇄ recover toggle |
| **Multitasking Illusion** | Medium | High — foundational | **High** | 0–1 preset | scheduling-policy choice |
| **Jury Duty (consensus)** | **Highest** | High — distributed sys | Medium | 0–1 preset (`logEntry`) | kill nodes → stalls |
| **Scaling the Summit** | High | High — system design | Medium | 2 presets (`replica`,`shard`) | scale-stage choice + V/H toggle |
| **From Code to Circuit** | Medium-high | **Highest** for devs | Medium-low | 1 preset + maybe 1 actor kind | optimize toggle + target choice |

---

## Cross-story build plan

**Phase 0 — before any story (once).**
- For each chosen story, write a `research/<slug>.md` brief using the 10-step
  process in `research/README.md` (first principles → creative brief). Do not
  write scenes yet.
- Batch the shared engine gaps so they land in one PR: presets `inode`,
  `logEntry`, `replica`, `shard`, `astNode`; confirm existing glyphs cover
  `book/gear/box/chip/database/cache/balancer`; decide the compiler tree
  question (relational-placement first, custom kind only if forced).

**Phase 1 — build in ranked order (one `story.ts` + `meta.ts` each).**
For every story, the loop is identical (this is the whole workflow):
1. Invoke the `new-explainer` skill; author `meta.ts` (library card + intro
   hook) and `story.ts` (scenes).
2. Keep each scene to 4–8 actors, 12–25s at 1×, one sentence per beat, present
   tense; dim what isn't being discussed (`AUTHORING.md` quality bar).
3. Put the payoff fact in each meaningful actor's `note` (that's the "inspector").
4. Wire the single teaching knob as a `toggle`/`choice`; make the knob change the
   *story*, not a number.
5. Verify: `npx tsc -b` + `npx vite build`, then the `explainers:verify` skill to
   run and screenshot; fix any overlap/never-visible validator throws.
6. Register the category on `meta` (`systems` for 1–3 & 5, `deployment-cloud` for
   4) — discovery is automatic via glob.

**Phase 2 — polish pass.** Re-read each as a learner: does every scene answer its
`question`, does the `takeaway` state the answer plainly, does `nextPrompt` pull
forward? Cross-link consensus ⇄ scaling (sharding needs consensus) in the copy.

**Sequencing rationale.** 1 and 2 need zero-to-one new primitives and warm up the
choreography muscles; 3 and 4 are choreography-heavy but primitive-light; 5 is
gated last so the tree-layout decision is made with real experience, not upfront.

---

## Sources index (all primary / canonical)

- OSTEP (free OS textbook): https://pages.cs.wisc.edu/~remzi/OSTEP/ — stories 1, 2
- `unlink(2)`, `rm(1)`, `ln(1)`, `shred(1)` man pages (man7.org) — story 1
- ext4 kernel docs: https://www.kernel.org/doc/html/latest/filesystems/ext4/ — story 1
- Raft paper: https://raft.github.io/raft.pdf · site: https://raft.github.io/ — story 3
- The Secret Lives of Data (Raft viz): http://thesecretlivesofdata.com/raft/ — story 3
- Lamport, Paxos Made Simple: https://lamport.azurewebsites.net/pubs/paxos-simple.pdf — story 3
- Kleppmann, *Designing Data-Intensive Applications* (O'Reilly, 2017) — stories 3, 4
- AWS Well-Architected: https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html — story 4
- Google SRE Book: https://sre.google/sre-book/ — story 4
- Dragon Book (Aho/Lam/Sethi/Ullman); Cooper & Torczon, *Engineering a Compiler* — story 5
- Nystrom, *Crafting Interpreters*: https://craftinginterpreters.com/ — story 5
- LLVM docs + Kaleidoscope tutorial: https://llvm.org/docs/ — story 5
- Pike, "Concurrency Is Not Parallelism" (talk) — story 2
