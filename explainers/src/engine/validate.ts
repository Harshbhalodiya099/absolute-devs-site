/**
 * Dev-time scene validation. The DSL's types prevent most invalid stories at
 * compile time; this catches what types cannot — dead actors, empty beats,
 * malformed timing — and fails loudly during development instead of shipping
 * a silently broken explainer.
 */
import { CAMERA, type ActorSpec, type SceneContent } from "./types";

/** Solid, opaque actors whose footprints must not sit on top of one another.
 *  Regions are transparent containers, dots/labels are small annotations, and
 *  wires/packets travel — none of those participate in the overlap guard. */
const SOLID_KINDS = new Set(["node", "token", "bubble"]);
/** Overlap depth (px) on both axes below which contact reads as deliberate —
 *  a stacked deck (`stack`, dy≈10), touching pills, a `below(x, gap)` anchor. */
const CONTACT_SLOP = 12;

const nameOf = (id: string, spec: ActorSpec): string => {
  const label = spec.props?.label ?? spec.props?.text;
  return label ? `${id} ("${String(label).slice(0, 24)}")` : id;
};

/** Actors whose box is static (never moved) and still on stage at scene end —
 *  the only pairs where a footprint collision is a real, visible defect. */
function settledSolids(content: SceneContent): [string, ActorSpec][] {
  const moved = new Set<string>();
  // Opacity a target settles to at scene end. Act `at` is relative to its own
  // step (steps.emit(0)), so a later step always supersedes an earlier one;
  // within a step the latest-ending opacity act wins.
  const lastOpacity = new Map<string, { step: number; end: number; to: number }>();
  content.steps.forEach((step, si) => {
    for (const act of step.acts) {
      if (act.channel === "x" || act.channel === "y") moved.add(act.target);
      if (act.channel === "opacity") {
        const end = act.at + act.dur;
        const prev = lastOpacity.get(act.target);
        if (!prev || si > prev.step || (si === prev.step && end >= prev.end)) {
          lastOpacity.set(act.target, { step: si, end, to: act.to });
        }
      }
    }
  });
  return Object.entries(content.actors).filter(([id, spec]) => {
    if (!spec.box || !SOLID_KINDS.has(spec.kind) || moved.has(id)) return false;
    const settled = lastOpacity.get(id);
    const opacity = settled ? settled.to : spec.visible ? 1 : 0;
    return opacity > 0.1;
  });
}

/** Overlap depth on each axis; both positive means the boxes truly intersect. */
function overlap(a: ActorSpec, b: ActorSpec): { dx: number; dy: number } {
  const dx = Math.min(a.x + a.box!.w / 2, b.x + b.box!.w / 2) - Math.max(a.x - a.box!.w / 2, b.x - b.box!.w / 2);
  const dy = Math.min(a.y + a.box!.h / 2, b.y + b.box!.h / 2) - Math.max(a.y - a.box!.h / 2, b.y - b.box!.h / 2);
  return { dx, dy };
}

export function validateContent(sceneId: string, content: SceneContent): void {
  const problems: string[] = [];

  // Actors that are visible from the start, or become visible via opacity acts.
  const revealed = new Set<string>();
  for (const [id, spec] of Object.entries(content.actors)) {
    if (spec.visible) revealed.add(id);
  }

  if (content.steps.length === 0) problems.push("scene has no steps");

  content.steps.forEach((step, i) => {
    const where = `step ${i + 1} ("${step.caption.slice(0, 40)}…")`;
    if (!step.caption.trim()) problems.push(`step ${i + 1} has an empty caption — every beat narrates`);
    if (step.acts.length === 0) problems.push(`${where} has no motion`);
    for (const act of step.acts) {
      if (act.target !== CAMERA && !(act.target in content.actors)) {
        problems.push(`${where} animates unknown actor "${act.target}"`);
      }
      if (act.at < 0 || act.dur < 0) problems.push(`${where} has negative timing on "${act.target}.${act.channel}"`);
      if (act.channel === "opacity" && act.to > 0) revealed.add(act.target);
    }
  });

  for (const id of Object.keys(content.actors)) {
    if (!revealed.has(id)) {
      problems.push(`actor "${id}" never becomes visible — remove it or reveal it (appear/show/draw/travel)`);
    }
  }

  // Solid cards must not sit on top of one another. Two same-time actors whose
  // boxes overlap on both axes occlude each other — a token over a node card,
  // two machines drawn at the same spot. A card (node/bubble) must be involved;
  // pill-on-pill contact is often a deliberate cluster, so it is left alone.
  const solids = settledSolids(content);
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const [idA, a] = solids[i];
      const [idB, b] = solids[j];
      if (a.kind === "token" && b.kind === "token") continue;
      const { dx, dy } = overlap(a, b);
      if (dx > CONTACT_SLOP && dy > CONTACT_SLOP) {
        problems.push(
          `actors ${nameOf(idA, a)} and ${nameOf(idB, b)} overlap by ${Math.round(dx)}×${Math.round(dy)}px — ` +
            `anchor one with above()/below()/leftOf()/rightOf() instead of raw x/y so it clears the other's footprint`,
        );
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`[engine] invalid scene "${sceneId}":\n  - ${problems.join("\n  - ")}`);
  }
}
