import { motion } from "motion/react";
import { Bubble, C, Icons, Node, Packet, Stage, StageDefs, Wire } from "../framework/stage";
import { useT } from "../framework/speed";
import { Term } from "../framework/Term";

/* ============================================================
   Scene 12 — inside Google's datacenter
   ============================================================ */
export function SceneServer() {
  const t = useT();
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Stage label="The request flows through Google's load balancer to a frontend server and back">
        <StageDefs />
        <Node x={110} y={230} w={130} icon={Icons.globe(C.cyan)} label="Request" sub="arriving" accent={C.cyan} />
        <Node x={340} y={230} w={160} icon={Icons.server(C.amber)} label="Load balancer" sub="picks a healthy server" accent={C.amber} appear={0.3} />
        <Node x={590} y={130} w={160} icon={Icons.server(C.violet)} label="Frontend" sub="builds your page" accent={C.violet} appear={0.6} pulse />
        <Node x={590} y={330} w={160} icon={Icons.server(C.faint)} label="Frontend" sub="busy right now" accent={C.faint} appear={0.6} dim />

        <Wire d="M 175 230 H 260" appear={0.8} />
        <Wire d="M 420 210 C 470 180, 500 160, 510 145" appear={1.0} />
        <Wire d="M 420 250 C 470 280, 500 300, 510 315" appear={1.0} dashed />

        <Packet path="M 175 230 H 260" start={1.3} travel={0.8} color={C.cyan} />
        <Packet path="M 420 210 C 470 180, 500 160, 510 145" start={2.3} travel={1.0} color={C.cyan} label="GET /" />

        {/* the frontend works: little activity bars */}
        {[0, 1, 2, 3].map((i) => (
          <motion.rect
            key={i}
            x={770 + 0}
            y={110 + i * 14}
            width={0}
            height={7}
            rx={3.5}
            fill={C.violet}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: [0, 40 + (i % 2) * 22, 12], opacity: [0, 1, 0.6] }}
            transition={{ delay: t(3.6 + i * 0.25), duration: t(1.0), ease: "easeInOut" }}
          />
        ))}
        <Bubble x={640} y={50} w={330} appear={3.5} accent={C.violet} lines={["assembling HTML · logging · A/B flags · locale…"]} />

        <motion.text
          x={450}
          y={420}
          textAnchor="middle"
          fill={C.dim}
          fontSize={12.5}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t(5.2), duration: t(0.6) }}
        >
          Somewhere in a building full of humming machines, one of them briefly works just for you.
        </motion.text>
      </Stage>
      <p className="max-w-xl text-center text-xs leading-relaxed text-slate-500">
        “Google's server” is really thousands of machines behind a{" "}
        <Term tip="A load balancer spreads incoming requests across many identical servers, skipping any that are overloaded or unhealthy — so no single machine ever has to handle the world.">
          load balancer
        </Term>
        . Your request is routed to whichever one can answer fastest.
      </p>
    </div>
  );
}

/* ============================================================
   Scene 13 — the response streams back
   ============================================================ */
export function SceneResponse() {
  const t = useT();
  const path = "M 760 150 C 620 90, 300 90, 150 150";
  return (
    <Stage label="The HTML response streams back to your computer in many small packets">
      <StageDefs />
      <Node x={790} y={170} w={140} icon={Icons.server(C.violet)} label="Google" accent={C.violet} />
      <Node x={120} y={170} w={140} icon={Icons.laptop(C.blue)} label="You" accent={C.blue} />
      <Wire d={path} appear={0.4} dashed />

      {/* status line stamp */}
      <motion.g
        initial={{ opacity: 0, scale: 1.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: t(0.8), duration: t(0.5), ease: [0.34, 1.4, 0.64, 1] }}
        style={{ transformOrigin: "450px 240px" }}
      >
        <rect x={355} y={214} width={190} height={48} rx={12} fill="rgba(134,239,172,0.08)" stroke={C.green} strokeOpacity={0.5} />
        <text x={450} y={244} textAnchor="middle" fill={C.green} fontSize={17} fontFamily="ui-monospace, monospace" fontWeight={600}>
          200 OK
        </text>
      </motion.g>

      {/* a stream of packets */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Packet key={i} path={path} start={1.6 + i * 0.45} travel={1.6} color={i === 0 ? C.green : C.rose} r={5} label={i === 0 ? "headers" : undefined} />
      ))}

      {/* bytes accumulate at the laptop */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: t(2.8), duration: t(0.4) }}>
        <rect x={50} y={250} width={140} height={12} rx={6} fill="rgba(148,163,184,0.12)" />
        <motion.rect
          x={50}
          y={250}
          height={12}
          rx={6}
          fill={C.rose}
          initial={{ width: 0 }}
          animate={{ width: 140 }}
          transition={{ delay: t(2.9), duration: t(2.6), ease: "easeInOut" }}
        />
        <text x={120} y={284} textAnchor="middle" fill={C.dim} fontSize={11} fontFamily="ui-monospace, monospace">
          index.html · ~55 KB gzipped
        </text>
      </motion.g>

      <Bubble x={450} y={330} w={360} appear={4.6} accent={C.ink} lines={["Not one delivery — a stream of numbered packets,", "reassembled in order by TCP on arrival."]} align="middle" />

      <motion.text
        x={450}
        y={420}
        textAnchor="middle"
        fill={C.dim}
        fontSize={12.5}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t(5.4), duration: t(0.6) }}
      >
        The page now exists on your machine — but only as text. No one has drawn anything yet.
      </motion.text>
    </Stage>
  );
}

