import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Job, Satellite } from "@/types";
import { GALAXY_COLORS } from "@/lib/statusMap";

/**
 * Per-category neon colors for orbiting satellites. Mirrors the chip
 * colors used in the JobPanel satellites list so the same file reads
 * the same color in 3D and in the panel.
 */
const SATELLITE_COLORS: Record<NonNullable<Satellite["category"]>, string> = {
  permit: "#FFC857",     // amber
  print: "#5BF3FF",      // cyan
  redline: "#FF3D9A",    // hot pink
  bidmaster: "#A78BFA",  // violet
  revisit: "#F97316",    // orange
  photo: "#22D3EE",      // bright teal
  other: "#9CA3AF",      // neutral grey
};
const DEFAULT_SAT_COLOR = "#E5E7EB";

interface Props {
  jobs: Job[];
  selectedJobId: string | null;
  onSelect: (id: string) => void;
  /** When true, planets that aren't selected fade hard so the focus is the selected planet. */
  focusMode?: boolean;
}

/**
 * Inside a galaxy: planets arranged in a Fibonacci sphere so density reads
 * cleanly even with hundreds of jobs.
 *
 * Each planet is a DARK CORE with a BRIGHT NEON HALO RING — luxurious dark
 * metal sphere wrapped by a glowing status-tinted halo, like a Saturn ring
 * lit from within.
 */
export function PlanetField({ jobs, selectedJobId, onSelect, focusMode = false }: Props) {
  const layout = useMemo(() => {
    const n = jobs.length || 1;
    // Galactic-disk layout. Instead of a fixed-radius Fibonacci sphere
    // (which reads as a hollow ball / ring from any vantage), planets are
    // distributed across a stretched flattened disk with a logarithmic
    // spiral bias — think planetary positions in an actual spiral galaxy.
    // This gives the cluster real volume and an elongated silhouette
    // instead of a tight bunched circle.
    //
    // Key changes vs. the old layout:
    //   - Radius varies (~3..21) per planet instead of one fixed shell.
    //   - Spiral arm bias — angular phase rotates with sqrt(radius).
    //   - Disk-flat: y-thickness scales down with radius * 0.18.
    //   - Per-planet jitter scales with local radius so outer planets
    //     drift further than inner ones (not the same fixed amount).
    const out: {
      id: string;
      label: string;
      pos: [number, number, number];
      color: string;
      tilt: number;
    }[] = [];
    const jitter = (seed: number) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453;
      return x - Math.floor(x); // 0..1
    };
    // Disk extent grows with sqrt(n) so 50 planets and 500 planets both
    // read at sensible density. Inner radius is small (3) so the cluster
    // has a visible "core" instead of a hole.
    const innerR = 3;
    const outerR = 8 + Math.sqrt(n) * 1.4;
    const armCount = 2; // number of spiral arms
    const armTwist = 1.6; // how much each arm winds
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      if (!jobs[i]) break;
      // Square-root index distribution biases more planets toward the
      // outer disk while leaving a populated core. Avoids a hollow hole.
      const tIdx = (i + 0.5) / n;
      const r = innerR + Math.sqrt(tIdx) * (outerR - innerR);
      // Spiral arm — each planet sits near one of `armCount` arms, with the
      // arm angle winding outward. goldenAngle adds variation between
      // adjacent indices so consecutive planets don't stack.
      const arm = i % armCount;
      const armBase = (arm / armCount) * Math.PI * 2;
      const armAngle =
        armBase +
        ((r - innerR) / (outerR - innerR)) * armTwist * Math.PI * 2 +
        goldenAngle * i * 0.18;
      // Lateral jitter perpendicular to the arm so planets feather the arm,
      // not sit on a perfect spiral line.
      const jr = (jitter(i + 1) - 0.5) * (1.6 + r * 0.18);
      const jt = (jitter(i + 7.13) - 0.5) * 0.55; // tangential angular jitter
      const finalR = Math.max(1.5, r + jr);
      const finalAngle = armAngle + jt;
      // Disk thickness — thin at center, slightly thicker at the rim, with
      // strong y-flatten so the whole thing reads as a disk not a sphere.
      const yJ = (jitter(i + 19.37) - 0.5) * (1.0 + r * 0.18);
      out.push({
        id: jobs[i].id,
        label: jobs[i].workOrder || jobs[i].id,
        pos: [
          finalR * Math.cos(finalAngle),
          yJ,
          finalR * Math.sin(finalAngle),
        ],
        color: GALAXY_COLORS[jobs[i].status],
        tilt: 0, // unused now — ring orientation is locked globally
      });
    }
    return out;
  }, [jobs]);

  return (
    <group>
      {layout.map((p, i) => {
        const job = jobs[i];
        // In planet (focus) mode, hide every planet that isn't the selected
        // one. The user's request was crystal clear: "that planet be the
        // only planet in view." Dimming wasn't enough — dozens of orbiting
        // dots still cluttered the foreground.
        if (focusMode && selectedJobId !== p.id) return null;
        return (
          <Planet
            key={p.id}
            position={focusMode && selectedJobId === p.id ? [0, 0, 0] : p.pos}
            color={p.color}
            tiltDeg={p.tilt}
            label={p.label}
            selected={selectedJobId === p.id}
            dim={false}
            hero={focusMode && selectedJobId === p.id}
            phase={i * 0.13}
            satellites={job?.satellites ?? []}
            onSelect={() => onSelect(p.id)}
          />
        );
      })}
    </group>
  );
}

