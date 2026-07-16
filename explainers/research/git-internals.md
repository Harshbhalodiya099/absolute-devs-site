# Research brief — How Git Works Internally

## 1. First principles

**Why it exists.** Version control before Git meant a central server owning
truth (CVS/SVN): branching was expensive, offline work impossible, merges
feared. Git's answer: give everyone the *entire history* as a local database
of immutable snapshots, and make sharing = comparing databases.

**What problem it solves.** Cheap, trustworthy history: any state
recoverable, any two histories mergeable, integrity guaranteed by content
hashing rather than by a server being honest.

**Why previous approaches were insufficient.** Delta-chains and central locks
made branches heavyweight, corruptible, and slow. SVN's "branch = directory
copy on the server" made experimentation socially expensive. Git made a branch
cost 41 bytes, which changed how humans collaborate — the killer fact.

**Core intuition (one sentence).** *Git is a content-addressed key-value
store — objects named by the hash of their content — plus a handful of tiny
pointer files; every command you fear is just moving a pointer.*

**Biggest misconception.** That commits store *diffs* and branches *contain*
commits. Reality: every commit is a full snapshot (a tree of hashes, deduped
because identical content hashes identically), and a branch is a 41-byte text
file holding one commit hash. Nearly all git terror (rebase, detached HEAD,
"I lost my work") dissolves once these two facts land.

Supporting misconceptions: checkout "moves code around" (it updates HEAD then
makes the working dir match); merge "combines branches" (it creates one new
commit with two parents); deleting a branch deletes commits (it deletes a
pointer; commits die only by garbage collection when unreachable).

**Hard to visualize.** Content addressing (why hashing the content IS the
name); the three trees (working dir / index / HEAD) — the staging area is
where most beginners actually suffer day-to-day; how snapshots avoid being
wasteful (structural sharing of unchanged blobs); rebase as "replay commits
on a new base" producing *new* hashes.

**Should become interactive.**
- **Hash-as-name:** learner edits a file's content, watches the blob's hash
  change; reverts the edit, hash returns — identity IS content. One text
  param, huge payoff.
- **Pointer surgery:** move a branch ref between commits and watch what
  "history" appears to be; this is `reset` demystified.
- **Snapshot dedup:** commit twice with one file changed; see the second tree
  reuse the unchanged blob's hash (structural sharing made visible).
- **Merge vs rebase on the same divergence** — one toggle, two resulting
  graphs, same content. The engine's re-simulation model fits perfectly.

## 2. Best educational resources

- **Pro Git, ch. 10 "Git Internals"** (git-scm.com/book, free). The canonical
  text; exceptional because it builds a commit *by hand* with `hash-object`,
  `update-index`, `commit-tree` — proving porcelain is optional. **Steal:**
  the plumbing-first reveal — construct a commit from raw objects before ever
  saying `git commit`.
- **"Git from the Bottom Up"** (John Wiegley, free PDF/site). Exceptional for
  its ordering: blobs → trees → commits → refs, each defined only in terms of
  the previous. **Steal:** that exact dependency ordering as scene order.
- **Learn Git Branching** (pcottle, learngitbranching.js.org). The most-used
  interactive git teacher ever. Exceptional because commands become *graph
  animations* — you watch `rebase` pick commits up and replay them. **Steal:**
  animating refs as labels that slide between nodes. **Don't copy:** its
  sandbox-command interface (typing commands is their interaction; yours is
  params), and it never shows *objects* — it teaches graph choreography but
  not content addressing. That gap is your opening.
- **"Git for Computer Scientists"** (Tommi Virtanen). Exceptional for
  compressing everything into one DAG picture. **Steal:** blob/tree/commit as
  three visually distinct node types in one graph.
- **Mary Rose Cook — "Git from the inside out" + Gitlet** (git implemented in
  1k lines of JS, annotated). Exceptional because every claim is backed by
  runnable code; her essay narrates what each command does to the object
  database. **Steal:** the "after this command, the repo looks like THIS"
  state-snapshot rhythm — a perfect match for step-based narration.
- **Julia Evans — "How Git Works" zine + blog series (2023–24).** Exceptional
  at naming real confusions ("HEAD is a file. Look at it.") and at the move
  of *opening `.git/` in a file browser*. **Steal:** treating `.git` as an
  explorable place, not an abstraction.
