/**
 * "How Elasticsearch finds your needle in a billion documents"
 *
 * Visual law: the inverted index is a PERSISTENT region that grows
 * throughout the story — documents enter it, terms accumulate, and the
 * region is never replaced. Queries traverse the index by lookup, never
 * by scanning the original docs. The asymmetry between write-path work
 * and query-path speed should be FELT through animation pacing.
 */
import {
  above,
  all,
  appear,
  crash,
  definePreset,
  defineStory,
  draw,
  enter,
  flash,
  glowOn,
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


const indexNode = definePreset({
  glyph: "server",
  label: "Node",
  accent: "cyan",
  w: 130,
  h: 62,
  note: "A machine in the Elasticsearch cluster. Each node holds some shards (primaries and/or replicas) and can serve as a coordinating node for scatter-gather queries.",
});

/* ============================================================
   Scene 1 — The Race: LIKE vs inverted index
   ============================================================ */

const theRace = scene({
  id: "the-race",
  chapter: "The problem",
  question: "How do you find a word in a billion documents without reading them all?",
  title: "SQL reads everything, every time. The inverted index reads it once.",
  takeaway:
    "A SQL `LIKE '%timeout%'` scan touches every row in the table, every single query — linear in corpus size, zero intelligence. An inverted index flips the relationship: at write time, each document is analyzed into terms, and each term points to its documents. At query time, you look up the term in the dictionary and get the list of matching documents instantly. The work moved from query time (expensive, repeated) to write time (expensive, once). That asymmetry is the entire trick.",
  nextPrompt: "How does the dictionary actually get built?",
  prose: [
    "Here is the database developer's nightmare: a user types a search term into a box, and your backend runs `SELECT * FROM docs WHERE body LIKE '%timeout error%'`. The database reads every single row, checks every single body, and returns the matches. For a hundred rows, that's fine. For ten million documents, it's catastrophic — every query takes seconds, and the time grows linearly with the corpus.",
    "The inverted index is a two-hundred-year-old solution (every book has one at the back). Instead of scanning every document at query time, you read every document once at write time and build a dictionary: each word maps to the list of documents that contain it. Now a search for 'timeout' is not a scan — it's a dictionary lookup. The time to find 'timeout' in a billion documents is the same as finding it in a hundred.",
    "Watch the race below: the scanner reads everything, every time, and slows down as the corpus grows. The index pays the cost once at write time, and every query after that is a snap.",
  ],
  setup: (s) => {
    const { scanner, indexer } = s.cast({
      scanner: v.database({
        x: 250, y: 180,
        label: "SQL LIKE",
        sub: "scans everything, every query",
        accent: "rose",
        note: "A full table scan: the database reads every row, checks the condition, and returns matches. Cost: O(corpus size) per query. No ranking, no typo tolerance.",
      }),
      indexer: v.database({
        x: 710, y: 180,
        label: "Inverted index",
        sub: "built once, looked up forever",
        accent: "green",
        note: "A word→documents dictionary built at write time. Query cost: O(1) lookup per term, then a set intersection. Independent of corpus size.",
      }),
    });
    const { q1, q2, q3 } = s.cast({
      q1: token({ x: 250, y: 310, text: "query: 'timeout'", accent: "rose" }),
      q2: token({ x: 250, y: 360, text: "scan 10M rows… again", accent: "rose" }),
      q3: token({ x: 710, y: 310, text: "query: 'timeout'", accent: "green" }),
    });
    const { snap, verdict } = s.cast({
      snap: token({ x: 710, y: 360, text: "lookup → [doc 4, doc 891, doc 20034] — instant", accent: "green" }),
      verdict: token({ x: 480, y: 440, text: "move the work to write time — every query is a lookup", accent: "green" }),
    });

    s.step("Two strategies for finding 'timeout' in 10 million documents.", [
      enter([scanner, indexer], 0.2),
    ]);

    s.step("The scanner reads every row, every query — and it takes seconds, every single time.", [
      appear(q1),
      pulse(scanner, 2.0),
      shake(scanner),
      appear(q2),
      wait(0.4),
    ]);

    s.step("The inverted index was built once at write time — the query is a dictionary lookup, instant.", [
      appear(q3),
      flash(indexer),
      appear(snap),
      glowOn(indexer),
      wait(0.4),
    ]);

    s.step(
      "The fundamental asymmetry: move the expensive work to write time and every query becomes a lookup.",
      [appear(verdict), pulse(verdict, 2.2), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 2 — The Catalog: watching the index build + analysis
   ============================================================ */

const theCatalog = scene({
  id: "the-catalog",
  chapter: "The dictionary",
  question: "What actually goes into the inverted index?",
  title: "Your text is not what's stored. 'The QUICK brown foxes!' becomes [quick, brown, fox].",
  takeaway:
    "Documents don't enter the index as-is. An analyzer pipeline processes each field: the tokenizer splits text into tokens, the lowercase filter normalizes case, and the stemmer reduces words to their roots ('running' → 'run', 'foxes' → 'fox'). The resulting terms — not your original text — are what the inverted index stores. This is why 'Running' matches 'run' and why exact strings sometimes fail: the analyzer decides what's findable. Most real-world 'why doesn't my search work' bugs are analyzer mismatches.",
  nextPrompt: "So if I index a document, I can find it right away — right?",
  prose: [
    "Here is the single most misunderstood part of Elasticsearch, and the source of most real-world 'why doesn't my search work?' pain: the analyzer. Your documents don't enter the inverted index as-is. They pass through a pipeline that transforms text into searchable terms.",
    "Watch what happens to the sentence 'The QUICK brown foxes!' — it enters the analyzer and comes out as three terms: 'quick', 'brown', 'fox'. The capitalizations are gone (lowercase filter). 'The' is gone (stop-word removal — common words that add noise). 'foxes' became 'fox' (stemming — reducing words to their root form). These transformed terms — not your original text — are what the inverted index stores and what queries match against.",
    "This is why 'Running' can match documents containing 'run' (both stem to 'run'). It's also why an exact-string search for 'The QUICK brown foxes!' might return zero results — the index doesn't contain that string. It contains [quick, brown, fox]. The analyzer is the translator between human text and searchable terms.",
  ],
  params: {
    stemming: toggle("Stemmer", [
      ["on", "On — foxes→fox, running→run"],
      ["off", "Off — exact forms only"],
    ]),
  },
  setup: (s, p) => {
    const { analyzer } = s.cast({
      analyzer: v.server({
        ...spot("center", { dy: -40 }),
        label: "Analyzer",
        sub: p.stemming === "on" ? "tokenize → lowercase → stem" : "tokenize → lowercase (no stem)",
        accent: "violet",
        w: 200,
        note: "The pipeline that transforms text into searchable terms. Tokenizer splits on whitespace/punctuation, filters normalize case and optionally reduce to root forms.",
      }),
    });
    const { docIn } = s.cast({
      docIn: token({ x: 480, y: 140, text: "The QUICK brown foxes!", accent: "blue" }),
    });

    const terms = p.stemming === "on"
      ? ["quick", "brown", "fox"]
      : ["quick", "brown", "foxes"];
    const termSpecs = Object.fromEntries(
      terms.map((t, i) => [
        `term${i}`,
        token({ x: 280 + i * 140, y: 350, text: t, accent: "green" }),
      ]),
    );
    const termRefs = s.cast(termSpecs);
    const termList = terms.map((_, i) => termRefs[`term${i}`]);

    const { dropped, arrow } = s.cast({
      dropped: token({ x: 480, y: 420, text: p.stemming === "on"
        ? "'The' removed · case lowered · foxes→fox"
        : "'The' removed · case lowered · foxes kept as-is",
        accent: "amber",
      }),
      arrow: label({ x: 480, y: 280, text: "↓ analyzed into terms", size: 12, color: "dim" }),
    });

    const { query, match, noMatch } = s.cast({
      query: token({ x: 200, y: 420, text: "search: 'fox'", accent: "cyan" }),
      match: token({
        x: 700, y: 420,
        text: p.stemming === "on" ? "✓ match — 'fox' is in the index" : "✗ no match — only 'foxes' is stored",
        accent: p.stemming === "on" ? "green" : "rose",
      }),
      noMatch: label({
        x: 480, y: 470,
        text: p.stemming === "on"
          ? "stemming makes search flexible — 'foxes', 'fox', and 'foxy' all match"
          : "without stemming, you must search the exact form",
        size: 12,
        color: p.stemming === "on" ? "green" : "rose",
      }),
    });

    s.step("A document enters the analyzer — this is where 'findability' is decided.", [
      appear(docIn),
      appear(analyzer),
      pulse(analyzer, 1.6),
    ]);

    s.step("The analyzer tokenizes, lowercases, and processes the text — what comes out is what the index stores.", [
      flash(analyzer),
      appear(arrow),
      stagger(0.15, ...termList.map((t) => appear(t))),
      appear(dropped),
      wait(0.4),
    ]);

    s.step("Now search for 'fox' — does it match? The answer depends entirely on the analyzer.", [
      appear(query),
      flash(termList[termList.length - 1]),
      appear(match),
      wait(0.4),
    ]);

    s.step(
      "The analyzer decides what's findable — toggle stemming above and watch the same query succeed or fail.",
      [appear(noMatch), pulse(analyzer, 2.2), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 3 — The Missing Document: NRT, segments, refresh
   ============================================================ */

const missingDoc = scene({
  id: "missing-document",
  chapter: "The write path",
  question: "You indexed a document 200ms ago — why can't you find it?",
  title: "Indexed is not searchable. That gap is by design.",
  takeaway:
    "Elasticsearch is near-real-time, not real-time. When you index a document, it goes into an in-memory buffer — fast, but unsearchable. Every ~1 second, a 'refresh' writes that buffer to a new immutable segment on disk, and only then does the document become searchable. This delay is not a bug; it's a deliberate engineering trade-off for write performance. Segments are immutable — updates are delete-markers plus re-adds; true deletes happen during background merges. The 'my document isn't there' panic is week-one ES, and the answer is always: wait one second.",
  nextPrompt: "What happens when the index outgrows one machine?",
  prose: [
    "Every Elasticsearch newcomer hits this moment in their first week: you index a document, immediately search for it, and get zero results. You check the document. It's there. You search again — zero. Thirty seconds later, it works. What happened?",
    "The answer is the segment lifecycle — the most important internal mechanism to understand. When a document arrives, Elasticsearch doesn't immediately make it searchable. It goes into an in-memory buffer where writes are fast. Every ~1 second (the 'refresh interval'), the buffer's contents are written to a new immutable segment — a small, self-contained inverted index on disk. Only after this refresh is the document searchable.",
    "This is not a bug. It's a deliberate trade-off: writing to a mutable index on every document would be catastrophically slow. Instead, new segments are born immutable, searched alongside existing segments, and periodically merged in the background. 'Near-real-time' means there's a window of up to ~1 second where a document is indexed but not yet findable. Every ES user learns this the hard way. Better to learn it here.",
  ],
  setup: (s) => {
    const { buffer, segment, merged } = s.cast({
      buffer: v.cache({
        x: 250, y: 200,
        label: "In-memory buffer",
        sub: "fast writes, not searchable",
        accent: "amber",
        note: "New documents land here first. The buffer is fast to write to but invisible to search queries. Documents stay here until the next refresh.",
      }),
      segment: v.database({
        x: 580, y: 200,
        label: "Segment",
        sub: "immutable, searchable",
        accent: "green",
        note: "After refresh, the buffer becomes an immutable segment — a tiny self-contained inverted index. Segments are never edited; updates = tombstone + new doc; deletes = tombstone only.",
      }),
      merged: v.database({
        x: 790, y: 200,
        label: "Merged segment",
        sub: "compacted, tombstones gone",
        accent: "cyan",
        note: "Background merges combine small segments into larger ones and purge tombstoned documents. This is the only time data is truly deleted.",
      }),
    });
    const { doc, searchMiss, refresh, searchHit, nrt } = s.cast({
      doc: token({ x: 250, y: 110, text: "new document arrives", accent: "blue" }),
      searchMiss: token({ x: 250, y: 340, text: "search NOW → 0 results!", accent: "rose" }),
      refresh: token({ x: 420, y: 300, text: "~1 second: refresh", accent: "amber" }),
      searchHit: token({ x: 580, y: 340, text: "search NOW → found!", accent: "green" }),
      nrt: token({ x: 480, y: 440, text: "near-real-time: indexed ≠ instantly searchable — by design", accent: "green" }),
    });

    const wireBS = s.connect(buffer, segment, { bow: 0, dashed: true });
    const wireSM = s.connect(segment, merged, { bow: 0, dashed: true });

    s.step("A new document arrives — it goes into the in-memory buffer, fast to write, not yet searchable.", [
      appear(doc),
      appear(buffer),
      flash(buffer),
      pulse(buffer, 1.6),
    ]);

    s.step("Search right now — zero results. The document is in the buffer, invisible to queries.", [
      appear(searchMiss),
      shake(buffer),
      wait(0.5),
    ]);

    s.step("~1 second later, the refresh fires: the buffer becomes an immutable segment — now searchable.", [
      appear(refresh),
      draw(wireBS),
      wireBS.send({ color: "amber", label: "refresh", dur: 0.8 }),
      appear(segment),
      vanish(searchMiss),
      flash(segment),
      appear(searchHit),
      wait(0.4),
    ]);

    s.step(
      "Near-real-time: there's always a window where a document is indexed but not yet findable. That's not a bug — it's the price of write performance.",
      [
        draw(wireSM),
        appear(merged),
        wireSM.send({ color: "cyan", label: "merge", dur: 0.8 }),
        appear(nrt),
        pulse(nrt, 2.2),
        wait(1.0),
      ],
      { hold: 1.2 },
    );
  },
});

/* ============================================================
   Scene 4 — The Cluster: shards, replicas, node death
   ============================================================ */

const theCluster = scene({
  id: "the-cluster",
  chapter: "The distribution",
  question: "What happens when the index outgrows one machine — or a machine dies?",
  title: "Split the dictionary across machines. Copy each piece. Survive anything.",
  takeaway:
    "When an index outgrows one machine, Elasticsearch splits it into shards — each shard is a self-contained Lucene index living on a node. Documents hash to shards (`hash(id) % shard_count`), and queries scatter to all shards and gather results. For fault tolerance, each shard has replica copies on other nodes. When a node dies, replicas promote to primary — no data lost, no downtime. The cluster self-heals. Kill a node above and watch it happen.",
  nextPrompt: "Start the story again",
  prose: [
    "One machine, one inverted index — we've understood the core. But a single-machine index hits two walls: it runs out of disk space, and it has no fault tolerance. Elasticsearch solves both with the same mechanism: sharding and replication.",
    "An index is split into N shards, each a complete Lucene index. Documents are assigned to shards by a simple hash: `hash(document_id) % shard_count`. This is also why you can't change the shard count after creation — the hash would change and documents would be in the wrong place. Each shard lives on a node in the cluster.",
    "For fault tolerance, each primary shard has one or more replica copies on other nodes. When a query arrives, the coordinating node scatters it to one copy of each shard (primary or replica), each shard runs the query locally and returns its top-k results, and the coordinator merges them. Kill a node and its replicas promote to primary on the surviving nodes — the cluster self-heals.",
  ],
  params: {
    failure: toggle("Node health", [
      ["healthy", "All nodes healthy"],
      ["dead", "Node 3 dies — watch failover"],
    ]),
  },
  setup: (s, p) => {
    const { coord } = s.cast({
      coord: v.loadBalancer({
        ...spot("top", { dy: 10 }),
        label: "Coordinator",
        sub: "scatter-gather",
        note: "Any node can be a coordinator. It receives the query, scatters it to one copy of each shard, and merges the per-shard top-k results into a final answer.",
      }),
    });
    const { n1, n2, n3 } = s.cast({
      n1: indexNode({ x: 210, y: 340, label: "Node 1", sub: "shard 1 (primary)" }),
      n2: indexNode({ x: 480, y: 340, label: "Node 2", sub: "shard 2 (primary)" }),
      n3: indexNode({ x: 750, y: 340, label: "Node 3", sub: "shard 3 (primary)" }),
    });
    const { r1, r2, r3 } = s.cast({
      r1: label({ x: 210, y: 395, text: "+replica of shard 3", size: 10, color: "dim" }),
      r2: label({ x: 480, y: 395, text: "+replica of shard 1", size: 10, color: "dim" }),
      r3: label({ x: 750, y: 395, text: "+replica of shard 2", size: 10, color: "dim" }),
    });

    const w1 = s.connect(coord, n1, { bow: -15, dashed: true });
    const w2 = s.connect(coord, n2, { bow: 0, dashed: true });
    const w3 = s.connect(coord, n3, { bow: 15, dashed: true });

    if (p.failure === "healthy") {
      const { scatter, result } = s.cast({
        scatter: token({ ...above(coord, 26), text: "query scatters to all shards, results merge at coordinator", accent: "cyan" }),
        result: token({ x: 480, y: 450, text: "3 shards, 3 replicas — split for scale, copied for safety", accent: "green" }),
      });

      s.step("The index is split into 3 shards across 3 nodes — each shard is a self-contained index.", [
        enter([coord, n1, n2, n3], 0.12),
        stagger(0.1, draw(w1), draw(w2), draw(w3)),
        stagger(0.1, appear(r1), appear(r2), appear(r3)),
      ]);

      s.step("A query arrives at the coordinator — it scatters the query to one copy of each shard.", [
        appear(scatter),
        all(w1.send({ color: "cyan", label: "query", dur: 0.7 }), w2.send({ color: "cyan", dur: 0.7 }), w3.send({ color: "cyan", dur: 0.7 })),
        stagger(0.1, flash(n1), flash(n2), flash(n3)),
      ]);

      s.step("Each shard runs the query locally and returns its top results — the coordinator merges them.", [
        all(w1.reply({ color: "green", label: "results", dur: 0.7 }), w2.reply({ color: "green", dur: 0.7 }), w3.reply({ color: "green", dur: 0.7 })),
        flash(coord),
      ]);

      s.step(
        "Shards for scale, replicas for safety — toggle 'Node 3 dies' above to test the safety.",
        [appear(result), pulse(result, 2.2), wait(1.0)],
        { hold: 1.2 },
      );
      return;
    }

    /* node 3 dies */
    const { death, promoted, healed } = s.cast({
      death: token({ x: 750, y: 450, text: "Node 3 is down!", accent: "rose" }),
      promoted: token({ x: 210, y: 450, text: "Node 1 promotes replica of shard 3 → primary", accent: "green" }),
      healed: token({ x: 480, y: 120, text: "cluster self-healed — no data lost, no downtime", accent: "green" }),
    });

    s.step("Three nodes, each holding a primary shard and one replica of another shard.", [
      enter([coord, n1, n2, n3], 0.12),
      stagger(0.1, draw(w1), draw(w2), draw(w3)),
      stagger(0.1, appear(r1), appear(r2), appear(r3)),
    ]);

    s.step("Node 3 dies — shard 3's primary is gone. But Node 1 has a replica.", [
      crash(n3),
      vanish(r3),
      appear(death),
      wait(0.5),
    ]);

    s.step("The replica on Node 1 promotes to primary — shard 3 is back, served from a different machine.", [
      flash(n1),
      glowOn(n1),
      appear(promoted),
      pulse(n1, 2.0),
      wait(0.4),
    ]);

    s.step(
      "The cluster self-healed. Kill a node and nobody notices — that's what replicas are for.",
      [appear(healed), pulse(healed, 2.4), wait(1.0)],
      { hold: 1.2 },
    );
  },
});

/* ============================================================ */

export default defineStory({
  ...meta,
  scenes: [theRace, theCatalog, missingDoc, theCluster],
  outro: [
    "The whole system in one breath: read documents once at write time, run them through an analyzer pipeline that transforms text into searchable terms, and store those terms in an inverted index — a word-to-documents dictionary. At query time, look up the term, intersect the document lists, rank by relevance (rare words matter more, repetition saturates, shorter fields win). Shard the index across machines for scale, replicate each shard for fault tolerance, scatter-gather queries across them all.",
    "Two honest footnotes. First, Elasticsearch is not a database. It's a search engine: near-real-time (not instant), historically loose on durability guarantees, and rebuilt from a source of truth. Treat it as an index you can rebuild, not as the truth itself. Second, the analyzer is where almost all real-world search pain lives — 'why doesn't my search match?' is almost always an analyzer misconfiguration. Now that you've seen tokens enter the index, you know where to look.",
  ],
  references: [
    {
      kind: "article",
      title: "Elasticsearch from the bottom up",
      url: "https://www.elastic.co/blog/found-elasticsearch-from-the-bottom-up",
      note: "The classic essay walking from the inverted index up to the cluster — the same climb as this story, in prose.",
    },
    {
      kind: "article",
      title: "Let's build a Full-Text Search engine",
      url: "https://artem.krylysov.com/blog/2020/07/28/lets-build-a-full-text-search-engine/",
      note: "An inverted index plus analyzer in ~150 lines of Go — proof that the core really is this small.",
    },
    {
      kind: "book",
      title: "Elasticsearch: The Definitive Guide",
      url: "https://www.elastic.co/guide/en/elasticsearch/guide/current/index.html",
      note: "Old APIs, evergreen concepts — the 'inside a shard' chapters explain segments and refresh honestly.",
    },
    {
      kind: "article",
      title: "Practical BM25",
      url: "https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables",
      note: "How the relevance score is actually computed, built up from the failures of plain TF-IDF.",
    },
  ],
});