function Planet({
  position,
  color,
  tiltDeg,
  label,
  selected,
  dim = false,
  hero = false,
  phase,
  satellites,
  onSelect,
}: {
  position: [number, number, number];
  color: string;
  tiltDeg: number;
  label: string;
  selected: boolean;
  dim?: boolean;
  /** Hero mode — this planet is alone on stage in planet view. Scales up,
   *  adds an atmosphere halo, slows rotation a touch, and bumps the ring
   *  glow so it reads as a real cinematic close-up. */
  hero?: boolean;
  phase: number;
  satellites: Satellite[];
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

  // Smooth scale interpolation so transitions in/out of hero mode glide
  // rather than snap. Hero is ~3.4× the regular planet size.
  const heroTargetScale = hero ? 3.4 : 1.0;
  const currentScale = useRef(1.0);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime + phase;
    // Interpolate group scale toward hero/non-hero target.
    if (groupRef.current) {
      currentScale.current += (heroTargetScale - currentScale.current) * Math.min(1, delta * 3);
      groupRef.current.scale.setScalar(currentScale.current);
    }
    if (coreRef.current) {
      // Slow rotation down a touch in hero mode — looks more cinematic.
      coreRef.current.rotation.y += delta * (hero ? 0.12 : 0.3);
    }
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 0.6) * 0.04;
    }
    if (ringRef.current) {
      const m = ringRef.current.material as THREE.MeshBasicMaterial;
      const tgt = (dim ? 0.18 : selected ? 1.0 : 0.95) + Math.sin(t * 1.5) * 0.04;
      m.opacity += (tgt - m.opacity) * Math.min(1, delta * 5);
    }
    if (ringGlowRef.current) {
      const m = ringGlowRef.current.material as THREE.MeshBasicMaterial;
      // Hero mode pumps the halo so the neon ring really sings up close.
      const baseGlow = hero ? 0.95 : selected ? 0.7 : 0.55;
      const tgt = (dim ? 0.08 : baseGlow) + Math.sin(t * 1.2) * (hero ? 0.12 : 0.08);
      m.opacity += (tgt - m.opacity) * Math.min(1, delta * 5);
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
          document.body.style.cursor = "url('/cursor-arrow-pointer.svg') 1 1, pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
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
      <group ref={labelRef} position={[0, 0.95, 0]} visible={!dim}>
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

      {/* Satellites — small glowing dots orbiting the selected planet, one
          per Smartsheet attachment. Color = attachment category. */}
      {selected && satellites.length > 0 && (
        <SatelliteOrbit satellites={satellites} planetColor={color} />
      )}
    </group>
  );
}

