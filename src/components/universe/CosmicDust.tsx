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
export function CosmicDust({ perGalaxy = 380, ambient = 900 }: Props) {
  const ref = useRef<THREE.Points>(null);

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

    // 1. Per-galaxy haze
    galaxyEntries.forEach(([g, p]) => {
      const c = new THREE.Color(GALAXY_COLORS[g]);
      for (let i = 0; i < perGalaxy; i++) {
        // Gaussian-ish cluster around galaxy position with ~7 unit spread.
        const r = Math.pow(Math.random(), 1.4) * 9;
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.5) * 0.7; // flatten to disk
        pos[idx * 3] = p[0] + Math.cos(theta) * r;
        pos[idx * 3 + 1] = p[1] + Math.sin(phi) * r * 0.5;
        pos[idx * 3 + 2] = p[2] + Math.sin(theta) * r;

        // Tint slightly desaturated toward white so dust isn't garish.
        const fade = 0.55 + Math.random() * 0.45;
        col[idx * 3] = c.r * fade + 0.08;
        col[idx * 3 + 1] = c.g * fade + 0.08;
        col[idx * 3 + 2] = c.b * fade + 0.08;

        // Mostly tiny motes, a few larger glowing puffs.
        siz[idx] = Math.random() < 0.08 ? 1.4 + Math.random() * 0.9 : 0.35 + Math.random() * 0.55;
        idx++;
      }
    });

    // 2. Ambient sweep — broad, sparse, cool palette.
    for (let i = 0; i < ambient; i++) {
      const r = 18 + Math.pow(Math.random(), 0.7) * 38;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 14;
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

      siz[idx] = 0.3 + Math.random() * 0.6;
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
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        size={1.0}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.42}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
