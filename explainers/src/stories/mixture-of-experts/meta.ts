import { defineMeta } from "../../engine";

export const meta = defineMeta({
  slug: "mixture-of-experts",
  title: "How mixture of experts makes giant models affordable",
  intro: {
    eyebrow: "An interactive explainer",
    title: "47 billion parameters. 13 billion used. That gap is the whole trick.",
    lead: "A dense neural network fires every parameter for every token — double the size, double the bill. Mixture of Experts breaks that coupling: a tiny learned router sends each token to only a few specialist sub-networks, so the model's knowledge is vast but each token's path through it is narrow. Watch the router dispatch, break it on purpose, and discover that the 'experts' aren't what you think.",
    begin: "Scale the wall",
  },
});
