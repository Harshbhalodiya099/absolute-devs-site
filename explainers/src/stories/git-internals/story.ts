/**
 * "How Git actually stores your work"
 *
 * The visual law of this story, straight from the brief: OBJECTS NEVER MOVE
 * and are never deleted on stage; LABELS (refs) are the only things that
 * travel. Every "scary" command is staged as pointer motion over a permanent
 * object store.
 */
import {
  all,
  appear,
  below,
  definePreset,
  defineStory,
  dim,
  draw,
  enter,
  fadeTo,
  flash,
  move,
  pulse,
  region,
  scene,
  spot,
  stagger,
  toggle,
  token,
  v,
  wait,
} from "../../engine";
import { meta } from "./meta";

/* ---------------- story-local vocabulary ---------------- */

const blob = definePreset({
  glyph: "doc",
  label: "blob",
  accent: "cyan",
  w: 138,
  h: 66,
  note: "A file's contents, compressed and stored under the SHA-1 hash of those contents. No filename, no date — content only. Same content anywhere in history = same hash = stored once.",
});

const tree = definePreset({
  glyph: "box",
  label: "tree",
  accent: "amber",
  w: 138,
  h: 66,
  note: "A folder written down: a list of names, each mapped to the hash of a blob (file) or another tree (subfolder). One tree pins an exact snapshot of a directory.",
});

const commitObj = definePreset({
  glyph: "commit",
  label: "commit",
  accent: "violet",
  w: 148,
  h: 66,
  note: "A sealed record: one tree hash (the complete snapshot), parent commit hash(es), author, message. Immutable — 'changing' a commit always means making a new one.",
});

/* ============================================================
   Scene 1 — the mystery: where did your commit go?
   ============================================================ */

const openTheBox = scene({
  id: "open-the-box",
  chapter: "The mystery",
  question: "You typed `git commit`. Where did your work actually go?",
  title: "It went into a folder of small files you're allowed to read.",
  takeaway:
    "There is no server, no daemon, no black box: .git is a directory of small files on your disk. Your branch — the thing you've been afraid of breaking for years — is a 41-byte text file containing one commit hash. HEAD is one line naming which branch you're standing on. The commit itself landed in objects/, and that's where we dig next.",
  nextPrompt: "So what exactly is sitting inside objects/?",
  prose: [
    "You type `git commit -m \"fix\"`. Two hundred milliseconds later the prompt returns. No network light blinked, no server was contacted — and yet your work is now somewhere safe enough that people trust this system with the Linux kernel. Where did it go?",
    "The unglamorous answer is the beginning of all git enlightenment: it went into a hidden folder called .git at the root of your repository, and that folder is not an abstraction. It is made of ordinary small files you can open right now, today, with `cat`. Nothing in it is off-limits and almost everything in it is human-readable.",
    "The figure opens the box. Two files matter immediately: refs/heads/main — your branch — and HEAD. Read them both and notice how little is there. Most git fear dissolves in the face of how small these files are.",
  ],
  setup: (s) => {
    const { you, gitdir } = s.cast({
      you: v.browser({
        ...spot("left", { dy: -20 }),
        label: "you",
        sub: 'git commit -m "fix"',
        note: "No network involved. Committing is a purely local write into the .git folder — that's why it's instant and why every clone is a full backup.",
      }),
      gitdir: region({
        x: 620,
        y: 262,
        w: 440,
        h: 384,
        title: ".git — just a folder",
        accent: "dim",
        note: "The entire repository lives here: every version of every file, all history, all branches. Delete everything else and this folder can rebuild it.",
      }),
    });

    const { headFile, mainFile, objects } = s.cast({
      headFile: v.server({
        x: 512,
        y: 160,
        label: "HEAD",
        sub: "a 1-line text file",
        accent: "blue",
        w: 150,
        h: 70,
        note: "Contains literally: 'ref: refs/heads/main'. It answers one question — where are you standing right now?",
      }),
      mainFile: v.server({
        x: 726,
        y: 160,
        label: "refs/heads/main",
        sub: "your branch",
        accent: "green",
        w: 172,
        h: 70,
        note: "The branch. All of it. One line of text: the hash of the commit the branch currently points at. 41 bytes.",
      }),
      objects: region({
        x: 620,
        y: 356,
        w: 380,
        h: 150,
        title: "objects/ — the store",
        accent: "violet",
        note: "A content-addressed key-value store: every file version, folder listing and commit ever made, filed under the hash of its own contents.",
      }),
    });

    const { headContent, mainContent } = s.cast({
      headContent: token({ ...below(headFile, 56), text: "ref: refs/heads/main", accent: "blue" }),
      mainContent: token({ ...below(mainFile, 56), text: "a1b3f9e", accent: "green" }),
    });

    const wire = s.connect(you, gitdir, { bow: 30, dashed: true });

    s.step("You commit, the prompt returns in two hundred milliseconds — and your work has gone… somewhere.", [
      appear(you),
      appear(gitdir),
      draw(wire, 0.5),
      wire.send({ label: "your commit", dur: 1.1 }),
    ]);

    s.step(".git is not an abstraction — it's a folder of small files, and you are allowed to read every one of them.", [
      enter([headFile, mainFile, objects], 0.2),
    ]);

    s.step("Read your branch: refs/heads/main is a 41-byte text file holding one commit hash — that is the entire branch.", [
      flash(mainFile),
      appear(mainContent),
      pulse(mainFile, 2.0),
      wait(0.4),
    ]);

    s.step(
      "HEAD is one line too — the name of the branch you're standing on; the commit itself landed in objects/, our next stop.",
      [flash(headFile), appear(headContent), wait(0.5), pulse(objects, 2.2), wait(0.8)],
      { hold: 1.0 },
    );
  },
});