/* ============================================================
   Scene 14 — rendering: text becomes structure becomes pixels
   ============================================================ */
export function SceneRender() {
  const t = useT();
  type TreeNode = { x: number; y: number; label: string; d: number };
  const nodes: TreeNode[] = [
    { x: 450, y: 120, label: "html", d: 0 },
    { x: 330, y: 190, label: "head", d: 1 },
    { x: 570, y: 190, label: "body", d: 1 },
    { x: 250, y: 260, label: "title", d: 2 },
    { x: 410, y: 260, label: "style", d: 2 },
    { x: 510, y: 260, label: "form", d: 2 },
    { x: 640, y: 260, label: "img", d: 2 },
    { x: 510, y: 330, label: "input", d: 3 },
  ];
  const edges: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
    [2, 5],
    [2, 6],
    [5, 7],
  ];
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Stage label="Raw HTML is parsed into a DOM tree, then painted to pixels">
        <StageDefs />
        {/* raw text on the left, fading as the tree grows */}
        <motion.g initial={{ opacity: 1 }} animate={{ opacity: 0.25 }} transition={{ delay: t(2.2), duration: t(1.2) }}>
          {["<!doctype html>", "<html>", "  <head>…</head>", "  <body>", "    <form>…</form>", "  </body>", "</html>"].map((line, i) => (
            <motion.text
              key={i}
              x={60}
              y={130 + i * 24}
              fill={C.dim}
              fontSize={12.5}
              fontFamily="ui-monospace, monospace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: t(0.3 + i * 0.15), duration: t(0.3) }}
            >
              {line}
            </motion.text>
          ))}
        </motion.g>

        {/* the DOM tree assembles, staggered by depth */}
        {edges.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y + 14}
            x2={nodes[b].x}
            y2={nodes[b].y - 14}
            stroke={C.line}
            strokeWidth={1.2}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: t(1.6 + nodes[b].d * 0.5), duration: t(0.4) }}
          />
        ))}
        {nodes.map((n, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: t(1.3 + n.d * 0.5), duration: t(0.45), ease: [0.34, 1.5, 0.64, 1] }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          >
            <rect x={n.x - 34} y={n.y - 14} width={68} height={28} rx={8} fill={C.card} stroke={C.cardEdge} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fill={C.cyan} fontSize={12} fontFamily="ui-monospace, monospace">
              {n.label}
            </text>
          </motion.g>
        ))}

        {/* paint pass: a sweep that leaves "pixels" behind */}
        <motion.rect
          x={730}
          y={110}
          width={120}
          height={250}
          rx={12}
          fill={C.card}
          stroke={C.cardEdge}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t(4.0), duration: t(0.5) }}
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.rect
            key={i}
            x={742}
            y={130 + i * 44}
            width={i === 2 ? 96 : 60 + (i % 3) * 14}
            height={i === 2 ? 26 : 12}
            rx={6}
            fill={i === 2 ? "rgba(125,211,252,0.35)" : "rgba(148,163,184,0.25)"}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: t(4.4 + i * 0.22), duration: t(0.4), ease: "easeOut" }}
            style={{ transformOrigin: `742px ${130 + i * 44}px` }}
          />
        ))}
        <motion.text
          x={790}
          y={390}
          textAnchor="middle"
          fill={C.dim}
          fontSize={11}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t(5.2), duration: t(0.5) }}
        >
          layout → paint
        </motion.text>

        <motion.text
          x={450}
          y={420}
          textAnchor="middle"
          fill={C.dim}
          fontSize={12.5}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t(5.6), duration: t(0.6) }}
        >
          text → tree → boxes → pixels. Every page you've ever seen took this exact path.
        </motion.text>
      </Stage>
      <p className="max-w-xl text-center text-xs leading-relaxed text-slate-500">
        The browser parses HTML into the{" "}
        <Term tip="The Document Object Model — a live tree of every element on the page. CSS is parsed into a similar tree (the CSSOM); together they decide what gets drawn where.">
          DOM
        </Term>
        , computes where every box belongs, then hands the layout to the GPU to paint.
      </p>
    </div>
  );
}

