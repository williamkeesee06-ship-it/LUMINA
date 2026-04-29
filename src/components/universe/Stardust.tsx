import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  count?: number;
  radius?: number;
  /** Base size of star sprites (world units at default size attenuation). */
  size?: number;
  /** 0..1 — base opacity of the layer. */
  baseOpacity?: number;
  /** Fraction of stars that will twinkle (0..1). Default 0.05 = 5%. */
  twinkleFraction?: number;
  /** Rotation speed in rad/sec around Y. */
  spin?: number;
  /** Vertical squish: 1 = full sphere, 0.5 = flat dome. */
  flatten?: number;
  /** When true, reduce opacity for the cinematic planet-focus mode. */
  dim?: boolean;
}

/**
 * Layered starfield. Bright stars use a soft circular radial sprite so they
 * never render as squares. A small fraction (~5%) twinkle individually using
 * a per-particle phase encoded in the alpha channel of a custom shader; the
 * rest stay still so the field reads as deep, calm space.
 */
export function Stardust({
  count = 1400,
  radius = 90,
  size = 0.18,
  baseOpacity = 0.85,
  twinkleFraction = 0.05,
  spin = 0.01,
  flatten = 0.5,
  dim = false,
}: Props) {
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // High-resolution sharp pinpoint sprite. Tight bright core + tiny halo
  // makes stars read as crisp pixels of light at any distance instead of
  // soft glowy bokeh balls.
  const sprite = useMemo(() => {
    const s = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = s;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    // Bright pinpoint core, very tight falloff, tiny soft halo for atmosphere.
    grad.addColorStop(0.0, "rgba(255,255,255,1)");
    grad.addColorStop(0.08, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.18, "rgba(255,255,255,0.35)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.06)");
    grad.addColorStop(1.0, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(canvas);
    // Higher anisotropy + linear filter = sharper at oblique angles.
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const { positions, colors, twinkleData, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    // x = phase offset (0..2π), y = twinkle amplitude (0 = no twinkle, 1 = full)
    const tw = new Float32Array(count * 2);
    const siz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = radius * Math.pow(Math.random(), 0.5);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * flatten;
      pos[i * 3 + 2] = r * Math.cos(phi);

      // Mostly bright cool whites with rarer cyan / teal / warm-white tints.
      // Heavier on whites — the user wanted "more white stars".
      const tint = Math.random();
      if (tint < 0.025) {
        // cool cyan
        col[i * 3] = 0.45;
        col[i * 3 + 1] = 0.95;
        col[i * 3 + 2] = 1;
      } else if (tint < 0.045) {
        // teal
        col[i * 3] = 0.34;
        col[i * 3 + 1] = 1;
        col[i * 3 + 2] = 0.88;
      } else if (tint < 0.06) {
        // warm white
        col[i * 3] = 1;
        col[i * 3 + 1] = 0.94;
        col[i * 3 + 2] = 0.82;
      } else {
        // mostly bright neutral whites, biased brighter than before.
        const b = 0.85 + Math.random() * 0.15;
        col[i * 3] = b;
        col[i * 3 + 1] = b;
        col[i * 3 + 2] = b;
      }

      // Per-star size variation. The double-Math.random() bias keeps most
      // stars small (sharp pinpoints) with rarer brighter "near" stars.
      siz[i] = 0.55 + Math.random() * Math.random() * 1.4;

      // Only ~twinkleFraction of stars actually twinkle; the rest are still.
      tw[i * 2] = Math.random() * Math.PI * 2;
      tw[i * 2 + 1] = Math.random() < twinkleFraction ? 0.45 + Math.random() * 0.4 : 0;
    }
    return { positions: pos, colors: col, twinkleData: tw, sizes: siz };
  }, [count, radius, flatten, twinkleFraction]);

  // Custom shader material so we can do per-particle twinkle alpha cheaply.
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: sprite },
        uTime: { value: 0 },
        uOpacity: { value: baseOpacity },
        uSize: { value: size },
      },
      vertexShader: `
        attribute vec2 twinkle; // x: phase, y: amplitude
        attribute float aSize;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;
        uniform float uSize;
        void main() {
          vColor = color;
          // Twinkle modulates alpha only — keeps math cheap.
          float wave = sin(uTime * 2.4 + twinkle.x);
          float amp = twinkle.y;
          // when amp == 0, alpha is exactly 1.0 (still star)
          vAlpha = mix(1.0, 0.55 + wave * 0.45, amp);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          // Size attenuation: closer -> larger, with per-star jitter.
          gl_PointSize = uSize * aSize * (300.0 / -mv.z);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          float a = t.a * vAlpha * uOpacity;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * t.rgb, a);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [sprite, baseOpacity, size]);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * spin;
    }
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      const target = dim ? baseOpacity * 0.18 : baseOpacity;
      const cur = matRef.current.uniforms.uOpacity.value as number;
      matRef.current.uniforms.uOpacity.value =
        cur + (target - cur) * Math.min(1, delta * 4);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-twinkle" args={[twinkleData, 2]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <primitive ref={matRef} object={material} attach="material" />
    </points>
  );
}
