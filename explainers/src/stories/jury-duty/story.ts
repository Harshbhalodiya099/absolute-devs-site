/**
 * "Jury duty for servers" — how distributed machines agree on the truth (Raft).
 *
 * The visual law of this story: A COMMAND IS AMBER UNTIL A MAJORITY HAS IT, THEN
 * GREEN. Every log entry is a token that starts uncommitted (amber) and only
 * flips to committed (green) when more than half the servers have written it
 * down. The leader never invents that green — it earns it by counting acks. When
 * the count can't reach a majority, the token simply stays amber and the system
 * stalls, on purpose.
 */
import { E } from "../../engine";
import { meta } from "./meta";

/* ---------------- story-local vocabulary ---------------- */

const SERVER_NOTE =
  "One machine in the cluster. It keeps its own copy of the log — the ordered list of commands — and replays it to compute its state. It can be a follower, a candidate, or the leader, but only ever one at a time.";

/* a server card, same look everywhere; role is carried by sub/glow/tokens */
const srv = (
  pt: { x: number; y: number },
  label: string,
  sub: string,
  accent: "blue" | "violet" | "amber" = "blue",
) => E.v.server({ ...pt, label, sub, accent, w: 150, note: SERVER_NOTE });

/* fixed seats, reused across every scene so the room never moves */
const SEAT1 = { x: 250, y: 262 }; // the one that becomes candidate → leader
const SEAT2 = { x: 690, y: 165 };
const SEAT3 = { x: 690, y: 360 };

const UNCOMMITTED = "amber" as const;
const COMMITTED = "green" as const;

/* ============================================================
   Scene 1 — three machines, three answers
   ============================================================ */

