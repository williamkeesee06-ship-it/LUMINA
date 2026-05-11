import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Galaxy } from "@/types";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { GALAXY_POSITIONS } from "./galaxyLayout";

interface Props {
  /** Particles per galaxy haze cloud. */
  perGalaxy?: number;
  /** Ambient swirl particles spread across the universe. */
  ambient?: number;
  /** When true, fade dust out for cinematic planet-focus mode. */
  dim?: boolean;
}

/**
 * Real-nebula filaments. PR #9 throws out the PR #8 fuzzy-bokeh approach:
 * size 1.9 + sizeAttenuation made every particle blow up to a screen-filling
 * colored disk on close approach. Now:
 *  - particles distributed along 2-3 logarithmic spiral arms per galaxy with
 *    sin-noise perturbation so the cloud reads as wispy filaments, not a ball.
 *  - tiny world-size points (0.35) with a procedural radial-alpha CanvasTexture
 *    so each grain stays a soft mote rather than a hard disk.
 *  - per-particle color brightness × 0.45 so they read as gas, not bulbs.
 */
export function CosmicDust({ perGalaxy = 2200, ambient = 1200, dim = false }: Props) {
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  // Soft radial-falloff alpha sprite. pow(1-r, 2.5) gives a long gentle tail so
  // each particle dissolves into the next instead of clipping a hard disk edge.
  const sprite = useMemo(() => {
    const s = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = s;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(s, s);
    const cx = s / 2;
    const cy = s / 2;
    const maxR = s / 2;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const dx = (x - cx) / maxR;
        const dy = (y - cy) / maxR;
        const r = Math.min(1, Math.sqrt(dx * dx + dy * dy));
        const a = Math.pow(1 - r, 2.5);
        const i = (y * s + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.max(0, Math.min(255, Math.floor(a * 255)));
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const { positions, colors } = useMemo(() => {
    const galaxyEntries = Object.entries(GALAXY_POSITIONS) as [Galaxy, [number, number, number]][];
    const total = galaxyEntries.length * perGalaxy + ambient;
    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);

    let idx = 0;

    galaxyEntries.forEach(([g, p]) => {
      const c = new THREE.Color(GALAXY_COLORS[g]);
      // Deterministic per-galaxy seed → unique arm orientation + phase.
      const seed = (g.charCodeAt(0) * 13 + g.charCodeAt(g.length - 1) * 7) % 360;
      const rot = (seed / 360) * Math.PI * 2;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);

      // 2-3 logarithmic spiral arms. Galaxy centers stay at 120u — DO NOT
      // touch GALAXY_POSITIONS. Arm length is capped so adjacent clouds
      // overlap softly without reaching the next galaxy center.
      const armCount = 2 + (seed % 2); // 2 or 3 arms
      // Logarithmic spiral: r(θ) = a * exp(b θ). b controls tightness.
      const a = 2.2;
      const b = 0.32 + ((seed % 11) / 11) * 0.12;
      // Cap arm radius around 60u so cloud reach is ~half the gap to neighbor.
      const maxR = 60;
      // Per-galaxy noise phases
      const nPhaseA = (seed * 0.137) % (Math.PI * 2);
      const nPhaseB = (seed * 0.311) % (Math.PI * 2);

      for (let i = 0; i < perGalaxy; i++) {
        const armIdx = i % armCount;
        const armOffset = (armIdx / armCount) * Math.PI * 2;
        // θ along arm. Bias toward larger θ so density grows outward, then
        // pow falloff thins the very tips.
        const tParam = Math.pow(Math.random(), 0.85);
        const theta = tParam * (Math.PI * 2.6) + armOffset;
        let r = a * Math.exp(b * theta);
        if (r > maxR) r = maxR * (0.9 + Math.random() * 0.1);

        // Position on arm centerline.
        let lx = Math.cos(theta) * r;
        let lz = Math.sin(theta) * r;
        // Vertical thickness — thin disk + slight bulge near core.
        let ly = (Math.random() - 0.5) * (2.0 + r * 0.08);

        // Cross-arm dispersion: jitter perpendicular to the arm direction so
        // each arm is a thick wispy band, not a 1px line.
        const tangentX = -Math.sin(theta);
        const tangentZ = Math.cos(theta);
        const normalX = Math.cos(theta);
        const normalZ = Math.sin(theta);
        const dispersion = (Math.random() - 0.5) * (3 + r * 0.18);
        lx += normalX * dispersion;
        lz += normalZ * dispersion;
        // Tangential jitter too, so the arm has filamentary breaks
        const tangJitter = (Math.random() - 0.5) * r * 0.05;
        lx += tangentX * tangJitter;
        lz += tangentZ * tangJitter;

        // Sin-noise perturbation — gives sheet-like wisps inside each arm.
        const nAmp = 0.6 + (r / maxR) * 3.0;
        const nx = Math.sin(lx * 0.18 + nPhaseA) * Math.cos(lz * 0.14 + nPhaseB);
        const ny = Math.sin(lz * 0.22 + nPhaseA) * 0.4;
        const nz = Math.cos(lx * 0.19 + nPhaseB) * Math.sin(ly * 0.25);
        lx += nx * nAmp;
        ly += ny * nAmp * 0.5;
        lz += nz * nAmp;

        // Rotate the whole nebula by per-galaxy seed so each looks unique.
        const wx = lx * cosR - lz * sinR;
        const wz = lx * sinR + lz * cosR;
        pos[idx * 3] = p[0] + wx;
        pos[idx * 3 + 1] = p[1] + ly;
        pos[idx * 3 + 2] = p[2] + wz;

        // Color: per-particle status tint * 0.45 brightness multiplier (gas,
        // not solid disks). Core is brighter; tips fade toward black.
        const radial = Math.min(1, r / maxR);
        const fade = 0.55 + Math.random() * 0.45;
        const coreLift = (1 - radial) * 0.35;
        const bright = 0.45;
        col[idx * 3] = (c.r * fade + coreLift) * bright;
        col[idx * 3 + 1] = (c.g * fade + coreLift) * bright;
        col[idx * 3 + 2] = (c.b * fade + coreLift) * bright;

        idx++;
      }
    });

    // Ambient sweep — sparse drifting motes through the void between galaxies.
    for (let i = 0; i < ambient; i++) {
      const r = 14 + Math.pow(Math.random(), 0.65) * 64;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 22;
      pos[idx * 3] = Math.cos(theta) * r;
      pos[idx * 3 + 1] = y;
      pos[idx * 3 + 2] = Math.sin(theta) * r;

      const tint = Math.random();
      let r2 = 0.62, g2 = 0.7, b2 = 0.9;
      if (tint < 0.25) {
        r2 = 0.36; g2 = 0.85; b2 = 1.0;
      } else if (tint < 0.45) {
        r2 = 0.78; g2 = 0.55; b2 = 1.0;
      } else if (tint < 0.55) {
        r2 = 1.0; g2 = 0.55; b2 = 0.78;
      } else {
        const b = 0.55 + Math.random() * 0.35;
        r2 = b; g2 = b; b2 = b;
      }
      const bright = 0.45;
      col[idx * 3] = r2 * bright;
      col[idx * 3 + 1] = g2 * bright;
      col[idx * 3 + 2] = b2 * bright;
      idx++;
    }

    return { positions: pos, colors: col };
  }, [perGalaxy, ambient]);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.012;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.04) * 0.03;
    }
    if (matRef.current) {
      const target = dim ? 0.01 : 0.55;
      matRef.current.opacity += (target - matRef.current.opacity) * Math.min(1, delta * 4);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        map={sprite}
        alphaMap={sprite}
        size={0.35}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
