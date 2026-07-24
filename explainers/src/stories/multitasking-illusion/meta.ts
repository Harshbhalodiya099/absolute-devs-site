import { defineMeta } from "../../engine";

export const meta = defineMeta({
  slug: "multitasking-illusion",
  category: "systems",
  title: "The multitasking illusion",
  intro: {
    eyebrow: "An interactive explainer",
    title: "Your computer isn't doing many things at once. It's faking it, brilliantly.",
    lead: "A music player, a browser, a download — all running 'at the same time'. On a single core, none of them are. One core runs exactly one instruction stream at a time; it just rotates between tasks faster than your senses can follow. That trick is concurrency, and it is not the same as parallelism. Watch one core juggle three jobs, see what a context switch really costs, then take the scheduler's own dial and change who gets the core.",
    begin: "Watch one core juggle",
  },
});
