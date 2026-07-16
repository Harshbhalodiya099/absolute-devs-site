# Research brief — How Mixture of Experts (MoE) Works

## 1. First principles

**Why it exists.** Scaling laws say bigger models are smarter — but in a
dense transformer, every parameter touches every token. Doubling parameters
doubles compute *per token*. MoE breaks that coupling: grow total parameters
(knowledge capacity) without growing per-token compute (cost), by activating
only a small slice of the network for each token.

**What problem it solves.** The parameters-vs-FLOPs lockstep. A Mixtral-style
model has ~47B parameters but runs each token through ~13B — big-model
quality at mid-model latency. This is *conditional computation*: spend
compute only where it's routed.

**Why previous approaches were insufficient.** Dense scaling: cost grows
linearly with size, hits hardware walls. Classic ensembles: run N full models
and average — multiplies cost by N, the exact opposite of the goal. Early
conditional-computation attempts (hard, non-differentiable routing) couldn't
train by gradient descent; the 2017 breakthrough (Shazeer's sparsely-gated
MoE) made routing *learnable*.

**Core intuition (one sentence).** *In each MoE layer, a tiny learned router
scores all experts per token, sends the token to only the top-k, and blends
their outputs — so the model's knowledge is huge but each token's path
through it is narrow.*

**Biggest misconception.** That experts are human-legible specialists — "the
math expert," "the French expert." In reality experts specialize in shallow,
token-level patterns (punctuation, numbers, certain syntax), specialization
varies by layer, and it's largely uninterpretable. The Mixtral paper itself
shows routing correlates more with token identity than topic. Related
misconception: "8x7B = 56B model" (shared attention layers; ~47B total, ~13B
active) and "MoE = ensemble" (an ensemble runs everyone; MoE's whole point is
NOT running everyone).

**Hard to visualize.** The router's learned scoring (a softmax over experts,
per token, per layer); load balancing and its failure mode (router collapse —
rich-get-richer feedback where a good expert gets more traffic, more
gradient, gets better, gets more traffic); the auxiliary load-balancing loss
as a counterweight; capacity factor and token dropping in batched training;
the fact that routing happens independently *at every MoE layer*, so a
token's "path" is a different expert set at each depth.

**Should become interactive.**
- **Be the router / watch the router:** a stream of tokens flowing to
  experts; sliders for N (experts) and k (top-k); watch active-parameter
  count vs. total-parameter count diverge as N grows with k fixed. This is
  THE interaction — it makes the core trade visible as two numbers.
- **Router collapse toggle:** train with load-balancing loss off → traffic
  piles onto two experts, others atrophy (dim, shrink); toggle the aux loss
  on → traffic spreads. Failure-first, param-driven, perfect engine fit.
- **Capacity factor:** shrink expert capacity, watch overflow tokens get
  dropped/rerouted — makes an obscure training detail tangible.

## 2. Best educational resources

- **Hugging Face — "Mixture of Experts Explained"** (blog, Sanseviero et
  al.). The de facto standard reference; exceptional for covering the full
  practical landscape (routing, load balancing, capacity, fine-tuning
  quirks, sparse-vs-dense tradeoffs) with honest "this is finicky" notes.
  **Steal:** its framing that the MoE layer *replaces the FFN* — locating the
  change precisely inside the transformer block instead of hand-waving "some
  layers are experts."
- **Shazeer et al. 2017 — "Outrageously Large Neural Networks"** (the
  sparsely-gated MoE paper). Exceptional as the origin story: the abstract
  literally frames it as breaking the capacity/compute coupling. **Steal:**
  the motivation section's economics argument; the noisy top-k trick as a
  story beat about exploration.
- **Fedus, Zoph, Shazeer 2021 — "Switch Transformer".** Exceptional for its
  radical simplification (k=1!) and its unusually readable ablations on load
  balancing. **Steal:** the simplification instinct — if k=1 works, the
  concept demo should probably start at k=1 too.
