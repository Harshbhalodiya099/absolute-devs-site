import { motion } from "motion/react";
import { Bubble, C, Icons, Node, Packet, Stage, StageDefs, Wire } from "../framework/stage";
import { useT } from "../framework/speed";
import { Term } from "../framework/Term";

const LEFT = 170;
const RIGHT = 730;

function TwoParties({ children, rightSub = "142.250.72.14" }: { children: React.ReactNode; rightSub?: string }) {
  return (
    <Stage label="Your computer and Google's server, connected by a wire">
      <StageDefs />
      <Node x={LEFT} y={120} icon={Icons.laptop(C.blue)} label="You" sub="your computer" accent={C.blue} />
      <Node x={RIGHT} y={120} icon={Icons.server(C.violet)} label="Google" sub={rightSub} accent={C.violet} appear={0.2} />
      <Wire d={`M ${LEFT + 80} 120 H ${RIGHT - 80}`} appear={0.5} />
      {children}
    </Stage>
  );
}

/* ============================================================
   Scene 9 — TCP handshake
   ============================================================ */
export function SceneTcp() {
  const t = useT();
  const toRight = `M ${LEFT + 80} 120 H ${RIGHT - 80}`;
  const toLeft = `M ${RIGHT - 80} 135 H ${LEFT + 80}`;
  const toRight2 = `M ${LEFT + 80} 150 H ${RIGHT - 80}`;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <TwoParties>
        {/* 1. SYN */}
        <Packet path={toRight} start={0.9} travel={1.2} color={C.cyan} label="SYN — “can we talk?”" />
        <Bubble x={LEFT} y={230} w={230} appear={0.6} accent={C.cyan} lines={["“Hello! Are you there?”"]} />

        {/* 2. SYN-ACK */}
        <Packet path={toLeft} start={2.4} travel={1.2} color={C.violet} label="SYN-ACK — “yes! you?”" />
        <Bubble x={RIGHT} y={230} w={250} appear={2.7} accent={C.violet} lines={["“I'm here. I can hear you —", "can you hear me?”"]} />

        {/* 3. ACK */}
        <Packet path={toRight2} start={4.2} travel={1.2} color={C.cyan} label="ACK — “loud and clear”" />
        <Bubble x={LEFT} y={320} w={230} appear={4.5} accent={C.cyan} lines={["“Loud and clear.”"]} />

        {/* the wire lights up: connection established */}
        <motion.path
          d={`M ${LEFT + 80} 120 H ${RIGHT - 80}`}
          fill="none"
          stroke={C.green}
          strokeWidth={2}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          transition={{ delay: t(5.6), duration: t(0.8), ease: "easeInOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${C.green})` }}
        />
        <motion.text
          x={450}
          y={100}
          textAnchor="middle"
          fill={C.green}
          fontSize={12}
          letterSpacing="0.15em"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t(6.2), duration: t(0.5) }}
        >
          CONNECTION ESTABLISHED
        </motion.text>

        <motion.text
          x={450}
          y={400}
          textAnchor="middle"
          fill={C.dim}
          fontSize={12.5}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t(6.6), duration: t(0.6) }}
        >
          Three messages. Both sides now know the other can hear them.
        </motion.text>
      </TwoParties>
      <p className="max-w-xl text-center text-xs leading-relaxed text-slate-500">
        This is the{" "}
        <Term tip="TCP's three-way handshake (SYN, SYN-ACK, ACK) synchronizes sequence numbers on both sides, so every byte sent afterwards can be ordered, acknowledged, and re-sent if it gets lost.">
          TCP three-way handshake
        </Term>{" "}
        — the internet's version of “testing, testing, 1-2-3” before anyone says anything important.
      </p>
    </div>
  );
}

/* ============================================================
   Scene 10 — TLS handshake
   ============================================================ */
