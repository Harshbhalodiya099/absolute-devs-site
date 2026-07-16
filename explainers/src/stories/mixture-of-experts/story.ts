/**
 * "How mixture of experts makes giant models affordable"
 *
 * Visual law: the twin counters (total params vs active params) are on stage
 * throughout and diverge as the MoE trick kicks in. Experts that receive no
 * traffic DIM — utilization is readable at a glance with zero labels.
 * The router is always visually TINY compared to the experts it directs.
 */
import {
  all,
  appear,
  choice,
  definePreset,
  defineStory,
  dim,
  enter,
  fadeTo,
  flash,
  glowOn,
  label,
  pulse,
  scene,
  shake,
  stagger,
  toggle,
  token,
  vanish,
  wait,
} from "../../engine";
import { meta } from "./meta";

/* ---------------- story-local vocabulary ---------------- */

const expert = definePreset({
  glyph: "gear",
  label: "Expert",
  accent: "cyan",
  w: 120,
  h: 58,
  note: "An FFN sub-network (feed-forward block) — identical at initialization, differentiated only by training pressure. NOT a semantic specialist; what it learns is shallow and largely uninterpretable.",
});

const routerPreset = definePreset({
  glyph: "balancer",
  label: "Router",
  accent: "violet",
  w: 130,
  h: 58,
  note: "A single small linear layer + softmax. It scores every expert per token and picks the top-k. The entire routing decision is this tiny matrix — not a complex system.",
});

/* ============================================================
   Scene 1 — The Dense Wall: scaling costs linearly
   ============================================================ */

