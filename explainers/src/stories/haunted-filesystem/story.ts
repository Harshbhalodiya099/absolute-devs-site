/**
 * "The secret lives of deleted files" — the Haunted Filesystem.
 *
 * The visual law of this story: THE BYTES NEVER MOVE. Names and wires are the
 * only things that appear and vanish; the inode and its data blocks stay put on
 * disk the entire time. Every "delete" is staged as a wire being cut over a
 * block store that is never actually destroyed — until the final scene, where
 * real erasure overwrites the blocks in place.
 */
import { E } from "../../engine";
import { meta } from "./meta";

/* ---------------- story-local vocabulary ---------------- */

const inode = E.definePreset({
  glyph: "book",
  label: "inode",
  accent: "violet",
  w: 150,
  note: "The file's real identity: size, permissions, timestamps, a link count, and pointers to every data block. This — not the name — is the actual file.",
});

/* directory entry + data-block styling, reused across scenes */
const dirNote =
  "A directory is just a table of (name → inode number). The name has no bytes of its own; it only points at an inode.";
const CLEAN = "cyan";
const GHOST = "rose";

/* ============================================================
   Scene 1 — where a file actually lives
   ============================================================ */

const anatomy = E.scene({
  id: "anatomy",
  chapter: "The three layers",
  question: "When you save a file, where does the file actually live?",
  title: "A name, an inode, and the bytes — three layers, one file.",
  takeaway:
    "A file is not one thing but three, chained together: a name in a directory points at an inode number; the inode holds the metadata and the block pointers; the blocks hold the bytes. Only the top layer is human-readable, and only the top layer is what you think of as 'the file'. Keep this chain in mind — every trick that follows is about which link gets cut.",
  nextPrompt: "So what does `rm` actually cut?",
  setup: (s) => {
    const { dir, node } = s.cast({
      dir: E.node({
        x: 180,
        y: 255,
        label: "report.txt",
        sub: "directory entry",
        glyph: "doc",
        accent: "cyan",
        note: dirNote,
      }),
      node: inode({ x: 470, y: 255, sub: "inode 8213" }),
    });

    const { disk } = s.cast({
      disk: E.region({ x: 772, y: 255, w: 150, h: 300, title: "disk blocks", accent: "dim" }),
    });

    const pts = E.column({ at: { x: 772, y: 255 }, count: 4, gap: 66 });
    const { b0, b1, b2, b3 } = s.cast({
      b0: E.token({ ...pts[0], text: "0x4F…", accent: CLEAN }),
      b1: E.token({ ...pts[1], text: "0xA3…", accent: CLEAN }),
      b2: E.token({ ...pts[2], text: "0x19…", accent: CLEAN }),
      b3: E.token({ ...pts[3], text: "0xC7…", accent: CLEAN }),
    });
    const blocks = [b0, b1, b2, b3];

    const toNode = s.connect(dir, node, { bow: 0, dashed: true });
    const toBlocks = s.fanout(node, blocks, { dashed: true, bowSpread: 44 });

    s.step("The name you type is only an entry in a directory — a label that points at a number.", [
      E.appear(dir),
      E.pulse(dir, 2.0),
    ]);

    s.step("That number is the inode: the file's real identity — its size, permissions, and where the bytes live.", [
      E.appear(node),
      E.draw(toNode),
      toNode.send({ label: "inode 8213", dur: 1.1 }),
      E.pulse(node, 2.0),
    ]);

    s.step("The inode points at the data blocks on disk — the actual bytes of your file.", [
      E.appear(disk),
      E.enter(blocks, 0.12),
      toBlocks.draw({ gap: 0.12, dur: 0.5 }),
      toBlocks.send({ color: CLEAN, label: "bytes", gap: 0.15, dur: 0.9 }),
    ]);

    s.step(
      "Three layers, chained: a name, an inode, the blocks — and only the top link is the thing you named.",
      [E.all(E.pulse(dir, 2.4), E.pulse(node, 2.4), toBlocks.pulse(2.0)), E.wait(1.0)],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 2 — what `rm` actually touches
   ============================================================ */

const whatRmDoes = E.scene({
  id: "what-rm-does",
  chapter: "The bookkeeping edit",
  question: "You ran `rm`. What did it destroy?",
  title: "It cut one wire — the name — and touched nothing else.",
  takeaway:
    "`rm` calls `unlink()`, which does exactly two tiny things: it removes the directory entry and decrements the inode's link count. It never visits the data blocks. When the count hits zero the space is marked reusable, but 'reusable' is not 'erased' — the bytes sit there untouched until something else happens to overwrite them. Deletion is a bookkeeping edit, not an act of destruction.",
  nextPrompt: "If that's all delete does, can I prove the bytes survive?",
  setup: (s) => {
    const { dir, node } = s.cast({
      dir: E.node({
        x: 180,
        y: 255,
        label: "report.txt",
        sub: "directory entry",
        glyph: "doc",
        accent: "cyan",
        note: dirNote,
      }),
      node: inode({ x: 470, y: 255, sub: "link count: 1" }),
    });

    const { disk } = s.cast({
      disk: E.region({ x: 772, y: 255, w: 150, h: 300, title: "disk blocks", accent: "dim" }),
    });

    const pts = E.column({ at: { x: 772, y: 255 }, count: 4, gap: 66 });
    const { b0, b1, b2, b3 } = s.cast({
      b0: E.token({ ...pts[0], text: "0x4F…", accent: CLEAN }),
      b1: E.token({ ...pts[1], text: "0xA3…", accent: CLEAN }),
      b2: E.token({ ...pts[2], text: "0x19…", accent: CLEAN }),
      b3: E.token({ ...pts[3], text: "0xC7…", accent: CLEAN }),
    });
    const blocks = [b0, b1, b2, b3];

    const { rmTok, aliveTok } = s.cast({
      rmTok: E.token({ ...E.below(dir, 70), text: "rm → unlink()", accent: GHOST }),
      aliveTok: E.token({ ...E.below(node, 108), text: "bytes: untouched", accent: "green" }),
    });

    const toNode = s.connect(dir, node, { bow: 0, dashed: true });
    const toBlocks = s.fanout(node, blocks, { dashed: true, bowSpread: 44 });

    s.step("Here is that same file: the name, the inode, and the blocks, all still chained together.", [
      E.appear(disk),
      E.all(E.appear(dir), E.appear(node)),
      E.enter(blocks, 0.1),
      E.draw(toNode),
      toBlocks.draw({ gap: 0.1, dur: 0.4 }),
    ]);

    s.step("You run `rm`. It cuts exactly one thing — the directory entry — and the name is gone.", [
      E.appear(rmTok),
      E.fadeTo(toNode, 0, 0.5),
      E.crash(dir, { remains: 0 }),
      E.wait(0.4),
    ]);

    s.step("Nothing reached the inode or the disk; every byte is exactly where it was, just no longer named.", [
      E.fadeTo(rmTok, 0, 0.3),
      E.all(E.pulse(node, 2.6), toBlocks.pulse(2.4)),
      E.appear(aliveTok),
      E.wait(0.8),
    ]);

    s.step(
      "All `rm` did was drop an entry and decrement a counter. Destruction never happened.",
      [E.all(E.glowOn(node), toBlocks.pulse(2.0)), E.wait(1.0)],
      { hold: 1.0, view: [node, disk] },
    );
  },
});

/* ============================================================
   Scene 3 — the hard-link proof
   ============================================================ */

const hardLink = E.scene({
  id: "hard-link",
  chapter: "The proof",
  question: "Is 'delete = erase' just a story, or can you prove it wrong?",
  title: "Give one file two names, delete one, and it's completely unharmed.",
  takeaway:
    "A hard link is a second directory entry pointing at the same inode — `ln a b` doesn't copy anything; it just makes the inode's link count 2. Deleting `a` drops the count to 1 and removes one name; the bytes are provably untouched because `b` still opens the exact same file. Space is only reclaimed when the link count reaches zero AND no process still holds the file open. This is the cleanest proof that unlink is not erase.",
  nextPrompt: "So a deleted file is still down there — can I get it back?",
  setup: (s) => {
    const { nameA, nameB, node } = s.cast({
      nameA: E.node({
        x: 180,
        y: 150,
        label: "report.txt",
        sub: "name #1",
        glyph: "doc",
        accent: "cyan",
        note: "One directory entry pointing at inode 8213.",
      }),
      nameB: E.node({
        x: 180,
        y: 360,
        label: "backup.txt",
        sub: "name #2 (hard link)",
        glyph: "doc",
        accent: "amber",
        note: "A second entry pointing at the very same inode. Not a copy — the same bytes, reached by a different name.",
      }),
      node: inode({ x: 490, y: 255, sub: "link count: 2" }),
    });

    const { disk } = s.cast({
      disk: E.region({ x: 782, y: 255, w: 140, h: 300, title: "disk blocks", accent: "dim" }),
    });

    const pts = E.column({ at: { x: 782, y: 255 }, count: 4, gap: 66 });
    const { b0, b1, b2, b3 } = s.cast({
      b0: E.token({ ...pts[0], text: "0x4F…", accent: CLEAN }),
      b1: E.token({ ...pts[1], text: "0xA3…", accent: CLEAN }),
      b2: E.token({ ...pts[2], text: "0x19…", accent: CLEAN }),
      b3: E.token({ ...pts[3], text: "0xC7…", accent: CLEAN }),
    });
    const blocks = [b0, b1, b2, b3];

    const { countTok } = s.cast({
      countTok: E.token({ ...E.below(node, 96), text: "links: 2", accent: "green" }),
    });

    const wA = s.connect(nameA, node, { bow: -28, dashed: true });
    const wB = s.connect(nameB, node, { bow: 28, dashed: true });
    const toBlocks = s.fanout(node, blocks, { dashed: true, bowSpread: 40 });

    s.step("`ln a b` gives one file a second name — and both entries point at the very same inode.", [
      E.all(E.appear(nameA), E.appear(nameB), E.appear(node), E.appear(disk)),
      E.enter(blocks, 0.08),
      E.all(E.draw(wA), E.draw(wB)),
      toBlocks.draw({ gap: 0.08, dur: 0.4 }),
    ]);

    s.step("The inode's link count is now two — it is literally counting how many names lead to it.", [
      E.appear(countTok),
      E.pulse(node, 2.4),
    ]);

    s.step("Run `rm report.txt`: one name goes, the count drops to one, and the inode never flinches.", [
      E.fadeTo(wA, 0, 0.5),
      E.crash(nameA, { remains: 0 }),
      E.fadeTo(countTok, 0, 0.2),
      E.wait(0.2),
    ]);

    const { count1 } = s.cast({
      count1: E.token({ ...E.below(node, 96), text: "links: 1", accent: "green" }),
    });

    s.step(
      "`backup.txt` still opens the exact same bytes — unlink removed a name, not a file.",
      [
        E.appear(count1),
        wB.send({ color: "amber", label: "open()", dur: 1.0 }),
        toBlocks.send({ color: CLEAN, label: "read", gap: 0.12, dur: 0.9 }),
        E.all(E.pulse(node, 2.0), toBlocks.pulse(2.0)),
        E.wait(1.0),
      ],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 4 — recovery (the toggle payoff)
   ============================================================ */

const recovery = E.scene({
  id: "recovery",
  chapter: "The payoff",
  question: "The name is gone. Is the file gone?",
  title: "Delete cut the name; the inode still points home.",
  takeaway:
    "This is why undelete tools exist. Deletion orphans the inode — no directory entry names it — but as long as those blocks haven't been reused, the inode still points at your intact data. A recovery tool ignores the missing name, reads surviving inode structures straight off the disk, and writes a fresh directory entry back. Same inode, same bytes, because deletion never touched them. Flip the toggle and watch the ghost walk back out of the stacks.",
  nextPrompt: "Then how do you ever REALLY erase something?",
  params: {
    op: E.toggle("Operation", [
      ["delete", "Deleted"],
      ["recover", "Recover it"],
    ]),
  },
  setup: (s, p) => {
    const recovering = p.op === "recover";

    const { node } = s.cast({
      node: inode({ x: 470, y: 255, sub: "orphaned · link count: 0" }),
    });

    const { disk } = s.cast({
      disk: E.region({ x: 772, y: 255, w: 150, h: 300, title: "disk blocks", accent: "dim" }),
    });

    const pts = E.column({ at: { x: 772, y: 255 }, count: 4, gap: 66 });
    const { b0, b1, b2, b3 } = s.cast({
      b0: E.token({ ...pts[0], text: "0x4F…", accent: CLEAN }),
      b1: E.token({ ...pts[1], text: "0xA3…", accent: CLEAN }),
      b2: E.token({ ...pts[2], text: "0x19…", accent: CLEAN }),
      b3: E.token({ ...pts[3], text: "0xC7…", accent: CLEAN }),
    });
    const blocks = [b0, b1, b2, b3];

    const toBlocks = s.fanout(node, blocks, { dashed: true, bowSpread: 44 });

    if (!recovering) {
      const { ghostName, unref } = s.cast({
        ghostName: E.node({
          x: 180,
          y: 255,
          label: "report.txt",
          sub: "no such entry",
          glyph: "doc",
          accent: "dim",
          note: "The directory no longer has this name. `ls` can't find it and `open()` fails — yet the bytes it named are all still on disk.",
        }),
        unref: E.token({ ...E.below(node, 108), text: "unreferenced, not erased", accent: "amber" }),
      });

      s.step("The file is deleted: the directory entry is gone, so no name resolves to it any more.", [
        E.appear(disk),
        E.enter(blocks, 0.1),
        toBlocks.draw({ gap: 0.1, dur: 0.4 }),
        E.appear(node),
        E.appear(ghostName),
        E.all(E.dim(ghostName), E.dim(node)),
      ]);

      s.step("But the inode is orphaned, not erased — it still points at every original block, waiting.", [
        E.undim(node),
        E.all(E.pulse(node, 2.6), toBlocks.pulse(2.6)),
        E.appear(unref),
        E.wait(0.8),
      ]);

      s.step(
        "Unfindable by name, perfectly intact by inode. Now flip the toggle and bring it home.",
        [E.all(E.pulse(node, 2.2), toBlocks.pulse(2.0)), E.wait(1.0)],
        { hold: 1.0, view: "all" },
      );
      return;
    }

    /* recover branch: a tool reads the surviving inode and rebuilds the name */
    const { tool } = s.cast({
      tool: E.node({
        x: 180,
        y: 130,
        label: "recovery tool",
        sub: "reads raw disk",
        glyph: "gear",
        accent: "green",
        note: "Undelete software (extundelete, PhotoRec, TestDisk) walks the filesystem structures directly, skipping the missing directory entry to find inodes that still point at unreused blocks.",
      }),
    });
    const { newName } = s.cast({
      newName: E.node({
        x: 180,
        y: 360,
        label: "report.txt",
        sub: "restored entry",
        glyph: "doc",
        accent: "cyan",
        note: "A brand-new directory entry, written to point back at the surviving inode. The name is new; the inode and bytes are the originals.",
      }),
    });

    const scan = s.connect(tool, node, { bow: 24, dashed: true });
    const relink = s.connect(newName, node, { bow: -24, dashed: true });

    s.step("A recovery tool ignores the missing name and reads the surviving inode straight off the disk.", [
      E.appear(disk),
      E.enter(blocks, 0.1),
      E.appear(node),
      E.appear(tool),
      E.draw(scan),
      scan.send({ color: "green", label: "scan inodes", dur: 1.1 }),
      toBlocks.draw({ gap: 0.1, dur: 0.4 }),
      E.pulse(node, 2.0),
    ]);

    s.step("It finds the inode still pointing at the same untouched blocks — so it writes a fresh directory entry.", [
      toBlocks.send({ color: CLEAN, label: "still here", gap: 0.12, dur: 0.9 }),
      E.appear(newName),
      E.draw(relink),
      relink.send({ color: "cyan", label: "re-link", dur: 1.0 }),
    ]);

    s.step(
      "The file is back — same inode, same bytes — because deletion never touched them in the first place.",
      [E.all(E.glowOn(newName), E.pulse(node, 2.4), toBlocks.pulse(2.2)), E.wait(1.2)],
      { hold: 1.2, view: "all" },
    );
  },
});

/* ============================================================
   Scene 5 — so how do you REALLY erase it?
   ============================================================ */

const erase = E.scene({
  id: "erase",
  chapter: "Real erasure",
  question: "If unlink never erases, how do you actually destroy data?",
  title: "You have to overwrite the bytes — or throw away the key.",
  takeaway:
    "Because delete only edits bookkeeping, real erasure means attacking layer three: overwrite the blocks (`shred`, `wipe`) so there's nothing left to recover. On SSDs, TRIM already tells the controller a block is free so it can wipe it early for wear-leveling — which is why the ghost often vanishes on its own, but also why forensic recovery from SSDs is unreliable. The most reliable erase of all is full-disk encryption: destroy the key and every block stays scrambled forever, no overwriting required.",
  nextPrompt: "Start the story again",
  setup: (s) => {
    const { shred, node } = s.cast({
      shred: E.node({
        x: 180,
        y: 255,
        label: "shred",
        sub: "overwrite the blocks",
        glyph: "gear",
        accent: "rose",
        note: "`shred`/`wipe` write passes of data over the file's own blocks, so a tool reading the raw disk finds garbage instead of your bytes.",
      }),
      node: inode({ x: 470, y: 255, sub: "inode 8213" }),
    });

    const { disk } = s.cast({
      disk: E.region({ x: 772, y: 255, w: 150, h: 300, title: "disk blocks", accent: "dim" }),
    });

    const pts = E.column({ at: { x: 772, y: 255 }, count: 4, gap: 66 });
    const { b0, b1, b2, b3 } = s.cast({
      b0: E.token({ ...pts[0], text: "0x4F…", accent: CLEAN }),
      b1: E.token({ ...pts[1], text: "0xA3…", accent: CLEAN }),
      b2: E.token({ ...pts[2], text: "0x19…", accent: CLEAN }),
      b3: E.token({ ...pts[3], text: "0xC7…", accent: CLEAN }),
    });
    const blocks = [b0, b1, b2, b3];

    /* scrambled overlays, cast at the same spots (invisible until overwrite) */
    const { g0, g1, g2, g3 } = s.cast({
      g0: E.token({ ...pts[0], text: "▓▓▓", accent: GHOST }),
      g1: E.token({ ...pts[1], text: "▓▓▓", accent: GHOST }),
      g2: E.token({ ...pts[2], text: "▓▓▓", accent: GHOST }),
      g3: E.token({ ...pts[3], text: "▓▓▓", accent: GHOST }),
    });
    const clean = [b0, b1, b2, b3];
    const junk = [g0, g1, g2, g3];

    const toBlocks = s.fanout(shred, blocks, { dashed: true, bowSpread: 44 });

    s.step("To truly erase a file you must attack the one layer delete never touches — the blocks themselves.", [
      E.appear(disk),
      E.appear(node),
      E.appear(shred),
      E.enter(clean, 0.1),
      toBlocks.draw({ gap: 0.1, dur: 0.4 }),
    ]);

    s.step("`shred` writes garbage over every byte, so even a raw-disk reader finds nothing to recover.", [
      toBlocks.send({ color: GHOST, label: "overwrite", gap: 0.12, dur: 0.9 }),
      E.stagger(
        0.14,
        E.seq(E.fadeTo(b0, 0, 0.3), E.appear(g0)),
        E.seq(E.fadeTo(b1, 0, 0.3), E.appear(g1)),
        E.seq(E.fadeTo(b2, 0, 0.3), E.appear(g2)),
        E.seq(E.fadeTo(b3, 0, 0.3), E.appear(g3)),
      ),
      E.all(...junk.map((g) => E.pulse(g, 1.8))),
    ]);

    const { trimTok } = s.cast({
      trimTok: E.token({ ...E.below(node, 108), text: "SSD: TRIM wipes early", accent: "amber" }),
    });

    s.step("On an SSD, TRIM already hands freed blocks to the controller to wipe early — so the ghost often self-exorcises.", [
      E.appear(trimTok),
      E.all(...junk.map((g) => E.flash(g))),
      E.wait(0.6),
    ]);

    const { keyTok } = s.cast({
      keyTok: E.token({ ...E.below(node, 148), text: "crypto-erase: drop the key", accent: "violet" }),
    });

    s.step(
      "The surest erase of all: encrypt everything, then throw away the key — the bytes stay scrambled forever.",
      [E.appear(keyTok), E.all(E.pulse(node, 2.2), ...junk.map((g) => E.pulse(g, 2.0))), E.wait(1.2)],
      { hold: 1.2, view: "all" },
    );
  },
});

/* ============================================================ */

export default E.story({
  ...meta,
  scenes: [anatomy, whatRmDoes, hardLink, recovery, erase],
  outro: [
    "Strip away the fear and `rm` is almost boring: it removes a directory entry and decrements a counter, then trusts the filesystem to reuse those blocks whenever it likes. Everything that feels spooky about deleted files falls out of that one design choice — the recoverable ghost, the hard link that refuses to die, the log file that keeps eating disk until the process holding it open finally exits.",
    "It also tells you exactly how to think about erasure. If you want a file back, act before its blocks are reused. If you want it truly gone, don't delete it — overwrite it, TRIM it, or encrypt it and burn the key. 'Delete' was never destruction; it was always just bookkeeping, and now you can see the difference from the inside.",
  ],
  references: [
    {
      kind: "book",
      title: "Operating Systems: Three Easy Pieces — File System Implementation",
      url: "https://pages.cs.wisc.edu/~remzi/OSTEP/",
      note: "The free chapter that makes inodes, directory entries, and link counts concrete. Start here.",
    },
    {
      kind: "docs",
      title: "unlink(2) — Linux manual page",
      url: "https://man7.org/linux/man-pages/man2/unlink.2.html",
      note: "The actual contract: space is freed only when the link count AND every open handle both reach zero.",
    },
    {
      kind: "docs",
      title: "shred(1) — and why it can't help you on some filesystems",
      url: "https://man7.org/linux/man-pages/man1/shred.1.html",
      note: "Overwriting works on the file's blocks — the warning section explains where copy-on-write and SSDs break that assumption.",
    },
    {
      kind: "article",
      title: "ext4 Data Structures and Algorithms (kernel.org)",
      url: "https://www.kernel.org/doc/html/latest/filesystems/ext4/",
      note: "How a journaling filesystem keeps metadata consistent across a crash — and why journaling protects structure, not secrecy.",
    },
  ],
});
