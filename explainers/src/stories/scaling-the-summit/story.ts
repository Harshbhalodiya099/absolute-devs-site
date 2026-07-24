/**
 * "Scaling the summit" — how a web app grows from one box to millions of users.
 *
 * The visual law of this story: THE APP TIER IS CHEAP, THE DATA TIER IS THE WALL.
 * App servers are interchangeable cards you add freely once they hold no state;
 * every hard beat happens at the database — cache in front of it, replicas beside
 * it, shards splitting it. The teaching knob in the final scene makes the honest
 * trade explicit: a bigger box stays one growing card that eventually redlines,
 * while more boxes rebuild the whole cast tier by tier.
 */
import { E } from "../../engine";
import { meta } from "./meta";

/* ---------------- story-local vocabulary ---------------- */

/* A read-only copy of the database. Same glyph as a database, dimmed, because
   it is a follower, not a source of truth. */
const replica = E.definePreset({
  glyph: "database",
  label: "replica",
  accent: "dim",
  w: 150,
  note: "A read-only copy of the database. It answers reads to take load off the primary, but every write must still go to the primary and stream down to it — so replicas scale reads, never writes.",
});

/* One partition of the data, owning a range of keys. */
const shard = E.definePreset({
  glyph: "database",
  label: "shard",
  accent: "blue",
  w: 150,
  note: "One partition of the data that owns a range of keys. A write for those keys goes here and nowhere else — which is finally how writes scale past a single machine, at the cost of coordinating who owns what.",
});

const USERS_NOTE =
  "Real people hitting your app. They don't know or care how many machines you run — only whether the page loads, and how fast.";
const STATELESS_NOTE =
  "An app server that keeps no memory of who you are between requests. Because any copy can answer any request, the load balancer is free to send traffic anywhere — this is the property that makes 'more boxes' possible.";

/* fixed seats reused across scenes so the flow reads left-to-right, always */
const USERS = { x: 110, y: 262 };

/* ============================================================
   Scene 1 — one box (the pain)
   ============================================================ */

