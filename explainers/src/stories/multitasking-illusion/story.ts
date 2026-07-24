/**
 * "The multitasking illusion" — why concurrency isn't parallelism.
 *
 * The visual law of this story: ONE GLOW AT A TIME. A single CPU core can light
 * up exactly one task; everything that looks simultaneous is that one glow
 * hopping between cards faster than the eye resolves. Only the final scene adds
 * a second core and lets two tasks glow together — the moment concurrency
 * finally becomes parallelism.
 */
import { E } from "../../engine";
import { meta } from "./meta";

/* ---------------- story-local vocabulary ---------------- */

const cpu = E.definePreset({
  glyph: "chip",
  label: "CPU",
  accent: "amber",
  w: 150,
  note: "One core executes a single instruction stream at a time. Everything that looks simultaneous is really this one core switching between tasks faster than you can perceive.",
});

const task = E.definePreset({
  glyph: "box",
  label: "task",
  accent: "cyan",
  w: 150,
  note: "A process or thread: its own code and its own saved registers. It can be running, runnable (ready and waiting for the core), or blocked — but only one runnable task can hold a single core at any instant.",
});

/* the three jobs that recur across the story, with fixed identities */
const A = { label: "video encode", sub: "CPU-bound", accent: "cyan" as const };
const B = { label: "web browser", sub: "interactive", accent: "violet" as const };
const C = { label: "file backup", sub: "background", accent: "green" as const };

/* ============================================================
   Scene 1 — the illusion, then the curtain
   ============================================================ */

