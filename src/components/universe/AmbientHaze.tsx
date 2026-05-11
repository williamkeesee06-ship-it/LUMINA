import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildHazeMaterial } from "./CosmicDust";

/**
 *  Universe-wide ambient haze patches. 7 large billboarded plasma panels
 *  positioned BETWEEN the 120u-radius galaxy ring so they fill the void
 *  with color washes — never sitting directly over a galaxy center.
 *
 *  Scales here are HALF the V9 mockup values because LUMINA galaxies sit
 *  at 120u (mockup spread them to ~240u+). If a panel ever reads as
 *  competing with a galaxy center, drop its intensity here.
 */
interface HazePanel {
  pos: [number, number, number];
  scale: number;
  a: THREE.ColorRepresentation;
  b: THREE.ColorRepresentation;
  i: number;
}

const HAZE_PANELS: HazePanel[] = [
  { pos: [-50, 0, -30], scale: 160, a: 0x6a1e8a, b: 0x1e2e6a, i: 0.18 },
  { pos: [50, 0, 50], scale: 160, a: 0x1a4080, b: 0x5e1880, i: 0.16 },
  { pos: [-90, 10, 70], scale: 170, a: 0x8a1e5e, b: 0x2a1060, i: 0.16 },
  { pos: [90, -10, 70], scale: 160, a: 0x10605e, b: 0x301078, i: 0.15 },
  { pos: [-20, 20, -100], scale: 170, a: 0x3e1880, b: 0x102050, i: 0.17 },
  { pos: [100, -20, -45], scale: 150, a: 0x501880, b: 0x1a3a6a, i: 0.14 },
  { pos: [-110, 10, -45], scale: 150, a: 0x2a2080, b: 0x60148a, i: 0.14 },
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
