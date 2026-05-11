import type { Galaxy } from "@/types";
import { GALAXIES } from "@/types";

/**
 * Canonical 3D positions for the 7 galaxies in Universe view.
 * Distributed on a flattened ring for easy strategic scan.
 */
function buildPositions(): Record<Galaxy, [number, number, number]> {
  // Spread the ring outward so each cluster has clear empty void between it
  // and its neighbors. PR #5 bumped 42 → 78 (≈1.85×); PR #6 follow-up pushes
  // further to 120 (≈2.85× original) so the galaxy field fills more of the
  // god-view canvas. The per-galaxy particle clouds are intentionally LEFT
  // UNCONSTRAINED — neighboring dust should continue to bleed and overlap so
  // the universe reads as a real galaxy field, not a set of contained discs.
  const radius = 120;
  const out = {} as Record<Galaxy, [number, number, number]>;
  GALAXIES.forEach((g, i) => {
    const a = (i / GALAXIES.length) * Math.PI * 2 - Math.PI / 2;
    // Larger vertical wobble scaled with the wider ring so the layout
    // doesn't flatten into a perfect disc at god view.
    const wobble = i % 2 === 0 ? 1 : -1;
    out[g] = [Math.cos(a) * radius, wobble * 6, Math.sin(a) * radius];
  });
  return out;
}

export const GALAXY_POSITIONS = buildPositions();
