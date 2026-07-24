import { defineMeta } from "../../engine";

export const meta = defineMeta({
  slug: "kubernetes",
  category: "deployment-cloud",
  title: "How Kubernetes keeps your app alive",
  intro: {
    eyebrow: "An interactive explainer",
    title: "Your app crashed at 3 A.M. Nobody woke up. It came back anyway.",
    lead: "Every server dies eventually — the question is who's watching when it does. Follow one app from a single fragile container to a self-healing cluster, and meet the one idea underneath all of Kubernetes: a loop that never stops comparing what you asked for with what's actually running.",
    begin: "Watch it heal",
  },
});
