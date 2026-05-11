import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  count?: number;
  radius?: number;
  /** Non-attenuated pixel size of each star. */
  size?: number;
  baseOpacity?: number;
  /** Vertical squish: 1 = sphere, 0.5 = flat dome. */
  flatten?: number;
  /** Reduce opacity in cinematic planet-focus mode. */
  dim?: boolean;
  /** Fraction of brightest stars that also get a cross-flare sprite (~0.05). */
  flareFraction?: number;
}

/**
 * Hard white pinpoint starfield — like grains of salt against a black sky.
 * Uses `sizeAttenuation=false` so each star renders as a small fixed-pixel dot
 * regardless of camera distance. No soft glow, no bokeh swell on close
 * approach. The brightest ~5% get a separate cross-flare sprite layered on top
 * for a touch of variety (matches the look of long-exposure astrophotography).
 */
export function Starfield({
  count = 6000,
  radius = 240,
  size = 0.06,
  baseOpacity = 0.95,
  flatten = 1,
  dim = false,
  flareFraction = 0.05,
}: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const flareRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const flareMatRef = useRef<THREE.PointsMaterial>(null);

  // Cross-flare sprite for the brightest stars: vertical + horizontal bright
  // lines through center, fading out. Drawn once into a 64×64 CanvasTexture.
  const flareSprite = useMemo(() => {
    const s = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = s;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, s, s);
    // Bright center dot
    const cx = s / 2;
    const cy = s / 2;
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.18);
    core.addColorStop(0, "rgba(255,255,255,1)");
    core.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, s, s);
    // Horizontal flare line
    const hGrad = ctx.createLinearGradient(0, cy, s, cy);
    hGrad.addColorStop(0, "rgba(255,255,255,0)");
    hGrad.addColorStop(0.45, "rgba(255,255,255,0.85)");
    hGrad.addColorStop(0.5, "rgba(255,255,255,1)");
    hGrad.addColorStop(0.55, "rgba(255,255,255,0.85)");
    hGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, cy - 1, s, 2);
    // Vertical flare line
    const vGrad = ctx.createLinearGradient(cx, 0, cx, s);
    vGrad.addColorStop(0, "rgba(255,255,255,0)");
    vGrad.addColorStop(0.45, "rgba(255,255,255,0.85)");
    vGrad.addColorStop(0.5, "rgba(255,255,255,1)");
    vGrad.addColorStop(0.55, "rgba(255,255,255,0.85)");
    vGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = vGrad;
    ctx.fillRect(cx - 1, 0, 2, s);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const { positions, colors, flarePositions, flareColors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const flareList: number[] = [];
    const flareColList: number[] = [];

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = radius * Math.pow(Math.random(), 0.5);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta) * flatten;
      const z = r * Math.cos(phi);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // 90% pure white, 10% mild color variance (cool blue / warm).
      const tint = Math.random();
      let cr = 1, cg = 1, cb = 1;
      if (tint < 0.05) {
        // cool blue
        cr = 0.81; cg = 0.88; cb = 1.0;
      } else if (tint < 0.1) {
        // warm
        cr = 1.0; cg = 0.9; cb = 0.77;
      }
      col[i * 3] = cr;
      col[i * 3 + 1] = cg;
      col[i * 3 + 2] = cb;

      // Brightest ~flareFraction get a cross-flare sprite on top.
      if (Math.random() < flareFraction) {
        flareList.push(x, y, z);
        flareColList.push(cr, cg, cb);
      }
    }

    return {
      positions: pos,
      colors: col,
      flarePositions: new Float32Array(flareList),
      flareColors: new Float32Array(flareColList),
    };
  }, [count, radius, flatten, flareFraction]);

  useFrame((_, delta) => {
    if (matRef.current) {
      const target = dim ? baseOpacity * 0.18 : baseOpacity;
      matRef.current.opacity += (target - matRef.current.opacity) * Math.min(1, delta * 4);
    }
    if (flareMatRef.current) {
      const target = dim ? 0.05 : 0.7;
      flareMatRef.current.opacity += (target - flareMatRef.current.opacity) * Math.min(1, delta * 4);
    }
    // Very slow drift gives the sky some life without smearing the pinpoints.
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.003;
    if (flareRef.current) flareRef.current.rotation.y += delta * 0.003;
  });

  return (
    <group>
      {/* Hard pinpoint layer — non-attenuated so stars stay sharp at all
          distances and don't bloom on close approach. */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={matRef}
          size={size}
          sizeAttenuation={false}
          vertexColors
          transparent
          opacity={baseOpacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Cross-flare layer for the brightest stars. World-size sprite so the
          flare sells as a long-exposure highlight, not another pinpoint. */}
      {flarePositions.length > 0 && (
        <points ref={flareRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[flarePositions, 3]} />
            <bufferAttribute attach="attributes-color" args={[flareColors, 3]} />
          </bufferGeometry>
          <pointsMaterial
            ref={flareMatRef}
            map={flareSprite}
            alphaMap={flareSprite}
            size={0.25}
            sizeAttenuation
            vertexColors
            transparent
            opacity={0.7}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </group>
  );
}
