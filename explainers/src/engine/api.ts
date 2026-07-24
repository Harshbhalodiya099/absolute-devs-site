/**
 * The engine endpoint — one simplified surface for authoring explainers.
 *
 * A story used to import ~30 named symbols from the engine. Instead, import a
 * single handle and reach the whole vocabulary through it:
 *
 *   import { E } from "../../engine";
 *
 *   export default E.story({
 *     ...meta,
 *     scenes: [
 *       E.scene({
 *         id, chapter, question, title, takeaway, nextPrompt,
 *         setup: (s) => {
 *           const { users, app } = s.cast({ users: E.v.users(E.spot("left")), app: E.v.pod({ x: 680, y: 262 }) });
 *           const link = s.connect(users, app);
 *           s.step("A request arrives, the container answers.", [E.enter([users, app]), E.draw(link), link.send()]);
 *         },
 *       }),
 *     ],
 *   });
 *
 * Nothing here is new engine behaviour — `E` is a facade that re-groups the
 * existing builders, layout, motion, verbs and presets under one autocompleteable
 * namespace. The individual named exports still exist (index.ts) for anyone who
 * prefers them; `E` is just the simple front door.
 */
import { node, bubble, label, region, token, dot } from "./actors";
import { above, below, between, leftOf, rightOf } from "./geometry";
import { at, column, grid, inside, radial, row, spot, spread, stack } from "./layout";
import {
  all,
  appear,
  draw,
  fadeTo,
  flash,
  focus,
  frame,
  glowOff,
  glowOn,
  move,
  pulse,
  resetCam,
  seq,
  shake,
  show,
  stagger,
  travel,
  vanish,
  wait,
  dim,
  undim,
} from "./motion";
import { choice, scene, toggle } from "./scene";
import { definePreset, v } from "../vocab";
import { defineActorKind } from "./registry";
import { crash, enter, exit, revive } from "./verbs";
import { defineMeta, defineStory } from "./story";

/**
 * The single public authoring endpoint. Grouped by what an author reaches for:
 * builders, the visual vocabulary, layout, motion, and semantic verbs.
 */
export const E = {
  /* ---- top-level builders (make an explainer) ---- */
  /** The whole explainer: `E.story({ ...meta, scenes })`. */
  story: defineStory,
  /** Alias of `story`, for the "make an explainer" reading. */
  explainer: defineStory,
  /** The tiny library-card record, authored in meta.ts. */
  meta: defineMeta,
  /** One scene: id/chapter/question/title/takeaway/nextPrompt + setup. */
  scene,

  /* ---- interaction ---- */
  /** Two-state switch param. */
  toggle,
  /** Multi-choice param. */
  choice,

  /* ---- the visual vocabulary (same concept, same look) ---- */
  /** Presets: `E.v.users`, `E.v.pod`, `E.v.database`… */
  v,
  /** Define a story-local preset once, reuse it everywhere. */
  definePreset,

  /* ---- raw actor factories ---- */
  node,
  bubble,
  label,
  region,
  token,
  dot,
  /** Custom renderer, last resort — prefer a new glyph or a preset. */
  defineActorKind,

  /* ---- layout (describe arrangements; the engine derives coordinates) ---- */
  spot,
  at,
  row,
  column,
  grid,
  radial,
  stack,
  inside,
  spread,
  between,
  below,
  above,
  leftOf,
  rightOf,

  /* ---- motion: combinators ---- */
  seq,
  all,
  stagger,
  wait,

  /* ---- motion: narrative (gate) ---- */
  appear,
  vanish,
  show,
  fadeTo,
  move,
  travel,
  draw,

  /* ---- motion: emphasis (layer) ---- */
  pulse,
  flash,
  glowOn,
  glowOff,
  dim,
  undim,
  shake,

  /* ---- motion: camera ---- */
  focus,
  frame,
  resetCam,

  /* ---- semantic verbs (choreography with a name) ---- */
  crash,
  revive,
  enter,
  exit,
} as const;
