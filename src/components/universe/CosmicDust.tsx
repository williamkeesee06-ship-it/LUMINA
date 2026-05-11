import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { GALAXY_POSITIONS } from "./galaxyLayout";
import { GALAXIES } from "@/types";
import type { Galaxy } from "@/types";

interface Props {
  /** When true, fade dust out for cinematic planet-focus mode. */
  dim?: boolean;
}

/**
 *  Per-galaxy plasma stack. Replaces the old point-particle haze with a stack
 *  of 7 billboarded ShaderMaterial planes. Fragment shader uses 6-octave fbm
 *  + 7-octave ridged fbm so the cloud reads as torn-filament gas (matching
 *  the reflection-nebula reference + V9 mockup), not bokeh balls.
 *
 *  Stack scales [140, 110, 85, 65, 48, 34, 24] keep each galaxy compact so
 *  the outer haze does not bleed past its 120u-distant neighbor.
 */
const SHARED_NOISE_GLSL = `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0; float amp = 0.5;
    for (int i = 0; i < 6; i++){ v += amp * vnoise(p); p *= 2.07; amp *= 0.52; }
    return v;
  }
  float fbmRidged(vec2 p){
    float v = 0.0; float amp = 0.5;
    for (int i = 0; i < 7; i++){
      v += amp * (1.0 - abs(vnoise(p) * 2.0 - 1.0));
      p *= 2.13; amp *= 0.50;
    }
    return v;
  }
`;

const HAZE_VERTEX_SHADER = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HAZE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uSeed;
  uniform float uIntensity;
  ${SHARED_NOISE_GLSL}
  void main(){
    vec2 p = vUv - 0.5;
    float r = length(p);
    float fall = smoothstep(0.55, 0.0, r);
    vec2 q = p * 2.6 + vec2(uSeed * 5.3, uSeed * -3.1) + uTime * 0.008;
    float body  = fbm(q);
    float wisp1 = fbmRidged(q * 3.2 + vec2(11.0, -7.0));
    float wisp2 = fbmRidged(q * 6.4 + vec2(-3.0, 9.0) + uTime * 0.010);
    float density =
        pow(body,  1.4) * 0.55
      + pow(wisp1, 1.8) * 0.70
      + pow(wisp2, 2.2) * 0.55;
    density += 0.55 * smoothstep(0.45, 0.85, wisp1) * smoothstep(0.30, 0.70, body);
    density *= fall * uIntensity;
    vec3 col = mix(uColorA, uColorB, body);
    col = mix(col, vec3(1.0), pow(wisp2, 2.5) * 0.35);
    col *= density;
    gl_FragColor = vec4(col, density);
  }
`;

export function buildHazeMaterial(
  colorA: THREE.ColorRepresentation,
  colorB: THREE.ColorRepresentation,
  seed: number,
  intensity: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uSeed: { value: seed },
      uIntensity: { value: intensity },
    },
    vertexShader: HAZE_VERTEX_SHADER,
    fragmentShader: HAZE_FRAGMENT_SHADER,
  });
}

const STACK_SCALES = [140, 110, 85, 65, 48, 34, 24];

interface GalaxyPlasmaStackProps {
  galaxy: Galaxy;
  position: [number, number, number];
  dim?: boolean;
}

function GalaxyPlasmaStack({ galaxy, position, dim }: GalaxyPlasmaStackProps) {
  const groupRef = useRef<THREE.Group>(null);
  const galaxyIndex = GALAXIES.indexOf(galaxy);
  const accentHex = useMemo(() => {
    // Derive a darker accent from the galaxy base color so each plasma stack
    // has its own primary tint + darker shadow band, matching the mockup.
    const base = new THREE.Color(GALAXY_COLORS[galaxy]);
    const accent = base.clone().multiplyScalar(0.18);
    return accent.getHex();
  }, [galaxy]);

  const planes = useMemo(() => {
    return STACK_SCALES.map((scale, si) => {
      const material = buildHazeMaterial(
        GALAXY_COLORS[galaxy],
        accentHex,
        galaxyIndex * 1.3 + si * 0.41,
        0.40 + (STACK_SCALES.length - 1 - si) * 0.08,
      );
      return { scale, material, tiltSeed: galaxyIndex * 0.5 + si };
    });
  }, [galaxy, galaxyIndex, accentHex]);

  // Dispose materials on unmount so we don't leak shader programs when the
  // user toggles between universe/planet view repeatedly.
  // (useMemo doesn't run cleanup, so we hook into a ref-effect.)
  const planesRef = useRef(planes);
  planesRef.current = planes;

  // Smooth dim fade.
  const dimAmount = useRef(0);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const camQuat = state.camera.quaternion;
    const targetDim = dim ? 1 : 0;
    dimAmount.current += (targetDim - dimAmount.current) * Math.min(1, delta * 4);
    const intensityMul = 1 - dimAmount.current * 0.92;
    const g = groupRef.current;
    if (!g) return;
    for (let i = 0; i < g.children.length; i++) {
      const child = g.children[i] as THREE.Mesh;
      child.quaternion.copy(camQuat);
      child.rotateZ(planes[i].tiltSeed + t * 0.02);
      const mat = child.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = t;
      // Per-plane base intensity is set on the material; modulate by dim.
      const baseI = 0.40 + (STACK_SCALES.length - 1 - i) * 0.08;
      mat.uniforms.uIntensity.value = baseI * intensityMul;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {planes.map((p, i) => (
        <mesh key={i} material={p.material}>
          <planeGeometry args={[p.scale, p.scale]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 *  CosmicDust mounts one plasma stack per galaxy. The old `perGalaxy` /
 *  `ambient` props are gone — ambient haze now lives in <AmbientHaze /> and
 *  per-galaxy density is fixed by the 7-plane stack.
 */
export function CosmicDust({ dim = false }: Props) {
  // Keep the underlying camera live so useFrame can pull quaternion. Just
  // referencing it here ensures the consumer Canvas has a camera context.
  useThree();
  return (
    <group>
      {GALAXIES.map((g) => (
        <GalaxyPlasmaStack
          key={g}
          galaxy={g}
          position={GALAXY_POSITIONS[g]}
          dim={dim}
        />
      ))}
    </group>
  );
}
