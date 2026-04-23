import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SatelliteProps {
  state: string;
  orbitRadius: number;
  angleOffset: number;
  speed: number;
}

export function Satellite({ state, orbitRadius, angleOffset, speed }: SatelliteProps) {
  const meshRef = useRef<THREE.Group>(null!);
  const ledMeshRef = useRef<THREE.Mesh>(null!);

  const color = useMemo(() => {
    if (state === 'alert' || state === 'needs_reply') return '#ff3333';
    if (state === 'warning' || state === 'waiting') return '#ffcc00';
    if (state === 'inactive') return '#444455';
    return '#00f2ff';
  }, [state]);

  // Performance: Memoize resources
  const boxGeo = useMemo(() => new THREE.BoxGeometry(0.5, 0.5, 0.5), []);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.15, 8, 8), []);
  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#444455',
        metalness: 1,
        roughness: 0.1,
      }),
    []
  );
  const ledMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 10,
      }),
    [color]
  );

  // Dispose on unmount
  useEffect(
    () => () => {
      boxGeo.dispose();
      sphereGeo.dispose();
      bodyMat.dispose();
      ledMat.dispose();
    },
    [boxGeo, sphereGeo, bodyMat, ledMat]
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const orbitT = t * speed + angleOffset;

    meshRef.current.position.set(
      Math.cos(orbitT) * orbitRadius,
      Math.sin(orbitT * 0.8) * orbitRadius * 0.05,
      Math.sin(orbitT) * orbitRadius
    );

    const pulse = 0.5 + 0.5 * Math.sin(t * 8.0);
    if (ledMeshRef.current) {
      const mat = ledMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 15 * pulse;
    }
  });

  return (
    <group ref={meshRef}>
      {/* Satellite body */}
      <mesh geometry={boxGeo} material={bodyMat}>
        {/* Little antenna arm */}
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.1, 0.7, 0.1]} />
          <meshStandardMaterial color="#8888aa" metalness={0.8} roughness={0.3} />
        </mesh>
      </mesh>

      {/* LED beacon */}
      <mesh ref={ledMeshRef} geometry={sphereGeo} material={ledMat} position={[0.3, 0.3, 0]}>
        <mesh scale={2.0}>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} />
        </mesh>
      </mesh>
    </group>
  );
}
