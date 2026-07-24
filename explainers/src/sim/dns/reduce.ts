/**
 * DNS simulation — the pure reducer. `reduce(state, action, rng) => state`,
 * never mutating its input, so a `(seed, action list)` pair replays to a
 * byte-identical trace. Only `lookup` consumes randomness (small per-hop
 * jitter); every other action is deterministic on its own.
 *
 * The rng is a defaulted parameter so this doubles as an ordinary two-arg
 * `useReducer` reducer (`reduceDns`): React never has to thread a generator
 * through dispatch, and the seed still fully determines the jitter.
 */
import { makeRng } from "../rng";
import type { SeededRng } from "../contracts";
import type { DnsAction, DnsNodeId, DnsState, Hop } from "./state";

/** Human labels for the causal log — kept out of `state.ts` (pure data there). */
const LABEL: Record<DnsNodeId, string> = {
  client: "your computer",
  resolver: "the resolver",
  root: "the root server",
  tld: "the .com registry",
  auth: "ns1.google.com",
};

/** A real resolver gives up on an unreachable server after a long wait. */
const TIMEOUT_MS = 2000;

/** The full recursive walk, in order. Latency is `base + [0..spread]` jitter. */
const MISS_STEPS: ReadonlyArray<Omit<Hop, "latencyMs"> & { base: number; spread: number }> = [
  { from: "client", to: "resolver", base: 1, spread: 3, note: "your computer asks the resolver: where is google.com?" },
  { from: "resolver", to: "root", base: 12, spread: 12, note: "nothing cached — the resolver asks a root server" },
  { from: "root", to: "tld", base: 16, spread: 14, note: "the root server refers it to the .com registry" },
  { from: "tld", to: "auth", base: 20, spread: 16, note: "the .com registry refers it to ns1.google.com" },
  { from: "auth", to: "resolver", base: 14, spread: 12, note: "ns1.google.com answers authoritatively: 142.250.72.14" },
  { from: "resolver", to: "client", base: 1, spread: 2, note: "the resolver caches the answer and hands it back" },
];

const jitter = (rng: SeededRng, base: number, spread: number) => base + rng.int(spread + 1);

/** Build the walk, truncating at the first unreachable server (a timeout hop). */
function buildMissPlan(down: Record<DnsNodeId, boolean>, rng: SeededRng): Hop[] {
  const plan: Hop[] = [];
  for (const step of MISS_STEPS) {
    if (down[step.to]) {
      plan.push({ from: step.from, to: step.to, latencyMs: TIMEOUT_MS, note: `timed out waiting for ${LABEL[step.to]} — it is unreachable` });
      break;
    }
    plan.push({ from: step.from, to: step.to, latencyMs: jitter(rng, step.base, step.spread), note: step.note });
  }
  return plan;
}

export function reduce(state: DnsState, action: DnsAction, rng: SeededRng = makeRng(state.seed + state.tick)): DnsState {
  const tick = state.tick + 1;

  switch (action.type) {
    case "lookup": {
      // A hit needs the resolver reachable; otherwise even a cached answer can't
      // be asked for, and it degrades to a walk that times out at the resolver.
      const hit = state.cacheEnabled && state.cached && !state.down.resolver;
      const plan: Hop[] = hit
        ? [{ from: "client", to: "resolver", latencyMs: jitter(rng, 1, 3), note: "resolver cache hit — the TTL is still valid, no walk needed" }]
        : buildMissPlan(state.down, rng);
      return { ...state, tick, phase: "walking", plan, activeHop: 0, totalLatencyMs: 0, log: ["Looking up google.com …"] };
    }

    case "advance": {
      if (state.phase !== "walking") return { ...state, tick };
      const hop = state.plan[state.activeHop];
      if (!hop) return { ...state, tick };

      const activeHop = state.activeHop + 1;
      const totalLatencyMs = state.totalLatencyMs + hop.latencyMs;
      const log = [...state.log, `${hop.note} (${hop.latencyMs} ms)`];

      if (activeHop < state.plan.length) {
        return { ...state, tick, activeHop, totalLatencyMs, log };
      }

      // Terminal hop just completed. It failed iff its destination is down.
      const last = state.plan[state.plan.length - 1];
      const failed = state.down[last.to];
      if (failed) {
        return { ...state, tick, activeHop, totalLatencyMs, phase: "failed", log: [...log, `Lookup failed after ${totalLatencyMs} ms — no address returned.`] };
      }
      // A successful answer is written back to the cache when caching is on.
      const cached = state.cacheEnabled ? true : state.cached;
      return { ...state, tick, activeHop, totalLatencyMs, phase: "answered", cached, log: [...log, `Answered in ${totalLatencyMs} ms.`] };
    }

    case "toggleCache": {
      const cacheEnabled = !state.cacheEnabled;
      // Turning caching off also drops whatever answer was being held.
      return { ...state, tick, cacheEnabled, cached: cacheEnabled ? state.cached : false };
    }

    case "clearCache":
      return { ...state, tick, cached: false };

    case "toggleDown":
      return { ...state, tick, down: { ...state.down, [action.node]: !state.down[action.node] } };

    case "reset":
      return { ...state, tick, phase: "idle", plan: [], activeHop: 0, totalLatencyMs: 0, log: [] };

    default:
      return state;
  }
}
