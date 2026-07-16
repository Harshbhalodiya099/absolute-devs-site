/**
 * "Where your code actually runs" — the deployment ladder.
 *
 * Not a tour of release strategies (rolling / canary) but of runtimes: how the
 * same app climbs from a hand-built VM, to a portable Docker image, to a
 * self-healing Kubernetes cluster — and why a static SPA and a stateful
 * database end up in two completely different homes.
 */
import {
  all,
  appear,
  below,
  crash,
  defineStory,
  definePreset,
  dim,
  draw,
  enter,
  fadeTo,
  flash,
  glowOn,
  grid,
  node,
  pulse,
  region,
  rightOf,
  scene,
  seq,
  shake,
  spot,
  stagger,
  toggle,
  token,
  v,
  wait,
} from "../../engine";
import { meta } from "./meta";

/* ============================================================
   Scene 1 — a bare virtual machine
   ============================================================ */

const bareVm = scene({
  id: "bare-vm",
  chapter: "Climbing the ladder",
  question: "It runs on your laptop. How does the rest of the world reach it?",
  title: "Rent a computer that never sleeps.",
  takeaway:
    "A virtual machine is a computer in someone's datacenter, rented by the hour. You SSH in, install the runtime by hand, copy your code up, and open a port — and now the world can reach it. Dead simple to picture, but you own everything: OS patches, the drift between your laptop and the server, and the 3 A.M. crash that stays down until you wake up.",
  nextPrompt: "How do I make it run the same everywhere?",
  prose: [
    "Your code works. It works on your laptop, which is the one machine on Earth where it is guaranteed to work, because your laptop is exactly the computer you built it on. The moment you want anyone else to use it, you hit the oldest problem in shipping software: your laptop goes to sleep, gets closed, rides the train home. A thing the public depends on cannot do that. It needs a computer that is always on.",
    "The most direct answer is to rent one. A virtual machine is a sliver of a real server in a datacenter, handed to you as if it were a whole computer — you get an IP address and a root login. So you SSH in and set it up the way you'd set up any fresh machine: install the language runtime, copy your code across, install the dependencies, start the process, open a firewall port. Point a domain at the IP and, genuinely, you have shipped.",
    "It's the clearest mental model there is, which is exactly why it's worth starting here. It's also the one where every future problem is born. You built this server by hand, which means no two servers you build are quite alike. The OS needs patching and that's your job now. And when the process dies at 3 A.M. — out of memory, unhandled exception, a full disk — nothing brings it back. The lights just stay off until you notice.",
  ],
  setup: (s) => {
    const { laptop, vm, users } = s.cast({
      laptop: v.browser({
        ...spot("left"),
        label: "Your laptop",
        sub: "code that works",
        note: "The one machine where your app is guaranteed to run — because it's the machine you built it on.",
      }),
      vm: v.server({
        x: 510,
        y: 260,
        w: 176,
        label: "Virtual machine",
        sub: "rented by the hour",
        note: "A sliver of a real server, handed to you as a whole computer: an IP address and a root login. You own everything above the bare metal.",
      }),
      users: v.users({
        ...spot("right"),
        sub: "the whole world",
        accent: "violet",
        note: "They reach your app by its public IP or domain name — as long as the process behind it is alive.",
      }),
    });

    const setup = s.connect(laptop, vm, { bow: 60, dashed: true });
    const serve = s.connect(vm, users, { bow: -40 });

    const { install, copy, run, crashTok } = s.cast({
      install: token({ x: 510, y: 150, text: "install runtime", accent: "cyan" }),
      copy: token({ x: 510, y: 118, text: "copy code", accent: "cyan" }),
      run: token({ x: 510, y: 372, text: "open port :443", accent: "cyan" }),
      crashTok: token({ ...below(vm, 96), text: "crash → still down", accent: "rose" }),
    });

    s.step("It all starts on the one computer where your code is certain to run: the machine you wrote it on.", [
      appear(laptop),
      pulse(laptop, 1.6),
    ]);

    s.step("So you rent a virtual machine, SSH in, and set it up by hand — runtime, code, an open port.", [
      appear(vm),
      draw(setup, 0.7),
      setup.send({ label: "ssh + scp", dur: 1.3 }),
      flash(vm),
      stagger(0.18, appear(copy), appear(install), appear(run)),
      all(fadeTo(copy, 0.45), fadeTo(install, 0.45), fadeTo(run, 0.45)),
    ]);

    s.step("Point a domain at its address and you've genuinely shipped — the world hits it and your app answers.", [
      appear(users),
      draw(serve, 0.6),
      serve.reply({ color: "violet", label: "GET /", dur: 1.1 }),
      all(pulse(vm, 1.8), seq(wait(0.4), serve.send({ color: "green", label: "200 OK", dur: 1.1 }), glowOn(users))),
    ]);

    s.step(
      "But you own all of it — patches, configuration drift, and the crash at 3 A.M. that stays down until you wake up.",
      [appear(crashTok), all(shake(vm), dim(vm), pulse(crashTok, 2.2)), wait(1.4)],
      { hold: 1.0 },
    );
  },
});

