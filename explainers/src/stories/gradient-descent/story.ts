/**
 * "How gradient descent makes machines learn"
 *
 * Every descent trajectory on stage is computed with the real update rule
 * x ← x − lr·f′(x) on the quadratic f(d) = K·d² (d = distance from the valley
 * floor), which simplifies to d ← m·d with m = 1 − 2K·lr. Honest math, per
 * the brief: no canned animation pretending to be computation.
 */
import {
  all,
  appear,
  below,
  choice,
  defineStory,
  dot,
  draw,
  enter,
  flash,
  glowOn,
  label,
  move,
  pulse,
  scene,
  shake,
  spot,
  stagger,
  token,
  v,
  vanish,
  wait,
  type StageApi,
} from "../../engine";
import { meta } from "./meta";

/* ---------------- the shared valley (real quadratic) ---------------- */

const XC = 480; // x of the valley floor
const YB = 380; // y of the valley floor (low on screen = low loss)
const K = 0.0028;

/** Height of the loss surface at horizontal position x. */
const valleyY = (x: number) => YB - K * (x - XC) ** 2;

/** Real gradient-descent trajectory: d ← m·d, m = 1 − 2K·lr. */
const descend = (x0: number, m: number, steps: number): { x: number; y: number }[] => {
  const pts = [];
  let d = x0 - XC;
  for (let i = 0; i < steps; i++) {
    d = m * d;
    pts.push({ x: XC + d, y: valleyY(XC + d) });
  }
  return pts;
};

/** Cast a row of faint dots tracing the surface, so the invisible hill is felt. */
const castValley = (s: StageApi) => {
  const specs = Object.fromEntries(
    Array.from({ length: 25 }, (_, i) => {
      const x = 200 + i * (560 / 24);
      return [`vy${i}`, dot({ x, y: valleyY(x), r: 2.5, color: "dim" })];
    }),
  );
  return Object.values(s.cast(specs));
};

/* ============================================================
   Scene 1 — the race: direction beats guessing
   ============================================================ */

