import { defineMeta } from "../../engine";

export const meta = defineMeta({
  slug: "jury-duty",
  category: "systems",
  title: "Jury duty for servers",
  intro: {
    eyebrow: "An interactive explainer",
    title: "A handful of servers, some of which will crash, still agree on one version of the truth.",
    lead: "No machine is in charge in advance, any of them can lag or die, and yet a cluster returns a single ordered history that every server replays identically. The trick isn't trust — it's arithmetic. Watch a leader get elected the way a jury foreman does, watch a command become law only once a majority has written it down, then take the failure dial yourself: kill a follower and the truth holds; kill the majority and the system would rather stall than lie.",
    begin: "Convene the jury",
  },
});
