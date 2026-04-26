import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useUI } from "@/store/uiStore";
import { GALAXY_POSITIONS } from "./galaxyLayout";

/**
 * Cinematic camera. Bible: motion must communicate mass and command —
 * not gamey. We critically damp toward target position and target lookAt.
 *
 * Three travel modes:
 *  - Universe overview: high, slightly elevated, looking at origin.
 *  - Galaxy entry: pull into a single galaxy from a tactical angle.
 *  - Planet focus: tighter shot biased toward selected planet.
 */
export function CameraRig() {
  const { camera } = useThree();
  const viewMode = useUI((s) => s.viewMode);
  const focusedGalaxy = useUI((s) => s.focusedGalaxy);
  const selectedJobId = useUI((s) => s.selectedJobId);
  const jobs = useUI((s) => s.jobs);

  const targetPos = useRef(new THREE.Vector3(0, 22, 60));
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));
  const currentLook = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (viewMode === "universe") {
      targetPos.current.set(0, 22, 60);
      targetLook.current.set(0, 0, 0);
    } else if (viewMode === "galaxy" && focusedGalaxy) {
      const p = GALAXY_POSITIONS[focusedGalaxy];
      // Approach from offset; aim at galaxy.
      const offset = new THREE.Vector3(0, 4, 14);
      targetPos.current.set(p[0] + offset.x, p[1] + offset.y, p[2] + offset.z);
      targetLook.current.set(p[0], p[1], p[2]);
    } else if (viewMode === "planet" && selectedJobId && focusedGalaxy) {
      const galaxyPos = GALAXY_POSITIONS[focusedGalaxy];
      // Slightly closer than galaxy.
      targetPos.current.set(galaxyPos[0] + 7, galaxyPos[1] + 3, galaxyPos[2] + 9);
      targetLook.current.set(galaxyPos[0], galaxyPos[1], galaxyPos[2]);
    }
  }, [viewMode, focusedGalaxy, selectedJobId, jobs]);

  useFrame((_, delta) => {
    // Critical damping toward target. Keeps motion controlled, not bouncy.
    const lambda = 2.4;
    const k = 1 - Math.exp(-lambda * delta);
    camera.position.lerp(targetPos.current, k);
    currentLook.current.lerp(targetLook.current, k);
    camera.lookAt(currentLook.current);
  });

  return null;
}