- **"Write yourself a Git"** (thb.lt/wyag) and **CodeCrafters' build-your-own
  -git** — accuracy references for object encoding; not narrative inspiration.

## 3. Interactive inspiration

- **Learn Git Branching** — see above; the single most relevant artifact.
- **Visualizing Git** (git-school.github.io/visualizing-git). Simpler live
  DAG sandbox. **Learn:** immediate command→graph feedback loop. **Don't
  copy:** unlabeled austere nodes; no narrative, no objects, no *why*.
- **GitHub's network graph / gitk / `git log --graph`** (dev tools). Learners
  have *seen* these without being able to read them. Ending with "now read
  your own repo's graph" converts the lesson into a daily superpower.
- **Immutable/content-addressed systems elsewhere** (IPFS explainers,
  Merkle-tree demos from blockchain education). **Learn:** the "change one
  byte, watch the root hash cascade" demo is the crispest integrity proof
  anywhere — steal the cascade, skip the crypto branding.
- **Zachtronics visible-state principle:** git anxieties come from hidden
  state (the index, HEAD). A UI where the three trees are always on stage,
  always inspectable, is the anti-anxiety design.

## 4. Story directions

- **The archaeology dig / "open the box" (recommended).** Start from a real
  `.git` directory and excavate: refs are text files → they point to commits
  → commits point to trees → trees to blobs. Every layer is *literally
  inspectable on the learner's own machine right now*. *Audience:* anyone who
  uses git daily with low-grade fear. *Strength:* zero abstraction debt —
  every claim verifiable with `cat`; ends with the learner unafraid of
  `.git`. *Weakness:* bottom-up start needs a hook, or blobs feel pointless
  for two scenes (fix: open with a mystery, below).
- **The mystery: "Where does a commit GO?"** You type `git commit`. 200ms
  later, it's... where? Follow the data. *Strength:* natural detective
  structure; motivates each object type on demand. *Weakness:* overlaps
  heavily with the dig — likely merge these two into one framing.
- **The fear-list debunk.** Take the three scariest commands (rebase, reset
  --hard, detached HEAD) and show each is pointer motion. *Audience:*
  intermediate users. *Strength:* directly targets felt pain; extremely
  shareable ("git rebase finally makes sense"). *Weakness:* assumes the
  object model — works better as the *payoff act* than the opening.
- **The distributed-trust angle** (why hashes, why every clone is a full
  backup, why history tampering is detectable). *Strength:* explains the
  design's *why* rather than its *what*. *Weakness:* less daily-useful;
  better as one scene than a spine.

Best composite: **mystery opening ("your commit went somewhere — where?") →
archaeology dig through the object layers → fear-list debunk as the payoff.**

## 5. Learning psychology

- **Concreteness fading in reverse — start concrete.** `.git` is a folder of
  files you can `cat`. No topic offers cheaper concreteness; use it
  relentlessly. Abstraction (the DAG view) comes *after* the files.
