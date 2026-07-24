---
name: new-explainer
description: Author a new interactive explainer story for the engine. Read this FIRST, before opening any engine source or existing story — it points to the tool-neutral API reference and adds the token-cheap workflow.
---

# Authoring a new explainer

**The API reference is `explainers/AUTHORING.md`.** Read it first — it is
tool-neutral (any LLM or developer can use it) and contains the complete
authoring surface: the `E` endpoint, the `s`-vs-`E` model of `setup`, layout,
presets, relationships, motions, params, and the quality bar. Do NOT read
`src/engine/*` or `ENGINE.md` to author — only if you hit a genuine engine gap
(then fix the engine, not the story). `src/stories/kubernetes/story.ts` is the
canonical worked example.

This file adds only the **workflow** on top of that reference — the part that is
about how *you* (an agent) should spend effort, not about the engine.

## Workflow — two phases, in this order

**Phase 1 — script (plain text, no code).** Write the full scene plan and show
it to the user for approval BEFORE writing any TypeScript:
- 3–5 scenes; each with: chapter, question, title, takeaway, nextPrompt.
- Per scene: 3–6 steps, each step = one caption sentence + a note of what
  appears/moves on stage.
- The arc that works: pain/problem → mechanism → anatomy → payoff. Narration
  creates curiosity ("who do you ask when nobody knows?"), takeaways answer it.

**Phase 2 — code, once.** Only after the script is approved:
1. Create `src/stories/<slug>/meta.ts` + `src/stories/<slug>/story.ts` (shapes
   in AUTHORING.md). Discovery is automatic via glob — touch NO other file.
2. Translate the script scene by scene. Never invent new narrative in code.
3. Verify cheaply: `npx tsc -b` + `npx vite build`, then run dev and check the
   validator (it throws in dev naming scene/step/actor for empty steps,
   unknown actors, never-visible actors, negative timing, overlaps).
4. Screenshots are the expensive loop: at most ONE screenshot pass, per scene,
   at the very end, via the `verify` skill. Never screenshot-iterate on
   pixel positions — use the layout engine instead.
