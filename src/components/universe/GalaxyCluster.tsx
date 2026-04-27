import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { Galaxy } from "@/types";
import { GALAXY_COLORS } from "@/lib/statusMap";

/**
 * Soft additive radial sprite — used to replace the hard sphereGeometry core
 * so the galaxy nucleus reads as a glow instead of a flat disc.
 */
function makeSoftSprite(): THREE.Texture {
  const s = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.65)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface Props {
  galaxy: Galaxy;
  position: [number, number, number];
  count: number;
  highlighted?: boolean;
  dimmed?: boolean;
  insideThis?: boolean;
  onSelect: () => void;
}

const NEBULA_FOR: Record<Galaxy, string> = {
  Complete: "/textures/nebula_teal.png",
  "Fielded-RTS": "/textures/nebula_teal.png",
  "Needs Fielding": "/textures/nebula_amber.png",
  "On Hold": "/textures/nebula_red.png",
  Pending: "/textures/nebula_violet.png",
  "Routed to Sub": "/textures/nebula_magenta.png",
  Scheduled: "/textures/nebula_green.png",
};

/**
 * Custom shader material for nebula billboard:
 * - samples nebula texture
 * - multiplies by status color tint
 * - applies radial alpha falloff so square edges vanish
 * - additive-blend with the scene
 */
function makeNebulaMaterial(tex: THREE.Texture, color: string) {
  const c = new THREE.Color(color);
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex },
      uColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
      uOpacity: { value: 0.65 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        // Radial mask: 1 at center, 0 at edges with smooth falloff
        vec2 d = vUv - 0.5;
        float r = length(d) * 2.0; // 0..1 from center to corner
        float mask = smoothstep(1.0, 0.15, r);
        // Tint nebula by status color while preserving brightness variation
        vec3 lum = vec3(dot(t.rgb, vec3(0.299, 0.587, 0.114)));
        vec3 tinted = mix(t.rgb, lum * uColor * 1.6, 0.65);
        float a = t.a * mask * uOpacity;
        gl_FragColor = vec4(tinted, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function GalaxyCluster({
  galaxy,
  position,
  count,
  highlighted = false,
  dimmed = false,
  insideThis = false,
  onSelect,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const nebulaMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const dustRef = useRef<THREE.Points>(null);

  const color = GALAXY_COLORS[galaxy];
  const nebulaTex = useLoader(THREE.TextureLoader, NEBULA_FOR[galaxy]);
  const softSprite = useMemo(() => makeSoftSprite(), []);

  const nebulaMaterial = useMemo(() => {
    const m = makeNebulaMaterial(nebulaTex, color);
    nebulaMatRef.current = m;
    return m;
  }, [nebulaTex, color]);

  const scale = useMemo(() => {
    if (count === 0) return 0.7;
    return 0.95 + Math.min(Math.log2(count + 1) * 0.18, 1.6);
  }, [count]);

  const { positions, colors } = useMemo(() => {
    const n = Math.max(120, Math.min(700, count * 12));
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      // Looser arms: wider angular jitter so spiral looks organic, not tidy.
      const angle = t * Math.PI * 8 + (Math.random() - 0.5) * 1.6;
      // Wider radius distribution + per-particle radial jitter so silhouette
      // bleeds into surrounding space instead of having a sharp edge.
      const r = 1.0 + Math.pow(Math.random(), 0.5) * 5.0 + (Math.random() - 0.5) * 0.6;
      pos[i * 3] = Math.cos(angle) * r;
      // Wider y-jitter, scaled by radius so outer arms feather out vertically.
      pos[i * 3 + 1] = (Math.random() - 0.5) * (0.35 + r * 0.12);
      pos[i * 3 + 2] = Math.sin(angle) * r;
      const fade = 0.5 + Math.random() * 0.5;
      col[i * 3] = c.r * fade;
      col[i * 3 + 1] = c.g * fade;
      col[i * 3 + 2] = c.b * fade;
    }
    return { positions: pos, colors: col };
  }, [count, color]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (nebulaMatRef.current) {
      // When camera is inside this galaxy, fade the billboard so it acts as
      // ambient atmosphere rather than dominating the view.
      const baseOpacity = insideThis ? 0.18 : dimmed ? 0.22 : 0.7;
      nebulaMatRef.current.uniforms.uOpacity.value =
        baseOpacity + Math.sin(t * 0.6) * 0.04;
    }
    if (haloRef.current) {
      const m = haloRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = insideThis
        ? 0
        : (dimmed ? 0.04 : 0.22) + Math.sin(t * 1.2) * 0.04;
    }
    if (coreRef.current) {
      const m = coreRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = insideThis
        ? 0
        : (dimmed ? 0.4 : 0.95) + Math.sin(t * 1.6) * 0.05;
    }
    if (dustRef.current) {
      dustRef.current.rotation.y += delta * 0.04;
      const m = dustRef.current.material as THREE.PointsMaterial;
      m.opacity = insideThis ? 0.05 : dimmed ? 0.12 : 0.85;
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
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
      {/* Nebula billboard — always faces camera, radial alpha mask hides edges.
          Larger plane (10×10) lets the existing alpha-masked texture feather
          farther out into the void, so each cluster's outer edge dissolves into
          space instead of stopping abruptly. No new geometry/particles — just
          stretching the same nebula sprite over a larger area. */}
      <Billboard>
        <mesh material={nebulaMaterial}>
          <planeGeometry args={[10, 10]} />
        </mesh>
      </Billboard>

      {/* Soft outer halo — neon glow bleed (additive only, no solid mass) */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {/* Bright neon core — soft additive radial sprite (no hard silhouette).
          Replaces the previous sphereGeometry which read as a visible disc. */}
      <Billboard>
        <mesh ref={coreRef}>
          <planeGeometry args={[2.4, 2.4]} />
          <meshBasicMaterial
            map={softSprite}
            color={color}
            transparent
            opacity={0.95}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      {/* Highlight ring when focused */}
      {highlighted && (
        <Billboard>
          <mesh>
            <ringGeometry args={[2.2, 2.32, 96]} />
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
      {/* Parallax dust */}
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.07}
          sizeAttenuation
          vertexColors
          transparent
          opacity={dimmed ? 0.12 : 0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
