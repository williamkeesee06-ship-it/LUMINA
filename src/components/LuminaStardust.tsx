import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function LuminaStardust({ count = 5000, radius = 500 }) {
  const pointsRef = useRef<THREE.Points>(null!);

  const particles = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const cyan = new THREE.Color("#00f2ff");
    const magenta = new THREE.Color("#ff00ea");
    const gold = new THREE.Color("#ffcc00");

    for (let i = 0; i < count; i++) {
        // Random spherical distribution
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        const r = radius * Math.sqrt(Math.random());

        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);

        // Mix colors for variety
        const mix = Math.random();
        const selectedColor = mix > 0.8 ? gold : mix > 0.4 ? cyan : magenta;
        colors[i * 3] = selectedColor.r;
        colors[i * 3 + 1] = selectedColor.g;
        colors[i * 3 + 2] = selectedColor.b;

        sizes[i] = Math.random() * 2.0;
    }
    return { positions: pos, colors, sizes };
  }, [count, radius]);

  useFrame((state) => {
    const t = state.get().performance.now() * 0.001;
    if (pointsRef.current) {
        pointsRef.current.rotation.y = t * 0.01;
        pointsRef.current.rotation.x = t * 0.005;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute 
            attach="attributes-position" 
            count={count} 
            array={particles.positions} 
            itemSize={3} 
        />
        <bufferAttribute 
            attach="attributes-color" 
            count={count} 
            array={particles.colors} 
            itemSize={3} 
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.6}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
