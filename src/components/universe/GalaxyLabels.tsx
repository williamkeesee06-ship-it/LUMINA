/**
 * Subtle in-galaxy labels.
 *
 * Each galaxy gets its name rendered at its center as a soft, color-matched
 * tag. Color matches the galaxy's status hue, opacity is intentionally low
 * (≈0.32) so labels read as ambient orientation cues — legible but not loud.
 *
 * Labels:
 *  - hide entirely when a galaxy is focused or when inside a galaxy
 *  - use Billboard so they always face the camera
 *  - sit slightly above the cluster center (y +0.4) so the bright core
 *    doesn't wash out the type
 */
import { Billboard, Text } from "@react-three/drei";
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
      {GALAXIES.filter((g) => g !== "Complete").map((g) => {
        const pos = GALAXY_POSITIONS[g];
        const color = GALAXY_COLORS[g];
        // Dim the non-focused labels even further when one is focused.
        const isFocused = focusedGalaxy === g;
        const opacity = isFocused ? 0 : focusedGalaxy ? 0.16 : 0.34;

        return (
          <Billboard key={g} position={[pos[0], pos[1] + 0.45, pos[2]]}>
            <Text
              fontSize={0.62}
              color={color}
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.18}
              fillOpacity={opacity}
              // No stroke — keep it clean so it reads as part of the cluster
              // glow rather than a UI overlay.
              outlineWidth={0}
            >
              {g.toUpperCase()}
            </Text>
          </Billboard>
        );
      })}
    </>
  );
}