export function SceneTls() {
  const t = useT();
  const toRight = `M ${LEFT + 80} 120 H ${RIGHT - 80}`;
  const toLeft = `M ${RIGHT - 80} 135 H ${LEFT + 80}`;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <TwoParties>
        <Packet path={toRight} start={0.8} travel={1.1} color={C.cyan} label="“let's speak in secret”" />
        <Packet path={toLeft} start={2.1} travel={1.1} color={C.violet} label="certificate — “here's my ID”" />

        {/* certificate check */}
        <motion.g
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: t(3.3), duration: t(0.5) }}
        >
          <rect x={LEFT - 105} y={200} width={210} height={64} rx={12} fill={C.card} stroke={C.cardEdge} />
          <text x={LEFT} y={226} textAnchor="middle" fill={C.ink} fontSize={12}>
            Issued to: google.com
          </text>
          <motion.text
            x={LEFT}
            y={248}
            textAnchor="middle"
            fill={C.green}
            fontSize={12}
            fontWeight={600}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: t(4.0), duration: t(0.4) }}
          >
            ✓ signed by a trusted authority
          </motion.text>
        </motion.g>

        {/* key exchange sparkle in the middle */}
        <motion.g
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: t(4.8), duration: t(0.7), ease: [0.34, 1.5, 0.64, 1] }}
          style={{ transformOrigin: "450px 300px" }}
        >
          <g transform="translate(450, 300)">{Icons.lock(C.green)}</g>
          <motion.circle
            cx={450}
            cy={300}
            r={30}
            fill="none"
            stroke={C.green}
            strokeOpacity={0.4}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.5], opacity: [0.7, 0] }}
            transition={{ delay: t(5.0), duration: t(1.2), repeat: Infinity, repeatDelay: t(0.8) }}
            style={{ transformOrigin: "450px 300px" }}
          />
          <text x={450} y={348} textAnchor="middle" fill={C.green} fontSize={12} fontWeight={600}>
            shared secret key created
          </text>
          <text x={450} y={366} textAnchor="middle" fill={C.dim} fontSize={11}>
            never sent across the wire — computed by both sides
          </text>
        </motion.g>

        {/* the wire becomes a tunnel */}
        <motion.rect
          x={LEFT + 80}
          y={108}
          width={RIGHT - LEFT - 160}
          height={24}
          rx={12}
          fill="rgba(134,239,172,0.06)"
          stroke={C.green}
          strokeOpacity={0.45}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t(6.0), duration: t(0.8) }}
        />
        <motion.text
          x={450}
          y={95}
          textAnchor="middle"
          fill={C.green}
          fontSize={12}
          letterSpacing="0.15em"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t(6.4), duration: t(0.5) }}
        >
          ENCRYPTED TUNNEL — TLS 1.3
        </motion.text>
      </TwoParties>
      <p className="max-w-xl text-center text-xs leading-relaxed text-slate-500">
        Via a{" "}
        <Term tip="TLS key exchange (usually elliptic-curve Diffie-Hellman) lets two strangers each combine a private value with the other's public value and arrive at the same secret — while an eavesdropper seeing both public values learns nothing.">
          key exchange
        </Term>
        , both sides derive the same secret without ever transmitting it. From here on, eavesdroppers see only noise.
      </p>
    </div>
  );
}

/* ============================================================
   Scene 11 — the HTTP request
   ============================================================ */
export function SceneHttp() {
  const t = useT();
  const toRight = `M ${LEFT + 80} 120 H ${RIGHT - 80}`;
  return (
    <TwoParties>
      {/* the tunnel persists from last scene */}
      <rect
        x={LEFT + 80}
        y={108}
        width={RIGHT - LEFT - 160}
        height={24}
        rx={12}
        fill="rgba(134,239,172,0.05)"
        stroke={C.green}
        strokeOpacity={0.3}
      />

      {/* the request, written as a letter */}
      <motion.g
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: t(0.6), duration: t(0.7), ease: [0.22, 1, 0.36, 1] }}
      >
        <rect x={290} y={200} width={320} height={150} rx={14} fill="rgba(10,13,22,0.9)" stroke={C.cardEdge} />
        <text x={310} y={232} fill={C.cyan} fontSize={14} fontFamily="ui-monospace, monospace" fontWeight={600}>
          GET / HTTP/2
        </text>
        {[
          ["host:", " google.com"],
          ["user-agent:", " your browser"],
          ["accept:", " text/html"],
          ["accept-encoding:", " gzip, br"],
        ].map(([k, v], i) => (
          <motion.text
            key={k}
            x={310}
            y={260 + i * 22}
            fontSize={12.5}
            fontFamily="ui-monospace, monospace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: t(1.2 + i * 0.35), duration: t(0.4) }}
          >
            <tspan fill={C.violet}>{k}</tspan>
            <tspan fill={C.dim}>{v}</tspan>
          </motion.text>
        ))}
      </motion.g>

      <Packet path={toRight} start={3.8} travel={1.6} color={C.cyan} r={7} label="GET / — “the homepage, please”" keepAlive />

      <motion.text
        x={450}
        y={400}
        textAnchor="middle"
        fill={C.dim}
        fontSize={12.5}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t(5.4), duration: t(0.6) }}
      >
        After all that ceremony, the actual question is one line: “GET /” — give me the homepage.
      </motion.text>
    </TwoParties>
  );
}
