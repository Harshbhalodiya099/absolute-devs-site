/**
 * Mode Host — the composition shell (plan §3, §4).
 *
 * It builds the shared `HostServices` once and hands the same object to every
 * mode, then renders the active one. Tab chrome appears ONLY when an explainer
 * has more than one mode, so a single-mode explainer (most of the library)
 * renders pixel-identical to the pre-shell path.
 *
 * Phase 2 services: `vocab` and `nav` are real (the quiz mode uses `nav` to
 * send a learner back to the story); `selection`/`timeline`/`controls` remain
 * part of the contract but unbuilt (see `contracts.ts`).
 */
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as vocab from "../../vocab";
import type { ExplainerDef, HostServices } from "../contracts";

export function ModeHost({ explainer }: { explainer: ExplainerDef }) {
  const { modes } = explainer;
  // A deep link can open a specific mode: /learn/<slug>?mode=quiz. Used by the
  // essay's "check your understanding" CTA to hand the reader straight to it.
  const [active, setActive] = useState(() => {
    const id = new URLSearchParams(window.location.search).get("mode");
    const i = id ? modes.findIndex((m) => m.id === id) : -1;
    return i >= 0 ? i : 0;
  });
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // Different explainer, fresh start: otherwise a learner who left DNS on its
  // quiz tab would land on the quiz of the next explainer they opened.
  const [seenSlug, setSeenSlug] = useState(explainer.meta.slug);
  if (seenSlug !== explainer.meta.slug) {
    setSeenSlug(explainer.meta.slug);
    setActive(0);
  }

  const index = active < modes.length ? active : 0;

  const host = useMemo<HostServices>(
    () => ({
      vocab,
      nav: {
        modes: modes.map((m) => ({ id: m.id, label: m.label })),
        activeId: modes[index].id,
        go: (id) => {
          const to = modes.findIndex((m) => m.id === id);
          if (to >= 0) setActive(to);
        },
      },
    }),
    [modes, index],
  );

  // Single mode → no chrome at all: identical to the direct-shell path.
  if (modes.length <= 1) return <>{modes[0].render(host)}</>;

  const focusTab = (to: number) => {
    const i = ((to % modes.length) + modes.length) % modes.length;
    setActive(i);
    tabs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight") focusTab(index + 1);
    else if (e.key === "ArrowLeft") focusTab(index - 1);
    else if (e.key === "Home") focusTab(0);
    else if (e.key === "End") focusTab(modes.length - 1);
    else return;
    e.preventDefault();
  };

  const current = modes[index];
  return (
    <div className="flex min-h-dvh flex-col">
      <nav
        className="mx-auto mt-4 flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-900/40 p-1"
        aria-label={`${explainer.meta.title} modes`}
        role="tablist"
        onKeyDown={onKeyDown}
      >
        {modes.map((m, i) => (
          <button
            key={m.id}
            id={`mode-tab-${m.id}`}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={i === index}
            aria-controls={`mode-panel-${m.id}`}
            tabIndex={i === index ? 0 : -1}
            onClick={() => setActive(i)}
            className={
              "cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-teal-300/60 focus-visible:outline-none " +
              (i === index
                ? "bg-slate-100 text-slate-900 shadow-[0_0_18px_rgba(94,234,212,0.18)]"
                : "text-slate-300 hover:text-white")
            }
          >
            {m.label}
          </button>
        ))}
      </nav>
      <div
        id={`mode-panel-${current.id}`}
        role="tabpanel"
        aria-labelledby={`mode-tab-${current.id}`}
        className="flex flex-1 flex-col"
      >
        {current.render(host)}
      </div>
    </div>
  );
}