- **Mixtral of Experts paper (Mistral AI, 2024).** Exceptional for the
  routing-analysis section — the empirical evidence *against* semantic
  specialization (adjacent tokens share experts; syntax over topic).
  **Steal:** their expert-assignment-colored text figure — tokens colored by
  which expert served them is a ready-made visualization and the perfect
  misconception-killer.
- **Sebastian Raschka — MoE explainers (magazine/book chapters, incl. the
  DeepSeek-V3/R1 era analyses).** Exceptional at bridging paper-math and
  implementation; covers modern refinements (fine-grained experts, shared
  experts) cleanly. **Steal:** the "shared expert + routed experts" diagram
  logic if you touch modern designs; also a good accuracy check.
- **Cameron Wolfe — "Mixture-of-Experts" deep dives (substack).** Exceptional
  for historical throughline from 1991 (Jacobs & Jordan's original adaptive
  mixtures) to modern LLMs. **Steal:** the observation that MoE is a
  30-year-old idea that had to *wait for scale to matter* — great narrative
  beat.
- **3Blue1Brown — transformer series (esp. the MLP/attention chapters).**
  Not MoE, but the audience's mental scaffold for "what an FFN block does"
  will come from here. **Steal:** his visual grammar for tokens-as-vectors
  flowing through blocks, so your MoE layer slots into a picture learners
  already hold.
- **Karpathy — "Zero to Hero" / nanoGPT.** Grounding for what "the FFN is
  2/3 of your parameters" means concretely; his style of counting parameters
  on screen is worth echoing when you show dense-vs-MoE budgets.

## 3. Interactive inspiration

- **TensorFlow Playground.** The canonical "sliders change a live network"
  artifact. **Learn:** instant param→behavior feedback with zero setup; the
  restraint of showing ONE network small enough to see whole. **Don't copy:**
  its free-play openness — MoE needs a guided reveal (collapse first, fix
  second), not a sandbox.
- **LLM Visualization (bbycroft.net).** 3D walkthrough of a real GPT's
  internals. **Learn:** the power of showing *actual tensor shapes* to scale;
  the camera-as-teacher pattern. **Don't copy:** the 3D density — your
  engine's calm 2D stage is the right altitude; bbycroft overwhelms
  deliberately, you clarify deliberately.
- **Mail-sorting / postal-hub visualizations & airport routing boards.**
  Non-CS inspiration: a sorting facility where parcels stream to stations is
  the honest physical analog of token routing, including overflow (capacity)
  and hot stations (imbalance). **Learn:** queue-pressure as a visual
  (backlog piling up = load imbalance felt viscerally).
- **The Evolution of Trust (Nicky Case).** **Learn:** how to teach a *system
  failure* (defection spirals ≈ router collapse) by letting the learner watch
  a feedback loop run, then handing them the fix as a param. The
  rich-get-richer dynamic is exactly a Case-style story.
- **Human Resource Machine.** **Learn:** workers-with-personalities makes
  "experts" charming — but keep personas mechanical (fast/slow, busy/idle),
  NOT semantic ("math expert"), or the visualization itself would teach the
  misconception you're trying to kill.

## 4. Story directions

