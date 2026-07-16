/**
 * Dev-time scene validation. The DSL's types prevent most invalid stories at
 * compile time; this catches what types cannot — dead actors, empty beats,
 * malformed timing — and fails loudly during development instead of shipping
 * a silently broken explainer.
 */
import { CAMERA, type SceneContent } from "./types";

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

  if (problems.length > 0) {
    throw new Error(`[engine] invalid scene "${sceneId}":\n  - ${problems.join("\n  - ")}`);
  }
}
