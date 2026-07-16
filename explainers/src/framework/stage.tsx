import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useT } from "./speed";

/**
 * Shared SVG stage. Every scene draws inside a fixed 900×460 coordinate
 * space so choreography is precise and the whole thing scales responsively.
 */
export function Stage({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg
      viewBox="0 0 900 460"
      role="img"
      aria-label={label}
      className="h-auto max-h-[52dvh] w-full max-w-[820px] select-none"
    >
      {children}
    </svg>
  );
}

/* ---------- palette ---------- */
export const C = {
  ink: "#e8ecf4",
  dim: "#8b93a7",
  faint: "#4a5165",
  line: "rgba(139,147,167,0.28)",
  cyan: "#5eead4",
  blue: "#7dd3fc",
  violet: "#c4b5fd",
  amber: "#fcd34d",
  rose: "#fda4af",
  green: "#86efac",
  card: "rgba(148,163,184,0.07)",
  cardEdge: "rgba(148,163,184,0.22)",
};

/* ---------- a glassy node card ---------- */
export function Node({
  x,
  y,
  w = 150,
  h = 84,
  icon,
  label,
  sub,
  accent = C.blue,
  appear = 0,
  dim = false,
  pulse = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  icon?: ReactNode;
  label: string;
  sub?: string;
  accent?: string;
  appear?: number;
  dim?: boolean;
  pulse?: boolean;
}) {
  const t = useT();
  return (
    <motion.g
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: dim ? 0.35 : 1, y: 0 }}
      transition={{ delay: t(appear), duration: t(0.6), ease: [0.22, 1, 0.36, 1] }}
    >
      {pulse && (
        <motion.rect
          x={x - w / 2 - 6}
          y={y - h / 2 - 6}
          width={w + 12}
          height={h + 12}
          rx={20}
          fill="none"
          stroke={accent}
          strokeOpacity={0.5}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{ delay: t(appear + 0.3), duration: t(1.6), repeat: Infinity, repeatDelay: t(0.6) }}
        />
      )}
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={16}
        fill={C.card}
        stroke={C.cardEdge}
        strokeWidth={1}
      />
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={16} fill="url(#nodeSheen)" opacity={0.5} />
      {icon && <g transform={`translate(${x}, ${y - 12})`}>{icon}</g>}
      <text x={x} y={icon ? y + 18 : y - 2} textAnchor="middle" fill={C.ink} fontSize={14} fontWeight={600}>
        {label}
      </text>
      {sub && (
        <text x={x} y={icon ? y + 34 : y + 16} textAnchor="middle" fill={C.dim} fontSize={11}>
          {sub}
        </text>
      )}
    </motion.g>
  );
}

/* ---------- a wire that draws itself ---------- */
export function Wire({
  d,
  appear = 0,
  color = C.line,
  dashed = false,
}: {
  d: string;
  appear?: number;
  color?: string;
  dashed?: boolean;
}) {
  const t = useT();
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeDasharray={dashed ? "4 6" : undefined}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ delay: t(appear), duration: t(0.8), ease: "easeInOut" }}
    />
  );
}

/* ---------- the hero: a glowing packet travelling a path ---------- */
export function Packet({
  path,
  start,
  travel = 1.4,
  color = C.cyan,
  r = 6,
  label,
  keepAlive = false,
}: {
  /** SVG path to travel along */
  path: string;
  /** seconds (1×) before departure */
  start: number;
  travel?: number;
  color?: string;
  r?: number;
  label?: string;
  /** keep glowing at destination instead of fading out */
  keepAlive?: boolean;
}) {
  const t = useT();
  return (
    <>
      {/* invisible rail the packet follows */}
      <path id={undefined} d={path} fill="none" stroke="none" />
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: keepAlive ? [0, 1, 1] : [0, 1, 1, 0] }}
        transition={{ delay: t(start), duration: t(travel), times: keepAlive ? [0, 0.08, 1] : [0, 0.08, 0.9, 1] }}
      >
        <motion.circle
          r={r * 2.6}
          fill={color}
          opacity={0.18}
          initial={{ offsetDistance: "0%" }}
          animate={{ offsetDistance: "100%" }}
          style={{ offsetPath: `path("${path}")`, offsetRotate: "0deg" }}
          transition={{ delay: t(start), duration: t(travel), ease: [0.45, 0, 0.25, 1] }}
        />
        <motion.circle
          r={r}
          fill={color}
          initial={{ offsetDistance: "0%" }}
          animate={{ offsetDistance: "100%" }}
          style={{ offsetPath: `path("${path}")`, offsetRotate: "0deg", filter: `drop-shadow(0 0 8px ${color})` }}
          transition={{ delay: t(start), duration: t(travel), ease: [0.45, 0, 0.25, 1] }}
        />
        {label && (
          <motion.g
            initial={{ offsetDistance: "0%" }}
            animate={{ offsetDistance: "100%" }}
            style={{ offsetPath: `path("${path}")`, offsetRotate: "0deg" }}
            transition={{ delay: t(start), duration: t(travel), ease: [0.45, 0, 0.25, 1] }}
          >
            <text y={-14} textAnchor="middle" fill={color} fontSize={11} fontWeight={600} letterSpacing="0.06em">
              {label}
            </text>
          </motion.g>
        )}
      </motion.g>
    </>
  );
}

