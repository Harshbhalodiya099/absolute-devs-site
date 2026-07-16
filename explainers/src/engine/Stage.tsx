import { useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { pathTable, pointAt } from "./paths";
import { getRenderer, StageDefs } from "./registry";
import { sampleActor, sampleTrack } from "./timeline";
import { STAGE_H, STAGE_W, type CompiledActor, type CompiledScene } from "./types";

/** Below this rendered width the stage zooms in and crops instead of shrinking. */
const NARROW_PX = 640;

/**
 * On a narrow viewport the world is shown through a cropping (slice) window.
 * The zoom bias re-fits the scene's content bounds to that window's shape, so
 * the resting frame stays complete while the tall container delivers the
 * apparent-size gain; directed camera moves scale with it.
 */
function narrowZoomBias(scene: CompiledScene, w: number, h: number): number {
  const pxPerUnit = Math.max(w / STAGE_W, h / STAGE_H); // slice: cover, not contain
  const visW = w / pxPerUnit;
  const visH = h / pxPerUnit;
  const fit = Math.min(visW / scene.home.w, visH / scene.home.h);
  return Math.min(Math.max(fit / scene.home.zoom, 0.4), 1.8);
}

/**
 * The stage renders a compiled scene at the player's current time.
 * React renders the structure once; every frame is DOM writes only.
 *
 * Sizing: the SVG scales via viewBox but is capped so the whole scene
 * (header → stage → caption → transport) fits one viewport. On narrow
 * viewports it claims a fixed band of the screen, biases the camera zoom up
 * and crops (slice) rather than letterboxing a uniformly shrunken world.
 */
export function Stage({
  scene,
  time,
  ariaLabel,
  onInspect,
}: {
  scene: CompiledScene;
  time: MotionValue<number>;
  ariaLabel: string;
  onInspect: (note: string | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = size !== null && size.w < NARROW_PX;
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      preserveAspectRatio={narrow ? "xMidYMid slice" : "xMidYMid meet"}
      role="img"
      aria-label={ariaLabel}
      className="w-full select-none"
      style={
        narrow
          ? { height: "56dvh" }
          : { height: "auto", aspectRatio: `${STAGE_W} / ${STAGE_H}`, maxHeight: "calc(100dvh - 24rem)" }
      }
    >
      <StageDefs />
      <CameraRig scene={scene} time={time} zoomBias={narrow && size ? narrowZoomBias(scene, size.w, size.h) : 1}>
        {scene.actors.map((actor) => (
          <ActorView key={actor.id} actor={actor} time={time} onInspect={onInspect} />
        ))}
      </CameraRig>
    </svg>
  );
}

/* ---------------- camera ---------------- */

function CameraRig({
  scene,
  time,
  zoomBias,
  children,
}: {
  scene: CompiledScene;
  time: MotionValue<number>;
  zoomBias: number;
  children: React.ReactNode;
}) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    const update = (t: number) => {
      const x = sampleTrack(scene.camera.camX, t, scene.home.x);
      const y = sampleTrack(scene.camera.camY, t, scene.home.y);
      const z = sampleTrack(scene.camera.camZoom, t, scene.home.zoom) * zoomBias;
      ref.current?.setAttribute(
        "transform",
        `translate(${STAGE_W / 2 - x * z} ${STAGE_H / 2 - y * z}) scale(${z})`,
      );
    };
    update(time.get());
    return time.on("change", update);
  }, [scene, time, zoomBias]);
  return <g ref={ref}>{children}</g>;
}

/* ---------------- actor binding ---------------- */

function ActorView({
  actor,
  time,
  onInspect,
}: {
  actor: CompiledActor;
  time: MotionValue<number>;
  onInspect: (note: string | null) => void;
}) {
  const ref = useRef<SVGGElement>(null);
  const Renderer = getRenderer(actor.spec.kind);

  const isPacket = actor.spec.kind === "packet";
  const table = useMemo(() => {
    if (!isPacket) return null;
    const d = actor.spec.props?.path as string | undefined;
    return d ? pathTable(d) : null;
  }, [isPacket, actor.spec.props]);

  // Channels renderers consume directly.
  const glow = useTransform(time, (t) => sampleActor(actor, "glow", t));
  const progress = useTransform(time, (t) => sampleActor(actor, "progress", t));

  // Position, entrance lift, wobble, scale, opacity(dim) — written per frame.
  useMotionValueEvent(time, "change", (t) => writeFrame(t));
  const writeFrame = (t: number) => {
    const el = ref.current;
    if (!el) return;
    let x: number;
    let y: number;
    if (table) {
      const p = pointAt(table, sampleActor(actor, "progress", t));
      x = p.x;
      y = p.y;
    } else {
      x = sampleActor(actor, "x", t);
      y = sampleActor(actor, "y", t) + sampleActor(actor, "lift", t);
    }
    const wobble = sampleActor(actor, "wobble", t);
    if (wobble > 0.001) x += Math.sin(t * 46) * 5 * wobble;
    const scale = sampleActor(actor, "scale", t);
    const opacity = sampleActor(actor, "opacity", t) * (1 - 0.75 * sampleActor(actor, "dim", t));
    el.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
    el.setAttribute("opacity", String(Math.max(opacity, 0)));
    el.style.pointerEvents = opacity < 0.15 ? "none" : "";
  };
  // Paint the initial frame (and after recompiles).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => writeFrame(time.get()));

  if (!Renderer) {
    console.warn(`[engine] unknown actor kind "${actor.spec.kind}"`);
    return null;
  }

  const note = actor.spec.note;
  return (
    <g
      ref={ref}
      onPointerEnter={note ? () => onInspect(note) : undefined}
      onPointerLeave={note ? () => onInspect(null) : undefined}
      style={note ? { cursor: "help" } : undefined}
    >
      <Renderer p={actor.spec.props ?? {}} glow={glow} progress={progress} />
    </g>
  );
}