/* ============================================================
   Scene 2 — the object store: birth of a commit + dedup
   ============================================================ */

const objectStore = scene({
  id: "object-store",
  chapter: "The archaeology",
  question: "What is a commit actually made of?",
  title: "A commit is a snapshot, not a diff — and snapshots are cheap.",
  takeaway:
    "Three object types build everything: blobs (file contents, named by their hash), trees (folders as lists of hashes), and commits (one tree + parents + message). Because the name IS the content's hash, identical content is stored exactly once — so committing a 1000-file repo with one file changed creates three new objects, not a thousand. Snapshots, deduplicated: that's the whole storage model.",
  nextPrompt: "If objects never change, what do commands like reset actually do?",
  prose: [
    "Most people carry a wrong model here, so let's name it: commits are NOT diffs, and branches do not 'contain' commits. If commits were diffs, checking out a five-year-old commit would mean replaying five years of patches — but it's instant. The real model is stranger and simpler: every commit is a complete snapshot of your entire project.",
    "The store knows only three shapes. A blob is one file's contents, stored under the hash of those contents — the hash is the name, which means identity IS content. A tree is a folder written down as a list of hashes. A commit is a sealed envelope: one tree hash, a parent hash, a message. Watch one get born piece by piece below.",
    "Then the objection everyone raises: a full snapshot per commit — isn't that insanely wasteful? Watch the second commit closely and make a prediction first: you changed one file out of two. How many new objects will appear?",
  ],
  setup: (s) => {
    const { c1, t1, b1, b2 } = s.cast({
      c1: commitObj({ x: 175, y: 175, label: "commit a1b3f9e", sub: "“fix login bug”" }),
      t1: tree({ x: 440, y: 175, label: "tree 7d2c04a", sub: "the folder, as hashes" }),
      b1: blob({ x: 726, y: 120, label: "blob 9e01d22", sub: "app.js" }),
      b2: blob({ x: 726, y: 254, label: "blob 4c11a90", sub: "README.md" }),
    });
    const { c2, t2, b3, dedup } = s.cast({
      c2: commitObj({ x: 175, y: 392, label: "commit c07d811", sub: "parent: a1b3f9e" }),
      t2: tree({ x: 440, y: 392, label: "tree 91ab3e7", sub: "one entry changed" }),
      b3: blob({ x: 726, y: 392, label: "blob 22e8f04", sub: "app.js (edited)" }),
      dedup: token({ x: 726, y: 320, text: "unchanged file → same hash → reused", accent: "green" }),
    });

    const wCT = s.connect(c1, t1, { bow: 0 });
    const wTB1 = s.connect(t1, b1, { bow: -20 });
    const wTB2 = s.connect(t1, b2, { bow: 20 });
    const wCT2 = s.connect(c2, t2, { bow: 0 });
    const wTB3 = s.connect(t2, b3, { bow: 0 });
    const wReuse = s.connect(t2, b2, { bow: -30, dashed: true });
    const wParent = s.connect(c2, c1, { bow: -40, dashed: true });

    s.step("Start with the files: git hashes each one's contents, and the hash becomes its name — content IS identity here.", [
      enter([b1, b2], 0.2),
      all(flash(b1), flash(b2)),
    ]);

    s.step("A tree is your folder written down as hashes; the commit seals one tree, one parent, and a message — a full snapshot.", [
      appear(t1),
      stagger(0.15, draw(wTB1, 0.5), draw(wTB2, 0.5)),
      appear(c1),
      draw(wCT, 0.5),
      pulse(c1, 1.8),
    ]);

    s.step("Now edit app.js and commit again — predict it: how many new objects for a two-file project?", [
      appear(b3),
      appear(t2),
      draw(wTB3, 0.5),
      appear(c2),
      stagger(0.15, draw(wCT2, 0.5), draw(wParent, 0.5)),
    ]);

    s.step(
      "Three — and the unchanged README isn't copied: same content, same hash, so the new tree simply points at the old blob.",
      [draw(wReuse, 0.6), all(flash(b2), appear(dedup)), pulse(b2, 2.2), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 3 — pointer surgery: reset & detached HEAD, demystified
   ============================================================ */

const pointers = scene({
  id: "pointer-surgery",
  chapter: "The fear list",
  question: "So what do the scary commands actually do?",
  title: "Watch closely: the label moves, and nothing else happens.",
  takeaway:
    "reset didn't destroy a commit — it moved a 41-byte pointer, and the 'lost' commit sat there the whole time, intact and recoverable. Detached HEAD isn't a broken state — it's HEAD containing a raw hash instead of a branch name. Objects are immutable and never move; every command you fear is a sticky note being peeled off and stuck somewhere else.",
  nextPrompt: "Then what about the scariest one of all — rebase?",
  prose: [
    "You now know the two halves of the machine: a store of sealed, immutable objects, and a handful of tiny pointer files. That split is enough to defuse the fear list, because every frightening command turns out to operate on the pointers and only the pointers.",
    "Take the most feared of all: `git reset --hard HEAD~1`, the one folklore says 'destroys your commit.' Watch the stage while it runs. Count the things that change. It is exactly one — the branch label slides back one node. The commit it left behind is not deleted, not corrupted, not even touched; it merely stops being pointed at.",
    "And 'detached HEAD', the warning that has terrified a generation: flip back to scene one and remember what HEAD is — a one-line file. Normally it holds a branch name. Check out a raw commit and it holds a hash instead. That's the entire difference. The dramatic warning is git telling you 'new commits here won't move any branch label' — useful to know, dangerous to nothing.",
  ],
  setup: (s) => {
    const { c1, c2, c3 } = s.cast({
      c1: commitObj({ x: 200, y: 300, label: "commit 4f2a660", sub: "“initial commit”" }),
      c2: commitObj({ x: 480, y: 300, label: "commit a1b3f9e", sub: "“fix login bug”" }),
      c3: commitObj({ x: 760, y: 300, label: "commit c07d811", sub: "“wip: experiment”" }),
    });
    const { mainTok, headTok, still, detachedTok } = s.cast({
      mainTok: token({ x: 760, y: 208, text: "main", accent: "green" }),
      headTok: token({ x: 760, y: 168, text: "HEAD", accent: "blue" }),
      still: token({ ...below(c3, 58), text: "still in the store, untouched", accent: "violet" }),
      detachedTok: token({ x: 200, y: 168, text: "HEAD = 4f2a660 — a hash, not a name", accent: "amber" }),
    });

    const w21 = s.connect(c2, c1, { bow: 0, dashed: true });
    const w32 = s.connect(c3, c2, { bow: 0, dashed: true });

    s.step("Three commits, one branch label, one HEAD — this graph plus two pointer files is ALL the state there is.", [
      enter([c1, c2, c3], 0.18),
      stagger(0.15, draw(w32, 0.5), draw(w21, 0.5)),
      all(appear(mainTok), appear(headTok)),
    ]);

    s.step("Run the feared one — git reset --hard HEAD~1 — and watch closely: the label moves, and nothing else happens.", [
      all(move(mainTok, { x: 480 }, 0.9), move(headTok, { x: 480 }, 0.9)),
      dim(c3),
      wait(0.5),
    ]);

    s.step("The 'destroyed' commit is right there — unreferenced, but intact; reset moved a sticky note, not history.", [
      flash(c3),
      appear(still),
      pulse(c3, 2.2),
      wait(0.5),
    ]);

    s.step(
      "Check out an old commit directly and HEAD simply holds a hash instead of a branch name — 'detached HEAD' is a file-contents difference, not a disaster.",
      [move(headTok, { x: 200 }, 0.9), all(flash(c1), appear(detachedTok)), pulse(c1, 2.0), wait(0.8)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 4 — interactive: merge vs rebase, then the safety net
   ============================================================ */

const mergeVsRebase = scene({
  id: "merge-vs-rebase",
  chapter: "The payoff",
  question: "Merge or rebase — what's ACTUALLY different afterwards?",
  title: "Merge adds one commit. Rebase copies yours — new hashes and all.",
  takeaway:
    "Merge creates a single new commit with two parents and moves main — every original commit untouched. Rebase REPLAYS your commits on a new base, which means copies with new hashes; the originals stay behind, unreferenced, which is exactly why a rebased branch needs a force-push. And beneath both: the reflog records every position HEAD has held for 90 days. Immutable objects + a 90-day trail of pointers = you almost can't lose work.",
  nextPrompt: "Start the story again",
  prose: [
    "One divergence, two philosophies. You branched off, made two commits; meanwhile main moved on. Merge and rebase are the two ways to bring the histories together, and arguments about them fill forums — but on this stage the difference is just two different pointer-and-object moves, each visible in full.",
    "Flip the toggle above to run each one on the identical starting graph. Merge is the conservative move: it creates exactly one new commit — one with two parents — and slides main forward. Nothing is rewritten because nothing is ever rewritten; the store only grows. Rebase is the tidy-history move: it picks up your commits and replays them on top of main. Replayed means copied — look at the hashes. New parent, new content-address: they are NEW commits. Your originals don't move and aren't destroyed; they sit unreferenced, which is precisely why pushing a rebased branch needs --force — the remote is still pointing at the old copies.",
    "And then the finale this whole story has been building to. Even 'unreferenced' commits are recoverable, because git keeps a diary: the reflog, every position HEAD has held for the last 90 days. Botch a rebase, reset the wrong thing, delete a branch — the objects are immutable and the diary knows where everything was. You were never one command away from disaster.",
  ],
  params: {
    strategy: toggle("Bring them together", [
      ["merge", "git merge"],
      ["rebase", "git rebase"],
    ]),
  },
  setup: (s, p) => {
    const { c1, c2, f1, f2 } = s.cast({
      c1: commitObj({ x: 165, y: 330, label: "commit 4f2a660", sub: "the common ancestor" }),
      c2: commitObj({ x: 420, y: 330, label: "commit a1b3f9e", sub: "main moved on" }),
      f1: commitObj({ x: 420, y: 165, label: "commit b8d3c21", sub: "your work #1" }),
      f2: commitObj({ x: 660, y: 165, label: "commit d94e77f", sub: "your work #2" }),
    });
    const { mainTok, featTok, reflog } = s.cast({
      mainTok: token({ ...below(c2, 58), text: "main", accent: "green" }),
      featTok: token({ x: 660, y: 100, text: "feature", accent: "cyan" }),
      reflog: token({ x: 480, y: 452, text: "reflog: every HEAD position, kept 90 days — the safety net", accent: "violet" }),
    });

    const w21 = s.connect(c2, c1, { bow: 0, dashed: true });
    const wf1 = s.connect(f1, c1, { bow: -35, dashed: true });
    const wf2 = s.connect(f2, f1, { bow: 0, dashed: true });

    const intro = () =>
      s.step("Two lines of work share an ancestor: main moved on below, your feature branch grew above.", [
        enter([c1, c2, f1, f2], 0.15),
        stagger(0.12, draw(w21, 0.4), draw(wf1, 0.4), draw(wf2, 0.4)),
        all(appear(mainTok), appear(featTok)),
      ]);

    if (p.strategy === "merge") {
      const { m } = s.cast({
        m: commitObj({ x: 820, y: 330, label: "commit 5e19a02", sub: "TWO parents" }),
      });
      const wm1 = s.connect(m, c2, { bow: 0, dashed: true });
      const wm2 = s.connect(m, f2, { bow: 25, dashed: true });

      intro();

      s.step("Merge doesn't blend branches — it creates exactly ONE new commit, with two parents.", [
        appear(m),
        stagger(0.2, draw(wm1, 0.5), draw(wm2, 0.5)),
        pulse(m, 2.0),
      ]);

      s.step("main slides forward to the merge commit; every commit that existed before is untouched.", [
        move(mainTok, { x: 820 }, 1.0),
        flash(m),
        wait(0.5),
      ]);

      s.step(
        "And underneath it all, the reflog has recorded every move — objects are immutable, pointers leave a trail, work is hard to lose.",
        [appear(reflog), pulse(reflog, 2.4), wait(1.0)],
        { hold: 1.2 },
      );
      return;
    }

    /* rebase branch */
    const { r1, r2 } = s.cast({
      r1: commitObj({ x: 640, y: 330, label: "commit e9a2f10", sub: "your work #1 — NEW hash" }),
      r2: commitObj({ x: 850, y: 330, label: "commit 03cb5d8", sub: "your work #2 — NEW hash" }),
    });
    const wr1 = s.connect(r1, c2, { bow: 0, dashed: true });
    const wr2 = s.connect(r2, r1, { bow: 0, dashed: true });

    intro();

    s.step("Rebase REPLAYS your commits on top of main — replayed means copied: new parent, new hash, new commits.", [
      appear(r1),
      draw(wr1, 0.5),
      appear(r2),
      draw(wr2, 0.5),
      all(flash(r1), flash(r2)),
    ]);

    s.step("The originals don't move and aren't destroyed — they just go unreferenced, which is why the remote now disagrees and a force-push is needed.", [
      all(fadeTo(f1, 0.3), fadeTo(f2, 0.3), fadeTo(wf1, 0.15), fadeTo(wf2, 0.15)),
      move(featTok, { x: 850, y: 262 }, 1.0),
      wait(0.5),
    ]);

    s.step(
      "Even those ghosts are recoverable: the reflog remembers every position HEAD held for 90 days — you almost can't lose work.",
      [appear(reflog), all(flash(f1), flash(f2)), pulse(reflog, 2.4), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================ */

export default defineStory({
  ...meta,
  scenes: [openTheBox, objectStore, pointers, mergeVsRebase],
  outro: [
    "The whole machine, one more time: a content-addressed store of sealed objects — blobs, trees, commits, named by the hash of what's inside them — plus a handful of tiny text files pointing into it. Commands don't edit history; they add objects and move pointers. Once that split lands, you can predict what any command does to the graph before you run it, which is the difference between using git and fearing it.",
    "Next time something goes wrong at the terminal, open the box: `cat .git/HEAD`, `cat .git/refs/heads/main`, `git reflog`. You'll be reading one-line files and a diary of pointer positions — nothing in there can't be understood, and almost nothing in there can't be undone. The fear was never about danger; it was about hidden state. Now none of it is hidden.",
  ],
  references: [
    {
      kind: "book",
      title: "Pro Git, ch. 10: Git Internals",
      url: "https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain",
      note: "The canonical (free) text — it builds a commit by hand from raw objects, without ever typing git commit.",
    },
    {
      kind: "interactive",
      title: "Learn Git Branching",
      url: "https://learngitbranching.js.org",
      note: "Watch rebase physically pick your commits up and replay them — the graph animations pair perfectly with the pointer model.",
    },
    {
      kind: "article",
      title: "Git from the inside out",
      url: "https://codewords.recurse.com/issues/two/git-from-the-inside-out",
      note: "Mary Rose Cook narrates what each command does to the object database, state snapshot by state snapshot.",
    },
    {
      kind: "book",
      title: "Git from the Bottom Up",
      url: "https://jwiegley.github.io/git-from-the-bottom-up/",
      note: "Blobs → trees → commits → refs, each layer defined only in terms of the previous one.",
    },
  ],
});
