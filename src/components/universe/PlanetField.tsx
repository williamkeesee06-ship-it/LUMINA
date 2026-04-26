import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Job } from "@/types";
import { GALAXY_COLORS } from "@/lib/statusMap";

interface Props {
  jobs: Job[];
  selectedJobId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Inside a galaxy: planets arranged in a Fibonacci sphere so density reads
 * cleanly even with hundreds of jobs. Each planet is a small sphere with
 * a faint atmosphere; the selected one gets a tactical lock-on ring.
 */
export function PlanetField({ jobs, selectedJobId, onSelect }: Props) {
  const layout = useMemo(() => {
    const n = jobs.length || 1;
    const radius = 6 + Math.sqrt(n) * 0.4;
    const out: { id: string; pos: [number, number, number]; color: string }[] = [];
    for (let i = 0; i < n; i++) {
      if (!jobs[i]) break;
      const t = (i + 0.5) / n;
      const phi = Math.acos(1 - 2 * t);
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const theta = goldenAngle * i;
      out.push({
        id: jobs[i].id,
        pos: [
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta) * 0.55,
          radius * Math.cos(phi),
        ],
        color: GALAXY_COLORS[jobs[i].status],
      });
    }
    return out;
  }, [jobs]);

  return (
    <group>
      {layout.map((p, i) => (
        <Planet
          key={p.id}
          position={p.pos}
          color={p.color}
          selected={selectedJobId === p.id}
          phase={i * 0.13}
          onSelect={() => onSelect(p.id)}
        />
      ))}
    </group>
  );
}

function Planet({
  position,
  color,
  selected,
  phase,
  onSelect,
}: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  phase: number;
  onSelect: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.4;
      // Gentle bob
      const t = performance.now() * 0.001 + phase;
      ref.current.position.y = position[1] + Math.sin(t) * 0.05;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.6;
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={ref}
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
        <sphereGeometry args={[0.35, 18, 18]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 1.6 : 0.7}
          roughness={0.45}
          metalness={0.6}
        />
      </mesh>
      {/* Atmosphere */}
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.22 : 0.1} />
      </mesh>
      {/* Tactical lock-on ring */}
      {selected && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.78, 0.84, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