const illusion = E.scene({
  id: "illusion",
  chapter: "The lie",
  question: "Your machine runs a dozen programs 'at once'. How many can one core actually run?",
  title: "Three programs, one core, and a very convincing lie.",
  takeaway:
    "On a single core, nothing runs at the same time. The core executes a sliver of one task, saves its place, runs a sliver of the next, and rotates through them thousands of times a second. Switch fast enough and three separate slivers blur into the feeling of 'all at once'. That blur has a name — concurrency — and it is an illusion of simultaneity, not the real thing.",
  nextPrompt: "If it's really one task at a time, what happens in the gap between them?",
  setup: (s) => {
    const pts = E.column({ at: { x: 190, y: 255 }, count: 3, gap: 116 });
    const { t0, t1, t2 } = s.cast({
      t0: task({ ...pts[0], ...A }),
      t1: task({ ...pts[1], ...B }),
      t2: task({ ...pts[2], ...C }),
    });
    const { core } = s.cast({ core: cpu({ x: 660, y: 255, sub: "1 core" }) });
    const tasks = [t0, t1, t2];

    const fan = s.fanout(core, tasks, { dashed: true, bowSpread: 64 });

    s.step("A music player, a browser, a download — three programs, all running at the same time. Obviously.", [
      E.enter(tasks, 0.18),
      E.all(E.pulse(t0, 2.6), E.pulse(t1, 2.6), E.pulse(t2, 2.6)),
    ]);

    s.step("Pull back the curtain and there is just one core — and it can run exactly one of them at a time.", [
      E.appear(core),
      fan.draw({ gap: 0.14, dur: 0.5 }),
      E.pulse(core, 2.2),
    ]);

    s.step("So it doesn't run them together. It runs a sliver of one, then the next, then the next.", [
      E.seq(
        E.all(E.flash(t0), E.glowOn(core), fan.wires[0].send({ color: "cyan", label: "run", dur: 0.5 })),
        E.wait(0.35),
        E.all(E.flash(t1), fan.wires[1].send({ color: "violet", label: "run", dur: 0.5 })),
        E.wait(0.35),
        E.all(E.flash(t2), fan.wires[2].send({ color: "green", label: "run", dur: 0.5 })),
        E.wait(0.35),
        E.all(E.flash(t0), fan.wires[0].send({ color: "cyan", label: "run", dur: 0.5 })),
        E.wait(0.35),
        E.all(E.flash(t1), fan.wires[1].send({ color: "violet", label: "run", dur: 0.5 })),
      ),
    ]);

    s.step(
      "Switch fast enough and three slivers blur into 'all at once'. That blur is concurrency — not many hands, just one, moving fast.",
      [E.all(E.pulse(t0, 2.2), E.pulse(t1, 2.2), E.pulse(t2, 2.2), E.glowOff(core)), E.wait(1.0)],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 2 — the switch, and what it secretly costs
   ============================================================ */

const contextSwitch = E.scene({
  id: "context-switch",
  chapter: "The handoff",
  question: "To swap from one task to the next, what does the core actually do — and is it free?",
  title: "Save the registers, load the next set, jump. Then pay the hidden bill.",
  takeaway:
    "A context switch is a save-and-restore: the kernel snapshots the running task's registers and program counter into its task struct, loads the next task's, and jumps. The direct cost is a few microseconds. The hidden cost is worse — the new task starts with cold caches and a flushed TLB, so it runs slow until its working set is back in cache. This is exactly why 'just add more threads' can make a program go backwards.",
  nextPrompt: "So who decides whose turn is next — and could you change the rule?",
  setup: (s) => {
    const { ta, tb } = s.cast({
      ta: task({ x: 180, y: 175, ...A, sub: "running" }),
      tb: task({ x: 180, y: 350, ...B, sub: "runnable" }),
    });
    const { core } = s.cast({ core: cpu({ x: 660, y: 262, sub: "1 core" }) });

    const { pcA } = s.cast({
      pcA: E.token({ ...E.below(core, 66), text: "PC 0x4A1C · regs: A", accent: "cyan" }),
    });

    const wA = s.connect(ta, core, { bow: -26, dashed: true });
    const wB = s.connect(tb, core, { bow: 26, dashed: true });

    s.step("The core is running A. A's live state — its program counter and registers — sits inside the core itself.", [
      E.appear(core),
      E.all(E.appear(ta), E.appear(tb)),
      E.dim(tb),
      E.draw(wA),
      wA.send({ color: "cyan", label: "execute", dur: 1.0 }),
      E.all(E.appear(pcA), E.pulse(core, 2.2)),
    ]);

    const { timer } = s.cast({
      timer: E.token({ ...E.above(core, 60), text: "⏱ timer interrupt · slice up", accent: "amber" }),
    });

    s.step("A timer interrupt fires: A's time-slice is up. The kernel steps in to hand the core to someone else.", [
      E.appear(timer),
      E.flash(core),
      E.wait(0.4),
    ]);

    s.step("First it copies A's registers back into A's own memory — a snapshot so A can resume exactly where it stopped.", [
      E.fadeTo(timer, 0, 0.3),
      wA.send({ color: "cyan", label: "save registers", dur: 1.0 }),
      E.fadeTo(pcA, 0, 0.4),
      E.flash(ta),
    ]);

    const { pcB } = s.cast({
      pcB: E.token({ ...E.below(core, 66), text: "PC 0x0C20 · regs: B", accent: "violet" }),
    });

    s.step("Then it loads B's saved registers and jumps in. The swap itself: a few microseconds of pure overhead.", [
      E.all(E.undim(tb), E.dim(ta)),
      E.draw(wB),
      wB.send({ color: "violet", label: "load registers", dur: 1.0 }),
      E.all(E.appear(pcB), E.pulse(core, 2.0)),
    ]);

    const { tax } = s.cast({
      tax: E.token({ ...E.below(core, 108), text: "cache cold · TLB flushed → B runs slow", accent: "rose" }),
    });

    s.step(
      "But B's data isn't in the cache yet, so it runs cold and slow. That aftershock — not the swap — is the real cost of switching.",
      [E.appear(tax), E.all(E.pulse(core, 2.2), E.pulse(tax, 2.0)), E.wait(1.0)],
      { hold: 1.0, view: [ta, tb, core] },
    );
  },
});

/* ============================================================
   Scene 3 — the scheduler's dial (the teaching knob)
   ============================================================ */

const colors = ["cyan", "violet", "green"] as const;

const policy = E.scene({
  id: "policy",
  chapter: "The rule of the room",
  question: "Same three tasks, same one core. Who gets to run next — and who decides?",
  title: "The scheduler is a policy, and the policy is a dial you can turn.",
  takeaway:
    "Nothing about the hardware decides whose turn is next — a scheduling policy does, and swapping the policy visibly redraws who gets the core. Round-robin hands every task an equal slice in strict rotation, simple but blind. Priority (nice values) lets you hand-pick a favorite, which can starve the rest. Linux's CFS keeps no fixed slices at all: it always runs whoever has used the least CPU so far, so it's fair over time and an interactive task that just woke gets served at once. Turn the dial and watch the same three tasks split the core three different ways.",
  nextPrompt: "But what about a task that isn't computing at all — one that's just waiting?",
  params: {
    policy: E.choice("Scheduler policy", [
      ["rr", "Round-robin"],
      ["prio", "Priority (nice)"],
      ["cfs", "CFS (fair)"],
    ]),
  },
  setup: (s, p) => {
    const pts = E.column({ at: { x: 190, y: 255 }, count: 3, gap: 116 });
    const { t0, t1, t2 } = s.cast({
      t0: task({ ...pts[0], ...A }),
      t1: task({ ...pts[1], ...B }),
      t2: task({ ...pts[2], ...C }),
    });
    const { core } = s.cast({ core: cpu({ x: 660, y: 255, sub: "1 core" }) });
    const tasks = [t0, t1, t2];

    let headline: string;
    let shares: [string, string, string];
    let order: number[];
    let sliceCaption: string;

    if (p.policy === "rr") {
      headline = "Round-robin: equal slices, strict rotation";
      shares = ["≈ 33%", "≈ 33%", "≈ 33%"];
      order = [0, 1, 2, 0, 1, 2];
      sliceCaption = "Round-robin gives every task an identical slice and cycles the room in order — fair, but blind to what any task needs.";
    } else if (p.policy === "prio") {
      headline = "Priority: you pick a favorite, others wait";
      shares = ["≈ 20%", "≈ 60% · nice −10", "≈ 20%"];
      order = [1, 0, 1, 2, 1, 1];
      sliceCaption = "Give the browser a high priority and it hogs the core; the low-priority backup gets whatever's left — and can starve entirely.";
    } else {
      headline = "CFS: least-used-so-far runs next";
      shares = ["≈ 33%", "≈ 33%", "≈ 33%"];
      order = [0, 1, 2, 1, 0, 2];
      sliceCaption = "CFS keeps no fixed slice — it runs whoever has had the least CPU, so the browser that just woke jumps in immediately, yet nobody is starved over time.";
    }

    const { head } = s.cast({
      head: E.label({ x: 660, y: 120, text: headline, size: 15, color: "amber" }),
    });
    const { s0, s1, s2 } = s.cast({
      s0: E.token({ x: 432, y: pts[0].y, text: shares[0], accent: colors[0] }),
      s1: E.token({ x: 432, y: pts[1].y, text: shares[1], accent: colors[1] }),
      s2: E.token({ x: 432, y: pts[2].y, text: shares[2], accent: colors[2] }),
    });

    const fan = s.fanout(core, tasks, { dashed: true, bowSpread: 64 });

    s.step("Same three tasks, same single core. What changes everything is the rule the scheduler follows.", [
      E.enter(tasks, 0.16),
      E.appear(core),
      fan.draw({ gap: 0.12, dur: 0.45 }),
      E.appear(head),
      E.pulse(core, 2.0),
    ]);

    const slices = order.flatMap((i) => [
      E.all(E.flash(tasks[i]), fan.wires[i].send({ color: colors[i], label: "slice", dur: 0.45 })),
      E.wait(0.32),
    ]);

    s.step(sliceCaption, [E.seq(...slices)]);

    s.step(
      "Read off how the core's time was split. The tasks never changed — only the policy did.",
      [E.all(E.appear(s0), E.appear(s1), E.appear(s2)), E.stagger(0.15, E.pulse(t0, 2.0), E.pulse(t1, 2.0), E.pulse(t2, 2.0)), E.wait(1.0)],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 4 — why the trick is worth it: waiting is free
   ============================================================ */

const waiting = E.scene({
  id: "waiting",
  chapter: "The payoff",
  question: "A task asks the disk for data and gets nothing back for milliseconds. Does the core just sit there?",
  title: "A blocked task isn't using the core — so the core doesn't wait for it.",
  takeaway:
    "The real magic of time-slicing is what it does with waiting. A task blocked on disk or network isn't 'using' the CPU — it's parked, and the scheduler skips right over it to run something that's actually ready. Interleave one CPU-bound job with a couple of I/O-bound ones and the core stays busy the entire time, overlapping other tasks' waiting with real work. That overlap is why a single core can feel like a whole busy kitchen.",
  nextPrompt: "And if you finally do add a second core — is that the same thing, or something new?",
  setup: (s) => {
    const pts = E.column({ at: { x: 185, y: 255 }, count: 3, gap: 116 });
    const { t0, t1, t2 } = s.cast({
      t0: task({ ...pts[0], ...A }),
      t1: task({ ...pts[1], ...B, sub: "waiting on network" }),
      t2: task({ ...pts[2], ...C, sub: "waiting on disk" }),
    });
    const { core, disk } = s.cast({
      core: cpu({ x: 620, y: 175, sub: "1 core" }),
      disk: E.v.database({
        x: 620,
        y: 375,
        label: "disk / network",
        sub: "I/O device",
        accent: "blue",
        note: "Storage and network are thousands of times slower than the CPU. A task that asks them for data is blocked until the answer arrives — often millions of cycles later.",
      }),
    });

    const wA = s.connect(t0, core, { bow: 0, dashed: true });
    const wB = s.connect(t1, disk, { bow: 20, dashed: true });
    const wC = s.connect(t2, disk, { bow: -8, dashed: true });

    s.step("Task A is pure computation — encoding video — and it will happily use every cycle you hand it.", [
      E.appear(core),
      E.appear(t0),
      E.draw(wA),
      wA.send({ color: "cyan", label: "execute", dur: 1.0 }),
      E.pulse(core, 2.2),
    ]);

    const { blockB, blockC } = s.cast({
      blockB: E.token({ x: 360, y: pts[1].y, text: "blocked", accent: "rose" }),
      blockC: E.token({ x: 360, y: pts[2].y, text: "blocked", accent: "rose" }),
    });

    s.step("B and C don't compute much. B wants bytes from the network, C from the disk — so they ask, and then they must wait.", [
      E.all(E.appear(t1), E.appear(t2), E.appear(disk)),
      E.all(E.draw(wB), E.draw(wC)),
      E.all(wB.send({ color: "violet", label: "read()", dur: 1.0 }), wC.send({ color: "green", label: "read()", dur: 1.0 })),
      E.all(E.dim(t1), E.dim(t2), E.appear(blockB), E.appear(blockC)),
    ]);

    s.step("A blocked task can't use the core anyway, so the scheduler skips both and keeps the core busy running A.", [
      E.all(E.pulse(core, 2.6), E.pulse(t0, 2.4)),
      wA.send({ color: "cyan", label: "execute", dur: 1.0 }),
      E.wait(0.6),
    ]);

    s.step(
      "The instant the disk answers, C wakes up runnable again — and the core was never once left idle.",
      [
        wC.reply({ color: "green", label: "data ready", dur: 1.0 }),
        E.all(E.undim(t2), E.fadeTo(blockC, 0, 0.3)),
        E.flash(t2),
        E.wait(1.0),
      ],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 5 — a second core: concurrency finally becomes parallelism
   ============================================================ */

const parallelism = E.scene({
  id: "parallelism",
  chapter: "The real thing",
  question: "You've watched one core fake it. What actually changes when you add a second?",
  title: "Two cores, two tasks, the same instant — until they both reach for one thing.",
  takeaway:
    "Add a second core and the lie finally becomes truth: two tasks really do execute in the very same instant. That is parallelism — many hands — and it is a different thing from the one-core juggling act you saw before. But the scheduler still time-slices whenever runnable tasks outnumber cores, and the moment two tasks share one resource — a lock, a database row, a stretch of memory — one must wait for the other. Coordination quietly hands back part of the speedup, which is why N cores almost never mean N times faster.",
  nextPrompt: "Start the story again",
  setup: (s) => {
    const { core1, core2 } = s.cast({
      core1: cpu({ x: 330, y: 150, label: "CPU 0", sub: "core 0" }),
      core2: cpu({ x: 630, y: 150, label: "CPU 1", sub: "core 1" }),
    });
    const { ta, tb } = s.cast({
      ta: task({ x: 330, y: 300, ...A }),
      tb: task({ x: 630, y: 300, ...B }),
    });
    const { shared } = s.cast({
      shared: E.node({
        x: 480,
        y: 402,
        label: "shared state",
        sub: "one lock",
        glyph: "lock",
        accent: "rose",
        w: 160,
        note: "A lock, a database row, a stretch of memory — anything two tasks both touch. Only one may hold it at a time, so access to it cannot run in parallel no matter how many cores you own.",
      }),
    });

    const wA = s.connect(ta, core1, { bow: 0, dashed: true });
    const wB = s.connect(tb, core2, { bow: 0, dashed: true });
    const lockA = s.connect(ta, shared, { bow: 20, dashed: true });
    const lockB = s.connect(tb, shared, { bow: -20, dashed: true });

    s.step("Add a second core and the illusion becomes real: A runs on core 0 while B runs on core 1, in the very same instant.", [
      E.all(E.appear(core1), E.appear(core2)),
      E.all(E.appear(ta), E.appear(tb)),
      E.all(E.draw(wA), E.draw(wB)),
      E.all(wA.send({ color: "cyan", label: "execute", dur: 1.0 }), wB.send({ color: "violet", label: "execute", dur: 1.0 })),
      E.all(E.pulse(core1, 2.4), E.pulse(core2, 2.4)),
    ]);

    s.step("This is parallelism — genuinely many hands at once — not one core juggling. A different thing entirely.", [
      E.all(E.pulse(ta, 2.2), E.pulse(tb, 2.2), E.glowOn(core1), E.glowOn(core2)),
      E.wait(0.6),
    ]);

    s.step("But both tasks still reach for one shared thing — a lock, a database row, a stretch of memory.", [
      E.all(E.glowOff(core1), E.glowOff(core2), E.appear(shared)),
      E.all(E.draw(lockA), E.draw(lockB)),
      E.all(lockA.send({ color: "cyan", label: "acquire", dur: 0.9 }), lockB.send({ color: "violet", label: "acquire", dur: 0.9 })),
      E.shake(shared),
    ]);

    const { serial } = s.cast({
      serial: E.token({ x: 700, y: 402, text: "serialized · Amdahl's law", accent: "amber" }),
    });

    s.step(
      "Only one can hold it at a time, so the other waits. Coordination hands back part of the speedup — N cores rarely means N times faster.",
      [
        E.dim(tb),
        E.pulse(shared, 2.0),
        E.appear(serial),
        E.wait(0.6),
        E.all(E.undim(tb), E.flash(tb)),
        E.wait(0.8),
      ],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================ */

export default E.story({
  ...meta,
  scenes: [illusion, contextSwitch, policy, waiting, parallelism],
  outro: [
    "Strip away the vocabulary and multitasking on one core is a single sleight of hand: run a little of one task, save its place, run a little of the next, and rotate fast enough that the seams disappear. Concurrency is that juggling act — a structure for dealing with many things at once. Parallelism, which needs real extra cores, is doing many things at once. Every laggy spinner and every 'why is my laptop hot' moment lives in the gap between those two ideas.",
    "It also tells you where performance actually comes from. A context switch is never free, so fewer, busier tasks beat a swarm of thin ones. Blocked tasks cost nothing, so overlapping I/O with computation is almost pure profit. And once you add cores, the shared lock — not the core count — is what caps your speedup. The scheduler you met in scene three is making these trade-offs thousands of times a second, silently, so that the machine can keep telling its convincing little lie.",
  ],
  references: [
    {
      kind: "book",
      title: "Operating Systems: Three Easy Pieces — Scheduling",
      url: "https://pages.cs.wisc.edu/~remzi/OSTEP/",
      note: "The free chapters on round-robin, the multi-level feedback queue, and proportional-share scheduling. Start here for the policy dial.",
    },
    {
      kind: "video",
      title: "Rob Pike — Concurrency Is Not Parallelism",
      url: "https://www.youtube.com/watch?v=oV9rvDllKEg",
      note: "The talk this whole story is built around: the one-line thesis, told with gophers and a wheelbarrow.",
    },
    {
      kind: "docs",
      title: "Linux CFS — Scheduler Design",
      url: "https://www.kernel.org/doc/html/latest/scheduler/sched-design-CFS.html",
      note: "How 'run whoever has the least virtual runtime' turns into a fair, responsive scheduler in the real kernel.",
    },
    {
      kind: "book",
      title: "Tanenbaum & Bos — Modern Operating Systems",
      url: "https://www.pearson.com/en-us/subject-catalog/p/modern-operating-systems/P200000003311",
      note: "The classic textbook treatment of processes, threads, context switches, and scheduling.",
    },
  ],
});
