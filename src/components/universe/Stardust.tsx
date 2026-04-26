import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  count?: number;
  radius?: number;
  /** When true, reduce opacity for the cinematic planet-focus mode. */
  dim?: boolean;
}

/**
 * Subtle stardust field. Far from cluttered — sparse, calm, atmospheric.
 * Bible-approved ingredient: "Subtle stardust fields."
 */
export function Stardust({ count = 1400, radius = 90, dim = false }: Props) {
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Spherical distribution but biased outward.
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = radius * Math.pow(Math.random(), 0.5);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5; // flatter dome
      pos[i * 3 + 2] = r * Math.cos(phi);

      // Mostly cool whites with a few faint cyan/teal tints.
      const tint = Math.random();
      if (tint < 0.04) {
        col[i * 3] = 0.36;
        col[i * 3 + 1] = 0.95;
        col[i * 3 + 2] = 1;
      } else if (tint < 0.08) {
        col[i * 3] = 0.24;
        col[i * 3 + 1] = 1;
        col[i * 3 + 2] = 0.83;
      } else {
        const b = 0.7 + Math.random() * 0.3;
        col[i * 3] = b;
        col[i * 3 + 1] = b;
        col[i * 3 + 2] = b;
      }
    }
    return { positions: pos, colors: col };
  }, [count, radius]);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.01;
    }
    // Gentle twinkle on the stardust as a whole — opacity oscillates softly
    // so the field feels alive without becoming distracting.
    if (matRef.current) {
      const base = 0.78 + Math.sin(state.clock.elapsedTime * 1.4) * 0.08;
      const target = dim ? base * 0.18 : base;
      // Smoothly lerp toward target so transitions feel cinematic.
      matRef.current.opacity += (target - matRef.current.opacity) * Math.min(1, delta * 4);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.16}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  );
}
