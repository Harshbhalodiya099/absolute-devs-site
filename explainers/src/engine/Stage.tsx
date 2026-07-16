import { useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { pathTable, pointAt } from "./paths";
import { getRenderer, StageDefs } from "./registry";
import { sampleActor, sampleTrack } from "./timeline";
import { STAGE_H, STAGE_W, type CompiledActor, type CompiledScene } from "./types";

/**
 * The stage renders a compiled scene at the player's current time.
 * React renders the structure once; every frame is DOM writes only.
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
  return (
    <svg
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      role="img"
      aria-label={ariaLabel}
      className="h-auto w-full max-w-[960px] select-none"
    >
      <StageDefs />
      <CameraRig scene={scene} time={time}>
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
  children,
}: {
  scene: CompiledScene;
  time: MotionValue<number>;
  children: React.ReactNode;
}) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    const update = (t: number) => {
      const x = sampleTrack(scene.camera.camX, t, STAGE_W / 2);
      const y = sampleTrack(scene.camera.camY, t, STAGE_H / 2);
      const z = sampleTrack(scene.camera.camZoom, t, 1);
      ref.current?.setAttribute(
        "transform",
        `translate(${STAGE_W / 2 - x * z} ${STAGE_H / 2 - y * z}) scale(${z})`,
      );
    };
    update(time.get());
    return time.on("change", update);
  }, [scene, time]);
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
    const opacity = sampleActor(actor, "opacity", t) * (1 - 0.68 * sampleActor(actor, "dim", t));
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