const race = scene({
  id: "race",
  chapter: "The problem",
  question: "How do you find the bottom of a valley you cannot see?",
  title: "No map. No answer key. Only the slope under your feet.",
  takeaway:
    "Learning is a search problem where you can never see the whole landscape — only how wrong you are right here, and which direction makes it slightly better. Random search wastes almost every trial; the slope is one bit of local information, and that one bit is enough to beeline to the bottom. That is the entire justification for gradients.",
  nextPrompt: "But where does the 'downhill direction' come from?",
  prose: [
    "A neural network is a pile of knobs — millions of numbers called weights — and 'learning' just means finding knob settings that make its outputs match reality. There is no formula to solve for them. There are far too many combinations to try. The only thing you can afford to compute, for any given setting, is a single number saying how wrong the network currently is.",
    "Picture that wrongness as terrain: every possible knob setting is a spot on the ground, and the height of the ground is the error. Somewhere out there is a low point. You are standing in fog — you cannot see the valley, only feel the ground directly under your feet.",
    "The figure below stages the two honest strategies. One walker guesses: teleport somewhere, check the height, repeat, learning nothing from each failure. The other walker asks one cheap local question — which way is downhill? — and takes a small step that way. Watch how unfair the race is.",
  ],
  setup: (s) => {
    const valley = castValley(s);
    const { guesser, walker } = s.cast({
      guesser: dot({ x: 700, y: valleyY(700), r: 9, color: "rose" }),
      walker: dot({ x: 215, y: valleyY(215), r: 9, color: "cyan" }),
    });
    const { gLbl, wLbl, floor, verdict } = s.cast({
      gLbl: label({ x: 700, y: 210, text: "random search", size: 13, color: "rose" }),
      wLbl: label({ x: 215, y: 150, text: "gradient descent", size: 13, color: "cyan" }),
      floor: label({ x: XC, y: 430, text: "the bottom — nobody can see it", size: 12, color: "dim" }),
      verdict: token({ x: XC, y: 90, text: "one bit of direction beats a thousand guesses", accent: "cyan" }),
    });

    s.step("The error surface is a valley hidden in fog — you can stand on it, but never see it.", [
      stagger(0.02, ...valley.map((d) => appear(d, 0.2))),
      appear(floor),
    ]);

    s.step("Random search guesses, checks, and guesses again — every trial forgets the last one.", [
      all(appear(guesser), appear(gLbl)),
      move(guesser, { x: 265, y: valleyY(265) }, 0.5),
      move(guesser, { x: 620, y: valleyY(620) }, 0.5),
      move(guesser, { x: 330, y: valleyY(330) }, 0.5),
      move(guesser, { x: 745, y: valleyY(745) }, 0.5),
    ]);

    s.step("Gradient descent asks one cheap question at every step: which way is downhill from here?", [
      all(appear(walker), appear(wLbl)),
      ...descend(215, 0.6, 8).map((p) => move(walker, p, 0.42)),
    ]);

    s.step(
      "Eight steps, straight to the floor — while the guesser is still guessing.",
      [
        all(glowOn(walker), pulse(walker, 2.2)),
        move(guesser, { x: 590, y: valleyY(590) }, 0.5),
        appear(verdict),
        wait(1.0),
      ],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 2 — two knobs, tuned by hand: you invent the algorithm
   ============================================================ */

const knobs = scene({
  id: "knobs",
  chapter: "Invent it yourself",
  question: "What would YOU do with two knobs and a wrongness meter?",
  title: "Nudge a knob. Watch the meter. Keep what helps.",
  takeaway:
    "Nudge one knob, watch the wrongness meter, keep the direction that helps, undo the one that hurts — that strategy you just watched (and would have used yourself) IS gradient descent. The 'gradient' is nothing more than all the nudge-answers computed at once: a per-knob list saying which way helps and by how much.",
  nextPrompt: "Fine for 2 knobs. How do you nudge a million at once?",
  prose: [
    "Forget networks for a moment. Here is a black box with two knobs on the front and a single meter labeled WRONGNESS. Inside, the knobs set the slope and height of a line that is trying to pass through three data points; the meter shows how far the line misses them. You don't need to know any of that. You can only turn knobs and read the meter.",
    "What would you do? Almost certainly this: turn knob A a little, see if the meter drops. It does — keep going. It rises — go back the other way. Then the same for knob B. There is no other sensible strategy when the meter is all you have, and everyone discovers it within a minute of playing.",
    "The numbers in the figure are the real meter readings from that real line-fit. Watch the strategy play out — including a nudge that makes things worse and gets undone — and then notice, in the takeaway, what the strategy is called.",
  ],
  setup: (s) => {
    const { machine } = s.cast({
      machine: v.server({
        ...spot("center", { dy: -40 }),
        label: "the machine",
        sub: "a line, trying to fit 3 points",
        accent: "violet",
        w: 210,
        note: "Inside: y = a·x + b, scored against three data points. But the whole point is that you don't need to see inside — only the meter.",
      }),
    });
    const { knobA, knobB, meter0 } = s.cast({
      knobA: token({ x: 330, y: 340, text: "knob a = 0.5", accent: "cyan" }),
      knobB: token({ x: 630, y: 340, text: "knob b = 1.0", accent: "blue" }),
      meter0: token({ ...below(machine, 130), text: "WRONGNESS: 5.50", accent: "rose" }),
    });
    const { m1, m2, m3, m4, k1, k2, k3, k4, eureka } = s.cast({
      eureka: token({ x: 480, y: 120, text: "this strategy has a name: gradient descent", accent: "violet" }),
      m1: token({ ...below(machine, 130), text: "WRONGNESS: 1.67 ↓", accent: "amber" }),
      m2: token({ ...below(machine, 130), text: "WRONGNESS: 0.17 ↓", accent: "green" }),
      m3: token({ ...below(machine, 130), text: "WRONGNESS: 1.00 ↑ — undo!", accent: "rose" }),
      m4: token({ ...below(machine, 130), text: "WRONGNESS: 0.17", accent: "green" }),
      k1: token({ x: 330, y: 340, text: "knob a = 1.0", accent: "cyan" }),
      k2: token({ x: 330, y: 340, text: "knob a = 1.5", accent: "cyan" }),
      k3: token({ x: 330, y: 340, text: "knob a = 2.0", accent: "cyan" }),
      k4: token({ x: 330, y: 340, text: "knob a = 1.5 ✓", accent: "cyan" }),
    });

    s.step("Two knobs, one meter, no manual — the meter reads 5.50 and your job is to make it small.", [
      appear(machine),
      enter([knobA, knobB], 0.15),
      appear(meter0),
      pulse(machine, 1.6),
    ]);

    s.step("Nudge knob a upward and watch: the wrongness falls to 1.67 — so that direction helps.", [
      all(vanish(knobA), appear(k1)),
      flash(machine),
      all(vanish(meter0), appear(m1)),
      wait(0.5),
    ]);

    s.step("Keep going the way that helped: another nudge, and the meter drops to 0.17.", [
      all(vanish(k1), appear(k2)),
      flash(machine),
      all(vanish(m1), appear(m2)),
      wait(0.5),
    ]);

    s.step("One nudge too far — the meter jumps back up to 1.00 — so you undo it and stay where it was lowest.", [
      all(vanish(k2), appear(k3)),
      flash(machine),
      all(vanish(m2), appear(m3)),
      shake(machine),
      wait(0.6),
      all(vanish(k3), appear(k4), vanish(m3), appear(m4)),
    ]);

    s.step(
      "Nudge, check, keep what helps: you have just re-invented gradient descent — that strategy, formalized, is the whole algorithm.",
      [appear(eureka), all(glowOn(machine), pulse(machine, 2.4)), wait(1.2)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 3 — backprop: all the nudges at once, blame flowing backwards
   ============================================================ */

const backprop = scene({
  id: "backprop",
  chapter: "The slope computer",
  question: "How do you nudge a million knobs without a million experiments?",
  title: "Blame flows backwards along the same wires the data flowed forward.",
  takeaway:
    "Backpropagation is not the learning algorithm — it is the slope computer. One forward pass produces the error; one backward pass routes blame through the same wires, using the chain rule as bookkeeping, and out falls every weight's nudge-direction at once. Then gradient descent — a separate, dumber part — takes the step. Slope computer and stepper: two parts, not one.",
  nextPrompt: "So the only knob left is the step size. How dangerous can that be?",
  prose: [
    "Nudge-and-check works, but it costs one full experiment per knob. A million knobs would mean a million forward runs per single step — hopeless. The rescue is that a network isn't a black box after all: it's made of simple pieces wired together, and each piece knows its own local slope. That's enough to get every knob's answer in one pass.",
    "Here is the smallest network that shows it: two inputs, two hidden neurons, one output. Data flows left to right and produces a guess; comparing the guess to the truth produces the error. Then the key move — the error flows backwards, right to left, along the very same wires. Each neuron takes the blame arriving from its right, scales it by its local slope, and passes shares of it further left.",
    "When the backward wave reaches the far side, every weight in the network has received its answer to 'which way should I move, and how much?' — the exact thing you were measuring one experiment at a time. One forward pass, one backward pass, a million nudge-directions. If you ever want to check it isn't magic: nudge any weight by 0.001, rerun, and watch the error move by its blame-share. The slope is just nudging, precomputed.",
  ],
  setup: (s) => {
    const { i1, i2, h1, h2, out } = s.cast({
      i1: dot({ x: 220, y: 180, r: 15, color: "blue" }),
      i2: dot({ x: 220, y: 340, r: 15, color: "blue" }),
      h1: dot({ x: 480, y: 150, r: 15, color: "cyan" }),
      h2: dot({ x: 480, y: 370, r: 15, color: "cyan" }),
      out: dot({ x: 730, y: 260, r: 15, color: "violet" }),
    });
    const { li, lh, lo, lossTok, gradTok } = s.cast({
      li: label({ x: 220, y: 120, text: "inputs", size: 13, color: "blue" }),
      lh: label({ x: 480, y: 92, text: "hidden layer", size: 13, color: "cyan" }),
      lo: label({ x: 800, y: 200, text: "output", size: 13, color: "violet" }),
      lossTok: token({ x: 730, y: 350, text: "error: 0.42 — too high", accent: "rose" }),
      gradTok: token({ x: 300, y: 440, text: "every weight now knows its nudge", accent: "green" }),
    });

    const w11 = s.connect(i1, h1, { bow: 0, dashed: true });
    const w12 = s.connect(i1, h2, { bow: 30, dashed: true });
    const w21 = s.connect(i2, h1, { bow: -30, dashed: true });
    const w22 = s.connect(i2, h2, { bow: 0, dashed: true });
    const wo1 = s.connect(h1, out, { bow: 0, dashed: true });
    const wo2 = s.connect(h2, out, { bow: 0, dashed: true });

    s.step("The smallest network that can show the trick: two inputs, two hidden neurons, one output — every wire is a knob.", [
      enter([i1, i2, h1, h2, out], 0.12),
      all(appear(li), appear(lh), appear(lo)),
      stagger(0.08, draw(w11), draw(w12), draw(w21), draw(w22), draw(wo1), draw(wo2)),
    ]);

    s.step("Forward pass: the data flows left to right and comes out as a guess — which turns out to be wrong by 0.42.", [
      all(w11.send({ color: "cyan", dur: 0.7 }), w12.send({ color: "cyan", dur: 0.7 }), w21.send({ color: "cyan", dur: 0.7 }), w22.send({ color: "cyan", dur: 0.7 })),
      all(wo1.send({ color: "cyan", dur: 0.7 }), wo2.send({ color: "cyan", dur: 0.7 })),
      all(flash(out), appear(lossTok)),
      wait(0.4),
    ]);

    s.step("Backward pass: the error flows right to left along the SAME wires — each neuron scales the blame by its local slope and passes shares on.", [
      all(wo1.reply({ color: "rose", label: "blame", dur: 0.8 }), wo2.reply({ color: "rose", dur: 0.8 })),
      all(w11.reply({ color: "rose", dur: 0.8 }), w12.reply({ color: "rose", dur: 0.8 }), w21.reply({ color: "rose", dur: 0.8 }), w22.reply({ color: "rose", dur: 0.8 })),
      all(flash(i1), flash(i2)),
    ]);

    s.step(
      "One pass forward, one pass back — and every knob in the network has its nudge-direction, no experiments required.",
      [appear(gradTok), all(pulse(h1, 2.0), pulse(h2, 2.0)), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 4 — interactive: the learning-rate cliff (real trajectories)
   ============================================================ */

const REGIMES = {
  tiny: { m: 0.93, steps: 9 },
  right: { m: 0.55, steps: 7 },
  high: { m: -0.82, steps: 9 },
} as const;

const learningRate = scene({
  id: "learning-rate",
  chapter: "The one knob you own",
  question: "The step size is yours to choose. How wrong can it go?",
  title: "Too timid crawls. Too bold explodes. The cliff is real.",
  takeaway:
    "The learning rate is the difference between converging, crawling, oscillating, and exploding — the same valley, the same rule, four different fates. Every trajectory you just scrubbed was computed with the actual update rule, not drawn by hand: past a sharp threshold each step genuinely overshoots by more than it gains, and the error runs away to infinity. Respect the cliff.",
  nextPrompt: "Start the story again",
  prose: [
    "The loop is now complete: backprop computes each knob's downhill direction, and gradient descent steps that way. But 'a small step' hides the one decision the algorithm cannot make for you — how small? That single number is called the learning rate, and it is famously the difference between a model that trains and a model that catches fire.",
    "The figure is interactive, and the trajectories are honest: each one is the real update rule run at the rate you pick. Start timid — the ball inches downhill and would take all week to arrive. Pick the sweet spot and it settles in a handful of steps. Now push higher, 'to go faster': each step overshoots the floor and lands on the far wall, back and forth, barely gaining.",
    "Then push once more. Past a sharp threshold, every overshoot lands higher than where it started — the loop that was supposed to reduce the error now amplifies it, and the numbers scream off to infinity. This is not a cartoon; training runs really die exactly this way. Every practitioner drags this slider too far once. Better to do it here.",
  ],
  params: {
    lr: choice("Learning rate", [
      ["tiny", "0.05 — timid"],
      ["right", "0.4 — just right"],
      ["high", "0.95 — reckless"],
      ["explode", "1.1 — over the cliff"],
    ]),
  },
  setup: (s, p) => {
    const valley = castValley(s);
    const { ball } = s.cast({ ball: dot({ x: 215, y: valleyY(215), r: 9, color: "cyan" }) });
    const { rule } = s.cast({
      rule: label({ x: XC, y: 448, text: "same valley · same rule · only the step size changes", size: 12, color: "dim" }),
    });

    s.step("The slope at the ball's position is known; the only choice left — the step size — is yours.", [
      stagger(0.02, ...valley.map((d) => appear(d, 0.2))),
      appear(rule),
      appear(ball),
    ]);

    if (p.lr === "tiny") {
      const { verdict } = s.cast({ verdict: token({ x: XC, y: 100, text: "converging… eventually. maybe. someday.", accent: "amber" }) });
      s.step("Each step is a whisper — technically downhill, practically stationary.", [
        ...descend(215, REGIMES.tiny.m, 5).map((q) => move(ball, q, 0.55)),
      ]);
      s.step(
        "Nine steps in and the ball has barely left the wall: too-small learning rates don't fail loudly, they just waste your compute quietly.",
        [...descend(215, REGIMES.tiny.m, REGIMES.tiny.steps).slice(5).map((q) => move(ball, q, 0.55)), appear(verdict), wait(0.8)],
        { hold: 1.0 },
      );
      return;
    }

    if (p.lr === "right") {
      const { verdict } = s.cast({ verdict: token({ x: XC, y: 100, text: "settled at the floor in 7 steps", accent: "green" }) });
      s.step("Each step covers most of the remaining distance without overshooting.", [
        ...descend(215, REGIMES.right.m, 4).map((q) => move(ball, q, 0.5)),
      ]);
      s.step(
        "A few more strides and it settles gently at the floor — this is what a healthy training curve feels like.",
        [
          ...descend(215, REGIMES.right.m, REGIMES.right.steps).slice(4).map((q) => move(ball, q, 0.5)),
          all(glowOn(ball), appear(verdict)),
          wait(1.0),
        ],
        { hold: 1.2 },
      );
      return;
    }

    if (p.lr === "high") {
      const { verdict } = s.cast({ verdict: token({ x: XC, y: 100, text: "overshooting every step — barely converging", accent: "rose" }) });
      s.step("Watch the first step: it flies OVER the floor and lands on the far wall.", [
        ...descend(215, REGIMES.high.m, 2).map((q) => move(ball, q, 0.55)),
      ]);
      s.step("Every step overshoots and swaps walls — the ball ping-pongs across the valley, gaining a little each bounce.", [
        ...descend(215, REGIMES.high.m, 7).slice(2).map((q) => move(ball, q, 0.5)),
      ]);
      s.step(
        "It converges — barely, wastefully, and one notch of bravery away from disaster.",
        [...descend(215, REGIMES.high.m, REGIMES.high.steps).slice(7).map((q) => move(ball, q, 0.5)), appear(verdict), wait(0.8)],
        { hold: 1.0 },
      );
      return;
    }

    /* explode: m = −1.25 — |m| > 1, each overshoot lands HIGHER; the loop amplifies */
    const { boom, lossTok } = s.cast({
      boom: token({ x: XC, y: 100, text: "loss → ∞ — the run is dead", accent: "rose" }),
      lossTok: token({ x: XC, y: 140, text: "each landing is HIGHER than the last", accent: "amber" }),
    });
    s.step("The first step overshoots the floor and lands on the far wall — higher than where it started.", [
      move(ball, { x: 811, y: valleyY(811) }, 0.6),
      appear(lossTok),
    ]);
    s.step("Now the loop runs in reverse: every step amplifies the error instead of shrinking it.", [
      move(ball, { x: 100, y: 84 }, 0.55),
      shake(ball),
    ]);
    s.step(
      "The numbers scream off to infinity and the training run is dead — one slider notch past 'reckless' is a cliff, not a slope.",
      [move(ball, { x: 880, y: 72 }, 0.4), vanish(ball), all(appear(boom), shake(lossTok)), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================ */

export default defineStory({
  ...meta,
  scenes: [race, knobs, backprop, learningRate],
  outro: [
    "Now say the whole thing in one breath: measure the wrongness, let blame flow backwards to price every knob's nudge, step each knob slightly downhill, repeat. That's it. There is no insight anywhere in the loop — no moment where the network 'sees' the pattern. The loop is blind, local, and slightly embarrassing in its simplicity, and it is the engine underneath every headline-grabbing model you have ever used.",
    "Two honest footnotes. First, the valley you watched was a cartoon: real loss surfaces live in millions of dimensions, where our pictures are useful lies — the mechanics of slope-and-step survive the translation, the geometry doesn't. Second, nothing guarantees the bottom you reach is THE bottom; in practice high-dimensional surfaces are riddled with good-enough valleys, and any of them will do. That a blind local loop, run at scale, produces machines that write and reason — deflating the mystery only sharpens the wonder.",
  ],
  references: [
    {
      kind: "video",
      title: "3Blue1Brown: Gradient descent, how neural networks learn",
      url: "https://www.youtube.com/watch?v=IHZwWFHWa-w",
      note: "The canonical visual treatment of the loss landscape and the nudge-every-knob idea.",
    },
    {
      kind: "video",
      title: "Karpathy: The spelled-out intro to backpropagation",
      url: "https://www.youtube.com/watch?v=VMj-3S1tku0",
      note: "The chain rule built node by node with numbers you can check by hand — the best backprop teaching ever recorded.",
    },
    {
      kind: "interactive",
      title: "TensorFlow Playground",
      url: "https://playground.tensorflow.org",
      note: "A full training loop running live in your browser, with sliders for everything.",
    },
    {
      kind: "article",
      title: "Distill: Why Momentum Really Works",
      url: "https://distill.pub/2017/momentum/",
      note: "Where to go once plain gradient descent feels slow — scrubbable optimization widgets throughout.",
    },
  ],
});
