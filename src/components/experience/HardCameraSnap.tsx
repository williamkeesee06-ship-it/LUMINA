import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CinematicCameraProps {
  zoomTarget: { center: THREE.Vector3; cameraPos: THREE.Vector3 } | null;
  viewMode: string;
  onComplete: () => void;
}

/**
 * CinematicCamera handles smooth transitions between view modes.
 * It replaces the previous 'hard snap' logic with dampened interpolation.
 */
export function HardCameraSnap({ zoomTarget, viewMode, onComplete }: CinematicCameraProps) {
  const { camera } = useThree();
  const controls = useThree(state => state.controls) as any;
  const isTransitioning = useRef(false);

  useEffect(() => {
    if (zoomTarget) {
      isTransitioning.current = true;
      
      // Temporarily disable user interaction and freeze inertia
      if (controls) {
        controls.enabled = false;
        controls.update(); // Freeze current momentum
      }

      // Safety fallback: Force complete after 2 seconds if distance check fails
      const timeout = setTimeout(() => {
        if (isTransitioning.current) {
          isTransitioning.current = false;
          if (controls) controls.enabled = true;
          onComplete();
        }
      }, 2000);

      return () => {
        clearTimeout(timeout);
        if (controls) controls.enabled = true;
      };
    }
  }, [zoomTarget, onComplete, controls]);

  useFrame((_state, delta) => {
    if (!zoomTarget || !isTransitioning.current) return;

    const lerpFactor = 1 - Math.pow(0.005, delta); // Slightly slower for cinematic feel

    if (controls) {
      controls.target.lerp(zoomTarget.center, lerpFactor);
      camera.position.lerp(zoomTarget.cameraPos, lerpFactor);
      controls.update();
    } else {
      camera.position.lerp(zoomTarget.cameraPos, lerpFactor);
      camera.lookAt(zoomTarget.center);
    }

    // Completion Check: If we are very close to the target, finish early
    const distSq = camera.position.distanceToSquared(zoomTarget.cameraPos);
    const targetDistSq = controls ? controls.target.distanceToSquared(zoomTarget.center) : 0;
    
    if (distSq < 0.001 && targetDistSq < 0.001) {
      isTransitioning.current = false;
      if (controls) controls.enabled = true;
      onComplete();
    }
  });


  return null;
}
