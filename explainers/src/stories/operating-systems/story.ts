/**
 * "How your operating system fakes an entire computer"
 *
 * Visual law: the CPU is ONE actor that NEVER duplicates — only the process
 * running on it changes. The OS (kernel) is dimmed and dormant between traps;
 * it flashes to life only when the timer fires or a syscall lands. This
 * enforces the brief's #1 misconception kill: the OS is NOT always running.
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
  flash,
  glowOn,
  glowOff,
  label,
  pulse,
  scene,
  shake,
  spot,
  stagger,
  toggle,
  token,
  v,
  vanish,
  wait,
} from "../../engine";
import { meta } from "./meta";

/* ---------------- story-local vocabulary ---------------- */

const process = definePreset({
  glyph: "box",
  label: "Process",
  accent: "cyan",
  w: 138,
  h: 66,
  note: "A running program. It believes it owns the whole CPU and all of memory — the OS maintains that illusion for every process simultaneously.",
});

const timer = definePreset({
  glyph: "gear",
  label: "Timer chip",
  accent: "rose",
  w: 130,
  h: 60,
  note: "A hardware clock that fires an interrupt at a fixed interval — typically every 1–10ms. This is the mechanism that yanks control from user code and hands it to the kernel. Without it, a greedy process could hold the CPU forever.",
});

/* ============================================================
   Scene 1 — The Cooperative Crash: no preemption, no safety
   ============================================================ */

