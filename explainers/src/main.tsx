import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Library } from "./app/Library";
import { StoryLoader } from "./app/StoryLoader";
import { library } from "./stories";
import { ExplainerShell } from "./framework/ExplainerShell";
import { Intro } from "./scenes/Intro";
import { googleJourney } from "./scenes/google-journey";

// /learn/<slug> opens one explainer (add ?read for essay mode).
// The base ("/learn/") is stripped; the first path segment is the slug.
// With a single story in the library, the root goes straight to it.
// Legacy ?story=<slug> links still work. ?v0 keeps the original explainer.
const search = new URLSearchParams(window.location.search);
const base = import.meta.env.BASE_URL; // "/learn/"
const rest = window.location.pathname.startsWith(base)
  ? window.location.pathname.slice(base.length)
  : window.location.pathname.replace(/^\//, "");
const pathSlug = rest.replace(/\/+$/, "").split("/")[0] || null;
const slug = pathSlug ?? search.get("story") ?? (library.length === 1 ? library[0].slug : null);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {search.has("v0") ? (
      <ExplainerShell explainer={googleJourney} Intro={Intro} />
    ) : slug ? (
      <StoryLoader slug={slug} read={search.has("read")} />
    ) : (
      <Library />
    )}
  </StrictMode>,
);