/* ============================================================
   Scene 2 — a Docker image
   ============================================================ */

const dockerImage = scene({
  id: "docker-image",
  chapter: "Climbing the ladder",
  question: "How do I make it run the same everywhere?",
  title: "Ship the whole kitchen, not just the recipe.",
  takeaway:
    "A Docker image packs your code together with its exact libraries, runtime, and a slice of the operating system into one immutable artifact. Build it once, push it to a registry, and anyone can pull that exact image and run it — a server, a laptop, a CI runner — and get identical behaviour. The unit you deploy is no longer instructions to reproduce an environment; it's the environment itself.",
  nextPrompt: "One container is easy — what about a hundred that heal themselves?",
  prose: [
    "The rot in the hand-built server is drift. Your laptop has Node 20 and a certain OpenSSL; the server drifted to Node 18 and a different one; a colleague is on something else again. Each is a machine assembled by hand at a different moment, so 'works on my machine' isn't a joke — it's a precise statement that the environment, not the code, is what differs. Fix that and you fix a whole category of 3 A.M. surprises.",
    "Docker's move is to stop shipping instructions and start shipping the result. `docker build` reads a short recipe and produces an image: your code, its dependencies, the language runtime, and a thin slice of the operating system, frozen together into one immutable, content-addressed artifact. It isn't a description of an environment. It is the environment, packed into a file.",
    "You push that image to a registry — Docker Hub, ECR, GHCR — once. From then on, running your app anywhere is a `docker pull` and a `docker run`. The bits that execute on the production server are the exact same bits that ran on your laptop and in CI, byte for byte. You still need somewhere to run the container, and that's the next rung — but the thing you deploy is now perfectly reproducible.",
  ],
  setup: (s) => {
    const { laptop, image, registry, server, teammate } = s.cast({
      laptop: v.browser({
        ...spot("left"),
        label: "Build machine",
        sub: "docker build",
        note: "Reads a Dockerfile — a short recipe — and produces an image. Run once, not on every deploy.",
      }),
      image: node({
        x: 440,
        y: 150,
        w: 190,
        glyph: "box",
        label: "Image",
        sub: "code + libs + OS",
        accent: "amber",
        note: "One immutable, content-addressed artifact. Not a description of an environment — the environment itself, frozen.",
      }),
      registry: node({
        x: 440,
        y: 390,
        w: 190,
        glyph: "cloud",
        label: "Registry",
        sub: "Docker Hub · ECR",
        accent: "violet",
        note: "A shared store for images. Push once; pull anywhere. The image's digest guarantees you get the exact same bits.",
      }),
      server: v.server({
        x: 790,
        y: 150,
        label: "Prod server",
        sub: "docker run",
        note: "Any host with a container runtime. It doesn't need your language installed — the image already carries it.",
      }),
      teammate: v.browser({
        x: 790,
        y: 390,
        label: "CI runner",
        sub: "same image",
        accent: "green",
        note: "The bits that run here are byte-for-byte the bits that ran in prod. 'Works on my machine' stops being possible.",
      }),
    });

    const build = s.connect(laptop, image, { bow: -20, dashed: true });
    const store = s.connect(image, registry, { bow: 0, dashed: true });
    const pulls = s.fanout(registry, [server, teammate], { dashed: true, bowSpread: -60 });

    const { same } = s.cast({
      same: token({ x: 790, y: 270, text: "identical bits", accent: "green" }),
    });

    s.step("The rot in a hand-built server is drift: two machines assembled by hand are never quite the same.", [
      appear(laptop),
      pulse(laptop, 1.6),
    ]);

    s.step("`docker build` freezes your code, its libraries, and a slice of the OS into one immutable image.", [
      appear(image),
      draw(build, 0.6),
      build.send({ color: "amber", label: "build", dur: 1.1 }),
      all(flash(image), pulse(image, 1.8)),
    ]);

    s.step("You push that image to a registry once — a single, content-addressed artifact anyone can fetch.", [
      appear(registry),
      draw(store, 0.6),
      store.send({ color: "violet", label: "push", dur: 1.0 }),
      flash(registry),
    ]);

    s.step(
      "Then any host pulls the exact same image and runs it — server, laptop, CI — with no more 'works on my machine'.",
      [
        enter([server, teammate], 0.2),
        pulls.draw({ gap: 0.2, dur: 0.5 }),
        all(pulls.wires[0].send({ color: "cyan", label: "pull", dur: 1.1 }), seq(wait(0.3), pulls.wires[1].send({ color: "green", label: "pull", dur: 1.1 }))),
        all(glowOn(server), glowOn(teammate), appear(same)),
        wait(1.2),
      ],
      { hold: 1.0 },
    );
  },
});

