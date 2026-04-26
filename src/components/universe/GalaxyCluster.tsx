import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Galaxy } from "@/types";
import { GALAXY_COLORS } from "@/lib/statusMap";

interface Props {
  galaxy: Galaxy;
  position: [number, number, number];
  count: number;
  highlighted?: boolean;
  dimmed?: boolean;
  onSelect: () => void;
}

/**
 * A galaxy cluster is a swirl of points around a luminous core.
 * Size scales softly with planet count. The core is the click target.
 */
export function GalaxyCluster({
  galaxy,
  position,
  count,
  highlighted = false,
  dimmed = false,
  onSelect,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  const color = GALAXY_COLORS[galaxy];
  const scale = useMemo(() => {
    if (count === 0) return 0.6;
    return 0.85 + Math.min(Math.log2(count + 1) * 0.18, 1.6);
  }, [count]);

  const { positions, colors } = useMemo(() => {
    const n = Math.max(160, Math.min(900, count * 16));
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      // Spiral arms
      const armCount = 3;
      const arm = i % armCount;
      const t = (i / n) * 2.6;
      const angle = t * 4 + (arm * (Math.PI * 2)) / armCount;
      const r = 0.5 + t * 4.0 + (Math.random() - 0.5) * 0.6;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
      pos[i * 3 + 2] = Math.sin(angle) * r;
      const fade = 1 - t / 3;
      col[i * 3] = c.r * (0.6 + fade * 0.8);
      col[i * 3 + 1] = c.g * (0.6 + fade * 0.8);
      col[i * 3 + 2] = c.b * (0.6 + fade * 0.8);
    }
    return { positions: pos, colors: col };
  }, [count, color]);

  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.05;
    if (coreRef.current) {
      const m = coreRef.current.material as THREE.MeshBasicMaterial;
      const t = performance.now() * 0.001;
      m.opacity = 0.85 + Math.sin(t * 1.6) * 0.1;
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Glow core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} />
      </mesh>
      {/* Soft halo */}
      <mesh>
        <sphereGeometry args={[1.05, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.05 : 0.16} />
      </mesh>
      {/* Highlight ring */}
      {highlighted && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.45, 1.55, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Spiral points */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.09}
          sizeAttenuation
          vertexColors
          transparent
          opacity={dimmed ? 0.18 : 0.92}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
