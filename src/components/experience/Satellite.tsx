import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SatelliteProps {
  state: string;
  orbitRadius: number;
  angleOffset: number;
  speed: number;
}

export function Satellite({ state, orbitRadius, angleOffset, speed }: SatelliteProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
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
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#444455", metalness: 1, roughness: 0.1 }), []);
  const ledMat = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 10 }), [color]);

  // Dispose on unmount
  useEffect(() => () => {
    boxGeo.dispose();
    sphereGeo.dispose();
    bodyMat.dispose();
    ledMat.dispose();
  }, [boxGeo, sphereGeo, bodyMat, ledMat]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const orbitT = (t * speed) + angleOffset;

    meshRef.current.position.set(
      Math.cos(orbitT) * orbitRadius,
      Math.sin(orbitT * 0.8) * (orbitRadius * 0.05),
      Math.sin(orbitT) * orbitRadius
    );

    const pulse = 0.5 + 0.5 * Math.sin(t * 8.0);
    if (ledMeshRef.current) {
      const mat = ledMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 15 * pulse;
    }
  });

  return (
    <mesh ref={meshRef} geometry={boxGeo} material={bodyMat}>
      <mesh ref={ledMeshRef} position={[0, 0.4, 0]} geometry={sphereGeo} material={ledMat} />
    </mesh>
  );
}

