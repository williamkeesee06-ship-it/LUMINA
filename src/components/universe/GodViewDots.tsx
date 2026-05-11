import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Job } from "@/types";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { GALAXY_POSITIONS } from "./galaxyLayout";

/**
 * GodViewDots — at universe (god) zoom, every planet renders as a small
 * glowing dot anchored to its parent galaxy. This is the per-planet pulse
 * surface called out by PR #5:
 *
 *   - Quiet planet (no unread email moons): a small, steady dot tinted by
 *     status color. No pulse.
 *   - Mail-active planet (one or more unread moons): brighter, larger
 *     dot that pulses on a ~1.4s cadence so it reads as "this job has
 *     new mail" from across the universe.
 *   - When ANY planet inside a galaxy is mail-active, the galaxy also
 *     gets a subtle ambient halo (the secondary cue) — rendered as a
 *     soft additive sprite layered behind that galaxy's dot cluster.
 *
 * The dot cluster reuses the same Fibonacci-style scatter that PlanetField
 * uses inside a galaxy, but at god-view distance the cluster compresses
 * naturally because we render small (radius ~0.08) sprites with additive
 * bloom — Bloom is already wired in UniverseScene's EffectComposer so the
 * dots bloom for free.
 *
 * Performance: one InstancedMesh per galaxy would be faster, but we have a
 * bounded count (≤ hundreds of planets per galaxy in practice) and each
 * dot is a low-poly sphere. Keeping the per-planet mesh keeps the per-frame
 * pulse logic straightforward and avoids fighting instance-attribute updates.
 */
export function GodViewDots({
  jobs,
  visible,
}: {
  jobs: Job[];
  /** Hide dots when inside a galaxy / planet view so the close-up scene
   *  is unobstructed. */
  visible: boolean;
}) {
  // Group jobs by galaxy for cheap unread aggregation.
  const grouped = useMemo(() => {
    const out = new Map<string, Job[]>();
    for (const j of jobs) {
      const list = out.get(j.status) ?? [];
      list.push(j);
      out.set(j.status, list);
    }
    return out;
  }, [jobs]);

  if (!visible) return null;

  return (
    <group>
      {Array.from(grouped.entries()).map(([galaxy, planets]) => {
        const galaxyHasUnread = planets.some((j) =>
          (j.moons ?? []).some((m) => m.unread),
        );
        const pos = GALAXY_POSITIONS[galaxy as keyof typeof GALAXY_POSITIONS];
        return (
          <group key={galaxy} position={pos}>
            <GalaxyDotCluster
              planets={planets}
              galaxyHasUnread={galaxyHasUnread}
            />
          </group>
        );
      })}
    </group>
  );
}

function GalaxyDotCluster({
  planets,
  galaxyHasUnread,
}: {
  planets: Job[];
  galaxyHasUnread: boolean;
}) {
  // Tight, locally-scattered layout — planets sit inside the galaxy nebula
  // so the dots form a visible cluster signature at god view. Radius is
  // small (≤ ~3.2u) so distinct clusters don't blur into each other now
  // that galaxies are spaced 78u apart on the ring.
  const layout = useMemo(() => {
    const n = planets.length;
    const items: {
      id: string;
      pos: [number, number, number];
      color: string;
      unread: boolean;
      phase: number;
    }[] = [];
    if (n === 0) return items;
    // Logarithmic spiral / golden-angle Fibonacci layout — same flavour as
    // PlanetField but compressed into a smaller radius so the dot cluster
    // reads as a single galactic disc, not a sphere.
    const golden = Math.PI * (3 - Math.sqrt(5));
    const innerR = 0.4;
    const outerR = 1.8 + Math.min(1.5, Math.sqrt(n) * 0.15);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const r = innerR + Math.sqrt(t) * (outerR - innerR);
      const a = golden * i;
      // Disk-flatten — small y wobble keeps the cluster from looking flat
      // but mostly sits on the galaxy plane.
      const y = (Math.sin(i * 1.913) * 0.18 + Math.cos(i * 0.733) * 0.12) * 0.6;
      const job = planets[i];
      items.push({
        id: job.id,
        pos: [Math.cos(a) * r, y, Math.sin(a) * r],
        color: GALAXY_COLORS[job.status],
        unread: (job.moons ?? []).some((m) => m.unread),
        phase: i * 0.27,
      });
    }
    return items;
  }, [planets]);

  // Per-instance refs so we can animate pulse opacity / scale on unread dots.
  const dotRefs = useRef<(THREE.Mesh | null)[]>([]);
  const haloRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ambientRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < layout.length; i++) {
      const it = layout[i];
      const dot = dotRefs.current[i];
      const halo = haloRefs.current[i];
      if (!dot || !halo) continue;
      if (it.unread) {
        // Pulse cadence — readable from across the universe view. PR #9
        // caps halo opacity at 0.25 max so dots no longer read as colored
        // bokeh balls at god view.
        const pulse = 0.6 + Math.sin(t * 4.4 + it.phase) * 0.4; // 0.2..1.0
        const scale = 1.0 + pulse * 0.6; // 1.0..1.6
        dot.scale.setScalar(scale);
        halo.scale.setScalar(scale * 1.2);
        const dm = dot.material as THREE.MeshBasicMaterial;
        const hm = halo.material as THREE.MeshBasicMaterial;
        dm.opacity = 0.75 + pulse * 0.15;
        hm.opacity = Math.min(0.25, 0.12 + pulse * 0.13);
      } else {
        // Quiet planet — static muted dot.
        dot.scale.setScalar(0.65);
        halo.scale.setScalar(0.8);
        const dm = dot.material as THREE.MeshBasicMaterial;
        const hm = halo.material as THREE.MeshBasicMaterial;
        dm.opacity = 0.45;
        hm.opacity = 0.05;
      }
    }
    if (ambientRef.current) {
      const m = ambientRef.current.material as THREE.MeshBasicMaterial;
      // Subtle whole-galaxy ambient glow when ANY planet has unread mail.
      // Breathing pulse so it reads as alive, not a frozen halo.
      const tgt = galaxyHasUnread ? 0.22 + Math.sin(t * 1.6) * 0.06 : 0;
      m.opacity += (tgt - m.opacity) * 0.08;
    }
  });

  // Pick the dominant status color in the cluster for the ambient halo tint.
  const ambientColor = useMemo(() => {
    if (layout.length === 0) return "#5BF3FF";
    return layout[0].color;
  }, [layout]);

  return (
    <group>
      {/* Whole-galaxy ambient glow — only really visible when galaxyHasUnread.
          Sphere mesh with additive material bleeds outward through Bloom. */}
      <mesh ref={ambientRef}>
        <sphereGeometry args={[3.2, 24, 24]} />
        <meshBasicMaterial
          color={ambientColor}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {layout.map((it, i) => (
        <group key={it.id} position={it.pos}>
          {/* Halo — PR #9 shrinks halo radius to 0.018 and caps opacity at
              0.25 so the dot reads as a small bright pinpoint, never a
              colored bokeh ball. */}
          <mesh
            ref={(m) => {
              haloRefs.current[i] = m;
            }}
          >
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshBasicMaterial
              color={it.color}
              transparent
              opacity={0.12}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          {/* Bright dot core — radius slashed from 0.06 → 0.014 (~77% smaller)
              so each planet reads as a small bright pinpoint comparable to a
              background starfield star, not a hero element. */}
          <mesh
            ref={(m) => {
              dotRefs.current[i] = m;
            }}
          >
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshBasicMaterial
              color={it.color}
              transparent
              opacity={0.75}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
