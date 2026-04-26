import type { Galaxy } from "@/types";
import { GALAXIES } from "@/types";

/**
 * Canonical 3D positions for the 7 galaxies in Universe view.
 * Distributed on a flattened ring for easy strategic scan.
 */
function buildPositions(): Record<Galaxy, [number, number, number]> {
  const radius = 28;
  const out = {} as Record<Galaxy, [number, number, number]>;
  GALAXIES.forEach((g, i) => {
    const a = (i / GALAXIES.length) * Math.PI * 2 - Math.PI / 2;
    const wobble = i % 2 === 0 ? 1 : -1;
    out[g] = [Math.cos(a) * radius, wobble * 2.5, Math.sin(a) * radius];
  });
  return out;
}

export const GALAXY_POSITIONS = buildPositions();
