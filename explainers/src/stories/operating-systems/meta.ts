import { defineMeta } from "../../engine";

export const meta = defineMeta({
  slug: "operating-systems",
  category: "systems",
  title: "How your operating system fakes an entire computer",
  intro: {
    eyebrow: "An interactive explainer",
    title: "Right now, your OS is not running. It's asleep — waiting for a bell.",
    lead: "Every program on your machine believes it owns the entire CPU and all of memory. None of them do. The operating system manufactures that illusion by waking for a few microseconds whenever a hardware timer fires, swapping one program for another so fast nobody notices, then going right back to sleep. Watch the trick, break it on purpose, and leave knowing what happens between any two lines of your own code.",
    begin: "Break the machine",
  },
});
