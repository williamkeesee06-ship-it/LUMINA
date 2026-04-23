import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface MoonProps {
  kind: string;
  orbitRadius: number;
  angleOffset: number;
  speed: number;
}

export function Moon({ kind, orbitRadius, angleOffset, speed }: MoonProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  const { color, emissive, intensity, size, speedMult, pulseFreq } = useMemo(() => {
    switch (kind) {
      case 'permit': return { color: '#ffcc00', emissive: '#ffaa00', intensity: 2, size: 0.8, speedMult: 1.0, pulseFreq: 1.5 };
      case 'prints': return { color: '#0088ff', emissive: '#00ccff', intensity: 2, size: 1.2, speedMult: 0.8, pulseFreq: 1.0 };
      case 'redlines': return { color: '#ff3333', emissive: '#ff6666', intensity: 2, size: 0.9, speedMult: 1.2, pulseFreq: 2.5 };
      case 'bidmaster': return { color: '#00ff88', emissive: '#33ffaa', intensity: 2, size: 1.0, speedMult: 1.0, pulseFreq: 1.5 };
      case 'revisit': return { color: '#ff00ea', emissive: '#ff00ea', intensity: 3, size: 1.4, speedMult: 1.5, pulseFreq: 4.0 };
      default: return { color: '#88aaff', emissive: '#88aaff', intensity: 1, size: 0.7, speedMult: 1.0, pulseFreq: 1.5 };
    }
  }, [kind]);

  // Performance: Memoize resources
  const geometry = useMemo(() => new THREE.SphereGeometry(size, 32, 32), [size]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.8,
    metalness: 0.2,
    transparent: true,
    opacity: 0.9
  }), [color, emissive, intensity]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const orbitT = (t * speed * speedMult) + angleOffset;

    meshRef.current.position.set(
      Math.cos(orbitT) * orbitRadius,
      Math.sin(orbitT * 0.3) * (orbitRadius * 0.15), 
      Math.sin(orbitT) * orbitRadius
    );

    const pulse = 1.0 + Math.sin(t * pulseFreq) * (kind === 'revisit' ? 0.15 : 0.05);
    meshRef.current.scale.set(pulse, pulse, pulse);
    meshRef.current.rotation.y += 0.01;
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
}

