import { useMemo } from "react";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";

/**
 * Distant nebula clouds — huge, very low-opacity static blobs placed in the
 * far corners of the universe. Static (no per-frame work) so they cost
 * nothing once uploaded. They give the deep-space backdrop subtle color
 * variation without overwhelming the galaxies.
 */
function makeCloudSprite(): THREE.Texture {
  const s = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext("2d")!;

  // Multiple offset radial gradients to simulate cloud puffs without an actual
  // noise function — much cheaper, looks organic enough at low opacity.
  const puffs = 7;
  for (let i = 0; i < puffs; i++) {
    const cx = s * (0.3 + Math.random() * 0.4);
    const cy = s * (0.3 + Math.random() * 0.4);
    const r = s * (0.18 + Math.random() * 0.22);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(255,255,255,0.18)");
    g.addColorStop(0.5, "rgba(255,255,255,0.06)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
  // Master fade so corners are perfectly transparent.
  const mask = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  mask.addColorStop(0, "rgba(0,0,0,0)");
  mask.addColorStop(0.85, "rgba(0,0,0,0)");
  mask.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, s, s);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface CloudDef {
  position: [number, number, number];
  scale: number;
  color: string;
  opacity: number;
}

const CLOUDS: CloudDef[] = [
  // Deep violet cloud, upper-left corner of the universe.
  { position: [-110, 18, -90], scale: 90, color: "#5C2D8A", opacity: 0.55 },
  // Deep teal cloud, lower-right.
  { position: [120, -22, -60], scale: 100, color: "#0E5A6B", opacity: 0.5 },
  // Subtle magenta wash behind the central ring.
  { position: [0, -30, -160], scale: 130, color: "#7B1F5C", opacity: 0.35 },
];

export function NebulaClouds() {
  const sprite = useMemo(() => makeCloudSprite(), []);

  return (
    <group>
      {CLOUDS.map((c, i) => (
        <Billboard key={i} position={c.position}>
          <mesh>
            <planeGeometry args={[c.scale, c.scale]} />
            <meshBasicMaterial
              map={sprite}
              color={c.color}
              transparent
              opacity={c.opacity}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </Billboard>
      ))}
    </group>
  );
}
