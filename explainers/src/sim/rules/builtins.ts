/**
 * The built-in component pack — enough kinds to build the load-bearing teaching
 * topologies (Client → API → DB, and the same with a cache in front of the DB).
 * Each entry is the §16 recipe in miniature: a pure rule + a component def that
 * points at it and at a `vocab` preset for the eventual renderer.
 *
 * Rules read only `node.config` (already merged over `defaults`) and `ctx`. A
 * cache is the composition proof: it forwards only its *misses* downstream, so
 * dropping one in front of a DB measurably lowers that DB's load and latency —
 * with zero change to the DB's own rule (see the composition test).
 */
import type { JsonValue, Rule, RuleContext } from "../contracts";
import { registerComponent, registerRule } from "./registry";

/** Read a numeric config value, falling back when absent or non-numeric. */
function num(cfg: Record<string, JsonValue>, key: string, fallback: number): number {
  const v = cfg[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Even split of served traffic across a node's out-edges. */
function fanOut(ctx: RuleContext, fraction = 1): { to: string; fraction: number }[] {
  if (ctx.out.length === 0) return [];
  const each = fraction / ctx.out.length;
  return ctx.out.map((to) => ({ to, fraction: each }));
}

/* ---- rules ---- */

/** A client: generates load, serves nothing, forwards everything downstream. */
const clientRule: Rule = (ctx) => ({
  sourceRps: num(ctx.node.config, "requestRps", 100),
  serviceCostMs: 0,
  forwards: fanOut(ctx),
});

/** A generic request-serving node (web/app server, API). */
const serviceRule: Rule = (ctx) => ({
  capacityRps: num(ctx.node.config, "capacityRps", 500),
  serviceCostMs: num(ctx.node.config, "serviceCostMs", 5),
  forwards: fanOut(ctx),
  metrics: { costPerMonthUsd: num(ctx.node.config, "costUsd", 20) },
});

/** A datastore: lower capacity, higher service cost — the usual bottleneck. */
const datastoreRule: Rule = (ctx) => ({
  capacityRps: num(ctx.node.config, "capacityRps", 200),
  serviceCostMs: num(ctx.node.config, "serviceCostMs", 8),
  forwards: fanOut(ctx),
  metrics: { costPerMonthUsd: num(ctx.node.config, "costUsd", 40) },
});

/** A read-through cache: serves hits from memory, forwards only misses. */
const cacheRule: Rule = (ctx) => {
  const hit = Math.min(Math.max(num(ctx.node.config, "hitRatio", 0.8), 0), 1);
  return {
    capacityRps: num(ctx.node.config, "capacityRps", 50_000),
    serviceCostMs: num(ctx.node.config, "serviceCostMs", 1),
    // Only the misses flow to the DB — this is the composition that teaches.
    forwards: fanOut(ctx, 1 - hit),
    metrics: { cacheHitRatio: hit, costPerMonthUsd: num(ctx.node.config, "costUsd", 15) },
  };
};

/** A load balancer: negligible service cost, spreads traffic across backends. */
const loadBalancerRule: Rule = (ctx) => ({
  capacityRps: num(ctx.node.config, "capacityRps", 100_000),
  serviceCostMs: num(ctx.node.config, "serviceCostMs", 0.5),
  forwards: fanOut(ctx),
  metrics: { costPerMonthUsd: num(ctx.node.config, "costUsd", 25) },
});

/* ---- install ---- */

/**
 * Register the built-in rules and components. Called once at module import (see
 * index.ts) and again by tests after `resetRegistries()`. Idempotent.
 */
export function installBuiltins(): void {
  registerRule("client.source", clientRule);
  registerRule("service.request", serviceRule);
  registerRule("datastore.sql", datastoreRule);
  registerRule("cache.readThrough", cacheRule);
  registerRule("loadBalancer.roundRobin", loadBalancerRule);

  registerComponent({
    kind: "client",
    vocab: "users",
    ruleKey: "client.source",
    defaults: { requestRps: 100 },
    label: "Client",
    version: "1.0.0",
  });
  registerComponent({
    kind: "api",
    vocab: "server",
    ruleKey: "service.request",
    defaults: { capacityRps: 500, serviceCostMs: 5, costUsd: 20 },
    label: "API",
    version: "1.0.0",
  });
  registerComponent({
    kind: "postgres",
    vocab: "database",
    ruleKey: "datastore.sql",
    defaults: { capacityRps: 200, serviceCostMs: 8, costUsd: 40 },
    label: "Postgres",
    version: "1.0.0",
  });
  registerComponent({
    kind: "redis",
    vocab: "cache",
    ruleKey: "cache.readThrough",
    defaults: { hitRatio: 0.8, capacityRps: 50_000, serviceCostMs: 1, costUsd: 15 },
    label: "Redis",
    version: "1.0.0",
  });
  registerComponent({
    kind: "nginx",
    vocab: "loadBalancer",
    ruleKey: "loadBalancer.roundRobin",
    defaults: { capacityRps: 100_000, serviceCostMs: 0.5, costUsd: 25 },
    label: "Load Balancer",
    version: "1.0.0",
  });
}
