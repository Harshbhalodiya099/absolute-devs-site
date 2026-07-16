import { createContext, useContext } from "react";

/**
 * Global playback speed. Scenes wrap every duration/delay in t() so the
 * whole choreography scales together.
 */
export const SpeedContext = createContext(1);

export function useT() {
  const speed = useContext(SpeedContext);
  return (seconds: number) => seconds / speed;
}
