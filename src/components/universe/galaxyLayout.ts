import type { Galaxy } from "@/types";
import { GALAXIES } from "@/types";

/**
 * Canonical 3D positions for the 7 galaxies in Universe view.
 * Distributed on a flattened ring for easy strategic scan.
 */
function buildPositions(): Record<Galaxy, [number, number, number]> {
  // Spread the ring outward so each cluster has clear empty void between it
  // and its neighbors. Galaxies have an effective silhouette radius of ~6
  // units; previous ring radius of 28 packed them shoulder-to-shoulder.
  // 42 gives generous breathing room without losing the cluster relationship.
  const radius = 42;
  const out = {} as Record<Galaxy, [number, number, number]>;
  GALAXIES.forEach((g, i) => {
    const a = (i / GALAXIES.length) * Math.PI * 2 - Math.PI / 2;
    // Slightly larger vertical wobble keeps the ring from looking like a tidy
    // disc now that the spacing is wider.
    const wobble = i % 2 === 0 ? 1 : -1;
    out[g] = [Math.cos(a) * radius, wobble * 3.5, Math.sin(a) * radius];
  });
  return out;
}

export const GALAXY_POSITIONS = buildPositions();
