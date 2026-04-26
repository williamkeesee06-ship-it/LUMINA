import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
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
 * cleanly even with hundreds of jobs.
 *
 * Each planet is a DARK CORE with a BRIGHT NEON HALO RING — luxurious dark
 * metal sphere wrapped by a glowing status-tinted halo, like a Saturn ring
 * lit from within.
 */
export function PlanetField({ jobs, selectedJobId, onSelect }: Props) {
  const layout = useMemo(() => {
    const n = jobs.length || 1;
    // Wider radius for crowded clusters — keeps rings from overlapping at high job counts.
    const radius = 6 + Math.sqrt(n) * 0.7;
    const out: {
      id: string;
      label: string;
      pos: [number, number, number];
      color: string;
      tilt: number;
    }[] = [];
    // Deterministic pseudo-random for per-planet position jitter — breaks
    // the perfectly-uniform Fibonacci look without losing overall layout.
    const jitter = (seed: number) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453;
      return x - Math.floor(x); // 0..1
    };
    for (let i = 0; i < n; i++) {
      if (!jobs[i]) break;
      const t = (i + 0.5) / n;
      const phi = Math.acos(1 - 2 * t);
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const theta = goldenAngle * i;
      const jx = (jitter(i + 1) - 0.5) * 0.9;
      const jy = (jitter(i + 7.13) - 0.5) * 0.7;
      const jz = (jitter(i + 19.37) - 0.5) * 0.9;
      out.push({
        id: jobs[i].id,
        label: jobs[i].workOrder || jobs[i].id,
        pos: [
          radius * Math.sin(phi) * Math.cos(theta) + jx,
          radius * Math.sin(phi) * Math.sin(theta) * 0.55 + jy,
          radius * Math.cos(phi) + jz,
        ],
        color: GALAXY_COLORS[jobs[i].status],
        tilt: 0, // unused now — ring orientation is locked globally
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
          tiltDeg={p.tilt}
          label={p.label}
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
  tiltDeg,
  label,
  selected,
  phase,
  onSelect,
}: {
  position: [number, number, number];
  color: string;
  tiltDeg: number;
  label: string;
  selected: boolean;
  phase: number;
  onSelect: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringGlowRef = useRef<THREE.Mesh>(null);
  const lockRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Group>(null);

  // tiltDeg retained for API compatibility but unused now — ring is
  // billboarded with a constant Y-squash so all planets read identically.
  void tiltDeg;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime + phase;
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.3;
    }
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 0.6) * 0.04;
    }
    if (ringRef.current) {
      const m = ringRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = (selected ? 1.0 : 0.95) + Math.sin(t * 1.5) * 0.04;
    }
    if (ringGlowRef.current) {
      const m = ringGlowRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = (selected ? 0.7 : 0.55) + Math.sin(t * 1.2) * 0.08;
    }
    if (lockRef.current) {
      lockRef.current.rotation.z += delta * 0.6;
    }
    // Keep label readable at constant pixel size regardless of distance.
    // Drei's Text is in world units, so to hold a constant projected size,
    // scale up as distance grows (and down when very close).
    if (labelRef.current && groupRef.current) {
      const dist = state.camera.position.distanceTo(
        groupRef.current.getWorldPosition(new THREE.Vector3())
      );
      const s = THREE.MathUtils.clamp(dist / 18, 0.35, 2.6);
      labelRef.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Dark core — luxurious black sphere with faint metallic sheen */}
      <mesh
        ref={coreRef}
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
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial
          color="#000000"
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.08 : 0}
          roughness={0.6}
          metalness={1.0}
        />
      </mesh>

      {/* Luminous neon outline tracing the planet core silhouette */}
      <mesh scale={1.06}>
        <sphereGeometry args={[0.28, 32, 32]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          uniforms={{
            uColor: { value: new THREE.Color(color).multiplyScalar(2.5) },
            uPower: { value: 4.0 },
            uIntensity: { value: 1.4 },
          }}
          vertexShader={`
            varying vec3 vN;
            varying vec3 vV;
            void main() {
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vN = normalize(normalMatrix * normal);
              vV = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uPower;
            uniform float uIntensity;
            varying vec3 vN;
            varying vec3 vV;
            void main() {
              float fres = pow(1.0 - max(dot(vN, vV), 0.0), uPower);
              gl_FragColor = vec4(uColor * uIntensity, fres);
            }
          `}
        />
      </mesh>

      {/* Neon ring — true 3D ring tilted at a fixed angle so it wraps
          around the planet (front in front, back behind). Tilt is constant
          across all planets so every silhouette reads the same. */}
      <group rotation={[Math.PI * 0.42, 0, 0]}>
        {/* Bright neon tube — thin */}
        <mesh ref={ringRef}>
          <ringGeometry args={[0.548, 0.612, 128]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={1.0}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        {/* Glow halo around tube — wet-neon bleed */}
        <mesh ref={ringGlowRef}>
          <ringGeometry args={[0.532, 0.628, 128]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Neon ID tag — dark pill with luminous border + matching neon text */}
      <group ref={labelRef} position={[0, 0.95, 0]}>
        <Billboard>
          <NeonTag label={label} color={color} selected={selected} />
        </Billboard>
      </group>

      {/* Tactical lock-on ring — billboarded perfect circle when selected */}
      {selected && (
        <Billboard follow position={[0, 0, 0]}>
          <mesh ref={lockRef}>
            <ringGeometry args={[0.85, 0.9, 64]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </Billboard>
      )}
    </group>
  );
}

/**
 * Neon ID tag — pill-shaped chip with dark backing, luminous border,
 * and bright neon text. Sized to fit the label content.
 */
function NeonTag({
  label,
  color,
  selected,
}: {
  label: string;
  color: string;
  selected: boolean;
}) {
  // Approximate width based on label length — fontSize 0.16, ~0.11 per char + padding
  const charW = 0.11;
  const padX = 0.18;
  const padY = 0.11;
  const width = Math.max(label.length * charW + padX * 2, 0.7);
  const height = 0.32;

  const textColor = selected ? "#ffffff" : color;
  const borderColor = color;

  return (
    <group>
      {/* Dark pill backing — luxurious near-black, slight tint */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#04060a" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {/* Luminous border — thin glowing outline frame */}
      <BorderFrame width={width} height={height} color={borderColor} />
      {/* Neon text */}
      <Text
        fontSize={0.16}
        color={textColor}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.05}
        outlineWidth={0.004}
        outlineColor={borderColor}
        outlineOpacity={0.6}
        position={[0, 0, 0.001]}
      >
        {label}
      </Text>
    </group>
  );
}

/**
 * Thin luminous frame around the tag — built from 4 additive bars
 * so it reads as a bright neon border with bloom bleed.
 */
function BorderFrame({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  const t = 0.018; // border thickness
  const z = 0.0005; // tiny z-offset above pill
  const matProps = {
    color,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  } as const;
  return (
    <group position={[0, 0, z]}>
      {/* top */}
      <mesh position={[0, height / 2 - t / 2, 0]}>
        <planeGeometry args={[width, t]} />
        <meshBasicMaterial {...matProps} />
      </mesh>
      {/* bottom */}
      <mesh position={[0, -height / 2 + t / 2, 0]}>
        <planeGeometry args={[width, t]} />
        <meshBasicMaterial {...matProps} />
      </mesh>
      {/* left */}
      <mesh position={[-width / 2 + t / 2, 0, 0]}>
        <planeGeometry args={[t, height]} />
        <meshBasicMaterial {...matProps} />
      </mesh>
      {/* right */}
      <mesh position={[width / 2 - t / 2, 0, 0]}>
        <planeGeometry args={[t, height]} />
        <meshBasicMaterial {...matProps} />
      </mesh>
    </group>
  );
}