- **Mental-model repair.** Most learners arrive with a wrong model
  (diffs+containers), not no model. Explicitly surface the wrong model, show
  where it fails (e.g. "if commits are diffs, why is checkout of ancient
  history instant?"), then replace it. Repair sticks better than fresh paint.
- **Prediction before reveal.** "You commit the same content twice — how many
  new objects are created?" "You delete the branch — is the commit gone?"
  Both predictions are usually wrong, both reveals are cheap.
- **Anxiety reduction as an explicit goal.** Unusual for a technical topic:
  much of the audience is *afraid* of git. Naming the fear ("rebase feels
  like it can destroy work") and disproving it mechanically (reflog exists;
  objects are immutable; you can only lose *pointers*) is the emotional core.
- **Active recall at the end:** show a graph, ask "what does `reset --hard
  HEAD~1` do to this picture?" before animating it.

## 6. Aha moments

- **`cat .git/refs/heads/main` → it's just a hash.** The load-bearing aha.
  Interactive: click the branch label, see the file contents.
- **Same content → same hash → stored once.** Commit a 1000-file repo twice
  with one file changed; second commit adds 3 objects, not 1000. Surprise →
  the snapshot model stops sounding wasteful.
- **Detached HEAD is just HEAD containing a hash instead of a branch name.**
  Relief — a scary warning message becomes a file-contents difference.
- **Rebase creates NEW commits.** Watch the replayed commits get new hashes
  while the originals sit there, unreferenced but alive. Explains both why
  rebase "rewrites history" and why force-push is needed — two mysteries, one
  animation.
- **The reflog reveal: "you almost can't lose work."** Achievement/relief
  finale: everything you did for 90 days is recoverable.

## 7. Visual opportunities

- **Animate:** a commit's birth (blob → tree → commit object materializing,
  each pointing at the previous); ref labels sliding between nodes on
  commit/reset/merge; rebase physically lifting commits and replaying them
  with visibly new hashes.
- **Interactive (params):** merge-vs-rebase toggle on one divergence; "edit
  the content" → hash changes; number of files changed → count of new objects
  per commit (dedup made quantitative); move-the-ref pointer surgery.
- **Simulation:** the object database as a persistent scene-wide actor set —
  every operation only *adds* objects and *moves* labels; immutability is
  shown by nothing ever being deleted on stage.
- **Static:** the three-object-type legend (blob/tree/commit anatomy); the
  final "commands → pointer motions" cheat-sheet table.

Why: the topic's essence is *graph surgery over immutable objects* — motion
belongs to pointers, permanence belongs to objects, and the visual language
should enforce that split (objects never move; labels never persist).

## 8. Common tutorial mistakes

- **Teaching commands, not the model.** The default failure of all git
  education; produces cargo-cult users. Counter: no command appears before
  the structure it manipulates.
- **Skipping the index/staging area** because it's awkward. It's the #1
  daily-driver confusion. Counter: three trees always visible on stage.
- **Diff-based mental model taught "for simplicity."** Actively harmful — it
  breaks the moment rebase appears. Counter: snapshot model from minute one,
  with dedup shown immediately so it doesn't seem wasteful.
- **DAG jargon before DAG feeling.** Counter: build the graph on screen node
  by node before ever naming it.
- **No safety-net teaching.** Tutorials end without reflog, leaving fear
  intact. Counter: end ON the safety net — it's the emotional payoff.
- **Showing hashes as noise.** Truncate to 7 chars, color-code by object
  type, and make hashes *do* something (match = dedup) so they read as names,
  not line noise.

## 9. Design inspiration

- **Learn Git Branching's ref animation** — the one existing gold-standard
  motion pattern in this domain; refine, don't reinvent.
- **Museum "exploded view" exhibits / iFixit teardowns:** the commit object
  as an exploded assembly (commit → tree → blobs) that reassembles — an
  anatomy shot worth one full scene.
- **3B1B's "watch the same object under a new lens":** the same commit graph
  viewed as (a) history, (b) a key-value store, (c) reachability from refs —
  three lenses, one structure, camera does the work.
- **Info-vis principle (Tufte, small multiples):** merge-vs-rebase belongs
  side by side as small multiples of the same starting graph, not sequential.

## 10. Creative brief

- **Core intuition:** immutable content-addressed objects + movable pointer
  files; every git command is pointer motion over a permanent object store.
- **Educational objective:** learner can predict what any of
  commit/branch/merge/rebase/reset does to the graph *before* running it, and
  can open `.git` and identify what everything is.
- **Emotional objective:** fear → safety. "I understand it, and I can't
  really lose work."
- **Biggest misconception to kill:** commits are diffs; branches contain
  commits.
- **Strongest analogy:** a museum archive of sealed, numbered boxes (objects,
  named by fingerprint of contents) plus a wall of sticky notes (refs) — you
  only ever move sticky notes.
- **Strongest interactions:** content→hash live link; pointer surgery;
  merge/rebase toggle; dedup counter.
- **Strongest animations:** birth of a commit; ref labels sliding; rebase
  replay with new hashes; the Merkle cascade when one byte changes.
- **Story direction:** mystery ("where did your commit go?") → archaeology
  dig up the object layers → scary-commands debunk → reflog safety-net
  finale.
- **Best external resources:** Pro Git ch.10 (plumbing ground truth), Git
  from the Bottom Up (ordering), Learn Git Branching (ref animation
  language), Mary Rose Cook (state-snapshot rhythm), Julia Evans (fear-first
  framing).
- **Risks:** bottom-up boredom before the payoff (fix with the mystery hook);
  hash noise overwhelming the stage (truncate + color); scope creep into
  packfiles/remotes (cut both; remotes are a sequel explainer).
- **Aha inventory:** branch-is-41-bytes; same-content-same-hash; detached-
  HEAD-is-a-file-difference; rebase-makes-new-commits; reflog-means-safety.
