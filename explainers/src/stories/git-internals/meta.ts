import { defineMeta } from "../../engine";

export const meta = defineMeta({
  slug: "git-internals",
  category: "dev-tools",
  title: "How Git actually stores your work",
  intro: {
    eyebrow: "An interactive explainer",
    title: "You've feared the wrong thing. A branch is a 41-byte text file.",
    lead: "Every scary git command — rebase, reset, detached HEAD — is a tiny pointer file moving over a store of sealed, immutable objects. Open the .git folder, watch a commit get built from its parts, move the pointers yourself, and leave knowing why you almost can't lose work.",
    begin: "Open the box",
  },
});
