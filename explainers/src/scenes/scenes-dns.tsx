import { motion } from "motion/react";
import { Bubble, C, Icons, Node, Packet, Stage, StageDefs, Wire } from "../framework/stage";
import { useT } from "../framework/speed";
import { Term } from "../framework/Term";

/* ============================================================
   Scene 4 — leaving the machine: the DNS resolver
   ============================================================ */
export function SceneResolver() {
  const t = useT();
  const path = "M 230 200 C 340 120, 520 120, 640 200";
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Stage label="The question leaves your computer and travels to a DNS resolver">
        <StageDefs />
        <Node x={160} y={220} icon={Icons.laptop(C.blue)} label="Your computer" accent={C.blue} />
        <Node x={710} y={220} icon={Icons.server(C.cyan)} label="DNS resolver" sub="usually your ISP, or 8.8.8.8" accent={C.cyan} appear={0.5} pulse />

        <Wire d={path} appear={0.9} dashed />
        <Packet path={path} start={1.5} travel={1.8} color={C.cyan} label="where is google.com?" keepAlive />

        <Bubble x={160} y={330} w={260} appear={0.3} accent={C.blue} lines={["“Does anyone know", "where google.com is?”"]} />
        <Bubble x={710} y={330} w={250} appear={3.6} accent={C.cyan} lines={["“I don't. But I know", "exactly who to ask.”"]} />

        <motion.text
          x={450}
          y={410}
          textAnchor="middle"
          fill={C.dim}
          fontSize={12.5}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t(4.6), duration: t(0.6) }}
        >
          For the first time, your question exists outside your machine.
        </motion.text>
      </Stage>
      <p className="max-w-xl text-center text-xs leading-relaxed text-slate-500">
        The{" "}
        <Term tip="A recursive resolver is a server whose whole job is answering 'where is X?' on your behalf. It chases the answer through the DNS hierarchy so your computer doesn't have to.">
          resolver
        </Term>{" "}
        is a professional question-asker. It doesn't know the answer — it knows the path to the answer.
      </p>
    </div>
  );
}

/* ============================================================
   Shared layout for the DNS hierarchy scenes (5–7)
   ============================================================ */
function Hierarchy({
  focus,
  children,
}: {
  focus: "root" | "tld" | "auth";
  children: React.ReactNode;
}) {
  return (
    <Stage label="The DNS hierarchy: resolver, root server, .com server, Google's name server">
      <StageDefs />
      <Node x={120} y={230} w={140} icon={Icons.server(C.cyan)} label="Resolver" accent={C.cyan} />
      <Node
        x={420}
        y={90}
        w={170}
        icon={Icons.book(C.amber)}
        label="Root server"
        sub="knows every ending"
        accent={C.amber}
        dim={focus !== "root"}
        pulse={focus === "root"}
      />
      <Node
        x={480}
        y={230}
        w={170}
        icon={Icons.book(C.violet)}
        label=".com server"
        sub="knows every .com"
        accent={C.violet}
        dim={focus !== "tld"}
        pulse={focus === "tld"}
      />
      <Node
        x={540}
        y={370}
        w={190}
        icon={Icons.server(C.green)}
        label="ns1.google.com"
        sub="Google's own name server"
        accent={C.green}
        dim={focus !== "auth"}
        pulse={focus === "auth"}
      />
      {children}
    </Stage>
  );
}

/* Scene 5 — root server */
export function SceneRoot() {
  const up = "M 190 210 C 260 150, 300 110, 335 95";
  const down = "M 335 110 C 300 130, 260 180, 190 225";
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Hierarchy focus="root">
        <Wire d={up} appear={0.5} />
        <Packet path={up} start={0.9} travel={1.3} color={C.cyan} label="google.com?" />
        <Bubble x={700} y={90} w={260} appear={2.6} accent={C.amber} lines={["“.com? Not my department —", "but I know who runs .com.”"]} />
        <Packet path={down} start={3.6} travel={1.2} color={C.amber} label="ask the .com servers" />
      </Hierarchy>
      <p className="max-w-xl text-center text-xs leading-relaxed text-slate-500">
        Thirteen{" "}
        <Term tip="There are 13 named root server identities (a.root-servers.net through m), but each is really hundreds of mirrored machines around the world, found via anycast routing.">
          root server
        </Term>{" "}
        families sit at the very top of the internet's phone book. They don't know addresses — they know who keeps each ending.
      </p>
    </div>
  );
}