/* ============================================================
   Scene 15 — the page appears
   ============================================================ */
export function SceneDone() {
  const t = useT();
  // x positions account for each glyph's width so the wordmark kerns correctly
  const letters = [
    { ch: "G", color: "#7dd3fc", x: 398 },
    { ch: "o", color: "#fda4af", x: 426 },
    { ch: "o", color: "#fcd34d", x: 450 },
    { ch: "g", color: "#7dd3fc", x: 474 },
    { ch: "l", color: "#86efac", x: 490 },
    { ch: "e", color: "#fda4af", x: 507 },
  ];
  const steps = [
    "parse", "cache", "cache", "resolver", "root", "tld", "auth", "ip", "tcp", "tls", "http", "server", "bytes", "render", "✓",
  ];
  return (
    <Stage label="The finished page appears, with a recap of every step of the journey">
      <StageDefs />
      {/* a minimal, abstract search page materializes */}
      <motion.rect
        x={230}
        y={60}
        width={440}
        height={250}
        rx={18}
        fill={C.card}
        stroke={C.cardEdge}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: t(0.8), ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "450px 185px" }}
      />
      <g>
        {letters.map((l, i) => (
          <motion.text
            key={i}
            x={l.x}
            y={165}
            textAnchor="middle"
            fill={l.color}
            fontSize={40}
            fontWeight={700}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: t(0.5 + i * 0.1), duration: t(0.5), ease: [0.34, 1.4, 0.64, 1] }}
          >
            {l.ch}
          </motion.text>
        ))}
      </g>
      <motion.rect
        x={310}
        y={200}
        width={280}
        height={40}
        rx={20}
        fill="rgba(10,13,22,0.7)"
        stroke={C.cardEdge}
        initial={{ opacity: 0, scaleX: 0.6 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: t(1.3), duration: t(0.6), ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "450px 220px" }}
      />
      <motion.circle
        cx={568}
        cy={220}
        r={7}
        fill="none"
        stroke={C.dim}
        strokeWidth={1.6}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t(1.8), duration: t(0.4) }}
      />

      {/* elapsed-time counter */}
      <motion.text
        x={450}
        y={295}
        textAnchor="middle"
        fill={C.green}
        fontSize={13}
        fontFamily="ui-monospace, monospace"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t(2.2), duration: t(0.5) }}
      >
        elapsed: ~300 milliseconds
      </motion.text>

      {/* recap: the whole journey as a row of lights */}
      <motion.text
        x={450}
        y={352}
        textAnchor="middle"
        fill={C.dim}
        fontSize={11}
        letterSpacing="0.18em"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t(2.8), duration: t(0.5) }}
      >
        EVERYTHING THAT JUST HAPPENED
      </motion.text>
      {steps.map((s, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: t(3.0 + i * 0.12), duration: t(0.35) }}
        >
          <circle cx={140 + i * 44} cy={385} r={4} fill={i === steps.length - 1 ? C.green : C.cyan} opacity={0.9} />
          <text x={140 + i * 44} y={408} textAnchor="middle" fill={C.faint} fontSize={9.5}>
            {s}
          </text>
          {i < steps.length - 1 && <line x1={148 + i * 44} y1={385} x2={176 + i * 44} y2={385} stroke={C.line} strokeWidth={1} />}
        </motion.g>
      ))}

      <motion.text
        x={450}
        y={445}
        textAnchor="middle"
        fill={C.dim}
        fontSize={12.5}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t(5.2), duration: t(0.8) }}
      >
        And you'll do it all again — without noticing — the next time you press Enter.
      </motion.text>
    </Stage>
  );
}