/* ============================================================
   Scene 3 — a Kubernetes cluster
   ============================================================ */

const kubernetes = scene({
  id: "kubernetes",
  chapter: "Climbing the ladder",
  question: "One container is easy — what about a hundred that heal themselves?",
  title: "Hand the cluster a wish, not a to-do list.",
  takeaway:
    "Kubernetes runs your image across a fleet of machines. You don't launch containers by hand — you declare desired state (\"five replicas of this image\") and a controller makes reality match: it schedules pods across nodes, load-balances traffic, and when a pod or a whole machine dies, it notices the gap and fills it. You stop tending servers and start describing what you want.",
  nextPrompt: "But not everything is a server — where does a website, or a database, live?",
  prose: [
    "One container is a solved problem: `docker run` and walk away. Real systems aren't one container. They're many copies of your app for capacity, spread across several machines so one failure isn't total, wired to a load balancer, and — the hard part — expected to recover on their own at 3 A.M. Doing that by hand means writing exactly the babysitting scripts that Kubernetes already is.",
    "The shift Kubernetes asks of you is to stop giving orders and start declaring intent. You don't say 'start a container here, another there.' You hand it a wish: I want five replicas of this image, reachable on this port. That desired state is stored, and a control loop compares it against what's actually running, forever — the same idea underneath everything Kubernetes does.",
    "From that one idea, the magic falls out. Kubernetes schedules the five pods across nodes and load-balances traffic to them. A pod crashes and now four are running against five wanted — the loop sees the gap and starts a replacement. A whole node dies, taking its pods with it; the same comparison reschedules them elsewhere. There is no special 'disaster' mode: a catastrophe and an ordinary Tuesday look identical to a loop whose only job is to close the gap.",
  ],
  setup: (s) => {
    const { image, deploy, users } = s.cast({
      image: node({
        x: 150,
        y: 120,
        w: 150,
        glyph: "box",
        label: "Your image",
        accent: "amber",
        note: "The same immutable artifact from the last rung. Kubernetes runs copies of it — it doesn't care what's inside.",
      }),
      deploy: v.controller({
        x: 150,
        y: 360,
        w: 168,
        label: "Deployment",
        sub: "desired: 5 replicas",
        accent: "cyan",
        note: "Your declared intent, stored in the cluster. A control loop compares it against reality without stopping.",
      }),
      users: v.users({
        x: 150,
        y: 240,
        accent: "violet",
        note: "Traffic enters through a load balancer that spreads requests across whichever pods are currently healthy.",
      }),
    });

    const cluster = s.add(region({ x: 620, y: 265, w: 440, h: 370, title: "Cluster · nodes", accent: "ink" }));

    const slots = grid({ at: { x: 630, y: 262 }, cols: 3, rows: 2, gapX: 120, gapY: 175 });
    const mini = (pt: { x: number; y: number }) =>
      v.pod({ ...pt, w: 96, h: 52, note: "One running copy of your image." });
    const { p1, p2, p3, p4, p5, p6 } = s.cast({
      p1: mini(slots[0]),
      p2: mini(slots[1]),
      p3: mini(slots[2]),
      p4: mini(slots[3]),
      p5: mini(slots[4]),
      p6: mini(slots[5]),
    });

    const wImage = s.connect(image, deploy, { bow: 0, dashed: true });
    const wWish = s.connect(deploy, cluster, { bow: 30, dashed: true });
    const wTraffic = s.connect(users, cluster, { bow: -10 });

    s.step("Real systems aren't one container — they're many copies, on many machines, expected to recover on their own.", [
      appear(image),
      appear(deploy),
      draw(wImage, 0.6),
      pulse(deploy, 1.6),
    ]);

    s.step("You never launch them by hand. You hand Kubernetes a wish: five replicas of this image.", [
      draw(wWish, 0.6),
      wWish.send({ color: "cyan", label: "desired: 5", dur: 1.1 }),
      appear(cluster),
      enter([p1, p2, p3, p4, p5], 0.14),
      all(glowOn(p1), glowOn(p2), glowOn(p3), glowOn(p4), glowOn(p5)),
    ]);

    s.step("It schedules them across nodes and load-balances traffic in — you've stopped tending servers.", [
      appear(users),
      draw(wTraffic, 0.6),
      wTraffic.send({ color: "violet", label: "traffic", dur: 1.2 }),
      pulse(cluster, 1.8),
    ]);

    s.step(
      "A pod dies. The loop sees five wanted, four running — and fills the gap before anyone notices.",
      [crash(p3, { remains: 0.06 }), pulse(deploy, 2.0), wait(0.3), appear(p6), glowOn(p6), wait(1.2)],
      { hold: 1.0 },
    );
  },
});

