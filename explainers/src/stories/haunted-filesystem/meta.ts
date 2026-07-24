import { defineMeta } from "../../engine";

export const meta = defineMeta({
  slug: "haunted-filesystem",
  category: "systems",
  title: "The secret lives of deleted files",
  intro: {
    eyebrow: "An interactive explainer",
    title: "You didn't delete that file. You just tore up its library card.",
    lead: "`rm` feels like destruction — the name vanishes and the space comes back. But almost nothing is destroyed. Delete removes a directory entry and drops a counter; the inode and every byte sit on disk, fully intact, until something else overwrites them. That gap is exactly why recovery tools work — and why 'empty the trash' is not the same as 'shred'. Follow one file from name to bytes, delete it, then bring it back.",
    begin: "Delete a file",
  },
});
