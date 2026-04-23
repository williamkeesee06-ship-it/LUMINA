import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface GalaxySwirlProps {
  color: string;
  tilt?: [number, number, number];
  scale?: number;
  rotationSpeed?: number;
}

export function GalaxySwirl({
  color,
  tilt = [0, 0, 0],
  scale = 1.0,
  rotationSpeed = 1.0,
}: GalaxySwirlProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const innerPointsRef = useRef<THREE.Points>(null!);
  const outerPointsRef = useRef<THREE.Points>(null!);

  const count = 5000;
  const outerCount = 1500;

  const { positions, colors, outerPositions, outerColors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const outerPos = new Float32Array(outerCount * 3);
    const outerCol = new Float32Array(outerCount * 3);

    const baseColor = new THREE.Color(color);
    const coreColor = baseColor.clone().lerp(new THREE.Color('#ffffff'), 0.5);
    const edgeColor = baseColor.clone().multiplyScalar(0.3);

    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 2.0);
      const radius = 5 + r * 120;
      const armIndex = i % 2;
      const armOffset = Math.PI * armIndex;
      const wrap = radius * 0.05;
      const scatter = (1.0 - r) * (Math.random() - 0.5) * Math.PI * 0.8;
      const finalAngle = armOffset + wrap + scatter;

      pos[i * 3] = Math.cos(finalAngle) * radius;
      pos[i * 3 + 1] =
        (Math.random() - 0.5) * (15 * (1.0 - Math.min(1.0, r * 1.5)));
      pos[i * 3 + 2] = Math.sin(finalAngle) * radius;

      const mixed = new THREE.Color();
      if (r < 0.15) {
        mixed.lerpColors(coreColor, baseColor, r / 0.15);
      } else {
        mixed.lerpColors(baseColor, edgeColor, (r - 0.15) / 0.85);
      }

      col[i * 3] = mixed.r;
      col[i * 3 + 1] = mixed.g;
      col[i * 3 + 2] = mixed.b;
    }

    for (let i = 0; i < outerCount; i++) {
      const r = Math.pow(Math.random(), 1.5);
      const radius = 20 + r * 140;
      const angle = Math.random() * Math.PI * 2;

      outerPos[i * 3] = Math.cos(angle) * radius;
      outerPos[i * 3 + 1] =
        (Math.random() - 0.5) * 35 * (1.0 - r * 0.5);
      outerPos[i * 3 + 2] = Math.sin(angle) * radius;

      const outerMixed = edgeColor.clone().multiplyScalar(0.7);
      outerCol[i * 3] = outerMixed.r;
      outerCol[i * 3 + 1] = outerMixed.g;
      outerCol[i * 3 + 2] = outerMixed.b;
    }

    return {
      positions: pos,
      colors: col,
      outerPositions: outerPos,
      outerColors: outerCol,
    };
  }, [color]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0012 * rotationSpeed;
      groupRef.current.rotation.x =
        tilt[0] + Math.sin(t * 0.08 * rotationSpeed) * 0.015;
      groupRef.current.rotation.z = tilt[2];
    }

    if (innerPointsRef.current) {
      innerPointsRef.current.rotation.y += 0.0004 * rotationSpeed;
    }

    if (outerPointsRef.current) {
      outerPointsRef.current.rotation.y -= 0.0002 * rotationSpeed;
    }
  });

  return (
    <group ref={groupRef} scale={scale}>
      {/* Inner arms */}
      <Points
        ref={innerPointsRef}
        positions={positions}
        colors={colors}
        stride={3}
      >
        <PointMaterial
          transparent
          vertexColors
          size={0.8}
          sizeAttenuation
          depthWrite={false}
        />
      </Points>

      {/* Outer haze */}
      <Points
        ref={outerPointsRef}
        positions={outerPositions}
        colors={outerColors}
        stride={3}
      >
        <PointMaterial
          transparent
          vertexColors
          size={1.0}
          sizeAttenuation
          depthWrite={false}
          opacity={0.7}
        />
      </Points>
    </group>
  );
}
