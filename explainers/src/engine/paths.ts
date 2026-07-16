/**
 * Scrub-safe path travel. CSS offset-path cannot be sampled at an arbitrary
 * time, so paths are measured once via getPointAtLength into a lookup table;
 * position at any progress is a table interpolation.
 */

export interface PathTable {
  pts: { x: number; y: number }[];
}

const cache = new Map<string, PathTable>();
const SAMPLES = 96;

let scratch: SVGPathElement | null = null;

function measure(d: string): PathTable {
  if (!scratch) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.style.width = "0";
    svg.style.height = "0";
    svg.style.overflow = "hidden";
    scratch = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.appendChild(scratch);
    document.body.appendChild(svg);
  }
  scratch.setAttribute("d", d);
  const len = scratch.getTotalLength();
  const pts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = scratch.getPointAtLength((len * i) / SAMPLES);
    pts.push({ x: p.x, y: p.y });
  }
  return { pts };
}

export function pathTable(d: string): PathTable {
  let table = cache.get(d);
  if (!table) {
    table = measure(d);
    cache.set(d, table);
  }
  return table;
}

export function pointAt(table: PathTable, progress: number): { x: number; y: number } {
  const p = Math.min(Math.max(progress, 0), 1) * SAMPLES;
  const i = Math.min(Math.floor(p), SAMPLES - 1);
  const f = p - i;
  const a = table.pts[i];
  const b = table.pts[i + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
