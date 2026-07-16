/**
 * "How the internet finds google.com" — the engine's reference story.
 *
 * This file is pure storytelling: it casts presets, connects them, and
 * composes motion. No coordinates for wires or packets (connections own
 * them: send travels one lane, reply the mirrored one), no timestamps
 * (seq/all/stagger compose them), no strings for references (refs are typed
 * handles). The next explainer is another folder shaped exactly like this one.
 */
import {
  all,
  appear,
  below,
  bubble,
  defineStory,
  dim,
  draw,
  enter,
  fadeTo,
  flash,
  frame,
  glowOn,
  label,
  node,
  pulse,
  resetCam,
  rightOf,
  scene,
  seq,
  spot,
  stagger,
  toggle,
  token,
  undim,
  v,
  wait,
} from "../../engine";
import { meta } from "./meta";

/* ============================================================
   Scene 1 — the question leaves home
   ============================================================ */

const leavingHome = scene({
  id: "leaving-home",
  chapter: "Finding the address",
  question: "Who do you ask when nobody knows?",
  title: "Your browser doesn't know where Google lives.",
  takeaway:
    "The browser checked its own DNS cache, then the operating system's — both misses. So it sent the question to a recursive resolver (usually your ISP's, or a public one like 8.8.8.8), whose whole job is chasing answers.",
  nextPrompt: "Where does the resolver start?",
  prose: [
    "You type google.com and press Enter. It feels like one action, but your browser can't do anything with those ten characters — the internet doesn't route by name, it routes by number. Somewhere out there is a machine whose address looks like 142.250.72.14, and until your computer knows that number, nothing else can happen. No connection, no encryption, no page.",
    "So before a single packet leaves your machine, the browser does what you would do with a phone number you might already have: it checks its own notes. First its private cache of recently resolved names, then the operating system's — a deeper cache that even includes a hand-written address book called the hosts file, older than DNS itself.",
    "Both come up empty. This is the moment the question has to leave home — addressed to a recursive resolver, a server whose entire purpose is to find out things your computer doesn't know. Watch the figure below: the misses happen first, then the question walks out the door.",
  ],
  setup: (s) => {
    const { laptop, browserCache, osCache, resolver } = s.cast({
      laptop: v.browser({
        ...spot("left"),
        label: "Your computer",
        note: "Everything starts here: you typed google.com and pressed Enter. To fetch the page, your machine first needs Google's numeric IP address.",
      }),
      browserCache: v.cache({
        x: 420,
        y: 120,
        w: 158,
        label: "Browser cache",
        sub: "recently seen domains",
        accent: "cyan",
        note: "Browsers remember domains they resolved in the last few minutes, so repeat visits skip the network entirely.",
      }),
      osCache: node({
        x: 420,
        y: 410,
        w: 172,
        glyph: "doc",
        label: "OS cache + hosts file",
        sub: "the machine's address book",
        accent: "violet",
        note: "The operating system keeps its own resolver cache, plus /etc/hosts — a hand-written address book that predates DNS itself.",
      }),
      resolver: v.server({
        ...spot("right"),
        w: 168,
        label: "DNS resolver",
        sub: "usually your ISP, or 8.8.8.8",
        note: "A recursive resolver answers “where is X?” for thousands of users. It doesn't know the answer — it knows the path to the answer.",
      }),
    });

    const toBrowser = s.connect(laptop, browserCache, { bow: 20, dashed: true });
    const toOs = s.connect(laptop, osCache, { bow: -20, dashed: true });
    const toResolver = s.connect(laptop, resolver, { bow: 90, dashed: true });

    const { missA, missB, askBubble, knowBubble } = s.cast({
      missA: token({ ...rightOf(browserCache, 46), text: "miss", accent: "rose" }),
      missB: token({ ...rightOf(osCache, 46), text: "miss", accent: "rose" }),
      askBubble: bubble({
        ...below(laptop, 93),
        w: 250,
        lines: ["“Does anyone know", "where google.com is?”"],
        accent: "blue",
      }),
      knowBubble: bubble({
        ...below(resolver, 93),
        w: 250,
        lines: ["“I don't. But I know", "exactly who to ask.”"],
        accent: "cyan",
      }),
    });

    s.step(
      "Before asking the internet, the browser checks every notebook it owns — its own cache, then the operating system's.",
      [
        appear(laptop),
        enter([browserCache, osCache], 0.2),
        stagger(0.2, draw(toBrowser, 0.5), draw(toOs, 0.5)),
        all(
          seq(toBrowser.send({ color: "cyan", label: "google.com?", dur: 1.0 }), flash(browserCache), wait(0.4), appear(missA)),
          seq(wait(0.6), toOs.send({ color: "violet", label: "google.com?", dur: 1.0 }), flash(osCache), wait(0.4), appear(missB)),
        ),
        wait(0.2),
        all(dim(browserCache), dim(osCache), fadeTo(missA, 0.4), fadeTo(missB, 0.4)),
      ],
    );

    s.step(
      "Nothing on this machine knows. So the question leaves home for the first time — bound for a resolver whose whole job is finding out.",
      [
        appear(askBubble),
        all(appear(resolver), seq(wait(0.4), draw(toResolver, 0.8))),
        toResolver.send({ color: "cyan", label: "where is google.com?", dur: 1.8, keepAlive: true }),
        all(pulse(resolver, 2.8), seq(wait(0.4), appear(knowBubble))),
      ],
      { hold: 1.0 },
    );
  },
});