const denseWall = scene({
  id: "dense-wall",
  chapter: "The problem",
  question: "What if you want a smarter model but can't afford to double the bill?",
  title: "In a dense model, every parameter fires for every token. Double the size, double the cost.",
  takeaway:
    "Scaling laws say bigger models are smarter — more parameters, better predictions. But in a dense transformer, every parameter touches every token. Double the parameters and you double the compute per token: the bill scales linearly with model size. Past a threshold, the next step up is simply unpayable. That linear coupling between capacity (how much the model knows) and cost (per-token compute) is the wall MoE breaks.",
  nextPrompt: "So how do you break the coupling?",
  prose: [
    "Here is the uncomfortable arithmetic of large language models. The scaling laws — empirical results that have held remarkably well — say that bigger models produce better predictions. More parameters store more patterns, more associations, more knowledge. Everyone wants a bigger model.",
    "But in a standard dense transformer, every parameter participates in processing every single token. The FFN block — the feed-forward network inside each transformer layer — is typically two-thirds of the model's parameters, and all of it fires for every token. Double the model's size and you exactly double the computation per token.",
    "Watch below: a small model processes tokens by lighting up every expert. Scale it up — add more experts — and every one of them still fires for every token. The total-parameters counter and the active-parameters counter are locked together. At some point, the next step is just unpayable. That lockstep is the wall.",
  ],
  setup: (s) => {
    const { e1, e2, e3, e4 } = s.cast({
      e1: expert({ x: 260, y: 200, label: "FFN block 1", accent: "cyan" }),
      e2: expert({ x: 420, y: 200, label: "FFN block 2", accent: "cyan" }),
      e3: expert({ x: 580, y: 200, label: "FFN block 3", accent: "cyan" }),
      e4: expert({ x: 740, y: 200, label: "FFN block 4", accent: "cyan" }),
    });
    const { tok } = s.cast({
      tok: token({ x: 480, y: 360, text: "each token", accent: "blue" }),
    });
    const { total, active, wall } = s.cast({
      total: token({ x: 300, y: 90, text: "total params: 28B", accent: "amber" }),
      active: token({ x: 660, y: 90, text: "active per token: 28B", accent: "rose" }),
      wall: token({ x: 480, y: 440, text: "capacity and cost are locked together — the wall", accent: "rose" }),
    });

    s.step("A dense model: four FFN blocks, each holding a share of the model's parameters.", [
      enter([e1, e2, e3, e4], 0.15),
      appear(total),
    ]);

    s.step("A token arrives — and ALL four blocks fire. Every parameter participates, every time.", [
      appear(tok),
      stagger(0.15, flash(e1), flash(e2), flash(e3), flash(e4)),
      all(glowOn(e1), glowOn(e2), glowOn(e3), glowOn(e4)),
      appear(active),
      wait(0.4),
    ]);

    s.step("Double the model's size? Every block still fires — the active count doubles too.", [
      all(pulse(e1, 1.5), pulse(e2, 1.5), pulse(e3, 1.5), pulse(e4, 1.5)),
      wait(0.6),
    ]);

    s.step(
      "Total parameters and active parameters are locked together — you can't have a bigger brain without a bigger bill.",
      [appear(wall), pulse(wall, 2.2), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 2 — The Router: breaking the coupling
   ============================================================ */

const theRouter = scene({
  id: "the-router",
  chapter: "The trick",
  question: "What if each token used only a fraction of the model?",
  title: "A tiny router sends each token to 2 of 8 experts — big model, small bill.",
  takeaway:
    "The MoE layer replaces the FFN block with N expert copies and one tiny router. The router is a single linear layer + softmax — it scores every expert per token and sends the token to only the top-k (often k=2 out of 8). The model's total parameters grow with N (knowledge capacity), but the per-token compute stays proportional to k (cost). Mixtral has ~47B total parameters but runs each token through ~13B — big-model quality at mid-model cost. The gap between total and active IS the trick.",
  nextPrompt: "But what if the router plays favorites?",
  prose: [
    "The idea is deceptively simple: what if each token didn't have to use the entire model? What if a small dispatcher looked at each token and decided which parts of the model were most relevant, sending the token through only those parts?",
    "That is Mixture of Experts. In each MoE layer, the single large FFN block is replaced by N smaller FFN copies — the experts — plus one tiny router. The router is absurdly small: a single linear layer followed by a softmax. For each incoming token, it produces a score for every expert, keeps only the top-k scores, and routes the token to those experts. The outputs of the chosen experts are blended using the scores as weights.",
    "Watch the twin counters: total parameters grow with N (you added experts, each with their own weights). But active parameters per token grow only with k. Eight experts, top-2 routing: the model holds 8x the knowledge but each token pays only 2x the compute. The gap between those two numbers is the entire MoE value proposition.",
  ],
  params: {
    topk: choice("Experts per token (top-k)", [
      ["1", "k = 1 — one expert per token"],
      ["2", "k = 2 — the common choice"],
      ["4", "k = 4 — more compute, more quality"],
    ]),
  },
  setup: (s, p) => {
    const k = parseInt(p.topk, 10);
    const experts = Array.from({ length: 8 }, (_, i) => ({
      key: `e${i}`,
      spec: expert({ x: 140 + i * 98, y: 210, label: `E${i + 1}`, accent: "cyan", w: 78, h: 52 }),
    }));
    const expertSpecs = Object.fromEntries(experts.map((e) => [e.key, e.spec]));
    const expertRefs = s.cast(expertSpecs);
    const expertList = experts.map((e) => expertRefs[e.key]);

    const { router, tok } = s.cast({
      router: routerPreset({ x: 480, y: 350, label: "Router", sub: "scores → top-k" }),
      tok: token({ x: 480, y: 440, text: "incoming token", accent: "blue" }),
    });

    const kLabel = k === 1 ? "1 expert" : `${k} experts`;
    const totalLabel = `total params: 8 × 7B = ~47B`;
    const activeLabel = `active per token: ${k} × 7B = ~${k * 7}B`;
    const { total, active, gap } = s.cast({
      total: token({ x: 260, y: 80, text: totalLabel, accent: "amber" }),
      active: token({ x: 700, y: 80, text: activeLabel, accent: "green" }),
      gap: token({ x: 480, y: 460, text: `big model, small bill — the gap is the trick`, accent: "green" }),
    });

    /* which experts "activate" for this demo — deterministic for each k */
    const activeIdx = Array.from({ length: k }, (_, i) => i * Math.floor(8 / k));
    const activeSet = new Set(activeIdx);

    s.fanout(router, expertList, { bow: 0, virtual: true });

    s.step("Eight experts — identical at birth, each a copy of the FFN block — plus one tiny router.", [
      enter(expertList, 0.08),
      appear(router),
      appear(total),
    ]);

    s.step(`A token arrives. The router scores all 8 experts and picks the top-${k}: only ${kLabel} fire.`, [
      appear(tok),
      flash(router),
      wait(0.3),
      all(
        ...expertList.map((e, i) =>
          activeSet.has(i) ? all(glowOn(e), flash(e)) : dim(e),
        ),
      ),
      appear(active),
      wait(0.4),
    ]);

    s.step(`The idle experts cost nothing — total params are 47B, but the token ran through ~${k * 7}B.`, [
      all(...activeIdx.map((i) => pulse(expertList[i], 1.8))),
      wait(0.5),
    ]);

    s.step(
      "The gap between total and active widens as you add experts with k fixed — capacity grows, per-token cost doesn't.",
      [appear(gap), pulse(gap, 2.2), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 3 — The Collapse: router failure + the balancing fix
   ============================================================ */

const collapse = scene({
  id: "collapse",
  chapter: "The failure",
  question: "What if the router sends every token to the same expert?",
  title: "Without a balancing force, the rich get richer and six experts die.",
  takeaway:
    "Naive routing is unstable. An expert that gets slightly more traffic during training receives more gradient signal, gets better, receives even more traffic — a rich-get-richer feedback loop. Left unchecked, the router collapses: two experts hog everything while six atrophy. The fix is an auxiliary load-balancing loss that penalizes uneven traffic. Toggle it on and watch traffic spread. This is not a minor training detail — it's half the intellectual content of MoE. Without it, you paid for 8 experts and got 2.",
  nextPrompt: "So the experts specialize — a math expert, a language expert, right?",
  prose: [
    "The router is learned — its weights are trained alongside the experts. This creates a feedback loop that naive training cannot escape. Here is how it goes wrong:",
    "Early in training, one expert happens to be slightly better for a batch of tokens. The router sends more traffic to it. More traffic means more gradient signal. More gradient signal means it improves faster. It improves faster, so the router sends even MORE traffic to it. Meanwhile, the neglected experts receive almost no gradient, stagnate, and the router correctly learns to ignore them. Two experts end up handling everything; six are dead weight. You paid for eight and got two.",
    "This is router collapse, and it is not a theoretical concern — it's a real training failure that early MoE systems suffered from. The fix is elegant: an auxiliary loss term that penalizes uneven load distribution. It adds a gentle pressure toward equal traffic. The router is still free to specialize — it just can't let any expert starve completely.",
  ],
  params: {
    balance: toggle("Load-balancing loss", [
      ["off", "Off — let the router collapse"],
      ["on", "On — penalize uneven traffic"],
    ]),
  },
  setup: (s, p) => {
    const experts = Array.from({ length: 8 }, (_, i) => ({
      key: `e${i}`,
      spec: expert({ x: 140 + i * 98, y: 200, label: `E${i + 1}`, accent: "cyan", w: 78, h: 52 }),
    }));
    const expertSpecs = Object.fromEntries(experts.map((e) => [e.key, e.spec]));
    const expertRefs = s.cast(expertSpecs);
    const expertList = experts.map((e) => expertRefs[e.key]);

    const { router } = s.cast({
      router: routerPreset({ x: 480, y: 350, label: "Router", sub: "learned weights" }),
    });

    if (p.balance === "off") {
      const { feedback, dead, outcome } = s.cast({
        feedback: token({ x: 480, y: 95, text: "rich-get-richer: more traffic → better → more traffic", accent: "rose" }),
        dead: token({ x: 480, y: 440, text: "6 experts atrophied — you paid for 8, got 2", accent: "rose" }),
        outcome: label({ x: 480, y: 460, text: "toggle the balancing loss ON above to fix this", size: 12, color: "dim" }),
      });

      s.step("Eight experts, one router — early training begins. The router has no preference yet.", [
        enter(expertList, 0.08),
        appear(router),
        flash(router),
      ]);

      s.step("One expert gets slightly more traffic by chance — more gradient, faster learning, even more traffic.", [
        glowOn(expertList[2]),
        flash(expertList[2]),
        appear(feedback),
        pulse(expertList[2], 1.6),
        wait(0.3),
      ]);

      s.step("The feedback loop runs away: two experts hog everything, six receive nothing and atrophy.", [
        glowOn(expertList[5]),
        all(
          ...expertList.map((e, i) =>
            i === 2 || i === 5 ? pulse(e, 1.5) : all(dim(e), fadeTo(e, 0.25)),
          ),
        ),
        wait(0.5),
      ]);

      s.step(
        "Router collapse: you paid for 8 experts and got 2. The fix is a single loss term — toggle it on above.",
        [appear(dead), appear(outcome), shake(router), wait(1.0)],
        { hold: 1.2 },
      );
      return;
    }

    /* balance = "on" */
    const { balanced, result } = s.cast({
      balanced: token({ x: 480, y: 95, text: "auxiliary loss penalizes uneven traffic", accent: "green" }),
      result: token({ x: 480, y: 440, text: "all 8 experts active — the model uses its full capacity", accent: "green" }),
    });

    s.step("Eight experts, one router — the load-balancing loss adds pressure toward equal traffic.", [
      enter(expertList, 0.08),
      appear(router),
      appear(balanced),
      flash(router),
    ]);

    s.step("The router still routes by scores — but the penalty prevents any expert from starving.", [
      stagger(0.1, ...expertList.map((e) => flash(e))),
      wait(0.4),
    ]);

    s.step("Traffic distributes across all experts — each receives gradient, each improves, each contributes.", [
      all(...expertList.map((e) => glowOn(e))),
      stagger(0.08, ...expertList.map((e) => pulse(e, 1.5))),
      wait(0.5),
    ]);

    s.step(
      "All 8 experts active, all contributing — the model uses its full capacity instead of collapsing to 2.",
      [appear(result), pulse(result, 2.2), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 4 — The Detective: there is no math expert
   ============================================================ */

const detective = scene({
  id: "no-math-expert",
  chapter: "The myth",
  question: "Do the experts actually specialize? Is there a 'math expert'?",
  title: "Color each token by its expert — the pattern is not what you expect.",
  takeaway:
    "The word 'expert' is a trap. It smuggles in the idea of a human-legible specialist — a math expert, a French expert, a code expert. The Mixtral paper's own analysis shows the truth: routing correlates more with token identity (punctuation, numbers, syntax) than with topic. Adjacent tokens tend to share an expert regardless of what the sentence is about. And routing changes at every MoE layer — a token hits Expert 3 in layer 4 and Expert 7 in layer 8. There is no 'the math expert.' What the experts learn is shallow, per-layer, and largely uninterpretable. The trick works anyway.",
  nextPrompt: "Start the story again",
  prose: [
    "Everyone hears 'Mixture of Experts' and builds the same mental picture: a math expert for equations, a language expert for grammar, a science expert for physics. It's intuitive, it's clean, and it's wrong.",
    "The Mixtral paper includes a revealing figure: they colored tokens in real sentences by which expert served them. If experts were topic specialists, you'd see 'math tokens' in one color and 'French tokens' in another. Instead, the coloring looks almost random by topic — but patterned by syntax. Punctuation tokens cluster together. Numbers cluster together. Adjacent tokens share an expert regardless of what the sentence is about.",
    "And here's the final nail: routing happens independently at EVERY MoE layer. A token that goes to Expert 3 in layer 4 might go to Expert 7 in layer 8. There is no persistent 'assignment' of a token to an expert. The experts are specialized, but in shallow, per-layer, largely uninterpretable ways. The myth of the semantic specialist dies here — and the model works anyway.",
  ],
  setup: (s) => {
    /* A sentence where expert assignments LOOK semantic at first but aren't */
    const words = [
      { text: "The", exp: 2, color: "cyan" as const },
      { text: "derivative", exp: 5, color: "green" as const },
      { text: "of", exp: 2, color: "cyan" as const },
      { text: "x²", exp: 3, color: "amber" as const },
      { text: "is", exp: 2, color: "cyan" as const },
      { text: "2x", exp: 3, color: "amber" as const },
      { text: ".", exp: 1, color: "rose" as const },
    ];

    const tokenSpecs = Object.fromEntries(
      words.map((w, i) => [
        `t${i}`,
        token({ x: 130 + i * 105, y: 180, text: w.text, accent: w.color }),
      ]),
    );
    const tokenRefs = s.cast(tokenSpecs);
    const tokenList = words.map((_, i) => tokenRefs[`t${i}`]);

    const expLabels = Object.fromEntries(
      words.map((w, i) => [
        `exp${i}`,
        label({ x: 130 + i * 105, y: 230, text: `E${w.exp}`, size: 11, color: w.color }),
      ]),
    );
    const expRefs = s.cast(expLabels);
    const expList = words.map((_, i) => expRefs[`exp${i}`]);

    const { prediction, reveal, myth, layer2 } = s.cast({
      prediction: token({ x: 480, y: 100, text: "predict it: which tokens go to the 'math expert'?", accent: "violet" }),
      reveal: token({ x: 480, y: 100, text: "reality: routing follows syntax, not topic", accent: "amber" }),
      myth: token({ x: 480, y: 440, text: "there is no math expert — the model works anyway", accent: "green" }),
      layer2: token({ x: 480, y: 310, text: "layer 8: same tokens, DIFFERENT experts — routing is per-layer", accent: "violet" }),
    });

    const layer2Labels = Object.fromEntries(
      words.map((_, i) => [
        `l2e${i}`,
        label({
          x: 130 + i * 105,
          y: 370,
          text: `E${[7, 1, 4, 6, 4, 1, 3][i]}`,
          size: 11,
          color: ["violet", "rose", "blue", "cyan", "blue", "rose", "amber"][i] as "violet",
        }),
      ]),
    );
    const l2Refs = s.cast(layer2Labels);
    const l2List = words.map((_, i) => l2Refs[`l2e${i}`]);

    s.step("A sentence with math content — predict which tokens go to the 'math expert'.", [
      enter(tokenList, 0.1),
      appear(prediction),
      wait(0.5),
    ]);

    s.step("Color each token by its assigned expert — the pattern follows SYNTAX, not topic.", [
      vanish(prediction),
      stagger(0.1, ...expList.map((e) => appear(e))),
      appear(reveal),
      wait(0.5),
    ]);

    s.step("Now look at layer 8: the SAME tokens hit completely different experts — routing is per-layer, not permanent.", [
      appear(layer2),
      stagger(0.1, ...l2List.map((e) => appear(e))),
      wait(0.5),
    ]);

    s.step(
      "There is no math expert, no French expert, no code expert — the specialization is shallow, per-layer, and uninterpretable. The trick works anyway.",
      [appear(myth), pulse(myth, 2.4), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================ */

export default defineStory({
  ...meta,
  scenes: [denseWall, theRouter, collapse, detective],
  outro: [
    "The whole trick in one breath: replace the FFN block in each transformer layer with N expert copies and one tiny router. The router is a single small matrix — it scores all experts per token, keeps only the top-k, and routes the token through those few. Total parameters grow with N (knowledge), active parameters stay proportional to k (cost). Mixtral: ~47B total, ~13B active. The gap is the entire value proposition.",
    "Two honest footnotes. First, MoE is not free: the full parameter set still lives in memory even though most of it is idle per token, so memory cost does not shrink — only compute does. Communication costs in distributed setups are real, and training instability (the collapse you saw) makes MoE harder to train than dense models. Second, the idea is thirty years old: Jacobs and Jordan proposed adaptive mixtures of local experts in 1991. It had to wait for the transformer era and billion-parameter scale to become the architecture of choice. Some ideas need their hardware to catch up.",
  ],
  references: [
    {
      kind: "article",
      title: "Hugging Face: Mixture of Experts Explained",
      url: "https://huggingface.co/blog/moe",
      note: "The standard reference — routing, load balancing, capacity factors, and honest notes on the practical gotchas.",
    },
    {
      kind: "paper",
      title: "Outrageously Large Neural Networks (Shazeer et al., 2017)",
      url: "https://arxiv.org/abs/1701.06538",
      note: "The origin story: sparsely-gated MoE and the case for decoupling capacity from compute.",
    },
    {
      kind: "paper",
      title: "Mixtral of Experts (Mistral AI, 2024)",
      url: "https://arxiv.org/abs/2401.04088",
      note: "See the routing-analysis section — real evidence that experts specialize in syntax, not topics.",
    },
    {
      kind: "paper",
      title: "Switch Transformer (Fedus, Zoph, Shazeer, 2021)",
      url: "https://arxiv.org/abs/2101.03961",
      note: "What happens when you simplify all the way down to k=1 — with unusually readable ablations.",
    },
  ],
});