/**
 * Renders attachments as small luminous dots in a tilted orbit around
 * the planet. Multiple orbital rings if there are many — keeps density
 * legible. Each dot pulses slightly and follows a slow orbital rotation.
 */
function SatelliteOrbit({
  satellites,
  planetColor,
}: {
  satellites: Satellite[];
  planetColor: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // Distribute satellites across up to 3 rings so 30+ attachments stay readable.
  const layout = useMemo(() => {
    const PER_RING = 12;
    const ringCount = Math.min(3, Math.max(1, Math.ceil(satellites.length / PER_RING)));
    const radii = [0.95, 1.25, 1.55];
    const tilts = [0.42, -0.28, 0.62]; // radians; varied so rings don't overlap
    const items = satellites.map((s, i) => {
      const ring = i % ringCount;
      const inRing = Math.floor(i / ringCount);
      const ringSize = Math.max(
        1,
        Math.ceil(satellites.length / ringCount) +
          (ring < satellites.length % ringCount ? 1 : 0),
      );
      const angle = (inRing / ringSize) * Math.PI * 2;
      const cat = s.category ?? "other";
      return {
        id: s.id,
        radius: radii[ring],
        tilt: tilts[ring],
        baseAngle: angle,
        speed: 0.18 + ring * 0.05, // slower for outer rings
        color: SATELLITE_COLORS[cat] ?? DEFAULT_SAT_COLOR,
        ring,
        phase: i * 0.31,
      };
    });
    return { items, ringCount };
  }, [satellites]);

  // Refs for each satellite mesh so we can animate position per-frame.
  const meshRefs = useRef<(THREE.Group | null)[]>([]);
  const glowRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    layout.items.forEach((it, idx) => {
      const m = meshRefs.current[idx];
      if (!m) return;
      const a = it.baseAngle + t * it.speed;
      // Orbit on a tilted ring — same math as a tilted unit circle.
      const x = Math.cos(a) * it.radius;
      const yFlat = Math.sin(a) * it.radius;
      // Tilt around X-axis by `it.tilt`.
      const y = yFlat * Math.cos(it.tilt);
      const z = yFlat * Math.sin(it.tilt);
      m.position.set(x, y, z);
      // Subtle pulse on the glow halo.
      const g = glowRefs.current[idx];
      if (g) {
        const mat = g.material as THREE.MeshBasicMaterial;
        const tgt = 0.7 + Math.sin(t * 2 + it.phase) * 0.15;
        mat.opacity += (tgt - mat.opacity) * 0.1;
      }
    });
  });

  // Faint orbital track lines — luminous rings hinting at the orbit paths.
  const trackRings = useMemo(() => {
    const radii = [0.95, 1.25, 1.55];
    const tilts = [0.42, -0.28, 0.62];
    return Array.from({ length: layout.ringCount }, (_, i) => ({
      radius: radii[i],
      tilt: tilts[i],
      opacity: 0.12,
    }));
  }, [layout.ringCount]);

  return (
    <group ref={groupRef}>
      {/* Orbit track rings — dim guide rings showing the satellite paths */}
      {trackRings.map((r, i) => (
        <group key={`track-${i}`} rotation={[r.tilt, 0, 0]}>
          <mesh>
            <ringGeometry args={[r.radius - 0.005, r.radius + 0.005, 96]} />
            <meshBasicMaterial
              color={planetColor}
              transparent
              opacity={r.opacity}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      {/* Satellite dots — small bright cores with halo */}
      {layout.items.map((it, i) => (
        <group
          key={it.id}
          ref={(g) => {
            meshRefs.current[i] = g;
          }}
        >
          {/* Halo */}
          <mesh
            ref={(m) => {
              glowRefs.current[i] = m;
            }}
          >
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshBasicMaterial
              color={it.color}
              transparent
              opacity={0.7}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          {/* Bright core */}
          <mesh>
            <sphereGeometry args={[0.025, 12, 12]} />
            <meshBasicMaterial color={it.color} toneMapped={false} />
          </mesh>
        </group>
      ))}
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