const oneBox = E.scene({
  id: "one-box",
  chapter: "Base camp",
  question: "You shipped it and people came. What actually breaks first when a crowd shows up?",
  title: "One box serves everyone — right up until it can't.",
  takeaway:
    "Almost everything starts as a single server talking to a single database, and for a long time that is exactly right — simplicity is a feature. What breaks first is rarely the code: it's capacity. One machine has a fixed ceiling of CPU, memory, and connections, and when the crowd exceeds it the box doesn't fail politely — it slows to a crawl and starts refusing requests. Everything that follows is a different answer to the same question: how do you serve more people than one machine can?",
  nextPrompt: "So do you buy a bigger box, or more boxes?",
  setup: (s) => {
    const { users, app, db } = s.cast({
      users: E.v.users({ ...USERS, sub: "a handful, then a crowd", note: USERS_NOTE }),
      app: E.v.server({
        x: 470,
        y: 262,
        label: "app server",
        sub: "1 box · handles it all",
        note: "Your application, running on one machine. Every request — page, login, checkout — is served here, and every request competes for the same finite CPU and memory.",
      }),
      db: E.v.database({
        x: 790,
        y: 262,
        sub: "the one source of truth",
        note: "Where all the durable state lives: users, orders, sessions. One server can answer a lot of queries — until it can't, and then everything above it waits.",
      }),
    });

    const toApp = s.connect(users, app, { bow: 34, dashed: true });
    const toDb = s.connect(app, db, { bow: -20, dashed: true });

    s.step("At the start it's the whole architecture: users hit one app server, which reads and writes one database.", [
      E.enter([users, app, db], 0.2),
      E.draw(toApp),
      E.draw(toDb),
      E.all(toApp.send({ label: "GET /", dur: 1.0 }), E.seq(E.wait(0.4), toDb.send({ color: "amber", label: "query", dur: 0.9 }))),
    ]);

    s.step("For a real while, this is genuinely enough — and there is nothing wrong with it being simple.", [
      E.all(E.pulse(app, 2.4), E.pulse(db, 2.4)),
      E.seq(toApp.send({ label: "GET /", dur: 0.9 }), toApp.send({ label: "GET /", dur: 0.9 })),
    ]);

    const { load, err } = s.cast({
      load: E.token({ ...E.above(app, 60), text: "traffic ↑↑↑", accent: "amber" }),
      err: E.token({ ...E.below(app, 62), text: "503 · out of capacity", accent: "rose" }),
    });

    s.step("Then the crowd arrives faster than one machine can answer, and the box runs out of CPU and connections.", [
      E.appear(load),
      E.all(E.shake(app), E.pulse(app, 2.6)),
      E.seq(toApp.send({ color: "rose", label: "GET /", dur: 1.1, keepAlive: true }), E.appear(err)),
    ]);

    s.step(
      "One machine has one ceiling; past it, requests don't slow gracefully, they get refused — so the whole game is serving more than one box can.",
      [E.all(E.pulse(app, 2.2), E.pulse(err, 2.2)), E.wait(1.0)],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 2 — bigger box vs more boxes (the fork + statelessness)
   ============================================================ */

const theFork = E.scene({
  id: "the-fork",
  chapter: "The fork in the trail",
  question: "More capacity — sure. But do you grow the one machine, or add machines beside it?",
  title: "A bigger box has a ceiling. More boxes need your app to forget you.",
  takeaway:
    "There are exactly two directions. Scaling vertically means a bigger box: dead simple, but it hits a hard ceiling and stays a single point of failure — one crash is still a full outage. Scaling horizontally means more boxes behind a load balancer: it scales far past any single machine and adds redundancy, but it only works if the app is stateless. If any server can answer any request, traffic sprays freely; if a server 'remembers' your session, you're pinned to it and horizontal scaling breaks. Statelessness is the price of admission — move session out of the app and into shared state.",
  nextPrompt: "Now every read still lands on the same database. Can we make reads cheap?",
  setup: (s) => {
    const { users, box, db } = s.cast({
      users: E.v.users({ ...USERS, note: USERS_NOTE }),
      box: E.v.server({
        x: 470,
        y: 262,
        label: "app server",
        sub: "one machine",
        note: "The single box from base camp. The first instinct is to make this one thing bigger; the more durable instinct is to make more of it.",
      }),
      db: E.v.database({ x: 800, y: 262, sub: "shared state", note: "Still the one database. Both strategies keep it — for now." }),
    });
    const toBox = s.connect(users, box, { bow: 34, dashed: true });
    const boxDb = s.connect(box, db, { bow: -20, dashed: true });

    s.step("Start from the one box again, and take the first, obvious option: make it bigger.", [
      E.enter([users, box, db], 0.18),
      E.draw(toBox),
      E.draw(boxDb),
      toBox.send({ label: "GET /", dur: 0.9 }),
    ]);

    const { grow, ceil } = s.cast({
      grow: E.token({ ...E.above(box, 60), text: "vertical · +CPU +RAM", accent: "cyan" }),
      ceil: E.token({ ...E.below(box, 62), text: "one crash = full outage", accent: "rose" }),
    });

    s.step("Vertical scaling works and buys real headroom — but it's still one machine, so one crash is still a full outage.", [
      E.appear(grow),
      E.pulse(box, 2.4),
      E.appear(ceil),
    ]);

    /* pivot to horizontal: the one box becomes a balancer + a fleet */
    const { lb, app1, app2 } = s.cast({
      lb: E.v.loadBalancer({
        x: 330,
        y: 262,
        sub: "sprays traffic",
        note: "Sits in front of the fleet, spreads each request across the healthy app servers (round-robin or least-connections), and quietly drops any box that stops answering health checks.",
      }),
      app1: E.v.server({ x: 570, y: 160, label: "app · A", sub: "stateless", note: STATELESS_NOTE }),
      app2: E.v.server({ x: 570, y: 364, label: "app · B", sub: "stateless", note: STATELESS_NOTE }),
    });

    const toLb = s.connect(users, lb, { bow: 0, dashed: true });
    const fan = s.fanout(lb, [app1, app2], { dashed: true, bowSpread: 52 });
    const dbA = s.connect(app1, db, { bow: 22, dashed: true });
    const dbB = s.connect(app2, db, { bow: -22, dashed: true });

    s.step("The other direction: put a load balancer in front and add identical boxes beside the first.", [
      E.all(E.fadeTo(grow, 0, 0.3), E.fadeTo(ceil, 0, 0.3), E.fadeTo(toBox, 0, 0.3), E.fadeTo(boxDb, 0, 0.3), E.vanish(box)),
      E.appear(lb),
      E.draw(toLb),
      E.enter([app1, app2], 0.18),
    ]);

    s.step("It only works because the apps are stateless — any box can answer any request, so the balancer sends traffic anywhere.", [
      fan.draw({ gap: 0.14, dur: 0.5 }),
      E.all(E.draw(dbA), E.draw(dbB)),
      fan.send({ color: "cyan", label: "GET /", gap: 0.16, dur: 0.9 }),
    ]);

    const { rule } = s.cast({
      rule: E.token({ ...E.below(db, 66), text: "session lives here, not in the app", accent: "green" }),
    });

    s.step(
      "The catch: session state must move out of the app into shared storage — statelessness is the price of scaling out.",
      [E.appear(rule), E.all(dbA.send({ color: "amber", label: "session", dur: 0.9 }), dbB.send({ color: "amber", label: "session", dur: 0.9 })), E.pulse(db, 2.2), E.wait(0.9)],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 3 — the cache (reads get cheap)
   ============================================================ */

const theCache = E.scene({
  id: "the-cache",
  chapter: "A cache near the summit",
  question: "You can add app servers all day — but they all still hammer the one database. What gives?",
  title: "Most traffic is reads, and the same reads over and over.",
  takeaway:
    "Adding app servers just moves the pressure downstream: they all read from the same database, and reads are the overwhelming majority of most traffic — the same popular rows, fetched again and again. A cache in front of the database is the single highest-leverage move in scaling. A read checks the cache first; on a hit it never touches the database at all, and only a miss falls through. Suddenly the database serves a fraction of the reads it used to, and the whole system breathes. Caching doesn't remove the database bottleneck — it starves it of the easy work so it can survive the hard work.",
  nextPrompt: "Reads are cheap now. But what about the writes?",
  setup: (s) => {
    const { users, lb, app1, app2, cache, db } = s.cast({
      users: E.v.users({ ...USERS, note: USERS_NOTE }),
      lb: E.v.loadBalancer({ x: 300, y: 262, sub: "sprays traffic", note: "The same front door: spreads requests across the stateless fleet." }),
      app1: E.v.server({ x: 500, y: 160, label: "app · A", sub: "stateless", note: STATELESS_NOTE }),
      app2: E.v.server({ x: 500, y: 364, label: "app · B", sub: "stateless", note: STATELESS_NOTE }),
      cache: E.v.cache({
        x: 700,
        y: 150,
        sub: "hot reads, in memory",
        note: "An in-memory store of the most-requested data. Answers in microseconds, absorbs the repeated reads, and only lets a genuine miss reach the database behind it.",
      }),
      db: E.v.database({ x: 700, y: 366, sub: "source of truth", note: "The durable store. With a cache in front, it now sees only cache misses and writes — a small slice of the old load." }),
    });

    const toLb = s.connect(users, lb, { bow: 0, dashed: true });
    const fan = s.fanout(lb, [app1, app2], { dashed: true, bowSpread: 52 });
    const aCache = s.connect(app1, cache, { bow: 16, dashed: true });
    const aDb = s.connect(app2, db, { bow: -16, dashed: true });
    const cacheDb = s.connect(cache, db, { bow: 0, dashed: true, color: "dim" });

    s.step("Here's the fleet from before — every one of these boxes still reads from the single database.", [
      E.enter([users, lb, app1, app2, db], 0.14),
      E.draw(toLb),
      fan.draw({ gap: 0.14, dur: 0.5 }),
      E.draw(aDb),
    ]);

    s.step("So put a cache in front of it: a read checks the cache first, and most of the time the answer is already there.", [
      E.appear(cache),
      E.draw(aCache),
      E.draw(cacheDb),
      aCache.send({ color: "cyan", label: "read?", dur: 0.8 }),
    ]);

    const { hit } = s.cast({
      hit: E.token({ ...E.below(cache, 60), text: "cache hit · DB untouched", accent: "green" }),
    });

    s.step("On a hit, the request is answered from memory and never touches the database at all.", [
      aCache.reply({ color: "green", label: "hit", dur: 0.8 }),
      E.appear(hit),
      E.all(E.pulse(cache, 2.2), E.dim(db)),
    ]);

    const { miss } = s.cast({
      miss: E.token({ ...E.below(db, 60), text: "only misses fall through", accent: "amber" }),
    });

    s.step(
      "Only a miss falls through to the database — so it serves a fraction of the reads, and the highest-traffic path is now the cheapest.",
      [E.undim(db), cacheDb.send({ color: "amber", label: "miss", dur: 0.9 }), E.appear(miss), E.pulse(db, 2.0), E.wait(0.9)],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 4 — the database is the wall (replicas + shards + consensus)
   ============================================================ */

const theWall = E.scene({
  id: "the-wall",
  chapter: "The wall below the peak",
  question: "Cached reads are cheap. But every write still lands on one database. How do writes scale?",
  title: "Reads copy easily. Writes are where scaling gets hard.",
  takeaway:
    "The database is the real summit wall, and reads and writes hit it differently. Reads scale by copying: add read replicas — read-only followers of the primary — and spread reads across them. But writes can't just be copied, because every copy would have to agree, so writes stay pinned to the primary. To scale writes you must split the data itself into shards, each owning a range of keys, so different writes go to different machines. That buys write throughput — and reintroduces a hard question: when a write's ownership is in doubt, which shard is authoritative? Agreeing on that under failure is exactly the majority/consensus problem from 'Jury duty for servers': a group of machines picking one answer even when some are down.",
  nextPrompt: "Now take the dial yourself — and choose bigger-box or more-boxes.",
  setup: (s) => {
    const { app, primary } = s.cast({
      app: E.v.server({ x: 165, y: 262, label: "app tier", sub: "×N stateless", note: STATELESS_NOTE }),
      primary: E.v.database({
        x: 400,
        y: 262,
        label: "primary",
        sub: "takes every write",
        note: "The one database that accepts writes. Reads can be copied away from it, but writes cannot — every write has to be ordered somewhere, and that somewhere is here.",
      }),
    });
    const appDb = s.connect(app, primary, { bow: 0, dashed: true });

    s.step("Reads are handled — but every write in the whole system still funnels into one primary database.", [
      E.enter([app, primary], 0.18),
      E.draw(appDb),
      appDb.send({ color: "amber", label: "write", dur: 0.9 }),
      E.pulse(primary, 2.0),
    ]);

    /* reads scale by copying: replicas */
    const { rep1, rep2 } = s.cast({
      rep1: replica({ x: 700, y: 150, sub: "read-only copy" }),
      rep2: replica({ x: 700, y: 262, sub: "read-only copy" }),
    });
    const repFan = s.fanout(primary, [rep1, rep2], { dashed: true, bowSpread: 44, color: "dim" });

    s.step("Reads scale the easy way — by copying: read replicas follow the primary and answer reads off to the side.", [
      E.enter([rep1, rep2], 0.16),
      repFan.draw({ gap: 0.14, dur: 0.5 }),
      repFan.send({ color: "cyan", label: "stream changes", gap: 0.16, dur: 0.9 }),
    ]);

    const { stuck } = s.cast({
      stuck: E.token({ ...E.below(primary, 66), text: "writes still land here only", accent: "rose" }),
    });

    s.step("But you can't copy a write — every copy would have to agree — so writes stay stuck on the single primary.", [
      E.appear(stuck),
      E.all(E.dim(rep1), E.dim(rep2)),
      E.all(E.shake(primary), E.pulse(primary, 2.4)),
    ]);

    /* writes scale by splitting: shards */
    const { shardA, shardB } = s.cast({
      shardA: shard({ x: 615, y: 300, label: "shard · A", sub: "keys A–M" }),
      shardB: shard({ x: 800, y: 300, label: "shard · B", sub: "keys N–Z" }),
    });
    const wA = s.connect(app, shardA, { bow: 30, dashed: true, color: "blue" });
    const wB = s.connect(app, shardB, { bow: -30, dashed: true, color: "blue" });

    s.step("To scale writes you split the data itself into shards — each owns a range of keys, so different writes go to different machines.", [
      E.all(
        E.fadeTo(stuck, 0, 0.3),
        E.fadeTo(appDb, 0, 0.3),
        E.fadeTo(repFan.wires[0], 0, 0.3),
        E.fadeTo(repFan.wires[1], 0, 0.3),
        E.vanish(rep1),
        E.vanish(rep2),
        E.vanish(primary),
      ),
      E.enter([shardA, shardB], 0.16),
      E.draw(wA),
      wA.send({ color: "blue", label: "write A–M", dur: 1.0 }),
    ]);

    s.step(
      "But now: which shard truly owns a contested write? Agreeing under failure is the same majority problem from 'Jury duty for servers'.",
      [
        E.draw(wB),
        wB.send({ color: "blue", label: "write N–Z", dur: 1.0 }),
        E.all(E.pulse(shardA, 2.2), E.pulse(shardB, 2.2)),
        E.wait(1.0),
      ],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 5 — take the dial (THE KNOB: choice rebuilds cast + V/H toggle)
   ============================================================ */

const VSIZE = {
  solo: "2 vCPU · 8 GB",
  balanced: "16 vCPU · 64 GB",
  cached: "64 vCPU · 256 GB",
  distributed: "maxed · no bigger box exists",
} as const;

const takeTheDial = E.scene({
  id: "take-the-dial",
  chapter: "Take the dial",
  question: "You choose: as the crowd grows, do you buy a bigger box or add more boxes?",
  title: "The same load, two very different systems.",
  takeaway:
    "This is the whole story in one control. Flip to 'bigger box' and the system never changes shape — it's always one machine, just with more CPU and RAM, which is beautifully simple and a single point of failure that eventually hits a ceiling no purchase can clear. Flip to 'more boxes' and each step up in load rebuilds the system: a lone server, then a balancer over stateless apps, then a cache absorbing reads, then replicas and shards splitting the data tier. Vertical is a straight line to a wall; horizontal is a ladder with a harder rung at every level — and the hardest rungs are always at the database. Take the crowd to millions on 'bigger box' and watch it redline; switch to 'more boxes' and watch the cast grow to meet it.",
  nextPrompt: "Start the climb again",
  params: {
    scale: E.choice("Crowd size", [
      ["solo", "A few users"],
      ["balanced", "Thousands"],
      ["cached", "Tens of thousands"],
      ["distributed", "Millions"],
    ]),
    grow: E.toggle("Strategy", [
      ["horizontal", "More boxes"],
      ["vertical", "Bigger box"],
    ]),
  },
  setup: (s, p) => {
    /* ---------- VERTICAL: one box, forever — it only ever grows ---------- */
    if (p.grow === "vertical") {
      const maxed = p.scale === "distributed";
      const { users, box, db } = s.cast({
        users: E.v.users({ ...USERS, note: USERS_NOTE }),
        box: E.v.server({
          x: 480,
          y: 262,
          w: 180,
          label: "app server",
          sub: VSIZE[p.scale],
          note: "The bigger-box strategy: one machine, bought larger each time the crowd grows. Simple to reason about — and the only thing that can fail is also the only thing there is.",
        }),
        db: E.v.database({ x: 800, y: 262, sub: "one source of truth", note: "Still a single database, growing with the box." }),
      });
      const toBox = s.connect(users, box, { bow: 34, dashed: true });
      const boxDb = s.connect(box, db, { bow: -20, dashed: true });

      s.step("The bigger-box strategy never changes shape: no matter the crowd, it's one machine — you just buy a larger one.", [
        E.enter([users, box, db], 0.18),
        E.draw(toBox),
        E.draw(boxDb),
        toBox.send({ label: "GET /", dur: 0.9 }),
      ]);

      const { spof } = s.cast({
        spof: E.token({ ...E.below(box, 70), text: "single point of failure", accent: "rose" }),
      });

      if (!maxed) {
        s.step(
          "It comfortably handles this load — but there is exactly one of it, so a single crash is still a total outage.",
          [E.appear(spof), E.all(E.pulse(box, 2.4), E.pulse(db, 2.0)), E.wait(0.9)],
          { hold: 1.0, view: "all" },
        );
        return;
      }

      const { ceil, err } = s.cast({
        ceil: E.token({ ...E.above(box, 62), text: "ceiling hit · nothing bigger to buy", accent: "amber" }),
        err: E.token({ ...E.below(box, 128), text: "503 · out of capacity", accent: "rose" }),
      });

      s.step("But at millions, you run out of box: no machine is big enough, and it redlines with nowhere left to grow.", [
        E.appear(spof),
        E.appear(ceil),
        E.all(E.shake(box), E.pulse(box, 2.6)),
        E.seq(toBox.send({ color: "rose", label: "GET /", dur: 1.1, keepAlive: true }), E.appear(err)),
      ]);

      s.step(
        "Vertical scaling is a straight line to a wall — to go further you must stop growing the box and start adding boxes.",
        [E.all(E.pulse(box, 2.2), E.pulse(err, 2.2)), E.wait(1.0)],
        { hold: 1.0, view: "all" },
      );
      return;
    }

    /* ---------- HORIZONTAL: more boxes — each stage rebuilds the cast ---------- */

    /* stage 1: solo — a few users, nothing to balance yet */
    if (p.scale === "solo") {
      const { users, app, db } = s.cast({
        users: E.v.users({ ...USERS, sub: "a few", note: USERS_NOTE }),
        app: E.v.server({ x: 470, y: 262, label: "app server", sub: "1 box", note: STATELESS_NOTE }),
        db: E.v.database({ x: 790, y: 262, sub: "source of truth", note: "One database, easily keeping up at this size." }),
      });
      const toApp = s.connect(users, app, { bow: 34, dashed: true });
      const toDb = s.connect(app, db, { bow: -20, dashed: true });

      s.step("A few users: one box is the right amount of machine — there is nothing to spread yet.", [
        E.enter([users, app, db], 0.2),
        E.draw(toApp),
        E.draw(toDb),
        E.all(toApp.send({ label: "GET /", dur: 0.9 }), E.seq(E.wait(0.4), toDb.send({ color: "amber", label: "query", dur: 0.8 }))),
      ]);

      s.step(
        "Adding machines now would be pure overhead — you scale out when one box fills up, not before.",
        [E.all(E.pulse(app, 2.2), E.pulse(db, 2.2)), E.wait(0.9)],
        { hold: 1.0, view: "all" },
      );
      return;
    }

    /* stage 2: balanced — a load balancer over two stateless apps */
    if (p.scale === "balanced") {
      const { users, lb, app1, app2, db } = s.cast({
        users: E.v.users({ ...USERS, sub: "thousands", note: USERS_NOTE }),
        lb: E.v.loadBalancer({ x: 330, y: 262, sub: "sprays traffic", note: "Spreads each request across the healthy app servers and drops any that stop answering." }),
        app1: E.v.server({ x: 560, y: 160, label: "app · A", sub: "stateless", note: STATELESS_NOTE }),
        app2: E.v.server({ x: 560, y: 364, label: "app · B", sub: "stateless", note: STATELESS_NOTE }),
        db: E.v.database({ x: 800, y: 262, sub: "shared state", note: "Sessions live here, not in the apps — which is what lets any box answer any request." }),
      });
      const toLb = s.connect(users, lb, { bow: 0, dashed: true });
      const fan = s.fanout(lb, [app1, app2], { dashed: true, bowSpread: 52 });
      const dbA = s.connect(app1, db, { bow: 22, dashed: true });
      const dbB = s.connect(app2, db, { bow: -22, dashed: true });

      s.step("Thousands: a load balancer fronts two stateless app servers, and traffic sprays across both.", [
        E.enter([users, lb, app1, app2, db], 0.14),
        E.draw(toLb),
        fan.draw({ gap: 0.14, dur: 0.5 }),
        E.all(E.draw(dbA), E.draw(dbB)),
        fan.send({ color: "cyan", label: "GET /", gap: 0.16, dur: 0.9 }),
      ]);

      s.step(
        "Because no app remembers you, session state lives in the shared database — the enabler for every box you add.",
        [E.all(dbA.send({ color: "amber", label: "session", dur: 0.9 }), dbB.send({ color: "amber", label: "session", dur: 0.9 })), E.pulse(db, 2.2), E.wait(0.9)],
        { hold: 1.0, view: "all" },
      );
      return;
    }

    /* stage 3: cached — a cache absorbs the read-heavy majority */
    if (p.scale === "cached") {
      const { users, lb, app1, app2, cache, db } = s.cast({
        users: E.v.users({ ...USERS, sub: "tens of thousands", note: USERS_NOTE }),
        lb: E.v.loadBalancer({ x: 280, y: 262, sub: "sprays traffic", note: "The same front door over a bigger fleet." }),
        app1: E.v.server({ x: 470, y: 160, label: "app · A", sub: "stateless", note: STATELESS_NOTE }),
        app2: E.v.server({ x: 470, y: 364, label: "app · B", sub: "stateless", note: STATELESS_NOTE }),
        cache: E.v.cache({ x: 680, y: 150, sub: "hot reads", note: "Absorbs the repeated reads in memory; only a miss reaches the database." }),
        db: E.v.database({ x: 680, y: 366, sub: "misses + writes", note: "Now sees only cache misses and writes — a fraction of the old read load." }),
      });
      const toLb = s.connect(users, lb, { bow: 0, dashed: true });
      const fan = s.fanout(lb, [app1, app2], { dashed: true, bowSpread: 52 });
      const aCache = s.connect(app1, cache, { bow: 16, dashed: true });
      const aDb = s.connect(app2, db, { bow: -16, dashed: true });
      const cacheDb = s.connect(cache, db, { bow: 0, dashed: true, color: "dim" });

      s.step("Tens of thousands: the same fleet, now with a cache in front of the database catching the repeated reads.", [
        E.enter([users, lb, app1, app2, cache, db], 0.12),
        E.draw(toLb),
        fan.draw({ gap: 0.14, dur: 0.45 }),
        E.all(E.draw(aCache), E.draw(aDb), E.draw(cacheDb)),
        aCache.send({ color: "cyan", label: "read?", dur: 0.8 }),
      ]);

      s.step(
        "A hit answers from memory and never touches the database; only a miss falls through — reads got cheap.",
        [aCache.reply({ color: "green", label: "hit", dur: 0.8 }), cacheDb.send({ color: "amber", label: "miss", dur: 0.9 }), E.all(E.pulse(cache, 2.2), E.pulse(db, 2.0)), E.wait(0.9)],
        { hold: 1.0, view: "all" },
      );
      return;
    }

    /* stage 4: distributed — replicas for reads, shards for writes */
    const { users, lb, app, cache, shardA, shardB, rep } = s.cast({
      users: E.v.users({ ...USERS, sub: "millions", note: USERS_NOTE }),
      lb: E.v.loadBalancer({ x: 270, y: 262, sub: "sprays traffic", note: "Front door for the whole stateless fleet." }),
      app: E.v.server({ x: 440, y: 262, label: "app tier", sub: "×N stateless", note: STATELESS_NOTE }),
      cache: E.v.cache({ x: 640, y: 120, sub: "hot reads", note: "Still the first stop for reads, absorbing the repeated majority." }),
      shardA: shard({ x: 610, y: 290, label: "shard · A", sub: "keys A–M" }),
      shardB: shard({ x: 800, y: 290, label: "shard · B", sub: "keys N–Z" }),
      rep: replica({ x: 705, y: 412, sub: "per-shard read copy" }),
    });
    const toLb = s.connect(users, lb, { bow: 0, dashed: true });
    const lbApp = s.connect(lb, app, { bow: 0, dashed: true });
    const appCache = s.connect(app, cache, { bow: 10, dashed: true });
    const writes = s.fanout(app, [shardA, shardB], { dashed: true, bowSpread: 40, color: "blue" });
    const repl = s.connect(shardA, rep, { bow: 20, dashed: true, color: "dim" });

    s.step("Millions: the app tier is just ×N stateless boxes behind the balancer — the whole fight has moved to the data tier.", [
      E.enter([users, lb, app], 0.16),
      E.draw(toLb),
      E.draw(lbApp),
      toLb.send({ color: "cyan", label: "GET /", dur: 0.8 }),
    ]);

    s.step("Reads hit the cache; writes split across shards, each owning a key range, so writes finally scale past one machine.", [
      E.appear(cache),
      E.enter([shardA, shardB], 0.16),
      E.draw(appCache),
      writes.draw({ gap: 0.14, dur: 0.5 }),
      E.all(appCache.send({ color: "cyan", label: "read", dur: 0.8 }), writes.send({ color: "blue", label: "write by key", gap: 0.16, dur: 0.9 })),
    ]);

    s.step("Each shard keeps its own read replica to spread its reads — reads copy easily, the same trick one level down.", [
      E.appear(rep),
      E.draw(repl),
      repl.send({ color: "cyan", label: "stream", dur: 0.9 }),
      E.pulse(rep, 2.0),
    ]);

    s.step(
      "And agreeing which shard owns a contested write, even as machines fail, is the majority problem from 'Jury duty for servers'.",
      [E.all(E.pulse(shardA, 2.2), E.pulse(shardB, 2.2)), E.wait(1.0)],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================ */

export default E.story({
  ...meta,
  scenes: [oneBox, theFork, theCache, theWall, takeTheDial],
  outro: [
    "Strip away the diagrams and scaling is one honest admission repeated at every level: no single machine is enough, so you spread the work — and spreading only works when the pieces stop depending on any one place. App servers spread trivially once they forget who you are. Reads spread by copying into caches and replicas. Writes are the stubborn ones, because a write is a decision about the truth, and truth can't simply be duplicated — it has to be owned, which is why the final move is sharding the data itself.",
    "That's also the through-line to the rest of these explainers. The moment you shard, you're back to a room full of machines that must agree on one answer while some of them are down — the majority rule from 'Jury duty for servers.' Scaling doesn't escape the hard problems of distributed systems; it climbs high enough that it finally has to face them. The bigger box was never the summit. The summit is a system with no single point that has to be big at all.",
  ],
  references: [
    {
      kind: "book",
      title: "Designing Data-Intensive Applications — Kleppmann",
      url: "https://dataintensive.net/",
      note: "Chapters 5 (replication) and 6 (partitioning/sharding) are the definitive treatment of why the database is the wall.",
    },
    {
      kind: "docs",
      title: "AWS Well-Architected Framework — Reliability & Performance",
      url: "https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html",
      note: "Horizontal scaling, statelessness, and load balancing framed as first principles for building at scale.",
    },
    {
      kind: "book",
      title: "Google SRE Book — Load Balancing",
      url: "https://sre.google/sre-book/load-balancing-frontend/",
      note: "How real traffic gets spread across a fleet at the frontend and inside the datacenter.",
    },
    {
      kind: "article",
      title: "The AKF Scale Cube",
      url: "https://akfpartners.com/growth-blog/scale-cube",
      note: "The x/y/z axes of scaling — cloning, splitting by function, and splitting by data — the framing behind sharding.",
    },
  ],
});