/* ============================================================
   Scene 2 — climbing the hierarchy (the camera works here)
   ============================================================ */

const hierarchy = scene({
  id: "hierarchy",
  chapter: "Finding the address",
  question: "Where does every search begin?",
  title: "Nobody knows the answer. Everyone knows who to ask.",
  takeaway:
    "The resolver walked the DNS hierarchy: the root pointed to the .com registry, the registry pointed to Google's own name servers, and ns1.google.com finally answered with an address — 142.250.72.14.",
  nextPrompt: "Was all that worth it?",
  prose: [
    "Here's the surprising part: the resolver doesn't know where google.com is either. Nobody does — no single machine on Earth holds the complete map of the internet's names. What exists instead is a hierarchy of servers where each level knows exactly one thing: who to ask next.",
    "At the top sit the root servers — thirteen named identities, each actually hundreds of mirrored machines scattered across the planet. They can't tell you where google.com lives, but they know who runs .com. The .com registry can't either, but among its ~160 million entries is a referral: Google keeps its own phone book, at ns1.google.com. And that server — the authoritative one — finally speaks with certainty, because Google itself publishes the answer there.",
    "Three questions, three referrals, one answer. It's less like looking something up in a directory and more like being politely handed down a chain of receptionists, each one more specific than the last. The figure follows the resolver on that walk — the camera moves down the hierarchy with it.",
  ],
  setup: (s) => {
    const { resolver, root, tld, auth } = s.cast({
      resolver: v.server({
        x: 145,
        y: 280,
        w: 150,
        label: "Resolver",
        note: "The resolver does the walking so your computer doesn't have to. Each reply tells it who to ask next.",
      }),
      root: node({
        x: 505,
        y: 100,
        w: 172,
        glyph: "book",
        label: "Root server",
        sub: "knows every ending",
        accent: "amber",
        note: "Thirteen root server identities (a–m.root-servers.net), each really hundreds of mirrored machines found via anycast. They know who runs each ending: .com, .org, .dev…",
      }),
      tld: node({
        x: 560,
        y: 280,
        w: 172,
        glyph: "book",
        label: ".com registry",
        sub: "knows every .com",
        accent: "violet",
        note: "The TLD servers for .com hold referrals for ~160 million domains — not their addresses, but who speaks for each one.",
      }),
      auth: v.server({
        x: 615,
        y: 450,
        w: 196,
        label: "ns1.google.com",
        sub: "Google's own name server",
        accent: "green",
        note: "The authoritative server. Its answer isn't a rumor or a cache — Google itself publishes the address here.",
      }),
    });

    const upRoot = s.connect(resolver, root, { bow: 70, dashed: true });
    const upTld = s.connect(resolver, tld, { bow: 45, dashed: true });
    const upAuth = s.connect(resolver, auth, { bow: -70, dashed: true });

    const { rootSays, tldSays, authSays, answer } = s.cast({
      rootSays: bubble({
        x: 450,
        y: 235,
        w: 260,
        lines: ["“.com? Not my department —", "but I know who runs .com.”"],
        accent: "amber",
      }),
      tldSays: bubble({
        x: 390,
        y: 415,
        w: 240,
        lines: ["“Google keeps its own", "phone book. Ask them.”"],
        accent: "violet",
      }),
      authSays: bubble({
        x: 340,
        y: 490,
        w: 230,
        lines: ["“google.com lives at", "142.250.72.14.”"],
        accent: "green",
      }),
      answer: token({ ...below(resolver, 70), text: "google.com = 142.250.72.14", accent: "green" }),
    });

    const ask = { color: "cyan", label: "google.com?" } as const;

    s.step("Start at the very top. The root doesn't know google.com — but it keeps the book of every ending.", [
      all(
        appear(resolver),
        stagger(0.15, appear(root), all(appear(tld), dim(tld, 0.01)), all(appear(auth), dim(auth, 0.01))),
      ),
      all(frame([resolver, root]), seq(wait(0.2), draw(upRoot, 0.6), upRoot.send({ ...ask, dur: 1.3 }))),
      all(pulse(root, 1.7), seq(wait(0.2), appear(rootSays))),
      wait(0.7),
      upRoot.reply({ color: "amber", label: "ask the .com registry", dur: 1.2 }),
    ]);

    s.step("Down one level. The .com registry narrows 160 million domains to the one server that speaks for Google.", [
      all(fadeTo(rootSays, 0, 0.4), dim(root), undim(tld), frame([resolver, tld])),
      draw(upTld, 0.6),
      upTld.send({ ...ask, dur: 1.2 }),
      all(pulse(tld, 1.7), seq(wait(0.2), appear(tldSays))),
      wait(0.7),
      upTld.reply({ color: "violet", label: "ask Google's own servers", dur: 1.2 }),
    ]);

    s.step("One more hop — to Google's own name server. Its answer is not a referral. It's the address.", [
      all(fadeTo(tldSays, 0, 0.4), dim(tld), undim(auth), frame([resolver, auth])),
      draw(upAuth, 0.6),
      upAuth.send({ ...ask, dur: 1.3 }),
      all(pulse(auth, 1.9), seq(wait(0.2), appear(authSays))),
      wait(0.7),
      upAuth.reply({ color: "green", label: "142.250.72.14", dur: 1.4 }),
    ]);

    s.step(
      "Three questions, three referrals, one answer. The resolver carries it home.",
      [
        all(fadeTo(authSays, 0, 0.4), resetCam(), undim(root), undim(tld), undim(auth)),
        wait(0.3),
        all(appear(answer), glowOn(resolver), pulse(resolver, 2.0)),
        wait(1.6),
      ],
      { hold: 1.0 },
    );
  },
});

