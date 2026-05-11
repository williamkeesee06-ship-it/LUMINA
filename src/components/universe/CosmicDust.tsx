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
 * Soft cosmic-dust layer that swirls slowly and blends the galaxies into
 * surrounding space. Two contributions:
 *   1. Per-galaxy haze — particles tinted with each galaxy color, clustered
 *      around its position with a soft falloff so the nebulae feel like they
 *      "bleed" outward instead of sitting on a black void.
 *   2. Ambient sweep — neutral cyan/violet motes drifting through the whole
 *      ring, giving a sense of currents in interstellar dust.
 *
 * Uses a circular sprite + additive blending so points never look square.
 */
export function CosmicDust({ perGalaxy = 900, ambient = 1200, dim = false }: Props) {
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  // Build a small circular soft-falloff sprite once.
  const sprite = useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const { positions, colors, sizes } = useMemo(() => {
    const galaxyEntries = Object.entries(GALAXY_POSITIONS) as [Galaxy, [number, number, number]][];
    const total = galaxyEntries.length * perGalaxy + ambient;
    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const siz = new Float32Array(total);

    let idx = 0;

    // 1. Per-galaxy nebula — each cluster is a large volumetric structure
    //    with a dense bright core fading through long wispy outer filaments,
    //    NOT a tight bokeh ball with dot-confetti dust. Reference images:
    //    /workspace/image-2.jpg, image-3.jpg, image-4.jpg.
    //
    //    Key design choices:
    //    - Footprint ~55u (was 14u, ~3.9× radius). Particle count quadrupled
    //      so density doesn't collapse as the cloud expands.
    //    - Power-law radial distribution r = R * pow(rand, 2.2) concentrates
    //      points heavily near the core and lets a long wispy tail of
    //      particles drift far out.
    //    - Per-particle low-frequency sin-noise offset (3 octaves, cheap)
    //      perturbs positions so the cloud reads as filamentary sheets,
    //      not a uniform ellipsoid of points.
    //    - Hot-white tint at the dense core fading to status color at the
    //      edges, matching the "bright core / colored arms" look of real
    //      nebulae (image-4.jpg).
    galaxyEntries.forEach(([g, p]) => {
      const c = new THREE.Color(GALAXY_COLORS[g]);
      // Per-galaxy elongation parameters (deterministic per galaxy name).
      const seed = (g.charCodeAt(0) * 13 + g.charCodeAt(g.length - 1) * 7) % 360;
      const rot = (seed / 360) * Math.PI * 2;
      // Aspect ratio for the ellipsoid: long axis is ~3× short axis so each
      // galaxy reads as elongated / sheet-like, not spherical.
      const ax = 2.4 + ((seed % 40) / 40) * 1.6; // 2.4..4.0 long axis
      const az = 0.65 + ((seed % 17) / 17) * 0.55; // 0.65..1.2 short axis
      const ay = 0.6; // vertical squash so the cloud lays in a thick disk
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      // Phase offsets for cheap 3-octave sin-noise wisps (per-galaxy unique).
      const nPhaseA = (seed * 0.137) % (Math.PI * 2);
      const nPhaseB = (seed * 0.311) % (Math.PI * 2);
      // Footprint controls overall nebula radius. 55u is ~3.9× the previous
      // 14u; combined with the elongation factor (ax up to 4) the long-axis
      // tip can reach ~220u, allowing neighboring galaxies (centers 120u
      // apart from PR #6) to bleed into each other in the middle of the
      // field — that overlap is intentional and desired.
      const footprint = 55;
      for (let i = 0; i < perGalaxy; i++) {
        // Power-law radial distribution: dense core, wispy outer reaches.
        // Exponent 2.2 strongly concentrates points near the center.
        const u = Math.pow(Math.random(), 2.2);
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.5) * 1.0;
        // Local frame coords — long axis = local X.
        let lx = Math.cos(theta) * u * ax;
        let ly = Math.sin(phi) * u * ay;
        let lz = Math.sin(theta) * u * az;
        // Cheap 3-octave sin-based "noise" offset to introduce filamentary
        // wisps. Amplitude grows with radius so the core stays clean and the
        // outer reaches break into sheet-like structures.
        const nAmp = 0.18 + u * 0.55;
        const nx = Math.sin(lx * 1.7 + nPhaseA) * Math.cos(lz * 1.3 + nPhaseB);
        const ny = Math.sin(lz * 2.1 + nPhaseA) * 0.4;
        const nz = Math.cos(lx * 1.9 + nPhaseB) * Math.sin(ly * 2.4);
        lx += nx * nAmp;
        ly += ny * nAmp * 0.35;
        lz += nz * nAmp;
        // Scale to full nebula footprint.
        lx *= footprint;
        const lyOut = ly * footprint;
        lz *= footprint;
        // Rotate around Y so each galaxy's long axis points uniquely.
        const wx = lx * cosR - lz * sinR;
        const wz = lx * sinR + lz * cosR;
        pos[idx * 3] = p[0] + wx;
        pos[idx * 3 + 1] = p[1] + lyOut;
        pos[idx * 3 + 2] = p[2] + wz;

        // Hot-white core fading to status color outward. coreMix is high
        // (whiter) at u≈0 and low (full color) at u≈1.
        const coreMix = Math.max(0, 1 - u * 2.6);
        const fade = 0.45 + Math.random() * 0.5;
        col[idx * 3] = c.r * fade + coreMix * 0.55 + 0.06;
        col[idx * 3 + 1] = c.g * fade + coreMix * 0.55 + 0.06;
        col[idx * 3 + 2] = c.b * fade + coreMix * 0.55 + 0.06;

        // Soft puffs throughout. Core particles a touch larger so the dense
        // center reads bright; outer wisps slightly smaller so they feather.
        const baseSize = 0.45 + (1 - u) * 0.55;
        siz[idx] =
          Math.random() < 0.015
            ? baseSize * 2.2 + Math.random() * 0.6
            : baseSize + Math.random() * 0.35;
        idx++;
      }
    });

    // 2. Ambient sweep — broader, sparser, spread across a wider ring so
    //    the void between galaxies has texture.
    for (let i = 0; i < ambient; i++) {
      // Ring spans 14..78 units (was 18..56) for a wider field.
      const r = 14 + Math.pow(Math.random(), 0.65) * 64;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 22;
      pos[idx * 3] = Math.cos(theta) * r;
      pos[idx * 3 + 1] = y;
      pos[idx * 3 + 2] = Math.sin(theta) * r;

      // Neutral whites with hints of cyan / violet / pink.
      const tint = Math.random();
      let r2 = 0.62, g2 = 0.7, b2 = 0.9;
      if (tint < 0.25) {
        r2 = 0.36; g2 = 0.85; b2 = 1.0;        // cyan
      } else if (tint < 0.45) {
        r2 = 0.78; g2 = 0.55; b2 = 1.0;        // violet
      } else if (tint < 0.55) {
        r2 = 1.0; g2 = 0.55; b2 = 0.78;        // soft pink
      } else {
        const b = 0.55 + Math.random() * 0.35;
        r2 = b; g2 = b; b2 = b;                 // dust white
      }
      col[idx * 3] = r2;
      col[idx * 3 + 1] = g2;
      col[idx * 3 + 2] = b2;

      // Smaller ambient mote sizes — these should never read as discrete
      // bokeh balls; they're atmospheric grain.
      siz[idx] = 0.18 + Math.random() * 0.35;
      idx++;
    }

    return { positions: pos, colors: col, sizes: siz };
  }, [perGalaxy, ambient]);

  // Slow swirl around Y axis with very gentle wobble — feels like a current.
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.012;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.04) * 0.03;
    }
    if (matRef.current) {
      // Planet view goes nearly black — the user wants the focused planet
      // alone with just "faint dust and stars" behind it.
      // God view opacity dropped (was 0.42) because particle count
      // quadrupled — without this the dense regions blow out.
      const target = dim ? 0.014 : 0.24;
      matRef.current.opacity += (target - matRef.current.opacity) * Math.min(1, delta * 4);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        map={sprite}
        size={2.2}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.24}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
