import { useMotionValue, useMotionValueEvent, type MotionValue } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface Player {
  /** The single clock every animated value derives from. Seconds. */
  time: MotionValue<number>;
  duration: number;
  markers: number[];
  playing: boolean;
  ended: boolean;
  stepIndex: number;
  speed: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  stepForward: () => void;
  stepBack: () => void;
  replay: () => void;
  setSpeed: (s: number) => void;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Owns the clock. A rAF loop advances `time` by dt × speed while playing and
 * auto-pauses at the end. Everything else — scrub, step, replay — is a seek.
 *
 * `autoplay: false` starts (and resets) paused at t=0 — used by reading mode,
 * where figures wait until they scroll into view.
 */
export function usePlayer(duration: number, markers: number[], resetKey: string, autoplay = true): Player {
  const reduced = useMemo(prefersReducedMotion, []);
  const time = useMotionValue(0);
  const [playing, setPlaying] = useState(autoplay && !reduced);
  const [ended, setEnded] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [speed, setSpeed] = useState(0.5);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const indexFor = useCallback(
    (t: number) => {
      let i = 0;
      for (let k = 0; k < markers.length; k++) if (t >= markers[k] - 0.001) i = k;
      return i;
    },
    [markers],
  );

  // New scene / rebuilt scene: reduced motion lands on the finished picture,
  // everyone else starts playing from zero.
  useEffect(() => {
    time.set(reduced ? duration : 0);
    setEnded(reduced);
    setPlaying(autoplay && !reduced);
    setStepIndex(reduced ? Math.max(markers.length - 1, 0) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // The clock.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1); // clamp tab-switch jumps
      last = now;
      const next = time.get() + dt * speedRef.current;
      if (next >= duration) {
        time.set(duration);
        setPlaying(false);
        setEnded(true);
        return;
      }
      time.set(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration, time]);

  // Narration follows the playhead, including while scrubbing.
  useMotionValueEvent(time, "change", (t) => {
    const i = indexFor(t);
    setStepIndex((prev) => (prev === i ? prev : i));
  });

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.min(Math.max(t, 0), duration);
      time.set(clamped);
      setEnded(clamped >= duration - 0.001);
      if (clamped < duration - 0.001 && !playingRef.current) {
        // stay paused; scrubbing shouldn't hijack playback state
      }
    },
    [duration, time],
  );

  const play = useCallback(() => {
    if (time.get() >= duration - 0.001) time.set(0);
    setEnded(false);
    setPlaying(true);
  }, [duration, time]);

  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playingRef.current ? pause() : play()), [pause, play]);

  const stepForward = useCallback(() => {
    const t = time.get();
    const next = markers.find((m) => m > t + 0.01);
    if (next !== undefined) seek(next);
    else seek(duration);
  }, [markers, duration, seek, time]);

  const stepBack = useCallback(() => {
    const t = time.get();
    const i = indexFor(t);
    // within the first beat of a step, go to the previous step; else restart the step
    const target = t - markers[i] < 0.6 && i > 0 ? markers[i - 1] : markers[i];
    seek(target);
  }, [indexFor, markers, seek, time]);

  const replay = useCallback(() => {
    time.set(0);
    setEnded(false);
    setPlaying(true);
    setStepIndex(0);
  }, [time]);

  return {
    time,
    duration,
    markers,
    playing,
    ended,
    stepIndex,
    speed,
    play,
    pause,
    toggle,
    seek,
    stepForward,
    stepBack,
    replay,
    setSpeed,
  };
}