/* ============================================================
   Scene 3 — interactive: first visit vs. second visit
   ============================================================ */

const cached = scene({
  id: "cached",
  chapter: "Finding the address",
  question: "Was all that worth it?",
  title: "Ask twice, and the internet remembers.",
  takeaway:
    "DNS answers carry a time-to-live and are cached at every stop — browser, OS, resolver. The first lookup pays the full price of the hierarchy walk; every lookup after that is answered from memory. Toggle the visit above and compare.",
  nextPrompt: "Start the journey again",
  prose: [
    "All of that took roughly 120 milliseconds — a real cost, paid before the page even begins to load. If every visit to every site paid it, the web would feel noticeably heavier. It doesn't, because DNS has one more trick: every answer carries an expiry date.",
    "That expiry is called a TTL — time to live. On the way back to your browser, the answer gets written down at every stop: the resolver keeps a copy, your operating system keeps a copy, your browser keeps a copy. Until the TTL runs out, asking \"where is google.com?\" costs nothing at all — the answer is already in the room.",
    "The figure below is interactive. It starts with the first visit — the full pilgrimage you just watched. Flip the toggle to the second visit and watch the entire hierarchy stay asleep.",
  ],
  params: {
    visit: toggle("Visit", [
      ["first", "First visit"],
      ["second", "Second visit"],
    ]),
  },
  setup: (s, p) => {
    const second = p.visit === "second";

    const { laptop, cache, resolver, root, tld, auth } = s.cast({
      laptop: v.browser({
        x: 165,
        y: 265,
        label: "Your computer",
        note: "Same machine, same question. What changes the second time is only what it remembers.",
      }),
      cache: v.cache({
        x: 165,
        y: 105,
        w: 158,
        label: "Browser cache",
        sub: second ? "google.com ✓ (TTL 300s)" : "empty",
        accent: "cyan",
        note: "Answers are stored with a time-to-live (TTL). Until it expires, this lookup costs nothing.",
        visible: true,
      }),
      resolver: v.server({ x: 480, y: 265, w: 150, label: "Resolver", visible: true }),
      root: node({ x: 790, y: 105, w: 150, glyph: "book", label: "Root", accent: "amber", visible: true }),
      tld: node({ x: 815, y: 265, w: 150, glyph: "book", label: ".com registry", accent: "violet", visible: true }),
      auth: v.server({ x: 790, y: 430, w: 160, label: "ns1.google.com", accent: "green", visible: true }),
    });

    const wCache = s.connect(laptop, cache, { bow: 0, dashed: true });

    if (second) {
      const clock = s.add(label({ x: 480, y: 480, text: "≈ 0 ms — answered from memory", size: 14, color: "green" }));

      s.step("Second visit: the browser asks its own cache first — and this time the entry is there, still fresh.", [
        all(appear(laptop), dim(resolver, 0.01), dim(root, 0.01), dim(tld, 0.01), dim(auth, 0.01)),
        draw(wCache, 0.4),
        wCache.exchange({
          send: { color: "cyan", label: "google.com?", dur: 0.7 },
          reply: { color: "green", label: "142.250.72.14", dur: 0.7 },
          gap: 0.5,
        }),
        all(pulse(cache, 1.6), glowOn(laptop)),
      ]);

      s.step(
        "The resolver, the root, the registry, Google's servers — the whole hierarchy stays asleep. This is why the web feels instant the second time.",
        [appear(clock), pulse(laptop, 2.0), wait(2.0)],
        { hold: 1.2 },
      );
      return;
    }

    const wRes = s.connect(laptop, resolver, { bow: 40, dashed: true });
    const wRoot = s.connect(resolver, root, { bow: 40, dashed: true });
    const wTld = s.connect(resolver, tld, { bow: 25, dashed: true });
    const wAuth = s.connect(resolver, auth, { bow: -40, dashed: true });

    const clock = s.add(label({ x: 480, y: 480, text: "≈ 120 ms of asking around", size: 14, color: "amber" }));

    const hop = (wire: typeof wRoot, replyColor: "amber" | "violet" | "green", replyLabel?: string) =>
      seq(
        draw(wire, 0.4),
        wire.send({ color: "cyan", dur: 0.8 }),
        wire.reply({ color: replyColor, label: replyLabel, dur: 0.8 }),
      );

    s.step(
      "First visit: the cache is empty, so the question makes the full pilgrimage — resolver, root, registry, Google.",
      [
        appear(laptop),
        draw(wCache, 0.3),
        wCache.send({ color: "cyan", label: "google.com?", dur: 0.6 }),
        flash(cache),
        wait(0.3),
        draw(wRes, 0.4),
        wRes.send({ color: "cyan", label: "google.com?", dur: 0.9 }),
        all(
          pulse(resolver, 5.4),
          seq(hop(wRoot, "amber"), hop(wTld, "violet"), hop(wAuth, "green", "142.250.72.14")),
        ),
        wRes.reply({ color: "green", label: "142.250.72.14", dur: 0.9 }),
        glowOn(laptop),
      ],
    );

    s.step(
      "Every hop costs milliseconds — and on the way back, every stop writes the answer down for next time.",
      [appear(clock), glowOn(cache), pulse(cache, 1.8), wait(2.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================ */

export default defineStory({
  ...meta,
  scenes: [leavingHome, hierarchy, cached],
  outro: [
    "So that's the quiet machinery behind ten typed characters: two local caches checked, one resolver dispatched, three levels of hierarchy walked, one authoritative answer carried home — and every stop along the way taking notes so it never has to happen again. All before your browser has sent a single byte to Google.",
    "The design is worth pausing on. DNS has no center, no master list, no single machine that could fail and take the names down with it. It scales because each level knows almost nothing — just who to ask next — and it feels instant because everyone remembers. Delegation plus caching: two old ideas that still resolve billions of questions an hour, invisibly, including the one you asked when you opened this page.",
  ],
  references: [
    {
      kind: "interactive",
      title: "Mess With DNS",
      url: "https://messwithdns.net",
      note: "Julia Evans' sandbox: you get a real subdomain and break DNS on purpose to see what actually happens.",
    },
    {
      kind: "article",
      title: "How DNS Works (comic)",
      url: "https://howdns.works",
      note: "The whole resolution walk retold as a friendly comic — a perfect second pass over what you just watched.",
    },
    {
      kind: "course",
      title: "Implement DNS in a Weekend",
      url: "https://implement-dns.wizardzines.com",
      note: "Build a toy resolver in ~200 lines of Python; nothing cements the walk like performing it yourself.",
    },
    {
      kind: "docs",
      title: "Cloudflare: What is DNS?",
      url: "https://www.cloudflare.com/learning/dns/what-is-dns/",
      note: "A clean reference for the record types and server roles this story deliberately skipped.",
    },
  ],
});