/* Scene 6 — TLD server */
export function SceneTld() {
  const over = "M 195 230 H 380";
  const back = "M 380 245 H 195";
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Hierarchy focus="tld">
        <Wire d={over} appear={0.5} />
        <Packet path={over} start={0.9} travel={1.2} color={C.cyan} label="google.com?" />
        <Bubble x={720} y={230} w={280} appear={2.4} accent={C.violet} lines={["“google.com is registered here.", "Its records live with Google.”"]} />
        <Packet path={back} start={3.5} travel={1.1} color={C.violet} label="ask ns1.google.com" />
      </Hierarchy>
      <p className="max-w-xl text-center text-xs leading-relaxed text-slate-500">
        The{" "}
        <Term tip="Top-Level Domain servers. The .com registry (run by Verisign) holds the name-server records for ~160 million .com domains — including which servers speak for google.com.">
          .com TLD servers
        </Term>{" "}
        hold one entry per domain: not the address itself, but who is allowed to give it out.
      </p>
    </div>
  );
}

/* Scene 7 — authoritative server */
export function SceneAuthoritative() {
  const t = useT();
  const down = "M 180 275 C 250 340, 330 365, 435 370";
  const back = "M 435 385 C 330 385, 250 355, 180 290";
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Hierarchy focus="auth">
        <Wire d={down} appear={0.5} />
        <Packet path={down} start={0.9} travel={1.3} color={C.cyan} label="google.com?" />
        <Bubble x={745} y={330} w={230} appear={2.6} accent={C.green} lines={["“Finally — someone", "who actually knows!”"]} />
        <motion.g
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: t(3.4), duration: t(0.6), ease: [0.34, 1.4, 0.64, 1] }}
          style={{ transformOrigin: "745px 400px" }}
        >
          <rect x={640} y={378} width={210} height={44} rx={12} fill="rgba(134,239,172,0.08)" stroke={C.green} strokeOpacity={0.5} />
          <text x={745} y={405} textAnchor="middle" fill={C.green} fontSize={16} fontFamily="ui-monospace, monospace" fontWeight={600}>
            142.250.72.14
          </text>
        </motion.g>
        <Packet path={back} start={4.4} travel={1.3} color={C.green} label="142.250.72.14" keepAlive />
      </Hierarchy>
      <p className="max-w-xl text-center text-xs leading-relaxed text-slate-500">
        This is the{" "}
        <Term tip="'Authoritative' means it doesn't relay anyone else's answer — Google itself operates this server, so its word on google.com is final. It answers with an A record: name → IPv4 address.">
          authoritative name server
        </Term>
        . Google runs it, so this answer is the truth — signed, sealed, and delivered as an A record.
      </p>
    </div>
  );
}

/* ============================================================
   Scene 8 — the IP comes home (and gets cached everywhere)
   ============================================================ */
export function SceneIpReturns() {
  const t = useT();
  const hops: Array<{ x: number; label: string; sub: string }> = [
    { x: 190, label: "Resolver", sub: "caches it" },
    { x: 430, label: "Your OS", sub: "caches it" },
    { x: 670, label: "Browser", sub: "caches it" },
  ];
  return (
    <Stage label="The IP address travels back, being cached at every stop">
      <StageDefs />
      {hops.map((h, i) => (
        <Node key={h.label} x={h.x} y={210} w={150} label={h.label} sub={h.sub} appear={i * 0.2} accent={C.cyan} />
      ))}
      <Wire d="M 265 210 H 355" appear={0.7} />
      <Wire d="M 505 210 H 595" appear={0.9} />

      <Packet path="M 130 210 H 355" start={1.2} travel={1.0} color={C.green} label="142.250.72.14" />
      <Packet path="M 430 210 H 595" start={2.4} travel={1.0} color={C.green} label="142.250.72.14" />

      {/* little cache stamps appearing under each hop */}
      {hops.map((h, i) => (
        <motion.g
          key={h.label}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: t(2.2 + i * 1.0), duration: t(0.45), ease: [0.34, 1.5, 0.64, 1] }}
          style={{ transformOrigin: `${h.x}px 290px` }}
        >
          <rect x={h.x - 66} y={272} width={132} height={34} rx={9} fill="rgba(134,239,172,0.07)" stroke={C.green} strokeOpacity={0.35} />
          <text x={h.x} y={293} textAnchor="middle" fill={C.green} fontSize={11} fontFamily="ui-monospace, monospace">
            saved · TTL 300s
          </text>
        </motion.g>
      ))}

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
        Next time, scene 2 ends the story in microseconds. That's why the web feels fast.
      </motion.text>
    </Stage>
  );
}
