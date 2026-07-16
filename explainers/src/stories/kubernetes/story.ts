/**
 * "How Kubernetes keeps your app alive" — a second reference story.
 *
 * Pure storytelling on top of the engine: cast, connect, compose motion. The
 * arc is deliberately a story, not a feature tour — one app's journey from a
 * fragile single container to a self-healing cluster, built around the one
 * idea underneath all of Kubernetes: the reconciliation loop.
 */
import {
  all,
  appear,
  below,
  bubble,
  defineStory,
  dim,
  draw,
  fadeTo,
  flash,
  frame,
  glowOff,
  glowOn,
  label,
  node,
  pulse,
  region,
  resetCam,
  scene,
  seq,
  shake,
  stagger,
  toggle,
  token,
  travel,
  wait,
} from "../../engine";
import { meta } from "./meta";

/* ============================================================
   Scene 1 — one server, nobody watching (the pain)
   ============================================================ */

const oneServer = scene({
  id: "one-server",
  chapter: "The problem",
  question: "What happens when the thing running your app just… stops?",
  title: "One container. One server. Nobody watching.",
  takeaway:
    "Everything crashes eventually — that part is normal and unavoidable. The real problem is that recovery depended on a human noticing and acting. Kubernetes exists to delete that dependency: to make a crash a non-event instead of an outage.",
  nextPrompt: "What if something was always watching?",
  prose: [
    "Here is the smallest possible way to run software for other people: one container, holding your app, sitting on one server. A request comes in, the container answers it, the request goes home happy. For a surprisingly long time, this is genuinely enough — it's how most things start, and there's nothing wrong with it.",
    "The trouble isn't that it's simple. The trouble is that it's alone. A container is just a process, and processes die: a memory leak fills the heap, a bad deploy ships a crash-on-startup bug, the kernel reaps something to save itself. None of these are exotic. Given enough nights, one of them will happen — and it will happen at the worst possible hour.",
    "The figure below plays out that night. Watch what happens after the crash: nothing. No alarm inside the system, no reflex, no recovery. The next request simply finds an empty room, and it keeps finding one until a human wakes up. That gap — between 'it broke' and 'someone noticed' — is the entire reason the rest of this story exists.",
  ],
  setup: (s) => {
    const { users, pod } = s.cast({
      users: node({
        x: 150,
        y: 262,
        glyph: "user",
        label: "Users",
        sub: "just want the page",
        accent: "blue",
        note: "Real people hitting your app. They don't know or care how many servers you run — only whether the page loads.",
      }),
      pod: node({
        x: 680,
        y: 262,
        glyph: "box",
        label: "your-app",
        sub: "1 container · 1 server",
        accent: "green",
        note: "A container is just a running process with its dependencies packed in. Isolated and portable — but still mortal. When it dies, nothing here brings it back.",
      }),
    });

    const { clock, err, downSays } = s.cast({
      clock: label({ x: 680, y: 110, text: "03:00", size: 26, color: "amber" }),
      err: token({ ...below(pod, 66), text: "503 · no healthy backend", accent: "rose" }),
      downSays: bubbleBelow(users, ["“Is the site down?”"]),
    });

    const link = s.connect(users, pod, { bow: 40, dashed: true });
    const r1 = s.packet(link, { color: "blue", label: "GET /" });
    const r2 = s.packet(link, { color: "blue", label: "GET /" });
    const rDead = s.packet(link, { color: "rose", label: "GET /" });

    s.step(
      "For months this is enough: a request arrives, the one container answers, everyone goes home happy.",
      [
        stagger(0.25, appear(users), appear(pod)),
        draw(link, 0.6),
        all(pulse(pod, 3.2), seq(travel(r1, 1.1), wait(0.2), travel(r2, 1.1))),
      ],
    );

    s.step(
      "Then, one night, it crashes — a memory leak, a bad deploy, a kernel hiccup. Which one hardly matters.",
      [
        appear(clock),
        shake(pod),
        wait(0.7),
        all(glowOff(pod), fadeTo(pod, 0.12, 0.6)),
      ],
    );

    s.step(
      "Nothing is watching. The next request finds an empty room — and it stays that way until a human wakes up.",
      [
        travel(rDead, 1.3, { keepAlive: true }),
        all(appear(err), seq(wait(0.3), appear(downSays))),
        wait(1.4),
      ],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 2 — the control loop (the one big idea)
   ============================================================ */

const controlLoop = scene({
  id: "control-loop",
  chapter: "The one big idea",
  question: "What if the fix wasn't a person, but a loop?",
  title: "Stop starting containers. Start declaring wishes.",
  takeaway:
    "This is the whole trick, repeated a thousand ways: you declare a desired state, a controller observes the actual state, and it acts to close the gap — continuously, forever. Self-healing isn't a feature bolted on top of Kubernetes; it's what the machine is made of.",
  nextPrompt: "But who actually runs the loop?",
  prose: [
    "The fix isn't a smarter human or a faster pager. It's a change in what you tell the computer. Instead of imperatively starting and babysitting containers — 'run this, now restart it, now run another' — you hand over a single declarative wish: I want three copies of this app running, at all times. Then you walk away.",
    "Something called a controller takes that wish and does exactly one thing, over and over: it compares. Desired state, three. Actual state, three. Match — do nothing. It is almost boringly simple, and that boredom is the point. There's no clever recovery logic to get wrong, because there's no special 'recovery' path at all.",
    "So watch what happens when a pod dies in the figure below. To the controller it isn't an emergency — it's just the two numbers disagreeing for a moment. Three wanted, two running. It schedules one more, the numbers match again, and the loop goes back to being boring. Kill another and it'll do the same thing. That's the whole idea; everything else is detail.",
  ],
  setup: (s) => {
    const { controller, field, p1, p2, p3, p2b, matchTok, gapTok, healTok } = s.cast({
      controller: node({
        x: 185,
        y: 262,
        glyph: "gear",
        label: "Controller",
        sub: "desired: 3 replicas",
        accent: "violet",
        note: "A controller is a small program running one endless loop: read the desired state, look at the actual state, and take the smallest action that moves reality toward the wish.",
      }),
      field: region({
        x: 655,
        y: 262,
        w: 300,
        h: 400,
        title: "actually running",
        accent: "dim",
        note: "The observed world: whatever pods are alive right now. The controller never trusts this to stay correct — it re-checks it constantly.",
      }),
      p1: podCard(655, 132),
      p2: podCard(655, 262),
      p3: podCard(655, 392),
      p2b: podCard(655, 262),
      matchTok: token({ x: 185, y: 392, text: "desired 3 = running 3 ✓", accent: "green" }),
      gapTok: token({ x: 185, y: 392, text: "running 2 — gap!", accent: "rose" }),
      healTok: token({ x: 185, y: 392, text: "reconciled → 3 ✓", accent: "green" }),
    });

    const w1 = s.connect(controller, p1, { bow: 60, dashed: true });
    const w2 = s.connect(controller, p2, { bow: 0, dashed: true });
    const w3 = s.connect(controller, p3, { bow: -60, dashed: true });
    const heal = s.packet(s.route(controller, p2b, { bow: 0 }), { color: "violet", label: "start a replacement" });

    s.step(
      "You declare a wish, not a procedure: three copies of this app, always. The controller writes it down.",
      [
        appear(controller),
        appear(field),
        stagger(0.2, appear(p1), appear(p2), appear(p3)),
        stagger(0.15, draw(w1, 0.5), draw(w2, 0.5), draw(w3, 0.5)),
      ],
    );

    s.step(
      "Its entire job is to compare the wish to reality. Three wanted, three running — a match. So it does nothing, happily.",
      [
        all(pulse(controller, 2.4), stagger(0.15, flash(p1), flash(p2), flash(p3))),
        seq(wait(0.4), appear(matchTok)),
        wait(0.6),
      ],
    );

    s.step(
      "Now kill one — a node reboots, a pod runs out of memory. Reality drifts: three wanted, two running.",
      [
        fadeTo(matchTok, 0, 0.3),
        shake(p2),
        wait(0.5),
        all(fadeTo(p2, 0, 0.5), fadeTo(w2, 0.15, 0.5)),
        appear(gapTok),
        wait(0.6),
      ],
    );

    s.step(
      "The gap is all it needs. It schedules a fresh pod into the hole, and the count is three again — no human, no pager.",
      [
        pulse(controller, 3.0),
        fadeTo(gapTok, 0, 0.3),
        travel(heal, 1.3),
        appear(p2b),
        all(glowOn(p2b), appear(healTok)),
        wait(1.2),
      ],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 3 — anatomy: what a single "apply" sets in motion
   ============================================================ */

const anatomy = scene({
  id: "anatomy",
  chapter: "Under the hood",
  question: "So who runs the loop — and where does it all live?",
  title: "One door in. A shared memory. Machines that never stop watching.",
  takeaway:
    "A cluster has two halves. The control plane decides — the API server is the only door in, etcd is the memory, and the scheduler and controllers are the deciders. The worker nodes do — each runs a kubelet that turns assignments into real containers. You only ever talk to the door; everything else is machines watching etcd and reconciling.",
  nextPrompt: "So what does a machine dying actually cost?",
  prose: [
    "That loop has to run somewhere, and it helps to see the cluster split cleanly in two. On one side is the control plane — the brain, where decisions are made. On the other are the worker nodes — the muscle, where your containers actually run. Almost everything interesting happens as information flows from brain to muscle.",
    "The brain has three named parts worth knowing. The API server is the only door in: every command, from you or from a controller, goes through it and nowhere else. etcd is the memory — a consistent key-value store that holds the one true record of what should exist. And the scheduler is a matchmaker, deciding which node each new pod should live on. A rule of thumb: if it isn't written in etcd, it didn't happen.",
    "Follow a single `kubectl apply` through the figure and the whole system stops feeling mysterious. Your command hits the door, gets written to memory, wakes the matchmaker, and finally a kubelet on some node turns the plan into a running container. No component ever gives another an order directly — they each just watch etcd and react. That indirection is exactly what makes the whole thing survivable.",
  ],
  setup: (s) => {
    const { kubectl, plane, api, etcd, sched, nodes, node1, node2, pod, placed } = s.cast({
      kubectl: node({
        x: 118,
        y: 118,
        glyph: "laptop",
        label: "kubectl apply",
        sub: "you, asking",
        accent: "blue",
        note: "The command line. It doesn't run anything itself — it just sends your desired state to the one endpoint that accepts changes.",
      }),
      plane: region({ x: 470, y: 268, w: 540, h: 430, title: "Control plane — the brain", accent: "dim" }),
      api: node({
        x: 355,
        y: 148,
        glyph: "server",
        label: "API server",
        sub: "the only door in",
        accent: "blue",
        note: "Every read and write goes through here. It validates the request and persists it — but it does not act on it. It just records intent.",
      }),
      etcd: node({
        x: 355,
        y: 392,
        glyph: "database",
        label: "etcd",
        sub: "the cluster's memory",
        accent: "amber",
        note: "A distributed, consistent key-value store. It holds the single source of truth for the entire cluster. Lose etcd and you lose the cluster's mind.",
      }),
      sched: node({
        x: 610,
        y: 148,
        glyph: "gear",
        label: "Scheduler",
        sub: "the matchmaker",
        accent: "violet",
        note: "Watches for pods with no assigned node, scores every node by free CPU, memory, affinity and constraints, and binds each pod to the best fit.",
      }),
      nodes: region({ x: 838, y: 268, w: 190, h: 430, title: "Worker nodes — the muscle", accent: "dim" }),
      node1: node({ x: 838, y: 208, glyph: "server", label: "Node 1", sub: "kubelet", accent: "cyan", note: "A worker machine. Its kubelet watches the API server for pods assigned to it, then tells the container runtime to actually start them." }),
      node2: node({ x: 838, y: 392, glyph: "server", label: "Node 2", sub: "kubelet", accent: "cyan", note: "Another worker. Identical role. The scheduler chose Node 1 for this pod, so Node 2 sits this one out." }),
      pod: podCard(838, 92),
      placed: token({ ...below(nodesAnchor(838, 92), 4), text: "container started ✓", accent: "green" }),
    });

    const wApi = s.connect(kubectl, api, { bow: 20, dashed: true });
    const wStore = s.connect(api, etcd, { bow: -40, dashed: true });
    const wNode = s.connect(api, node1, { bow: 55, dashed: true });

    const apply = s.packet(wApi, { color: "blue", label: "run this pod" });
    const store = s.packet(wStore, { color: "amber", label: "write desired state" });
    const scoreA = s.packet(s.route(sched, node1, { bow: 30 }), { color: "violet", label: "score" });
    const scoreB = s.packet(s.route(sched, node2, { bow: -30 }), { color: "violet", label: "score" });
    const bind = s.packet(s.route(sched, api, { bow: 60 }), { color: "violet", label: "bind → Node 1" });
    const start = s.packet(s.route(api, node1, { bow: 55 }), { color: "green", label: "kubelet: start it" });

    s.step(
      "Every change enters through exactly one door — the API server. `kubectl apply` hands it your desired state.",
      [
        appear(plane),
        all(appear(kubectl), appear(api)),
        frame([kubectl, api, etcd], { margin: 90 }),
        draw(wApi, 0.6),
        travel(apply, 1.3),
        pulse(api, 1.8),
      ],
    );

    s.step(
      "The API server doesn't act on it. It writes it to etcd — the cluster's single source of truth. If it isn't in etcd, it never happened.",
      [
        appear(etcd),
        draw(wStore, 0.5),
        travel(store, 1.2),
        flash(etcd),
        wait(0.6),
      ],
    );

    s.step(
      "The new pod has no home yet. The scheduler watches for homeless pods, scores each node, and picks the best fit.",
      [
        resetCam(),
        all(appear(sched), appear(nodes), stagger(0.2, appear(node1), appear(node2))),
        pulse(sched, 3.0),
        seq(wait(0.3), all(travel(scoreA, 0.9), travel(scoreB, 0.9))),
        travel(bind, 1.1),
        pulse(api, 1.4),
      ],
    );

    s.step(
      "On the winning node, the kubelet sees the assignment and actually starts the container. The wish is finally a running thing.",
      [
        frame([api, node1, pod], { margin: 90 }),
        draw(wNode, 0.5),
        travel(start, 1.2),
        appear(pod),
        all(glowOn(pod), appear(placed), pulse(node1, 2.0)),
        wait(1.2),
      ],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 4 — interactive: a whole machine dies, users don't notice
   ============================================================ */

const selfHealing = scene({
  id: "self-healing",
  chapter: "Why it feels like magic",
  question: "A whole machine just died. Why didn't your users notice?",
  title: "Pods are cattle. The address in front of them never moves.",
  takeaway:
    "A Service is a stable front door with a fixed address; the pods behind it are cattle, not pets — replaced freely, on any node, without the caller ever knowing. Put the reconciliation loop behind that address and losing an entire machine becomes a shrug: the survivors keep serving while replacements spin up elsewhere. Toggle the cluster above and compare.",
  nextPrompt: "Start the story again",
  prose: [
    "Two ideas from earlier now snap together into the thing that feels like magic. The reconciliation loop keeps the right number of pods alive. But pods are disposable — they get replaced, land on different machines, and receive new IP addresses every time. If your users had to know a pod's address, healing would break them constantly.",
    "So they never do. In front of the pods sits a Service: a single, stable address that never changes, even as the pods behind it come and go. Every request goes to the Service, and the Service forwards it to whatever healthy pods happen to exist at that instant. Callers talk to the front door; they have no idea — and no need to know — which particular pod answered.",
    "The figure below is interactive. It starts healthy: one Service spreading traffic across four pods on two nodes. Then flip the toggle and kill an entire node. Watch the Service quietly drop the dead pods, keep serving from the survivors, and pick up the rescheduled replacements — all behind the same address, with your users none the wiser.",
  ],
  params: {
    state: toggle("Cluster", [
      ["healthy", "Healthy"],
      ["failure", "Node fails"],
    ]),
  },
  setup: (s, p) => {
    const failing = p.state === "failure";

    const { users, svc } = s.cast({
      users: node({ x: 112, y: 262, glyph: "user", label: "Users", accent: "blue", visible: true, note: "They only ever know one address — the Service's. What runs behind it is invisible to them, by design." }),
      svc: node({
        x: 342,
        y: 262,
        glyph: "balancer",
        label: "Service",
        sub: "one stable address",
        accent: "cyan",
        visible: true,
        note: "A fixed virtual IP that never changes. It tracks the current set of healthy pods and load-balances across them, so callers never chase a moving target.",
      }),
    });

    const toUsers = s.connect(users, svc, { bow: 0, dashed: true });

    if (!failing) {
      const { a1, a2, b1, b2 } = s.cast({
        node1: node({ x: 632, y: 148, glyph: "server", label: "Node 1", accent: "cyan", visible: true }),
        node2: node({ x: 632, y: 392, glyph: "server", label: "Node 2", accent: "cyan", visible: true }),
        a1: podCard(842, 96),
        a2: podCard(842, 208),
        b1: podCard(842, 332),
        b2: podCard(842, 444),
      });

      const pods = [a1, a2, b1, b2];
      const wires = pods.map((pod, i) => s.connect(svc, pod, { bow: 40 - i * 26, dashed: true }));
      const req = s.packet(toUsers, { color: "blue", label: "GET /" });
      const fanout = pods.map((pod) => s.packet(s.route(svc, pod, { bow: 0 }), { color: "cyan" }));

      s.step(
        "Behind one Service address sit four pods across two nodes. The Service is the only thing your users ever talk to.",
        [
          stagger(0.12, appear(a1), appear(a2), appear(b1), appear(b2)),
          draw(toUsers, 0.4),
          stagger(0.1, ...wires.map((w) => draw(w, 0.4))),
        ],
      );

      s.step(
        "Every request hits the Service, which spreads it across whatever healthy pods exist right now.",
        [
          travel(req, 0.8),
          stagger(0.18, ...fanout.map((f) => travel(f, 0.8))),
          all(...pods.map((pod) => pulse(pod, 1.8))),
          wait(1.0),
        ],
        { hold: 1.0 },
      );
      return;
    }

    /* failure branch: node 2 dies; its pods reschedule onto node 1 */
    const { node1, node2, a1, a2, dead1, dead2, r1, r2, downTok } = s.cast({
      node1: node({ x: 632, y: 150, glyph: "server", label: "Node 1", accent: "cyan", visible: true }),
      node2: node({ x: 632, y: 396, glyph: "server", label: "Node 2", sub: "dead", accent: "cyan", visible: true }),
      a1: podCard(842, 84),
      a2: podCard(842, 190),
      dead1: podCard(842, 336),
      dead2: podCard(842, 448),
      r1: podCard(842, 296),
      r2: podCard(842, 408),
      downTok: token({ ...below(nodesAnchor(632, 396), 8), text: "Node 2 lost", accent: "rose" }),
    });

    const survivors = [a1, a2];
    const survivorWires = survivors.map((pod, i) => s.connect(svc, pod, { bow: 30 - i * 20, dashed: true }));
    const req = s.packet(toUsers, { color: "blue", label: "GET /" });
    const fanoutOk = survivors.map((pod) => s.packet(s.route(svc, pod, { bow: 0 }), { color: "cyan" }));
    const healWires = [r1, r2].map((pod, i) => s.connect(node1, pod, { bow: -20 + i * 12, dashed: true }));
    const reschedule = [r1, r2].map((pod) => s.packet(s.route(node1, pod, { bow: 0 }), { color: "violet", label: "reschedule" }));
    const fanoutNew = [r1, r2].map((pod) => s.packet(s.route(svc, pod, { bow: 0 }), { color: "cyan" }));

    s.step(
      "Same cluster, now under stress. Then Node 2 dies outright — power, kernel, hardware — and both of its pods vanish with it.",
      [
        stagger(0.1, appear(a1), appear(a2), appear(dead1), appear(dead2)),
        draw(toUsers, 0.4),
        stagger(0.1, ...survivorWires.map((w) => draw(w, 0.4))),
        wait(0.3),
        shake(node2),
        wait(0.5),
        all(dim(node2), fadeTo(dead1, 0, 0.5), fadeTo(dead2, 0, 0.5), appear(downTok)),
      ],
    );

    s.step(
      "The Service simply stops routing to the dead pods and keeps serving from the survivors. Your users see nothing.",
      [
        travel(req, 0.7),
        stagger(0.2, ...fanoutOk.map((f) => travel(f, 0.8))),
        all(pulse(a1, 1.8), pulse(a2, 1.8)),
        wait(0.8),
      ],
    );

    s.step(
      "Meanwhile the controller notices two pods missing and reschedules them — here, onto Node 1. New pods, new IPs.",
      [
        pulse(node1, 3.0),
        stagger(0.15, ...healWires.map((w) => draw(w, 0.4))),
        stagger(0.2, ...reschedule.map((m) => travel(m, 0.9))),
        stagger(0.15, appear(r1), appear(r2)),
        all(glowOn(r1), glowOn(r2)),
      ],
    );

    s.step(
      "Same address, different pods, zero downtime. Pods are disposable; the Service in front of them is forever.",
      [
        travel(req, 0.7),
        stagger(0.18, ...fanoutNew.map((f) => travel(f, 0.8))),
        all(pulse(r1, 1.8), pulse(r2, 1.8), glowOn(svc)),
        wait(1.2),
      ],
      { hold: 1.2 },
    );
  },
});

/* ============================================================ */

export default defineStory({
  ...meta,
  scenes: [oneServer, controlLoop, anatomy, selfHealing],
  outro: [
    "Strip away the vocabulary and Kubernetes is one small idea taken seriously: never tell the computer what to do — tell it what you want, and let a loop close the gap forever. A pod dies, the numbers disagree, the loop fixes it. A node dies, more numbers disagree, the loop fixes that too. There is no separate 'disaster recovery' mode because, from the loop's point of view, a disaster and an ordinary Tuesday look exactly the same.",
    "That's also why the parts are shaped the way they are. One door in (the API server) so every change is recorded and ordered. One memory (etcd) so there's a single truth to reconcile against. Stable Services in front of disposable pods so healing never breaks the caller. None of it is magic — it's delegation and comparison, the same two ideas that quietly run most robust systems, arranged so that the 3 A.M. crash from the first scene resolves itself before anyone's phone even buzzes.",
  ],
});

/* ---------------- small local helpers ---------------- */

/** A pod is just a node with the container glyph and a consistent look. */
function podCard(x: number, y: number) {
  return node({
    x,
    y,
    w: 132,
    glyph: "box",
    label: "pod",
    sub: "your-app",
    accent: "green",
    note: "A pod wraps one (or a few tightly-coupled) containers. It's the smallest thing Kubernetes schedules — and the smallest thing it will happily throw away and recreate.",
  });
}

/** A one-line speech bubble anchored below an actor. */
function bubbleBelow(ref: Parameters<typeof below>[0], lines: string[]) {
  return bubble({ ...below(ref, 84), w: 210, lines, accent: "blue" });
}

/** A point below a pod card placed at (x, y) — pods use a shorter box. */
function nodesAnchor(x: number, y: number) {
  return { x, y: y + 42 };
}