/* ---------- a speech bubble ---------- */
export function Bubble({
  x,
  y,
  w = 240,
  lines,
  appear,
  accent = C.ink,
  align = "middle",
}: {
  x: number;
  y: number;
  w?: number;
  lines: string[];
  appear: number;
  accent?: string;
  align?: "middle" | "start";
}) {
  const t = useT();
  const h = 20 + lines.length * 18;
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: t(appear), duration: t(0.5), ease: [0.34, 1.3, 0.64, 1] }}
      style={{ transformOrigin: `${x}px ${y}px` }}
    >
      <rect
        x={align === "middle" ? x - w / 2 : x}
        y={y - h / 2}
        width={w}
        height={h}
        rx={12}
        fill="rgba(10,13,22,0.85)"
        stroke={C.cardEdge}
      />
      {lines.map((line, i) => (
        <text
          key={i}
          x={align === "middle" ? x : x + 14}
          y={y - h / 2 + 24 + i * 18}
          textAnchor={align}
          fill={i === 0 ? accent : C.dim}
          fontSize={i === 0 ? 13 : 11.5}
          fontWeight={i === 0 ? 600 : 400}
          fontStyle={i === 0 ? "italic" : "normal"}
        >
          {line}
        </text>
      ))}
    </motion.g>
  );
}

/* ---------- tiny icons drawn in SVG (centered on 0,0) ---------- */
export const Icons = {
  laptop: (color = C.blue) => (
    <g stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x={-13} y={-11} width={26} height={16} rx={2.5} />
      <path d="M -17 8 H 17" />
    </g>
  ),
  globe: (color = C.cyan) => (
    <g stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round">
      <circle r={11} />
      <ellipse rx={5} ry={11} />
      <path d="M -10.5 -4 H 10.5 M -10.5 4 H 10.5" />
    </g>
  ),
  server: (color = C.violet) => (
    <g stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round">
      <rect x={-12} y={-12} width={24} height={9} rx={2.5} />
      <rect x={-12} y={2} width={24} height={9} rx={2.5} />
      <circle cx={-7} cy={-7.5} r={1.1} fill={color} stroke="none" />
      <circle cx={-7} cy={6.5} r={1.1} fill={color} stroke="none" />
    </g>
  ),
  chip: (color = C.amber) => (
    <g stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round">
      <rect x={-9} y={-9} width={18} height={18} rx={3} />
      <path d="M -4 -13 V -9 M 0 -13 V -9 M 4 -13 V -9 M -4 13 V 9 M 0 13 V 9 M 4 13 V 9 M -13 -4 H -9 M -13 0 H -9 M -13 4 H -9 M 13 -4 H 9 M 13 0 H 9 M 13 4 H 9" />
    </g>
  ),
  lock: (color = C.green) => (
    <g stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round">
      <rect x={-9} y={-3} width={18} height={13} rx={3} />
      <path d="M -5 -3 V -7 a 5 5 0 0 1 10 0 V -3" />
    </g>
  ),
  doc: (color = C.rose) => (
    <g stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M -8 -12 H 3 L 8 -7 V 12 H -8 Z" />
      <path d="M -4 -2 H 4 M -4 3 H 4 M -4 8 H 1" />
    </g>
  ),
  book: (color = C.amber) => (
    <g stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 0 -9 C -3 -12 -9 -12 -12 -10 V 9 C -9 7 -3 7 0 10 C 3 7 9 7 12 9 V -10 C 9 -12 3 -12 0 -9 Z" />
      <path d="M 0 -9 V 10" />
    </g>
  ),
};

/* ---------- defs every stage can use ---------- */
export function StageDefs() {
  return (
    <defs>
      <linearGradient id="nodeSheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(255,255,255,0.07)" />
        <stop offset="45%" stopColor="rgba(255,255,255,0)" />
      </linearGradient>
    </defs>
  );
}
