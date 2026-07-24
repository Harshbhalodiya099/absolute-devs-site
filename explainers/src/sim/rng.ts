/**
 * The one sanctioned source of randomness in the sim kernel. A seeded PRNG so a
 * `(graph, seed)` pair always produces the identical trace — the determinism
 * contract in `contracts.ts`. Deliberately the same mulberry32 the assessment
 * engine uses (`learn/assessment/evaluate.ts`): small, well-known, and stable
 * across engines and runs.
 */
import type { SeededRng } from "./contracts";

export function makeRng(seed: number): SeededRng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive: number) => Math.floor(next() * Math.max(0, maxExclusive)),
  };
}
