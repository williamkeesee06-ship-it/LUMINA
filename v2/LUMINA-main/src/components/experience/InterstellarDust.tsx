import { Points, PointMaterial } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

export function InterstellarDust() {
  const count = 1000;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 3000;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1500;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3000;
    }
    return pos;
  }, []);

  return (
    <group>
      <Points positions={positions} stride={3}>
        <PointMaterial
          transparent
          color="#88ccff"
          size={3}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.12}
        />
      </Points>
      <Points positions={positions.map(v => v * 1.1)} stride={3}>
        <PointMaterial
          transparent
          color="#aa44ff"
          size={5}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.06}
        />
      </Points>
    </group>
  );
}
