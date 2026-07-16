import { defineMeta } from "../../engine";

export const meta = defineMeta({
  slug: "elasticsearch",
  title: "How Elasticsearch finds your needle in a billion documents",
  intro: {
    eyebrow: "An interactive explainer",
    title: "A search query never reads your documents. It looks them up in a dictionary.",
    lead: "SQL scans every row, every query. Elasticsearch reads your documents once — at write time — and builds a word-to-documents dictionary called an inverted index. After that, a search is a dictionary lookup plus a set intersection, not a scan. Watch the dictionary get built, break it with the wrong analyzer, lose a document to near-real-time refresh, and survive a node death.",
    begin: "Start the race",
  },
});
