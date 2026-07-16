import { motion } from "motion/react";
import { Bubble, C, Icons, Node, Packet, Stage, StageDefs, Wire } from "../framework/stage";
import { useT } from "../framework/speed";
import { Term } from "../framework/Term";

/* ============================================================
   Scene 1 — the browser receives the keystroke
   ============================================================ */
export function SceneInput() {
  const t = useT();
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Stage label="The browser inspects the text you typed">
        <StageDefs />
        {/* the typed text, floating alone */}
        <motion.text
          x={450}
          y={120}
          textAnchor="middle"
          fill={C.ink}
          fontSize={30}
          fontFamily="ui-monospace, monospace"
          initial={{ opacity: 0, scale: 1.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: t(0.8), ease: [0.22, 1, 0.36, 1] }}
        >
          google.com
        </motion.text>

        {/* scanner line sweeping across it */}
        <motion.rect
          x={330}
          y={92}
          width={3}
          height={40}
          rx={1.5}
          fill={C.cyan}
          initial={{ x: 330, opacity: 0 }}
          animate={{ x: [330, 570, 330], opacity: [0, 1, 0] }}
          transition={{ delay: t(0.9), duration: t(1.6), ease: "easeInOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${C.cyan})` }}
        />

        {/* the two questions the browser asks */}
        <Bubble x={260} y={230} w={280} appear={2.4} accent={C.dim} lines={["“Is this a search…?”"]} />
        <Bubble x={640} y={230} w={280} appear={3.0} accent={C.cyan} lines={["“…or a place on the web?”"]} />

        {/* verdict: it's a domain → assemble the full URL */}
        <motion.g
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: t(4.0), duration: t(0.7), ease: [0.22, 1, 0.36, 1] }}
        >
          <rect x={280} y={310} width={340} height={54} rx={14} fill={C.card} stroke={C.cardEdge} />
          <text x={450} y={343} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={19}>
            <tspan fill={C.green}>https://</tspan>
            <tspan fill={C.ink}>google.com</tspan>
            <tspan fill={C.faint}>/</tspan>
          </text>
        </motion.g>
        <motion.text
          x={450}
          y={396}
          textAnchor="middle"
          fill={C.dim}
          fontSize={12}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t(4.6), duration: t(0.6) }}
        >
          It ends in “.com” — that's a place. The browser fills in the rest.
        </motion.text>
      </Stage>
      <p className="max-w-xl text-center text-xs leading-relaxed text-slate-500">
        Ten characters, no protocol, no path. The browser quietly upgrades it to a full{" "}
        <Term tip="A URL names three things: how to talk (https), whom to talk to (google.com), and what to ask for (/, the homepage). You typed only the middle one.">
          URL
        </Term>{" "}
        before anything leaves your machine.
      </p>
    </div>
  );
}

/* ============================================================
   Scene 2 — browser cache
   ============================================================ */
function CacheDrawer({
  x,
  y,
  label,
  value,
  hit,
  appear,
}: {
  x: number;
  y: number;
  label: string;
  value: string;
  hit: boolean;
  appear: number;
}) {
  const t = useT();
  return (
    <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: t(appear), duration: t(0.45) }}>
      <rect x={x - 130} y={y - 22} width={260} height={44} rx={10} fill={C.card} stroke={C.cardEdge} />
      <text x={x - 112} y={y + 5} fill={C.ink} fontSize={13} fontFamily="ui-monospace, monospace">
        {label}
      </text>
      <motion.text
        x={x + 112}
        y={y + 5}
        textAnchor="end"
        fill={hit ? C.green : C.faint}
        fontSize={12}
        fontFamily="ui-monospace, monospace"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t(appear + 0.5), duration: t(0.3) }}
      >
        {value}
      </motion.text>
    </motion.g>
  );
}

export function SceneBrowserCache() {
  const t = useT();
  return (
    <Stage label="The browser searches its own DNS cache and finds nothing">
      <StageDefs />
      <Node x={160} y={130} icon={Icons.globe(C.blue)} label="Browser" sub="checking its notebook" accent={C.blue} />

      {/* a magnifier sweeping over its own memory */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t(0.5), duration: t(0.4) }}
      >
        <text x={560} y={78} textAnchor="middle" fill={C.dim} fontSize={12} letterSpacing="0.15em">
          RECENTLY VISITED — DNS CACHE
        </text>
      </motion.g>

      <CacheDrawer x={560} y={130} label="github.com" value="140.82.113.4" hit appear={0.9} />
      <CacheDrawer x={560} y={186} label="wikipedia.org" value="208.80.154.224" hit appear={1.3} />
      <CacheDrawer x={560} y={242} label="ycombinator.com" value="209.216.230.240" hit appear={1.7} />
      <CacheDrawer x={560} y={298} label="google.com" value="— not here —" hit={false} appear={2.1} />

      {/* highlight ring lands on the missing entry */}
      <motion.rect
        x={422}
        y={272}
        width={276}
        height={52}
        rx={12}
        fill="none"
        stroke={C.rose}
        strokeWidth={1.5}
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: [0, 1, 0.7], scale: 1 }}
        transition={{ delay: t(3.0), duration: t(0.8), ease: [0.34, 1.4, 0.64, 1] }}
        style={{ transformOrigin: "560px 298px" }}
      />

      <Bubble x={160} y={260} w={220} appear={3.8} accent={C.rose} lines={["“I've never met", "google.com before.”"]} />

      <motion.text
        x={450}
        y={408}
        textAnchor="middle"
        fill={C.dim}
        fontSize={12.5}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t(4.4), duration: t(0.6) }}
      >
        A cache hit here would end the search in microseconds. Today, we're not so lucky.
      </motion.text>
    </Stage>
  );
}

/* ============================================================
   Scene 3 — OS cache
   ============================================================ */
export function SceneOsCache() {
  const t = useT();
  return (
    <Stage label="The browser asks the operating system, which also doesn't know">
      <StageDefs />
      <Node x={200} y={160} icon={Icons.globe(C.blue)} label="Browser" accent={C.blue} />
      <Node x={640} y={160} icon={Icons.chip(C.amber)} label="Operating System" sub="resolver cache + hosts file" accent={C.amber} appear={0.4} />

      <Wire d="M 280 160 H 560" appear={0.8} />
      <Packet path="M 280 160 H 560" start={1.2} travel={1.1} color={C.blue} label="google.com?" />

      {/* OS thinks... */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ delay: t(2.5), duration: t(1.4), times: [0, 0.2, 0.8, 1] }}
      >
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={615 + i * 25}
            cy={92}
            r={4}
            fill={C.amber}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ delay: t(2.5 + i * 0.18), duration: t(0.8), repeat: 1 }}
          />
        ))}
      </motion.g>

      <Bubble x={640} y={268} w={240} appear={4.0} accent={C.rose} lines={["“Not in my notes either.”"]} />

      {/* the shrug travels back */}
      <Packet path="M 560 175 H 280" start={4.6} travel={1.0} color={C.faint} label="no idea" />

      <motion.text
        x={450}
        y={390}
        textAnchor="middle"
        fill={C.dim}
        fontSize={12.5}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t(5.4), duration: t(0.6) }}
      >
        Two caches down. Time to ask someone outside this machine.
      </motion.text>
    </Stage>
  );
}
