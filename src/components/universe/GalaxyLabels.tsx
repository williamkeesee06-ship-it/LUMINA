/**
 * Galaxy labels rendered as neon-LED signs above each cluster.
 *
 * Each label is composed of three layered Text instances all sharing the
 * galaxy's color, drawn back-to-front:
 *
 *   1. Wide additive halo — large fillOpacity, big outlineWidth in the
 *      galaxy color, soft. Reads as the bloom around an LED tube.
 *   2. Mid tint pass — same color, smaller halo, more saturated.
 *   3. Crisp white-hot core — brilliant white inner letters with a tight
 *      color outline. Mimics the glowing filament inside neon.
 *
 * Position is well above each cluster (y + 4.5) so the label sits like a
 * marquee in space rather than overlapping the spiral arms. Labels fade
 * to zero when a galaxy is focused or when inside any galaxy.
 */
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { useUI } from "@/store/uiStore";
import { GALAXIES } from "@/types";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { GALAXY_POSITIONS } from "./galaxyLayout";

export function GalaxyLabels() {
  const viewMode = useUI((s) => s.viewMode);
  const focusedGalaxy = useUI((s) => s.focusedGalaxy);

  // Hide all labels the moment we leave universe view.
  if (viewMode !== "universe") return null;

  return (
    <>
      {/* PR #6 follow-up: previously Complete was filtered out so its
          (typically empty) galaxy floated label-less in the upper-right
          while every other bucket got a marquee. Every status bucket must
          render its label tag regardless of count — an empty COMPLETE
          galaxy still belongs in the field and still needs to be
          identifiable + clickable. */}
      {GALAXIES.map((g) => {
        const pos = GALAXY_POSITIONS[g];
        const color = GALAXY_COLORS[g];
        const isFocused = focusedGalaxy === g;
        // Master opacity envelope — fade non-focused labels when another
        // galaxy is focused.
        const opMul = isFocused ? 0 : focusedGalaxy ? 0.55 : 1.0;

        // Lift label well above the cluster so it sits as a marquee, not
        // inside the dust. The 14-unit nebula scaled by ~3 reaches roughly
        // y +3.5; +4.5 keeps the label clearly above that.
        const yOffset = 4.5;

        return (
          <Billboard key={g} position={[pos[0], pos[1] + yOffset, pos[2]]}>
            {/* Layer 1 — wide soft halo (the outer LED bloom). Drawn first
                so subsequent passes sit on top. Big outlineWidth in the
                galaxy color makes the entire glyph radiate. */}
            <Text
              fontSize={0.95}
              color={color}
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.22}
              fillOpacity={0.0}
              outlineWidth={0.32}
              outlineColor={color}
              outlineOpacity={0.32 * opMul}
              outlineBlur={0.22}
              material-blending={THREE.AdditiveBlending}
              material-toneMapped={false}
              material-depthWrite={false}
              material-transparent={true}
            >
              {g.toUpperCase()}
            </Text>

            {/* Layer 2 — mid tint pass. Slightly smaller halo, deeper color
                so the letters feel saturated rather than just bright. */}
            <Text
              fontSize={0.95}
              color={color}
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.22}
              fillOpacity={0.65 * opMul}
              outlineWidth={0.12}
              outlineColor={color}
              outlineOpacity={0.85 * opMul}
              outlineBlur={0.08}
              material-blending={THREE.AdditiveBlending}
              material-toneMapped={false}
              material-depthWrite={false}
              material-transparent={true}
            >
              {g.toUpperCase()}
            </Text>

            {/* Layer 3 — white-hot inner core. The brilliant filament
                inside neon tubing. Tight, additive, pure white. */}
            <Text
              fontSize={0.95}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.22}
              fillOpacity={0.95 * opMul}
              outlineWidth={0.025}
              outlineColor={color}
              outlineOpacity={1.0 * opMul}
              material-blending={THREE.AdditiveBlending}
              material-toneMapped={false}
              material-depthWrite={false}
              material-transparent={true}
            >
              {g.toUpperCase()}
            </Text>
          </Billboard>
        );
      })}
    </>
  );
}
