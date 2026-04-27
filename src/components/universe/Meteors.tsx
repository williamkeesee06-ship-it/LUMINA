import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  /** Average seconds between meteor spawns. Default ~10s. */
  intervalSec?: number;
  /** Maximum simultaneous meteors. Keeps the field calm. */
  poolSize?: number;
  /** Approximate spawn radius around origin. */
  radius?: number;
  /** When true, suppress new spawns (e.g. cinematic planet view). */
  dim?: boolean;
}

interface Meteor {
  active: boolean;
  start: THREE.Vector3;
  dir: THREE.Vector3;   // unit
  speed: number;        // units per second
  life: number;         // seconds elapsed
  duration: number;     // total lifetime
  hue: THREE.Color;     // tint
}

/**
 * Real shooting stars: tapered streaks with a bright head, fading tail, and
 * a soft glow halo. Replaces the user's complaint of "shooting squares".
 *
 * Implementation: a small pool of meteors share one BufferGeometry (line
 * segments built from per-meteor head/tail pairs), plus an additive sprite
 * for each head. Per-vertex colors give the bright-head -> faded-tail look
 * via vertexColors on a LineBasicMaterial without needing a custom shader.
 */
export function Meteors({
  intervalSec = 10,
  poolSize = 6,
  radius = 90,
  dim = false,
}: Props) {
  const linesGeoRef = useRef<THREE.BufferGeometry>(null);
  const headsGeoRef = useRef<THREE.BufferGeometry>(null);
  const headsMatRef = useRef<THREE.PointsMaterial>(null);
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null);
  const nextSpawn = useRef<number>(2 + Math.random() * intervalSec);

  // Soft circular sprite for the head glow.
  const headSprite = useMemo(() => {
    const s = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = s;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const meteors = useMemo<Meteor[]>(() => {
    const arr: Meteor[] = [];
    for (let i = 0; i < poolSize; i++) {
      arr.push({
        active: false,
        start: new THREE.Vector3(),
        dir: new THREE.Vector3(),
        speed: 0,
        life: 0,
        duration: 0,
        hue: new THREE.Color(),
      });
    }
    return arr;
  }, [poolSize]);

  // Buffers for line segments: 2 vertices per meteor (head, tail).
  const lineBuffers = useMemo(() => {
    const positions = new Float32Array(poolSize * 2 * 3);
    const colors = new Float32Array(poolSize * 2 * 3);
    return { positions, colors };
  }, [poolSize]);

  // Buffers for head sprites.
  const headBuffers = useMemo(() => {
    const positions = new Float32Array(poolSize * 3);
    const colors = new Float32Array(poolSize * 3);
    const sizes = new Float32Array(poolSize);
    return { positions, colors, sizes };
  }, [poolSize]);

  function spawn(m: Meteor) {
    // Spawn just outside view, fly across at a low pitch — meteors look most
    // believable when they cut diagonally across the sky.
    const theta = Math.random() * Math.PI * 2;
    const r = radius * (0.55 + Math.random() * 0.25);
    const y = (Math.random() - 0.4) * 18; // slightly biased upward
    m.start.set(Math.cos(theta) * r, y, Math.sin(theta) * r);

    // Direction: tangential-ish, mostly horizontal, slight downward bias.
    const dx = -Math.cos(theta) * 0.6 + (Math.random() - 0.5) * 0.4;
    const dz = -Math.sin(theta) * 0.6 + (Math.random() - 0.5) * 0.4;
    const dy = -0.05 - Math.random() * 0.15;
    m.dir.set(dx, dy, dz).normalize();

    m.speed = 28 + Math.random() * 22; // units / sec
    m.duration = 0.8 + Math.random() * 0.7;
    m.life = 0;

    // Cool palette: warm white, soft cyan, occasional violet.
    const tint = Math.random();
    if (tint < 0.7) m.hue.setRGB(1, 0.95, 0.85);       // warm white
    else if (tint < 0.92) m.hue.setRGB(0.55, 0.95, 1);  // cyan
    else m.hue.setRGB(0.85, 0.6, 1);                    // violet

    m.active = true;
  }

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Spawn schedule — only one meteor per tick, only when we're under cap.
    if (!dim && t > nextSpawn.current) {
      const idle = meteors.find((m) => !m.active);
      if (idle) spawn(idle);
      nextSpawn.current = t + intervalSec * (0.6 + Math.random() * 0.9);
    }

    // Update + repack buffers.
    const lp = lineBuffers.positions;
    const lc = lineBuffers.colors;
    const hp = headBuffers.positions;
    const hc = headBuffers.colors;
    const hs = headBuffers.sizes;

    let activeAny = false;

    for (let i = 0; i < meteors.length; i++) {
      const m = meteors[i];
      if (!m.active) {
        // zero out so nothing renders for this slot
        lp[i * 6] = lp[i * 6 + 1] = lp[i * 6 + 2] = 0;
        lp[i * 6 + 3] = lp[i * 6 + 4] = lp[i * 6 + 5] = 0;
        lc[i * 6] = lc[i * 6 + 1] = lc[i * 6 + 2] = 0;
        lc[i * 6 + 3] = lc[i * 6 + 4] = lc[i * 6 + 5] = 0;
        hp[i * 3] = hp[i * 3 + 1] = hp[i * 3 + 2] = 0;
        hc[i * 3] = hc[i * 3 + 1] = hc[i * 3 + 2] = 0;
        hs[i] = 0;
        continue;
      }

      m.life += delta;
      const life01 = m.life / m.duration;
      if (life01 >= 1) {
        m.active = false;
        continue;
      }
      activeAny = true;

      // Bell-curve fade — bright in the middle, fades on both ends.
      const fade = Math.sin(Math.PI * life01);

      // Head moves forward over time. Tail trails behind by ~tailLen along -dir.
      const headPos = m.start.clone().add(m.dir.clone().multiplyScalar(m.speed * m.life));
      const tailLen = 4 + m.speed * 0.18; // longer trail at higher speed
      const tailPos = headPos.clone().add(m.dir.clone().multiplyScalar(-tailLen));

      // Line segment: head bright, tail black (alpha-baked into color since
      // we use additive blending — black contributes nothing).
      lp[i * 6] = headPos.x;
      lp[i * 6 + 1] = headPos.y;
      lp[i * 6 + 2] = headPos.z;
      lp[i * 6 + 3] = tailPos.x;
      lp[i * 6 + 4] = tailPos.y;
      lp[i * 6 + 5] = tailPos.z;

      const k = fade;
      lc[i * 6] = m.hue.r * k;
      lc[i * 6 + 1] = m.hue.g * k;
      lc[i * 6 + 2] = m.hue.b * k;
      // Tail end: ~0 contribution so the streak tapers to nothing.
      lc[i * 6 + 3] = 0;
      lc[i * 6 + 4] = 0;
      lc[i * 6 + 5] = 0;

      // Head sprite at the tip, slightly larger than line.
      hp[i * 3] = headPos.x;
      hp[i * 3 + 1] = headPos.y;
      hp[i * 3 + 2] = headPos.z;
      hc[i * 3] = m.hue.r * fade;
      hc[i * 3 + 1] = m.hue.g * fade;
      hc[i * 3 + 2] = m.hue.b * fade;
      hs[i] = 0.9 + fade * 0.6;
    }

    if (linesGeoRef.current) {
      const posAttr = linesGeoRef.current.getAttribute("position") as THREE.BufferAttribute;
      const colAttr = linesGeoRef.current.getAttribute("color") as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }
    if (headsGeoRef.current) {
      const posAttr = headsGeoRef.current.getAttribute("position") as THREE.BufferAttribute;
      const colAttr = headsGeoRef.current.getAttribute("color") as THREE.BufferAttribute;
      const sizAttr = headsGeoRef.current.getAttribute("size") as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      if (sizAttr) sizAttr.needsUpdate = true;
    }
    if (lineMatRef.current) {
      lineMatRef.current.opacity = activeAny ? 1 : 0;
    }
    if (headsMatRef.current) {
      headsMatRef.current.opacity = activeAny ? 1 : 0;
    }
  });

  // Build indices for line segments: every 2 verts is one line.
  const lineIndices = useMemo(() => {
    const idx = new Uint16Array(poolSize * 2);
    for (let i = 0; i < poolSize * 2; i++) idx[i] = i;
    return idx;
  }, [poolSize]);

  return (
    <group>
      {/* Tapered streaks */}
      <lineSegments>
        <bufferGeometry ref={linesGeoRef}>
          <bufferAttribute attach="attributes-position" args={[lineBuffers.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[lineBuffers.colors, 3]} />
          <bufferAttribute attach="index" args={[lineIndices, 1]} />
        </bufferGeometry>
        <lineBasicMaterial
          ref={lineMatRef}
          vertexColors
          transparent
          opacity={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>

      {/* Bright head sprites */}
      <points>
        <bufferGeometry ref={headsGeoRef}>
          <bufferAttribute attach="attributes-position" args={[headBuffers.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[headBuffers.colors, 3]} />
          <bufferAttribute attach="attributes-size" args={[headBuffers.sizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          ref={headsMatRef}
          map={headSprite}
          size={1.2}
          sizeAttenuation
          vertexColors
          transparent
          opacity={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