- **The overwhelmed factory (recommended).** A dense model as a factory
  where EVERY worker inspects EVERY item — accurate but absurdly expensive.
  Scale the factory up and watch cost explode. Then invent the dispatcher
  (router): items go only to the k most relevant stations. Then the twist:
  dispatch goes wrong (collapse), and balance must be engineered. *Audience:*
  developers who know roughly what an LLM is. *Strength:* the economics
  (capacity vs. compute) is the actual point, and a factory makes cost
  *visible* as motion and idle workers. *Weakness:* factory workers invite
  semantic-specialist readings — must explicitly subvert it ("station 3 is
  not the math station; look what it actually receives").
- **The scaling-wall crisis / economics thriller.** Start from the scaling
  laws: you want a smarter model; the dense bill is unpayable; MoE as the
  loophole. *Audience:* more advanced, business-adjacent. *Strength:*
  motivates from the real historical pressure. *Weakness:* number-heavy
  opening before anything moves on stage.
- **The detective: "which expert answered?"** Take a real sentence, color
  each token by its expert (Mixtral-figure style), and investigate whether
  experts have themes — discovering the answer is "no, not the way you'd
  think." *Strength:* leads with the misconception and lets the learner
  discover its falseness — highest memorability per minute. *Weakness:*
  needs the mechanism explained first; works best as act three, not act one.
- **Historical arc (1991 → 2017 → Switch → Mixtral/DeepSeek).** *Strength:*
  the wait-for-scale irony. *Weakness:* history without mechanism is trivia;
  at most a takeaway beat.

Best composite: **factory/dispatcher spine → collapse-and-fix as the
dramatic middle → "which expert answered?" detective ending as the
misconception-killer.**

## 5. Learning psychology

- **Failure-first (twice).** (a) Dense scaling failing motivates routing;
  (b) naive routing collapsing motivates the balancing loss. Both failures
  are the actual intellectual content — MoE's cleverness is only legible
  against what goes wrong without it.
- **Prediction before reveal.** "8 experts × 7B — how big is the model you
  run per token?" Most will say 56B. Reveal ~13B. Also: "will the router
  send 'calculus' tokens to a math expert?" — reveal: no.
- **Quantitative contrast as a persistent HUD.** Two live counters — total
  params vs. active params — on stage throughout. Effective because the
  entire concept is the gap between those two numbers; every interaction
  should visibly move one and not the other.
- **Analogy with an explicit breaking point.** Use the dispatcher analogy,
  then *break it on purpose* (real routers are learned, per-layer, and route
  by uninterpretable features, not job type). Naming where the analogy fails
  is what prevents it from installing the specialist misconception.
- **Guided discovery over sandbox.** Order matters (collapse must be
  witnessed before the fix means anything), so use param interactions inside
  a directed sequence, not free play.

## 6. Aha moments

- **"Big model, small bill."** The active-vs-total counter diverging as you
  add experts. Wonder + the core takeaway in one image.
- **"The router is tiny."** Reveal that the dispatcher deciding everything
  is a single small matrix — a linear layer + softmax. Deflationary aha.
- **Router collapse.** Watching two experts hog everything while six atrophy
  — surprise, then curiosity ("why?"), then the feedback-loop explanation,
  then relief when the aux loss restores balance. The emotional peak; make
  it a two-step interactive (off → observe → on → observe).
- **"There is no math expert."** The colored-token reveal: expert assignments
  look near-random by topic, patterned by syntax. Directly kills the
  misconception; genuinely surprising even to practitioners.
- **"Each layer routes independently."** A token's path shown through 3
  stacked MoE layers, different experts at each — dissolves the mental image
  of "a token belongs to expert 5."

## 7. Visual opportunities

- **Animate:** tokens streaming through a transformer block where the FFN
  splits into expert lanes; the router's softmax as a quick per-token score
  flicker before dispatch; the collapse spiral (traffic thickening to hot
  experts while cold ones dim); the top-k blend (two expert outputs merging,
  weighted).
- **Interactive (params):** N experts × top-k sliders driving the twin
  param/FLOP counters; balancing-loss toggle; capacity-factor slider with
  visible token dropping; (stretch) choose the input sentence for the
  colored-token ending.
- **Simulation:** the routing scene IS a queueing simulation — arrival
  stream, per-expert queues, utilization; the engine's re-simulate-on-param
  model is exactly right for it.
- **Static:** where-the-MoE-layer-sits anatomy (transformer block diagram
  with FFN highlighted → swapped); the real-model stats table (Mixtral,
  Switch, DeepSeek totals vs. active).

Why: routing is traffic, and traffic is the thing animation does best;
the parameter economics is arithmetic, and arithmetic is best as live
counters; block anatomy is taxonomy, best static.

## 8. Common tutorial mistakes

- **Leading with the gating equations.** Softmax-over-logits notation before
  any picture of traffic. Counter: equations never; the router is "scores +
  keep top-k," shown as motion.
- **Letting "expert" do the teaching.** The word smuggles in the specialist
  misconception; most tutorials reinforce it with "imagine a math expert…".
  Counter: introduce experts as *identical-at-birth* FFN copies that
  differentiate only through training pressure; show what they actually
  receive.
- **Skipping load balancing** because it's "a training detail." It's half
  the intellectual content and the entire dramatic arc. Counter: collapse
  gets its own scene.
- **Conflating MoE with ensembles.** Counter: one beat that runs the
  ensemble version (everyone works, outputs averaged, cost ×N) next to MoE.
- **No numbers.** Without the 47B/13B-style contrast the whole point is
  invisible. Counter: the persistent twin counters.
- **Pretending it's free.** Memory footprint is still the FULL parameter
  count; communication costs; training instability. Counter: an honest
  "the fine print" takeaway.

## 9. Design inspiration

- **Nicky Case's feedback-loop pedagogy** (Evolution of Trust, Parable of
  the Polygons): teach the collapse as a *system dynamic* the learner
  watches unfold, not as a stated fact.
