import { defineMeta } from "../../engine";

export const meta = defineMeta({
  slug: "scaling-the-summit",
  category: "deployment-cloud",
  title: "Scaling the summit",
  intro: {
    eyebrow: "An interactive explainer",
    title: "One box serves your first users. Getting to millions is not about buying a bigger box.",
    lead: "Past a point you don't scale up, you scale out — you add ordinary machines and spread the load across them. That only works if your app forgets who it's talking to, and even then the web tier is the easy part: the real wall is the database. Watch the climb one camp at a time, then take the dial yourself — pick bigger-box versus more-boxes and see the whole system change shape.",
    begin: "Start the climb",
  },
});