/* ============================================================
   Scene 4 — the fork: static SPA vs. stateful DB (interactive)
   ============================================================ */

/** A CDN edge location — a story-local preset, defined once. */
const edge = definePreset({
  glyph: "cloud",
  label: "Edge",
  sub: "edge cache",
  accent: "cyan",
  w: 132,
  h: 66,
  note: "A CDN edge location. Holds a copy of the bundle so nearby users never touch your origin.",
});

const twoHomes = scene({
  id: "two-homes",
  chapter: "The fork in the road",
  question: "Not everything is a server — where does a website, or a database, actually live?",
  title: "Two things you're deploying, two completely different homes.",
  takeaway:
    "A single-page app is stateless: pure files with no server logic, so it lives on a CDN — copied to edge locations worldwide, served from the nearest one in milliseconds, scaling to millions for almost nothing. A database is the exact opposite: all state, one source of truth, pinned to a persistent disk that must survive every reboot. You can't casually clone it or scale it to zero. Frontend, backend, and data each want a different kind of home — match the host to the thing.",
  nextPrompt: "So which rung do you climb to?",
  prose: [
    "The whole ladder so far assumed you're deploying a running program — a process that answers requests. But two of the most common things you deploy aren't that shape at all, and forcing them onto a plain server is where a lot of cost and pain come from. Flip the control below between the two and watch how differently they want to live.",
    "A single-page app, once built, is just files: HTML, JavaScript, CSS. There is no server-side logic to execute — the logic runs in the user's browser. So the ideal home isn't a server at all; it's a CDN. You copy the built bundle to edge locations scattered across the planet, and every visitor is served from the one nearest them, in milliseconds. It scales to millions of users essentially for free, because serving a static file is the cheapest thing the internet does.",
    "A database is the mirror image. It is nothing but state — the one authoritative copy of your data — and state cannot be casually duplicated the way a stateless app can. Writes must funnel to a single primary; every byte has to survive a reboot on a persistent disk; read replicas and backups exist precisely because this box is irreplaceable. It can't scale to zero and you can't run ten identical copies. It's the opposite discipline from the SPA, which is exactly why they belong in different homes.",
  ],
  params: {
    serving: toggle("Serving", [
      ["spa", "A single-page app"],
      ["db", "A database"],
    ]),
  },
  setup: (s, p) => {
    if (p.serving === "spa") {
      const { bundle } = s.cast({
        bundle: node({
          ...spot("left"),
          w: 168,
          glyph: "doc",
          label: "Static bundle",
          sub: "HTML · JS · CSS",
          accent: "amber",
          note: "The built output of your SPA. No server logic — all the code runs later, in the user's browser.",
        }),
      });

      const { e1, e2, e3, e4, visitor, cost } = s.cast({
        e1: edge({ x: 520, y: 120, label: "Frankfurt" }),
        e2: edge({ x: 800, y: 190, label: "Mumbai" }),
        e3: edge({ x: 520, y: 410, label: "São Paulo" }),
        e4: edge({ x: 800, y: 380, label: "Tokyo" }),
        visitor: v.users({
          x: 300,
          y: 430,
          label: "A visitor",
          accent: "violet",
          note: "Served from the closest edge — not from your build machine, which may be a continent away.",
        }),
        cost: token({ x: 520, y: 265, text: "scales to millions · ~$0", accent: "green" }),
      });

      const cdn = s.fanout(bundle, [e1, e2, e3, e4], { dashed: true });
      const serve = s.connect(visitor, e3, { bow: 20 });

      s.step("A single-page app, once built, is just files — there's no server-side logic to run.", [
        appear(bundle),
        pulse(bundle, 1.6),
      ]);

      s.step("So you copy that bundle to a CDN: the same files cached at edge locations around the planet.", [
        enter([e1, e2, e3, e4], 0.14),
        cdn.draw({ gap: 0.1, dur: 0.5 }),
        cdn.send({ color: "cyan", gap: 0, dur: 1.0 }),
      ]);

      s.step(
        "Every visitor is served from the nearest edge in milliseconds — it scales to millions for almost nothing.",
        [
          appear(visitor),
          draw(serve, 0.5),
          serve.reply({ color: "green", label: "12 ms", dur: 0.9 }),
          all(glowOn(visitor), pulse(e3, 1.8), appear(cost)),
          wait(1.2),
        ],
        { hold: 1.0 },
      );
      return;
    }

    /* p.serving === "db" */
    const { app, primary, disk } = s.cast({
      app: v.server({
        ...spot("left"),
        label: "Your app",
        sub: "reads + writes",
        note: "Every write in your whole system funnels down to one place.",
      }),
      primary: v.database({
        x: 500,
        y: 200,
        w: 170,
        label: "Primary",
        sub: "source of truth",
        accent: "green",
        note: "The single authoritative copy. Writes go here and only here — there is exactly one.",
      }),
      disk: node({
        x: 500,
        y: 400,
        w: 170,
        glyph: "doc",
        label: "Persistent disk",
        sub: "survives reboots",
        accent: "amber",
        note: "State lives on durable storage. Lose this and you lose the data — the whole point of the box.",
      }),
    });

    const { r1, r2, backup, warn } = s.cast({
      r1: v.database({
        x: 820,
        y: 130,
        w: 150,
        label: "Read replica",
        accent: "cyan",
        note: "A near-copy that serves reads to spread load. It cannot accept writes — those still go to the primary.",
      }),
      r2: v.database({
        x: 820,
        y: 290,
        w: 150,
        label: "Read replica",
        accent: "cyan",
        note: "More replicas share read traffic, but none of them is the source of truth.",
      }),
      backup: node({
        x: 820,
        y: 430,
        w: 150,
        glyph: "box",
        label: "Backups",
        accent: "violet",
        note: "Point-in-time copies. When the irreplaceable box fails, this is the only way back.",
      }),
      warn: token({ ...rightOf(app, 8), text: "can't scale to zero", accent: "rose" }),
    });

    const write = s.connect(app, primary, { bow: -20 });
    const persist = s.connect(primary, disk, { bow: 0 });
    const guard = s.fanout(primary, [r1, r2, backup], { dashed: true, bowSpread: -45 });

    s.step("A database is the opposite of a static app: it's nothing but state, with one source of truth.", [
      appear(app),
      appear(primary),
      draw(write, 0.6),
      write.send({ color: "cyan", label: "write", dur: 1.0 }),
      all(flash(primary), pulse(primary, 1.8)),
    ]);

    s.step("Writes funnel to a single primary, and every byte must survive a reboot on a persistent disk.", [
      appear(disk),
      draw(persist, 0.6),
      all(glowOn(disk), pulse(disk, 1.6)),
    ]);

    s.step(
      "Read replicas share the load and backups guard the data — but this box is precious: clone it carelessly and truth splits.",
      [
        enter([r1, r2, backup], 0.16),
        guard.draw({ gap: 0.12, dur: 0.5 }),
        appear(warn),
        all(pulse(primary, 2.0), pulse(warn, 2.0)),
        wait(1.2),
      ],
      { hold: 1.0 },
    );
  },
});