- **Flow-map / Sankey visual language** (Minard tradition): edge thickness =
  traffic share is the correct encoding for routing distribution; a MoE
  layer over time is a living Sankey.
- **Dashboard restraint (Stripe-style):** the twin counters should feel like
  a beautiful minimal HUD, not a metrics wall — two numbers, always visible,
  nothing else quantified on screen.
- **Zachtronics idle-worker legibility:** an idle expert should *look* idle
  (dim, slack) at a glance — utilization readable with zero labels.

## 10. Creative brief

- **Core intuition:** a learned router sends each token to only k of N
  expert FFNs, decoupling total parameters (knowledge) from per-token
  compute (cost).
- **Educational objective:** learner can explain why an "8x7B" model runs at
  ~13B cost, what the router actually is, why naive routing collapses and
  how the balancing loss fixes it, and why "the math expert" is a myth.
- **Emotional objective:** delight at the economics trick, then the
  satisfying vertigo of the specialist myth dying.
- **Biggest misconception to kill:** experts are semantic specialists (and
  its cousin: 8×7B = 56B running cost).
- **Strongest analogy:** dispatch/sorting hub with stations — deployed with
  an explicit breaking point ("real dispatch is learned, per-layer, and not
  by job type").
- **Strongest interactions:** N×k sliders with twin total/active counters;
  balancing-loss toggle around the collapse; capacity-factor overflow.
- **Strongest animations:** token traffic through expert lanes; collapse
  spiral; top-k blend; per-layer path divergence; the colored-sentence
  ending.
- **Story direction:** overwhelmed factory → invent the dispatcher →
  collapse and the balancing fix → "which expert answered?" detective
  finale.
- **Best external resources:** HF MoE blog (landscape + FFN framing),
  Shazeer 2017 (motivation), Switch Transformer (k=1 simplicity + balance
  ablations), Mixtral paper (routing-analysis figure), Raschka/Wolfe
  (modern refinements + history), 3B1B transformers (audience scaffold).
- **Risks:** audience lacking the transformer scaffold (mitigate with a
  30-second "the FFN is most of the model" preamble scene); the analogy
  installing the specialist myth (mitigate by breaking it on stage);
  drowning in training minutiae (capacity/aux loss get one beat each, no
  equations).
- **Aha inventory:** big-model-small-bill; the-router-is-tiny;
  collapse-then-balance; no-math-expert; new-experts-every-layer.
