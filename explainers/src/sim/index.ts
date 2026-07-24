/**
 * The Sim facade — the one autocompleteable front door, mirroring the animation
 * engine's `E` and the assessment engine's `defineAssessment`. Importing this
 * module installs the built-in component pack as a side effect, so a caller can
 * build a graph and run it without touching the registries directly.
 *
 * Everything here is headless and deterministic (see contracts.ts). Phases 4+
 * (events, scenarios, timeline, renderer) add exports here; the kernel contract
 * below does not change.
 */
import { installBuiltins } from "./rules/builtins";

// Register the default components once, at import.
installBuiltins();

export type {
  ComponentDef,
  Forward,
  JsonValue,
  MetricKey,
  NodeMetrics,
  Rule,
  RuleContext,
  RuleOutput,
  SeededRng,
  SimEdge,
  SimGraph,
  SimNode,
  SimState,
  NodeId,
  EdgeId,
} from "./contracts";

export { createSim, step, run, serialize } from "./kernel/kernel";
export {
  registerRule,
  registerComponent,
  componentFor,
  componentKinds,
  ruleFor,
  resetRegistries,
} from "./rules/registry";
export { installBuiltins } from "./rules/builtins";
export { makeRng } from "./rng";

import type { SimEdge, SimNode } from "./contracts";

/** Terse node literal for tests/scenarios: `defNode("db", "postgres")`. */
export const defNode = (id: string, kind: string, config: SimNode["config"] = {}): SimNode => ({
  id,
  kind,
  config,
  status: "healthy",
});

/** Terse edge literal: `defEdge("api", "db")` ⇒ id `"api->db"`. */
export const defEdge = (from: string, to: string, kind?: string): SimEdge => ({
  id: `${from}->${to}`,
  from,
  to,
  kind,
});