/* ============================================================ */

export default defineStory({
  ...meta,
  scenes: [bareVm, dockerImage, kubernetes, twoHomes],
  outro: [
    "So the ladder, top to bottom: a virtual machine gives you a whole computer and total control, at the price of assembling and babysitting it by hand. A Docker image trades that hand-built fragility for a reproducible artifact — the same bits everywhere — but still needs a host to run on. Kubernetes runs those images across a fleet and heals them automatically, at the price of real operational complexity. Each rung buys you something and charges you for it; you climb only as far as your problem actually needs.",
    "And the fork matters as much as the ladder. Before you reach for any of it, ask what you're deploying. A stateless thing — a single-page app, static assets, anything that just answers with the same files — wants a CDN, where scaling is free and there's nothing to heal. A stateful thing — a database, a queue, anything that must remember — wants a managed, backed-up home built around a single source of truth. Most real systems are several of these at once: a static frontend on the edge, stateless services in containers, and a stateful database guarded like treasure. Good deployment is mostly just putting each piece in the home that fits it.",
  ],
  references: [
    {
      kind: "article",
      title: "How Containers Work (Julia Evans)",
      url: "https://wizardzines.com/zines/containers/",
      note: "A zine that demystifies the namespaces and cgroups hiding behind the shipping-container metaphor.",
    },
    {
      kind: "video",
      title: "Docker Crash Course (TechWorld with Nana)",
      url: "https://www.youtube.com/watch?v=3c-iBn73dDE",
      note: "Hands-on with images, containers, and the developer workflow this story showed from above.",
    },
    {
      kind: "docs",
      title: "Docker: What is a container?",
      url: "https://www.docker.com/resources/what-container/",
      note: "Docker's own definition, with the container-versus-VM comparison made precise.",
    },
    {
      kind: "article",
      title: "The Twelve-Factor App",
      url: "https://12factor.net",
      note: "The classic checklist for building an app that can live happily in any of these homes.",
    },
  ],
});