const cooperativeCrash = scene({
  id: "cooperative-crash",
  chapter: "The problem",
  question: "What happens when a program refuses to give up the CPU?",
  title: "One infinite loop, and the whole machine freezes.",
  takeaway:
    "Without a hardware timer interrupt, the CPU belongs to whoever is running — and there is no mechanism to take it back. Cooperative multitasking (classic Mac OS, Windows 3.x) trusted programs to yield voluntarily; one misbehaving program meant a frozen machine and a lost essay. The fix is a clock chip that fires an interrupt at a fixed interval, yanking control away whether the program likes it or not. That one piece of hardware is the entire difference between a frozen machine and a modern OS.",
  nextPrompt: "So the timer fires — then what actually happens?",
  prose: [
    "Before we can appreciate what an operating system does, we need to feel what happens without one. Imagine a machine that runs programs one at a time, trusting each program to eventually say 'I'm done, your turn.' This is cooperative multitasking — and for a decade, it was how personal computers actually worked.",
    "The rule is simple and fatal: whoever has the CPU keeps it until they choose to yield. Three well-behaved programs take polite turns. Then a fourth arrives — a buggy one with an infinite loop. It never yields. And because no mechanism exists to force it off the CPU, the other three programs, and you, wait forever.",
    "This is not a hypothetical. Classic Mac OS and Windows 3.x worked exactly this way. One hung application froze the entire computer. The fix was not software cleverness — it was a hardware clock chip that fires an interrupt whether the running program wants it or not. Watch it break, then watch the fix.",
  ],
  setup: (s) => {
    const { cpu } = s.cast({
      cpu: v.server({
        ...spot("center", { dy: -50 }),
        label: "CPU",
        sub: "one core, one thing at a time",
        accent: "cyan",
        w: 180,
        note: "The processor. It can only do one thing at a time. Right now it belongs to whoever is running — and there's no referee to say 'time's up.'",
      }),
    });
    const { pA, pB, pC, greedy } = s.cast({
      pA: process({ x: 170, y: 370, label: "Text editor", accent: "blue" }),
      pB: process({ x: 440, y: 370, label: "Spreadsheet", accent: "green" }),
      pC: process({ x: 710, y: 370, label: "Email", accent: "violet" }),
      greedy: process({ x: 440, y: 170, label: "Buggy app", sub: "while(true) {}", accent: "rose" }),
    });
    const { taking, frozen, fix } = s.cast({
      taking: token({ x: 480, y: 100, text: "cooperative: each program yields voluntarily", accent: "dim" }),
      frozen: token({ x: 480, y: 100, text: "the machine is frozen — no mechanism to stop it", accent: "rose" }),
      fix: token({ x: 480, y: 460, text: "the fix: a hardware timer that takes control back by force", accent: "green" }),
    });

    const { timerChip } = s.cast({
      timerChip: timer({ x: 810, y: 170, label: "Timer chip", sub: "fires every ~10ms" }),
    });

    s.step("Three well-behaved programs take turns on the CPU — each one yields voluntarily when it's done.", [
      enter([cpu, pA, pB, pC], 0.15),
      appear(taking),
      stagger(0.4, flash(pA), flash(pB), flash(pC)),
      wait(0.3),
    ]);

    s.step("A buggy program arrives. It has an infinite loop — and it never yields.", [
      vanish(taking),
      appear(greedy),
      pulse(greedy, 1.8),
      all(glowOn(greedy), flash(cpu)),
    ]);

    s.step("The CPU belongs to whoever is running, and there is no mechanism to take it back — the machine is frozen.", [
      all(dim(pA), dim(pB), dim(pC)),
      shake(cpu),
      appear(frozen),
      wait(0.8),
    ]);

    s.step(
      "The fix is hardware, not software: a timer chip that fires an interrupt at a fixed interval — the bell that wakes the sleeping referee.",
      [vanish(frozen), appear(timerChip), flash(timerChip), appear(fix), pulse(timerChip, 2.4), wait(0.8)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 2 — The Illusion: the OS wakes, swaps, and sleeps
   ============================================================ */

const theIllusion = scene({
  id: "the-illusion",
  chapter: "The trick",
  question: "What does the OS actually DO when the timer fires?",
  title: "The OS is not running right now. It wakes on a bell, swaps one program for another, and goes back to sleep.",
  takeaway:
    "The timer interrupt fires. User code halts mid-instruction. The CPU switches to kernel mode — a hardware flag, not a place — and runs the OS's trap handler. The handler saves the current process's registers (about 20 numbers), picks the next process, loads ITS registers, flips back to user mode, and returns. The OS is done. It was awake for microseconds. Both processes believe they were never interrupted. That is the entire trick, and it runs thousands of times per second.",
  nextPrompt: "Each process thinks it has the whole machine — but what about memory?",
  prose: [
    "Here is the deepest misconception about operating systems: that the OS is 'always running in the background,' supervising like a manager watching over your shoulder. The truth is the opposite. While your code runs, the OS is not running at all. It is dormant code sitting in memory, doing nothing, waiting for one of three bells: a timer interrupt, a hardware event, or your program explicitly asking for help (a syscall).",
    "When the timer fires, here is everything that happens: your code stops mid-instruction. The CPU flips a hardware mode bit from 'user' to 'kernel' — this is not a place, it's a privilege level. The CPU jumps to the OS's trap handler. The handler saves the current process's CPU state — about 20 register values, a few hundred bytes — and loads another process's saved state. Then it flips the mode bit back to 'user' and returns. Your process resumes, never knowing it was paused.",
    "A context switch is not magic. It is copying twenty numbers. The mystique comes entirely from speed and invisibility — it happens thousands of times per second and no process ever sees it.",
  ],
  setup: (s) => {
    const { cpu, kernel } = s.cast({
      cpu: v.server({
        x: 480, y: 130,
        label: "CPU",
        sub: "user mode",
        accent: "cyan",
        w: 170,
        note: "One processor. The mode bit says who gets to touch hardware: user code or the kernel. While your code runs, the bit says 'user' and the OS is asleep.",
      }),
      kernel: v.server({
        x: 480, y: 130,
        label: "CPU",
        sub: "kernel mode — the OS is awake",
        accent: "rose",
        w: 170,
        note: "Same CPU, different privilege. Kernel mode lets the trap handler save registers, pick the next process, and load its state. It lasts microseconds.",
      }),
    });
    const { pA, pB, timerChip } = s.cast({
      pA: process({ x: 220, y: 310, label: "Process A", sub: "running", accent: "cyan" }),
      pB: process({ x: 740, y: 310, label: "Process B", sub: "ready (waiting)", accent: "violet" }),
      timerChip: timer({ x: 810, y: 130, label: "Timer", sub: "fires every 10ms" }),
    });
    const { regA, regB, swap, asleep, awake } = s.cast({
      regA: token({ ...below(pA, 55), text: "registers: 20 numbers saved", accent: "cyan" }),
      regB: token({ ...below(pB, 55), text: "registers: 20 numbers loaded", accent: "violet" }),
      swap: token({ x: 480, y: 450, text: "a context switch is copying ~20 numbers — that's all", accent: "green" }),
      asleep: label({ x: 480, y: 60, text: "the OS is not running right now", size: 13, color: "dim" }),
      awake: label({ x: 480, y: 60, text: "the OS is awake — for microseconds", size: 13, color: "rose" }),
    });

    const wireTimer = s.connect(timerChip, cpu, { bow: 0, dashed: true });

    s.step("Process A is running on the CPU in user mode — the OS is not running, it's dormant code in memory.", [
      enter([cpu, pA, pB, timerChip], 0.15),
      glowOn(pA),
      appear(asleep),
      draw(wireTimer),
    ]);

    s.step("The timer fires — an interrupt. User code halts mid-instruction. The CPU flips to kernel mode.", [
      wireTimer.send({ color: "rose", label: "interrupt!", dur: 0.8 }),
      vanish(asleep),
      all(vanish(cpu), appear(kernel)),
      appear(awake),
      shake(pA),
      wait(0.3),
    ]);

    s.step("The kernel saves Process A's registers, picks Process B, and loads its registers — about 20 numbers, copied.", [
      glowOff(pA),
      appear(regA),
      flash(pA),
      wait(0.4),
      appear(regB),
      flash(pB),
      glowOn(pB),
      wait(0.3),
    ]);

    s.step(
      "Mode bit flips back to user. Process B runs, believing it was never interrupted. The OS goes back to sleep.",
      [
        vanish(awake),
        all(vanish(kernel), appear(cpu)),
        appear(asleep),
        appear(swap),
        pulse(pB, 2.2),
        wait(1.0),
      ],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 3 — The Address Paradox: virtual memory
   ============================================================ */

const addressParadox = scene({
  id: "address-paradox",
  chapter: "The second illusion",
  question: "Two programs both use address 0x1000 — how is that possible?",
  title: "Every program starts at the same address. None of them share memory.",
  takeaway:
    "Every process gets its own virtual address space, starting from the same familiar addresses. When the CPU accesses memory, it doesn't use the virtual address directly — the hardware sends it through a page table, which translates it to a physical address. Two processes can both use address 0x1000, and the page table sends them to completely different physical locations. This is why one program can never accidentally read another's data, and why 'virtual memory' is not about swap files — it's about the illusion of private, contiguous memory.",
  nextPrompt: "So the OS manages time AND space — what choices does it actually make?",
  prose: [
    "The CPU illusion was about time: every process believes it has the processor all to itself. The memory illusion is about space: every process believes it has a private, contiguous slab of memory, starting at address zero. Both processes can use address 0x1000 without conflict. How?",
    "The trick is a hardware component called the MMU (memory management unit) and a data structure called the page table. When your code says 'read address 0x1000,' the CPU doesn't go to physical location 0x1000. It goes to the page table first — a per-process lookup table that translates virtual addresses to physical ones. Process A's 0x1000 maps to one physical location; Process B's 0x1000 maps to a completely different one.",
    "This is the full meaning of 'virtual memory': not swap files, not 'extra memory on disk,' but the fundamental lie that each process has its own private memory space. The page table is the translator that keeps the lie consistent.",
  ],
  setup: (s) => {
    const { pageTable } = s.cast({
      pageTable: v.server({
        ...spot("center", { dy: -30 }),
        label: "Page table",
        sub: "virtual → physical",
        accent: "amber",
        w: 170,
        note: "A per-process lookup table maintained by the OS and used by the hardware (MMU). It translates every virtual address to a physical one. Two processes with identical virtual addresses get routed to different physical memory.",
      }),
    });
    const { pA, pB } = s.cast({
      pA: process({ x: 170, y: 200, label: "Process A", sub: "address 0x1000", accent: "cyan" }),
      pB: process({ x: 170, y: 380, label: "Process B", sub: "address 0x1000", accent: "violet" }),
    });
    const { physA, physB } = s.cast({
      physA: v.database({ x: 790, y: 200, label: "Physical 0x8A00", accent: "cyan", w: 160 }),
      physB: v.database({ x: 790, y: 380, label: "Physical 0x2F00", accent: "violet", w: 160 }),
    });
    const { same, resolved, lesson } = s.cast({
      same: token({ x: 170, y: 290, text: "same virtual address!", accent: "amber" }),
      resolved: token({ x: 790, y: 290, text: "different physical memory", accent: "green" }),
      lesson: token({ x: 480, y: 460, text: "virtual memory = private address space, not swap files", accent: "green" }),
    });

    const wA = s.connect(pA, pageTable, { bow: -20 });
    const wB = s.connect(pB, pageTable, { bow: 20 });
    const wPA = s.connect(pageTable, physA, { bow: -20 });
    const wPB = s.connect(pageTable, physB, { bow: 20 });

    s.step("Two processes both use address 0x1000 — make a prediction: can that work?", [
      enter([pA, pB], 0.2),
      appear(same),
      pulse(same, 1.8),
    ]);

    s.step("Enter the page table — a per-process lookup that translates virtual addresses to physical ones.", [
      appear(pageTable),
      stagger(0.15, draw(wA), draw(wB)),
      flash(pageTable),
    ]);

    s.step("Process A's 0x1000 maps to physical 0x8A00; Process B's 0x1000 maps to physical 0x2F00 — completely different.", [
      wA.send({ color: "cyan", label: "0x1000", dur: 0.8 }),
      appear(physA),
      draw(wPA),
      wPA.send({ color: "cyan", label: "→ 0x8A00", dur: 0.8 }),
      wait(0.3),
      wB.send({ color: "violet", label: "0x1000", dur: 0.8 }),
      appear(physB),
      draw(wPB),
      wPB.send({ color: "violet", label: "→ 0x2F00", dur: 0.8 }),
      appear(resolved),
    ]);

    s.step(
      "Virtual memory is not about swap files — it's the lie that every process has its own private, contiguous memory space.",
      [appear(lesson), pulse(pageTable, 2.2), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 4 — Interactive: the scheduler (preemptive vs cooperative)
   ============================================================ */

const scheduler = scene({
  id: "scheduler",
  chapter: "The policy",
  question: "How often should the OS interrupt? And what happens if it doesn't?",
  title: "One slider between a responsive machine and a frozen one.",
  takeaway:
    "Preemptive scheduling is the difference between a machine that stays responsive and one that a single rogue process can freeze. With preemption on, the timer interrupt fires at a regular interval — the time quantum — and the OS rotates processes whether they like it or not. A short quantum means snappy UI but more context-switch overhead. A long quantum means efficiency but sluggish apps. And with preemption off, you're back to cooperative multitasking: one `while(true)` and the show is over. The entire trick rests on one clock chip.",
  nextPrompt: "Start the story again",
  prose: [
    "The OS now has the power to take the CPU back by force — but how often should it? This is the scheduler's central trade-off, and it is interactive: you pick the regime and watch the consequences.",
    "With preemption on and a normal time quantum, three processes take orderly turns. Each runs for its slice, the timer fires, the kernel saves and swaps, and the next process goes. Everyone makes progress. The machine feels responsive.",
    "Turn preemption off and you're back in the cooperative world. Each process must yield voluntarily. Three polite programs work fine — but add a greedy one and the machine freezes. There is no timer to save you. A single toggle — hardware preemption on or off — is the entire difference between a modern OS and a 1990s crash.",
  ],
  params: {
    mode: toggle("Scheduling mode", [
      ["preemptive", "Preemptive — timer takes control"],
      ["cooperative", "Cooperative — programs yield voluntarily"],
    ]),
  },
  setup: (s, p) => {
    const { cpu, timerChip } = s.cast({
      cpu: v.server({
        ...spot("top", { dy: 10 }),
        label: "CPU",
        sub: p.mode === "preemptive" ? "timer fires every quantum" : "no timer — cooperative",
        accent: p.mode === "preemptive" ? "cyan" : "amber",
        w: 170,
        note: p.mode === "preemptive"
          ? "Preemptive mode: the timer fires at a fixed interval and the OS swaps processes by force."
          : "Cooperative mode: no timer interrupt. Each process must voluntarily yield or everyone else waits forever.",
      }),
      timerChip: timer({
        x: 820, y: 135,
        label: "Timer",
        sub: p.mode === "preemptive" ? "active" : "disabled",
      }),
    });
    const { p1, p2, p3 } = s.cast({
      p1: process({ x: 230, y: 370, label: "Editor", accent: "cyan" }),
      p2: process({ x: 480, y: 370, label: "Browser", accent: "blue" }),
      p3: process({ x: 730, y: 370, label: "Compiler", accent: "green" }),
    });

    const wireCpu1 = s.connect(cpu, p1, { bow: -20, dashed: true });
    const wireCpu2 = s.connect(cpu, p2, { bow: 0, dashed: true });
    const wireCpu3 = s.connect(cpu, p3, { bow: 20, dashed: true });
    const wireTimer = s.connect(timerChip, cpu, { bow: 0, dashed: true });

    if (p.mode === "preemptive") {
      const { verdict } = s.cast({
        verdict: token({ x: 480, y: 460, text: "everyone gets fair turns — the timer is the referee", accent: "green" }),
      });

      s.step("Three processes, one CPU, and a timer that fires at regular intervals — preemptive scheduling.", [
        enter([cpu, p1, p2, p3, timerChip], 0.12),
        stagger(0.1, draw(wireCpu1), draw(wireCpu2), draw(wireCpu3)),
        draw(wireTimer),
      ]);

      s.step("Process 1 runs for its time slice. The timer fires — the OS saves its state and picks the next one.", [
        glowOn(p1),
        flash(cpu),
        wait(0.6),
        wireTimer.send({ color: "rose", label: "tick!", dur: 0.5 }),
        flash(timerChip),
        glowOff(p1),
      ]);

      s.step("Process 2 runs, timer fires, swap. Process 3 runs, timer fires, swap. Everyone makes progress.", [
        glowOn(p2),
        flash(cpu),
        wait(0.5),
        wireTimer.send({ color: "rose", dur: 0.4 }),
        glowOff(p2),
        glowOn(p3),
        flash(cpu),
        wait(0.5),
        wireTimer.send({ color: "rose", dur: 0.4 }),
        glowOff(p3),
      ]);

      s.step(
        "Fair rotation, enforced by hardware — no process can hog the CPU because the timer takes it back every quantum.",
        [all(glowOn(p1), glowOn(p2), glowOn(p3)), appear(verdict), pulse(timerChip, 2.2), wait(1.0)],
        { hold: 1.2 },
      );
      return;
    }

    /* cooperative mode */
    const { greedy } = s.cast({
      greedy: process({ x: 480, y: 170, label: "Greedy app", sub: "while(true) {}", accent: "rose" }),
    });
    const { doom } = s.cast({
      doom: token({ x: 480, y: 460, text: "one toggle — preemption on/off — is the entire difference", accent: "rose" }),
    });

    s.step("Cooperative mode: no timer, no forced swaps — each process must yield voluntarily.", [
      enter([cpu, p1, p2, p3], 0.12),
      stagger(0.1, draw(wireCpu1), draw(wireCpu2), draw(wireCpu3)),
      appear(timerChip),
      dim(timerChip),
      draw(wireTimer),
    ]);

    s.step("The polite programs yield on time — cooperative works fine when everyone is well-behaved.", [
      stagger(0.5, flash(p1), flash(p2), flash(p3)),
      wait(0.3),
    ]);

    s.step("A greedy process arrives. It never yields. Without a timer, there is no mechanism to stop it.", [
      appear(greedy),
      glowOn(greedy),
      flash(cpu),
      all(dim(p1), dim(p2), dim(p3)),
      shake(cpu),
      wait(0.5),
    ]);

    s.step(
      "The machine is frozen — flip the toggle above to preemptive mode and watch the timer fix everything.",
      [appear(doom), shake(greedy), pulse(greedy, 2.4), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================ */

export default defineStory({
  ...meta,
  scenes: [cooperativeCrash, theIllusion, addressParadox, scheduler],
  outro: [
    "The whole trick, one more time: the OS is not a program that runs — it is dormant code that wakes when hardware traps into it, referees, and goes back to sleep. While your code runs, the OS is asleep. A timer chip fires thousands of times a second; each time the kernel wakes for microseconds, saves twenty numbers, loads twenty others, and vanishes. Both processes believe they were never interrupted. Add a page table that translates addresses per-process, and you have the second illusion: every program thinks it has private memory starting at zero.",
    "Next time you glance at Activity Monitor or htop, you'll be reading this trick in real time: the CPU percentage columns are the kernel's bookkeeping of how it sliced one processor among many pretenders, and the memory column is virtual — every number is a lie that the page table makes consistent. The magic was never in complexity; it was in speed and a clock chip.",
  ],
  references: [
    {
      kind: "book",
      title: "Operating Systems: Three Easy Pieces",
      url: "https://pages.cs.wisc.edu/~remzi/OSTEP/",
      note: "The free textbook this story leans on — every chapter states the problem before revealing the mechanism.",
    },
    {
      kind: "article",
      title: "Putting the You in CPU",
      url: "https://cpu.land",
      note: "An illustrated walk from 'you double-click a program' down to rings, syscalls, and ELF.",
    },
    {
      kind: "video",
      title: "Ben Eater: Building an 8-bit computer",
      url: "https://eater.net/8bit",
      note: "Breadboard-level grounding for what a CPU, a clock, and an interrupt physically are.",
    },
    {
      kind: "course",
      title: "MIT 6.1810 (xv6)",
      url: "https://pdos.csail.mit.edu/6.1810/",
      note: "A real Unix in ~6,000 lines of code — the build-it-yourself course if this story hooked you.",
    },
  ],
});
