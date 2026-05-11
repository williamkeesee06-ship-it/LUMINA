import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildHazeMaterial } from "./CosmicDust";

/**
 *  Universe-wide ambient haze patches. 3 large billboarded plasma panels
 *  (PR #11: cut from 7 + halved intensity) positioned in the void between
 *  galaxies — all panel centers are well over 60u from any galaxy center
 *  (galaxies sit on a 120u ring).
 */
interface HazePanel {
  pos: [number, number, number];
  scale: number;
  a: THREE.ColorRepresentation;
  b: THREE.ColorRepresentation;
  i: number;
}

const HAZE_PANELS: HazePanel[] = [
  { pos: [0, 0, 0], scale: 140, a: 0x6a1e8a, b: 0x1e2e6a, i: 0.09 },
  { pos: [30, 10, 30], scale: 130, a: 0x1a4080, b: 0x5e1880, i: 0.08 },
  { pos: [-30, -10, -30], scale: 130, a: 0x3e1880, b: 0x102050, i: 0.08 },
];

interface Props {
  dim?: boolean;
}

export function AmbientHaze({ dim = false }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const dimAmount = useRef(0);

  const panels = useMemo(() => {
    return HAZE_PANELS.map((h, i) => ({
      ...h,
      material: buildHazeMaterial(h.a, h.b, i * 1.7 + 0.3, h.i),
      tiltSeed: i,
    }));
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const targetDim = dim ? 1 : 0;
    dimAmount.current += (targetDim - dimAmount.current) * Math.min(1, delta * 4);
    const mul = 1 - dimAmount.current * 0.95;
    const g = groupRef.current;
    if (!g) return;
    const camQuat = state.camera.quaternion;
    for (let i = 0; i < g.children.length; i++) {
      const child = g.children[i] as THREE.Mesh;
      child.quaternion.copy(camQuat);
      child.rotateZ(panels[i].tiltSeed + t * 0.02);
      const mat = child.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uIntensity.value = panels[i].i * mul;
    }
  });

  return (
    <group ref={groupRef}>
      {panels.map((p, i) => (
        <mesh key={i} position={p.pos} material={p.material}>
          <planeGeometry args={[p.scale, p.scale]} />
        </mesh>
      ))}
    </group>
  );
}
