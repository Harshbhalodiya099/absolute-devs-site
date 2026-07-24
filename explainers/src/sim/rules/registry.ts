/**
 * The rule + component registries — the extensibility spine (sim-engine-plan.md
 * §8, §16). The kernel is closed for modification, open for extension: to add a
 * component you `registerRule` + `registerComponent`, and nothing in the kernel
 * moves. A node's `kind` resolves to a `ComponentDef`, whose `ruleKey` resolves
 * to a pure `Rule`.
 *
 * Registration is idempotent by key so a hot-reloaded data pack replaces its own
 * entry instead of erroring. Tests get `resetRegistries()` to return to a known
 * state; `installBuiltins()` (in builtins.ts) repopulates the defaults.
 */
import type { ComponentDef, Rule } from "../contracts";

const rules = new Map<string, Rule>();
const components = new Map<string, ComponentDef>();

export function registerRule(key: string, rule: Rule): void {
  rules.set(key, rule);
}

export function registerComponent(def: ComponentDef): void {
  components.set(def.kind, def);
}

/** The rule for a component kind, or throws with a message an author can act on. */
export function ruleFor(kind: string): Rule {
  const comp = components.get(kind);
  if (!comp) throw new Error(`[sim] unknown component kind "${kind}" — register it before use`);
  const rule = rules.get(comp.ruleKey);
  if (!rule) throw new Error(`[sim] component "${kind}" references unregistered rule "${comp.ruleKey}"`);
  return rule;
}

/** The component definition for a kind, or undefined. */
export function componentFor(kind: string): ComponentDef | undefined {
  return components.get(kind);
}

/** Known component kinds (sorted), e.g. to build a scenario palette later. */
export function componentKinds(): string[] {
  return [...components.keys()].sort();
}

/** Wipe both registries. Test-only — production installs run once at import. */
export function resetRegistries(): void {
  rules.clear();
  components.clear();
}
