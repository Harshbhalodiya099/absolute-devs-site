/**
 * vocab/ — the shared visual language of every explainer: presets · glyphs ·
 * accents. Extracted from engine/ (Phase 0) so that future modes (Simulation,
 * Assessment) can resolve the same look without depending on the animation
 * engine's internals. The animation engine imports these back through here.
 *
 * `accents.ts` is React-free; `glyphs.tsx` is the SVG (React) member;
 * `presets.ts` binds them into animation ActorSpecs (its one back-import into
 * engine/, documented there).
 */
export * from "./accents";
export * from "./glyphs";
export * from "./presets";