const theProblem = E.scene({
  id: "the-problem",
  chapter: "The problem",
  question: "Several servers, none of them in charge, some destined to crash — how do they agree on one answer?",
  title: "Three servers, three versions of the truth.",
  takeaway:
    "Consensus is not a vote of confidence in a boss you trust ahead of time — it's agreeing on the order of a log. If every server replays the exact same list of commands in the exact same order, they all end up in the same state, and the shared state falls out for free. The whole problem reduces to one question: how does a group of equals, any of whom may vanish, pick one order and stick to it? Raft's answer is a majority.",
  nextPrompt: "With no boss appointed in advance, who gets to decide the order?",
  setup: (s) => {
    const { s1, s2, s3 } = s.cast({
      s1: srv(SEAT1, "server A", "wants x = 1"),
      s2: srv(SEAT2, "server B", "wants x = 2"),
      s3: srv(SEAT3, "server C", "wants x = 3"),
    });
    const servers = [s1, s2, s3];

    const { conflict, goal } = s.cast({
      conflict: E.token({ x: 470, y: 262, text: "3 answers · 0 agreement", accent: "rose" }),
      goal: E.token({ ...E.below(s1, 74), text: "need: one ordered log, replayed by all", accent: "cyan" }),
    });

    s.step("Three identical servers, each handed a different command, and not one of them is in charge.", [
      E.enter(servers, 0.2),
      E.all(E.pulse(s1, 2.4), E.pulse(s2, 2.4), E.pulse(s3, 2.4)),
    ]);

    s.step("Ask them to store a single value and they disagree — read any one and you might get a different answer.", [
      E.appear(conflict),
      E.all(E.shake(s1), E.shake(s2), E.shake(s3)),
      E.wait(0.5),
    ]);

    s.step("The fix isn't picking a boss to trust; it's agreeing on one ordered log that every server replays identically.", [
      E.fadeTo(conflict, 0, 0.3),
      E.appear(goal),
      E.pulse(s1, 2.0),
    ]);

    s.step(
      "Raft's whole trick is arithmetic: as long as a majority can still talk, they can choose an order and keep it — no permanent boss required.",
      [E.all(E.pulse(s1, 2.2), E.pulse(s2, 2.2), E.pulse(s3, 2.2)), E.wait(1.0)],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 2 — the election
   ============================================================ */

const election = E.scene({
  id: "election",
  chapter: "The election",
  question: "No leader is appointed in advance. So who gets to decide the order — and how is the choice not rigged?",
  title: "A timer runs out, a server stands up, and the room votes.",
  takeaway:
    "Time is chopped into terms, and each term elects at most one leader. Every follower waits on a randomized election timer; whoever's fires first becomes a candidate, bumps the term, and asks the others to back it. The safety rule is small and total: a server grants at most one vote per term, so two candidates can never both collect a majority. Win a majority and you hold the gavel for that term; lose the race and you wait for the next timeout. Randomized timers make ties rare and self-correcting.",
  nextPrompt: "The leader has a new command. When does it actually become the official truth?",
  setup: (s) => {
    const { s1, s2, s3 } = s.cast({
      s1: srv(SEAT1, "server A", "follower"),
      s2: srv(SEAT2, "server B", "follower"),
      s3: srv(SEAT3, "server C", "follower"),
    });
    const followers = [s2, s3];

    const { timers } = s.cast({
      timers: E.token({ ...E.above(s1, 58), text: "election timers ticking…", accent: "cyan" }),
    });

    s.step("With no leader, every server just waits, quietly counting down a randomized election timer.", [
      E.enter([s1, s2, s3], 0.18),
      E.appear(timers),
      E.all(E.pulse(s1, 2.2), E.pulse(s2, 2.2), E.pulse(s3, 2.2)),
    ]);

    const { term } = s.cast({
      term: E.token({ ...E.above(s1, 58), text: "term → 2 · candidate", accent: "amber" }),
    });

    s.step("Server A's timer fires first: it becomes a candidate, bumps the term to 2, and votes for itself.", [
      E.fadeTo(timers, 0, 0.3),
      E.flash(s1),
      E.appear(term),
      E.glowOn(s1),
    ]);

    const fan = s.fanout(s1, followers, { dashed: true, bowSpread: 56 });

    s.step("It asks the rest of the room to back it — one RequestVote to every other server.", [
      fan.draw({ gap: 0.14, dur: 0.5 }),
      fan.send({ color: "amber", label: "RequestVote", gap: 0.16, dur: 0.9 }),
    ]);

    s.step("Each server grants at most one vote this term, so two candidates can never both win — the rule quietly forbids a tie.", [
      fan.gather({ color: COMMITTED, label: "vote ✓", gap: 0.18, dur: 0.9 }),
      E.all(E.flash(s2), E.flash(s3)),
    ]);

    const { leader } = s.cast({
      leader: E.token({ ...E.below(s1, 60), text: "leader · term 2", accent: "violet" }),
    });

    s.step(
      "Two of three is a majority, so server A holds the gavel for term 2 — the room now has exactly one leader.",
      [E.fadeTo(term, 0, 0.3), E.appear(leader), E.glowOn(s1), E.pulse(s1, 2.4), E.wait(1.0)],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 3 — a command becomes law
   ============================================================ */

const commit = E.scene({
  id: "commit",
  chapter: "The commit",
  question: "The leader receives a new command. At what exact moment does it become the truth?",
  title: "A command is law only once a majority has written it down.",
  takeaway:
    "Consensus lives in this one beat. The leader appends the client's command to its own log, but marks it uncommitted — it isn't law yet. It replicates the entry to the followers; each stores it and acknowledges. The instant a majority of servers hold the entry, the leader commits it: now it's applied everywhere and can never be undone. Committing on a majority is the safety guarantee, because any two majorities share at least one server — so a committed entry always survives into every future leader's log.",
  nextPrompt: "How many servers can drop before that majority is at risk?",
  setup: (s) => {
    const { client, s1, s2, s3 } = s.cast({
      client: E.v.users({
        x: 118,
        y: 110,
        label: "client",
        sub: "sends a command",
        note: "Any application talking to the cluster. It sends its command to the leader and waits to hear that it was committed — durably agreed by a majority.",
      }),
      s1: srv(SEAT1, "server A", "leader · term 2", "violet"),
      s2: srv(SEAT2, "server B", "follower"),
      s3: srv(SEAT3, "server C", "follower"),
    });
    const followers = [s2, s3];

    const toLeader = s.connect(client, s1, { bow: 18, dashed: true });

    const { logA } = s.cast({
      logA: E.token({ ...E.below(s1, 60), text: "x = 7 · uncommitted", accent: UNCOMMITTED }),
    });

    s.step("A client sends its command to the leader: set x = 7.", [
      E.all(E.appear(client), E.appear(s1), E.appear(s2), E.appear(s3)),
      E.draw(toLeader),
      toLeader.send({ color: "cyan", label: "set x = 7", dur: 1.0 }),
    ]);

    s.step("The leader writes it to its own log first — but marked uncommitted, because it is not yet law.", [
      E.appear(logA),
      E.pulse(s1, 2.2),
    ]);

    const fan = s.fanout(s1, followers, { dashed: true, bowSpread: 56 });
    const { logB, logC } = s.cast({
      logB: E.token({ ...E.below(s2, 56), text: "x = 7 · uncommitted", accent: UNCOMMITTED }),
      logC: E.token({ ...E.below(s3, 56), text: "x = 7 · uncommitted", accent: UNCOMMITTED }),
    });

    s.step("It replicates the entry to every follower, who each write the very same line into their own log.", [
      fan.draw({ gap: 0.12, dur: 0.45 }),
      fan.send({ color: UNCOMMITTED, label: "AppendEntries", gap: 0.16, dur: 0.9 }),
      E.all(E.appear(logB), E.appear(logC)),
    ]);

    s.step("Each follower acknowledges that it has stored the entry safely.", [
      fan.gather({ color: COMMITTED, label: "ack", gap: 0.18, dur: 0.9 }),
      E.all(E.flash(s2), E.flash(s3)),
    ]);

    const { committed } = s.cast({
      committed: E.token({ ...E.below(s1, 96), text: "majority holds it → committed", accent: COMMITTED }),
    });
    /* committed-green versions of each log line, layered over the amber ones */
    const { cA, cB, cC } = s.cast({
      cA: E.token({ ...E.below(s1, 60), text: "x = 7 · committed", accent: COMMITTED }),
      cB: E.token({ ...E.below(s2, 56), text: "x = 7 · committed", accent: COMMITTED }),
      cC: E.token({ ...E.below(s3, 56), text: "x = 7 · committed", accent: COMMITTED }),
    });

    s.step(
      "The moment a majority holds the entry, the leader commits it — every copy flips to committed and x = 7 can never be undone.",
      [
        E.all(E.fadeTo(logA, 0, 0.2), E.fadeTo(logB, 0, 0.2), E.fadeTo(logC, 0, 0.2)),
        E.all(E.appear(cA), E.appear(cB), E.appear(cC)),
        E.appear(committed),
        E.all(E.pulse(s1, 2.2), E.pulse(s2, 2.2), E.pulse(s3, 2.2)),
        E.wait(1.0),
      ],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 4 — the arithmetic of failure (THE KNOB)
   ============================================================ */

const failure = E.scene({
  id: "failure",
  chapter: "The arithmetic of failure",
  question: "Servers crash. How many can drop before the cluster can no longer tell the truth?",
  title: "Majority holds the line — until it doesn't.",
  takeaway:
    "Fault tolerance is pure arithmetic: 2f+1 servers survive f failures, so three tolerate one and five tolerate two. Kill a single follower and the leader plus the remaining follower are still a majority, so commits keep flowing. Kill the majority and the leader can no longer collect enough acks — so it refuses to commit. Crucially, it stalls rather than guessing: the entry stays uncommitted, no divergent answer is ever handed out, and consistency is kept at the cost of availability. That refusal is the feature, not a bug — it's exactly what prevents split-brain.",
  nextPrompt: "The downed servers eventually come back. Do we lose what happened while they slept?",
  params: {
    fault: E.choice("Who is still up?", [
      ["healthy", "All 3 up"],
      ["one", "1 follower down"],
      ["majority", "Majority down"],
    ]),
  },
  setup: (s, p) => {
    const { s1, s2, s3 } = s.cast({
      s1: srv(SEAT1, "server A", "leader · term 2", "violet"),
      s2: srv(SEAT2, "server B", "follower"),
      s3: srv(SEAT3, "server C", "follower"),
    });
    const followers = [s2, s3];
    const fan = s.fanout(s1, followers, { dashed: true, bowSpread: 56 });

    const { logA } = s.cast({
      logA: E.token({ ...E.below(s1, 60), text: "x = 9 · uncommitted", accent: UNCOMMITTED }),
    });

    if (p.fault === "healthy") {
      s.step("All three servers are healthy, and the leader takes a fresh command: set x = 9.", [
        E.all(E.appear(s1), E.appear(s2), E.appear(s3)),
        fan.draw({ gap: 0.12, dur: 0.45 }),
        E.appear(logA),
      ]);

      s.step("It replicates the entry to both followers, who store it and acknowledge.", [
        fan.send({ color: UNCOMMITTED, label: "AppendEntries", gap: 0.16, dur: 0.9 }),
        fan.gather({ color: COMMITTED, label: "ack", gap: 0.18, dur: 0.9 }),
        E.all(E.flash(s2), E.flash(s3)),
      ]);

      const { ok } = s.cast({
        ok: E.token({ ...E.below(s1, 96), text: "3 of 3 ≥ majority → committed", accent: COMMITTED }),
      });
      s.step(
        "Three of three is a comfortable majority, so the entry commits — the healthy case, exactly as before.",
        [E.fadeTo(logA, 0, 0.2), E.appear(ok), E.all(E.pulse(s1, 2.2), E.pulse(s2, 2.2), E.pulse(s3, 2.2)), E.wait(1.0)],
        { hold: 1.0, view: "all" },
      );
      return;
    }

    if (p.fault === "one") {
      const { downTok } = s.cast({
        downTok: E.token({ ...E.below(s3, 56), text: "unreachable", accent: "rose" }),
      });

      s.step("One follower goes dark — a reboot, a snapped network link — while the leader takes set x = 9.", [
        E.all(E.appear(s1), E.appear(s2), E.appear(s3)),
        fan.draw({ gap: 0.12, dur: 0.45 }),
        E.crash(s3),
        E.appear(downTok),
        E.appear(logA),
      ]);

      s.step("The leader replicates to whoever is still reachable; the surviving follower stores it and acknowledges.", [
        fan.wires[0].send({ color: UNCOMMITTED, label: "AppendEntries", dur: 0.9 }),
        E.wait(0.2),
        fan.wires[0].reply({ color: COMMITTED, label: "ack", dur: 0.9 }),
        E.flash(s2),
      ]);

      const { ok } = s.cast({
        ok: E.token({ ...E.below(s1, 96), text: "2 of 3 ≥ majority → committed", accent: COMMITTED }),
      });
      s.step(
        "Leader plus one surviving follower is two of three — still a majority — so the entry commits and a single failure changes nothing.",
        [E.fadeTo(logA, 0, 0.2), E.appear(ok), E.all(E.pulse(s1, 2.2), E.pulse(s2, 2.2)), E.wait(1.0)],
        { hold: 1.0, view: "all" },
      );
      return;
    }

    /* majority down: leader is alone; it cannot commit, so it stalls */
    const { down2, down3 } = s.cast({
      down2: E.token({ ...E.below(s2, 56), text: "unreachable", accent: "rose" }),
      down3: E.token({ ...E.below(s3, 56), text: "unreachable", accent: "rose" }),
    });

    s.step("Now both followers are gone at once — the majority is unreachable — and still the leader takes set x = 9.", [
      E.all(E.appear(s1), E.appear(s2), E.appear(s3)),
      fan.draw({ gap: 0.12, dur: 0.45 }),
      E.all(E.crash(s2), E.crash(s3)),
      E.all(E.appear(down2), E.appear(down3)),
      E.appear(logA),
    ]);

    s.step("It appends the entry and reaches out to replicate — but the acknowledgements never come back.", [
      fan.send({ color: "rose", label: "AppendEntries", gap: 0.16, dur: 1.0, keepAlive: true }),
      E.wait(0.6),
    ]);

    const { stall } = s.cast({
      stall: E.token({ ...E.below(s1, 96), text: "1 of 3 < majority → cannot commit", accent: "rose" }),
    });

    s.step("One server is not a majority, so the leader will not commit — the entry is stuck at uncommitted, glowing amber.", [
      E.appear(stall),
      E.all(E.pulse(logA, 2.4), E.pulse(s1, 2.2)),
      E.wait(0.6),
    ]);

    s.step(
      "It stalls rather than guesses: no divergent answer is ever handed out. The system would sooner freeze than lie — that refusal is what prevents split-brain.",
      [E.all(E.pulse(s1, 2.2), E.pulse(logA, 2.2)), E.wait(1.0)],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================
   Scene 5 — healing and catch-up
   ============================================================ */

const healing = E.scene({
  id: "healing",
  chapter: "Healing",
  question: "The crashed servers wake back up with stale logs. Do we lose what was decided while they slept?",
  title: "The survivors' log is the truth; the rest just catch up.",
  takeaway:
    "Nothing committed is ever lost. Because every commit required a majority, and any two majorities share at least one server, a newly elected leader is guaranteed to already hold every committed entry — the safety property that makes Raft correct. When the sleeping servers return, they don't get a vote on the past: they discover where their log diverges from the leader's, throw away anything that disagrees, and copy the leader's history forward until they match. The partition heals into one timeline, not two.",
  nextPrompt: "Start the story again",
  setup: (s) => {
    const { s1, s2, s3 } = s.cast({
      s1: srv(SEAT1, "server A", "leader · term 2", "violet"),
      s2: srv(SEAT2, "server B", "waking up"),
      s3: srv(SEAT3, "server C", "waking up"),
    });
    const followers = [s2, s3];

    const { logA } = s.cast({
      logA: E.token({ ...E.below(s1, 60), text: "x = 7 · committed", accent: COMMITTED }),
    });
    const { staleB, staleC } = s.cast({
      staleB: E.token({ ...E.below(s2, 56), text: "log: stale", accent: "rose" }),
      staleC: E.token({ ...E.below(s3, 56), text: "log: stale", accent: "rose" }),
    });

    s.step("The partition heals: the two crashed servers wake up, but their logs are stale — behind the leader's committed truth.", [
      E.appear(s1),
      E.appear(logA),
      E.all(E.revive(s2), E.revive(s3)),
      E.all(E.appear(staleB), E.appear(staleC)),
    ]);

    const fan = s.fanout(s1, followers, { dashed: true, bowSpread: 56 });

    s.step("The leader streams every entry they missed, straight from its own log — it never asks their opinion on the past.", [
      fan.draw({ gap: 0.12, dur: 0.45 }),
      fan.send({ color: COMMITTED, label: "AppendEntries", gap: 0.16, dur: 0.9 }),
    ]);

    const { freshB, freshC } = s.cast({
      freshB: E.token({ ...E.below(s2, 56), text: "x = 7 · committed", accent: COMMITTED }),
      freshC: E.token({ ...E.below(s3, 56), text: "x = 7 · committed", accent: COMMITTED }),
    });

    s.step("They overwrite whatever disagreed and converge on the leader's history — three copies, one identical log.", [
      E.all(E.fadeTo(staleB, 0, 0.3), E.fadeTo(staleC, 0, 0.3)),
      E.all(E.appear(freshB), E.appear(freshC)),
      E.all(E.flash(s2), E.flash(s3)),
    ]);

    s.step(
      "Because every commit needed a majority, and any two majorities overlap, a committed entry can never be lost — not even across a change of leaders.",
      [E.all(E.pulse(s1, 2.2), E.pulse(s2, 2.2), E.pulse(s3, 2.2), E.glowOn(s1)), E.wait(1.0)],
      { hold: 1.0, view: "all" },
    );
  },
});

/* ============================================================ */

export default E.story({
  ...meta,
  scenes: [theProblem, election, commit, failure, healing],
  outro: [
    "Strip away the vocabulary and consensus is one stubborn habit: never call something true until more than half the room has written it down. Elections, terms, and heartbeats all exist to make sure there's a single writer at a time; the majority rule on commits makes sure that writer can never lose a fact that was already agreed. A leader dies, a follower lags, a network splits — none of it is a special case, because the same arithmetic that commits an entry is the arithmetic that refuses to.",
    "That refusal is the part worth keeping. A cluster that would rather stall than hand out two different answers is choosing consistency over availability — the CAP trade-off, made concrete. It's why a database built on Raft feels slow to acknowledge a write under partition but never corrupts your data, and why 'just add more servers' buys you more tolerated failures but not a way to cheat the majority. The jury can lose members and still reach a verdict; it simply cannot be talked into two verdicts at once.",
  ],
  references: [
    {
      kind: "paper",
      title: "In Search of an Understandable Consensus Algorithm (Raft)",
      url: "https://raft.github.io/raft.pdf",
      note: "Ongaro & Ousterhout's original paper — deliberately written to be readable. The source for terms, elections, and commit-on-majority.",
    },
    {
      kind: "article",
      title: "The Secret Lives of Data — Raft, visualized",
      url: "http://thesecretlivesofdata.com/raft/",
      note: "Walks the same protocol frame by frame. The best place to watch an election and a replication play out interactively.",
    },
    {
      kind: "docs",
      title: "The Raft Consensus Algorithm — site & implementations",
      url: "https://raft.github.io/",
      note: "Visualizations, the full paper, and dozens of real implementations across languages.",
    },
    {
      kind: "book",
      title: "Designing Data-Intensive Applications — Consistency & Consensus",
      url: "https://dataintensive.net/",
      note: "Kleppmann's Chapter 9 places Raft in the wider landscape of replication, linearizability, and the CAP trade-off.",
    },
  ],
});
