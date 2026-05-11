import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

/**
 *  Procedural crater bump texture for the moon body — a 256×256 CanvasTexture
 *  that doubles as bumpMap + roughnessMap. Generated once at module load so
 *  every moon shares one texture (cheap, deterministic, looks consistent).
 */
function buildMoonCraterTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Mid-gray base with subtle noise speckle.
  ctx.fillStyle = "#7a7a7a";
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 32;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  // 70 craters of varying sizes, mostly dark bowls with a brighter rim.
  for (let i = 0; i < 70; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 3 + Math.random() * Math.random() * 28;
    const dark = `rgba(30,30,30,${0.55 + Math.random() * 0.35})`;
    const rim = `rgba(220,220,220,${0.15 + Math.random() * 0.25})`;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0, dark);
    grd.addColorStop(0.75, dark);
    grd.addColorStop(0.92, rim);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Few brighter highlight spots for surface variation.
  for (let i = 0; i < 25; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 1 + Math.random() * 4;
    ctx.fillStyle = `rgba(240,240,240,${0.18 + Math.random() * 0.2})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

const MOON_CRATER_TEXTURE = buildMoonCraterTexture();
import type { Job, Moon, Satellite } from "@/types";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { useUI } from "@/store/uiStore";

/**
 * Per-category neon colors for orbiting satellites. Mirrors the chip
 * colors used in the JobPanel satellites list so the same file reads
 * the same color in 3D and in the panel.
 */
const SATELLITE_COLORS: Record<NonNullable<Satellite["category"]>, string> = {
  permit: "#FFC857",     // amber
  print: "#5BF3FF",      // cyan
  redline: "#FF3D9A",    // hot pink
  bidmaster: "#A78BFA",  // violet
  revisit: "#F97316",    // orange
  photo: "#22D3EE",      // bright teal
  other: "#9CA3AF",      // neutral grey
};
const DEFAULT_SAT_COLOR = "#E5E7EB";

/**
 *  Sender-domain → moon color heuristic per the brief:
 *    - @northskycomm.com → tactical white (work-internal)
 *    - permit / govt-ish subject or sender → blue
 *    - vendor heuristic (subcontractors, suppliers) → magenta
 *    - everything else (customer) → amber
 *    - unknown / empty → muted grey
 */
const MOON_COLORS = {
  internal: "#F5F5F5",
  permit: "#5BF3FF",
  vendor: "#FF3D9A",
  customer: "#FFC857",
  unknown: "#9CA3AF",
};

function moonColor(moon: Moon): string {
  const from = (moon.from ?? "").toLowerCase();
  const subj = (moon.subject ?? "").toLowerCase();
  if (!from && !subj) return MOON_COLORS.unknown;
  if (from.includes("@northskycomm.com")) return MOON_COLORS.internal;
  // Permit / govt heuristic — words that signal city / county / state mail.
  if (
    /\b(permit|cityof|county|gov|dot|township|municipal|usic|locate|811)\b/i.test(
      from + " " + subj,
    )
  ) {
    return MOON_COLORS.permit;
  }
  // Vendor heuristic — common subcontractor / supplier keywords. Loose on
  // purpose, the worst case is amber vs magenta and the operator can tell.
  if (
    /\b(splicing|fiber|locate|crew|sub|underground|invoice|po\s*#|quote)\b/i.test(
      from + " " + subj,
    )
  ) {
    return MOON_COLORS.vendor;
  }
  return MOON_COLORS.customer;
}

interface Props {
  jobs: Job[];
  selectedJobId: string | null;
  onSelect: (id: string) => void;
  /** When true, planets that aren't selected fade hard so the focus is the selected planet. */
  focusMode?: boolean;
}

/**
 * Inside a galaxy: planets arranged in a Fibonacci sphere so density reads
 * cleanly even with hundreds of jobs.
 *
 * Each planet is a DARK CORE with a BRIGHT NEON HALO RING — luxurious dark
 * metal sphere wrapped by a glowing status-tinted halo, like a Saturn ring
 * lit from within.
 */
export function PlanetField({ jobs, selectedJobId, onSelect, focusMode = false }: Props) {
  const layout = useMemo(() => {
    const n = jobs.length || 1;
    // Galactic-disk layout. Instead of a fixed-radius Fibonacci sphere
    // (which reads as a hollow ball / ring from any vantage), planets are
    // distributed across a stretched flattened disk with a logarithmic
    // spiral bias — think planetary positions in an actual spiral galaxy.
    // This gives the cluster real volume and an elongated silhouette
    // instead of a tight bunched circle.
    //
    // Key changes vs. the old layout:
    //   - Radius varies (~3..21) per planet instead of one fixed shell.
    //   - Spiral arm bias — angular phase rotates with sqrt(radius).
    //   - Disk-flat: y-thickness scales down with radius * 0.18.
    //   - Per-planet jitter scales with local radius so outer planets
    //     drift further than inner ones (not the same fixed amount).
    const out: {
      id: string;
      label: string;
      pos: [number, number, number];
      color: string;
      tilt: number;
    }[] = [];
    const jitter = (seed: number) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453;
      return x - Math.floor(x); // 0..1
    };
    // Disk extent grows with sqrt(n) so 50 planets and 500 planets both
    // read at sensible density. Inner radius is small (3) so the cluster
    // has a visible "core" instead of a hole.
    const innerR = 3;
    const outerR = 8 + Math.sqrt(n) * 1.4;
    const armCount = 2; // number of spiral arms
    const armTwist = 1.6; // how much each arm winds
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      if (!jobs[i]) break;
      // Square-root index distribution biases more planets toward the
      // outer disk while leaving a populated core. Avoids a hollow hole.
      const tIdx = (i + 0.5) / n;
      const r = innerR + Math.sqrt(tIdx) * (outerR - innerR);
      // Spiral arm — each planet sits near one of `armCount` arms, with the
      // arm angle winding outward. goldenAngle adds variation between
      // adjacent indices so consecutive planets don't stack.
      const arm = i % armCount;
      const armBase = (arm / armCount) * Math.PI * 2;
      const armAngle =
        armBase +
        ((r - innerR) / (outerR - innerR)) * armTwist * Math.PI * 2 +
        goldenAngle * i * 0.18;
      // Lateral jitter perpendicular to the arm so planets feather the arm,
      // not sit on a perfect spiral line.
      const jr = (jitter(i + 1) - 0.5) * (1.6 + r * 0.18);
      const jt = (jitter(i + 7.13) - 0.5) * 0.55; // tangential angular jitter
      const finalR = Math.max(1.5, r + jr);
      const finalAngle = armAngle + jt;
      // Disk thickness — thin at center, slightly thicker at the rim, with
      // strong y-flatten so the whole thing reads as a disk not a sphere.
      const yJ = (jitter(i + 19.37) - 0.5) * (1.0 + r * 0.18);
      out.push({
        id: jobs[i].id,
        label: jobs[i].workOrder || jobs[i].id,
        pos: [
          finalR * Math.cos(finalAngle),
          yJ,
          finalR * Math.sin(finalAngle),
        ],
        color: GALAXY_COLORS[jobs[i].status],
        tilt: 0, // unused now — ring orientation is locked globally
      });
    }
    return out;
  }, [jobs]);

  return (
    <group>
      {layout.map((p, i) => {
        const job = jobs[i];
        // In planet (focus) mode, hide every planet that isn't the selected
        // one. The user's request was crystal clear: "that planet be the
        // only planet in view." Dimming wasn't enough — dozens of orbiting
        // dots still cluttered the foreground.
        if (focusMode && selectedJobId !== p.id) return null;
        return (
          <Planet
            key={p.id}
            position={focusMode && selectedJobId === p.id ? [0, 0, 0] : p.pos}
            color={p.color}
            tiltDeg={p.tilt}
            label={p.label}
            selected={selectedJobId === p.id}
            dim={false}
            hero={focusMode && selectedJobId === p.id}
            phase={i * 0.13}
            satellites={job?.satellites ?? []}
            moons={job?.moons ?? []}
            onSelect={() => onSelect(p.id)}
          />
        );
      })}
    </group>
  );
}

function Planet({
  position,
  color,
  tiltDeg,
  label,
  selected,
  dim = false,
  hero = false,
  phase,
  satellites,
  moons,
  onSelect,
}: {
  position: [number, number, number];
  color: string;
  tiltDeg: number;
  label: string;
  selected: boolean;
  dim?: boolean;
  /** Hero mode — this planet is alone on stage in planet view. Scales up,
   *  adds an atmosphere halo, slows rotation a touch, and bumps the ring
   *  glow so it reads as a real cinematic close-up. */
  hero?: boolean;
  phase: number;
  satellites: Satellite[];
  moons: Moon[];
  onSelect: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringGlowRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Group>(null);

  // tiltDeg retained for API compatibility but unused now — ring is
  // billboarded with a constant Y-squash so all planets read identically.
  void tiltDeg;

  // Smooth scale interpolation so transitions in/out of hero mode glide
  // rather than snap. Hero is ~3.4× the regular planet size.
  const heroTargetScale = hero ? 3.4 : 1.0;
  const currentScale = useRef(1.0);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime + phase;
    // Interpolate group scale toward hero/non-hero target.
    if (groupRef.current) {
      currentScale.current += (heroTargetScale - currentScale.current) * Math.min(1, delta * 3);
      groupRef.current.scale.setScalar(currentScale.current);
    }
    if (coreRef.current) {
      // Slow rotation down a touch in hero mode — looks more cinematic.
      coreRef.current.rotation.y += delta * (hero ? 0.12 : 0.3);
    }
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 0.6) * 0.04;
    }
    if (ringRef.current) {
      const m = ringRef.current.material as THREE.MeshBasicMaterial;
      const tgt = (dim ? 0.18 : selected ? 1.0 : 0.95) + Math.sin(t * 1.5) * 0.04;
      m.opacity += (tgt - m.opacity) * Math.min(1, delta * 5);
    }
    if (ringGlowRef.current) {
      const m = ringGlowRef.current.material as THREE.MeshBasicMaterial;
      // Hero mode pumps the halo so the neon ring really sings up close.
      const baseGlow = hero ? 0.95 : selected ? 0.7 : 0.55;
      const tgt = (dim ? 0.08 : baseGlow) + Math.sin(t * 1.2) * (hero ? 0.12 : 0.08);
      m.opacity += (tgt - m.opacity) * Math.min(1, delta * 5);
    }
    // Keep label readable at constant pixel size regardless of distance.
    // Drei's Text is in world units, so to hold a constant projected size,
    // scale up as distance grows (and down when very close).
    if (labelRef.current && groupRef.current) {
      const dist = state.camera.position.distanceTo(
        groupRef.current.getWorldPosition(new THREE.Vector3())
      );
      const s = THREE.MathUtils.clamp(dist / 18, 0.35, 2.6);
      labelRef.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Dark core — luxurious black sphere with faint metallic sheen */}
      <mesh
        ref={coreRef}
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
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial
          color="#000000"
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.08 : 0}
          roughness={0.6}
          metalness={1.0}
        />
      </mesh>

      {/* Luminous neon outline tracing the planet core silhouette */}
      <mesh scale={1.06}>
        <sphereGeometry args={[0.28, 32, 32]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          uniforms={{
            uColor: { value: new THREE.Color(color).multiplyScalar(2.5) },
            uPower: { value: 4.0 },
            uIntensity: { value: 1.4 },
          }}
          vertexShader={`
            varying vec3 vN;
            varying vec3 vV;
            void main() {
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vN = normalize(normalMatrix * normal);
              vV = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uPower;
            uniform float uIntensity;
            varying vec3 vN;
            varying vec3 vV;
            void main() {
              float fres = pow(1.0 - max(dot(vN, vV), 0.0), uPower);
              gl_FragColor = vec4(uColor * uIntensity, fres);
            }
          `}
        />
      </mesh>

      {/* Neon ring — true 3D ring tilted at a fixed angle so it wraps
          around the planet (front in front, back behind). Tilt is constant
          across all planets so every silhouette reads the same. */}
      <group rotation={[Math.PI * 0.42, 0, 0]}>
        {/* Bright neon tube — thin */}
        <mesh ref={ringRef}>
          <ringGeometry args={[0.548, 0.612, 128]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={1.0}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        {/* Glow halo around tube — wet-neon bleed */}
        <mesh ref={ringGlowRef}>
          <ringGeometry args={[0.532, 0.628, 128]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Neon ID tag — dark pill with luminous border + matching neon text */}
      <group ref={labelRef} position={[0, 0.95, 0]} visible={!dim}>
        <Billboard>
          <NeonTag label={label} color={color} selected={selected} />
        </Billboard>
      </group>

      {/* Satellites — small glowing dots orbiting the selected planet, one
          per Smartsheet attachment. Color = attachment category. */}
      {selected && satellites.length > 0 && (
        <SatelliteOrbit satellites={satellites} planetColor={color} />
      )}

      {/* Moons — close-orbit email threads. Render at all zoom levels (not
          just selected) so the operator sees mail-active planets across the
          galaxy view; pulse if any is unread. Click → opens the in-cockpit
          EmailThreadView. */}
      {moons.length > 0 && (
        <MoonOrbit moons={moons} planetColor={color} hero={hero} />
      )}
    </group>
  );
}

/**
 * MoonOrbit — outer-ring email threads. PR #5 redesign:
 *
 *  - Larger sphere (~2.5× previous radius) so moons read at planet view.
 *  - Procedural cratered surface via fragment shader — no texture
 *    downloads, no NASA imagery, no model loaders. Soft gray/off-white
 *    body with a faint blue rim so it sits in the LUMINA palette.
 *  - Tidally locked: each moon's own rotation matches its orbital angular
 *    velocity, so the same face always points back at the planet.
 *  - Moved to a NEW OUTER ring well outside the satellite ring
 *    (planet → satellites @ 0.95-1.55 → moons @ 1.95 outer).
 *  - Soft additive moonlight glow around each body.
 *  - Unread moons keep the pulse semantic but it now drives the outer
 *    glow halo instead of the moon body itself.
 *
 * Click semantics unchanged: opens the in-cockpit EmailThreadView via the
 * Zustand `openThread` action.
 */
function MoonOrbit({
  moons,
  planetColor,
  hero,
}: {
  moons: Moon[];
  planetColor: string;
  hero: boolean;
}) {
  const openThread = useUI((s) => s.openThread);
  const layout = useMemo(() => {
    // OUTER ring radius — placed comfortably outside the satellite tracks
    // (max satellite radius is 1.55, so 1.95 leaves clear separation).
    const baseRadius = hero ? 2.05 : 1.95;
    return moons.map((m, i) => {
      const angle = (i / Math.max(1, moons.length)) * Math.PI * 2;
      // Slow orbital speed so the tidal-lock rotation reads.
      const speed = 0.14 + (i % 3) * 0.02;
      return {
        moon: m,
        baseAngle: angle,
        radius: baseRadius,
        tilt: 0.28,
        speed,
        color: moonColor(m),
        phase: i * 0.41,
      };
    });
  }, [moons, hero]);

  // Per-moon refs: the outer group holds the orbital position; the body
  // group holds the tidal-lock rotation; the glow halo is animated for pulse.
  const orbitRefs = useRef<(THREE.Group | null)[]>([]);
  const bodyRefs = useRef<(THREE.Group | null)[]>([]);
  const glowRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    layout.forEach((it, idx) => {
      const orbit = orbitRefs.current[idx];
      const body = bodyRefs.current[idx];
      if (!orbit) return;
      const a = it.baseAngle + t * it.speed;
      const x = Math.cos(a) * it.radius;
      const yFlat = Math.sin(a) * it.radius;
      const y = yFlat * Math.cos(it.tilt);
      const z = yFlat * Math.sin(it.tilt);
      orbit.position.set(x, y, z);
      // Tidal lock — same face toward the planet at origin. We point the
      // moon's local -Z toward the parent so the "front" hemisphere with
      // the visible crater field always faces the planet.
      if (body) {
        body.lookAt(0, 0, 0);
      }
      const g = glowRefs.current[idx];
      if (g) {
        const mat = g.material as THREE.MeshBasicMaterial;
        // Unread moons pulse the outer halo brighter / faster.
        const tgt = it.moon.unread
          ? 0.7 + Math.sin(t * 2.6 + it.phase) * 0.3
          : 0.22;
        mat.opacity += (tgt - mat.opacity) * 0.1;
      }
    });
  });

  const trackTilt = 0.28;
  const trackRadius = hero ? 2.05 : 1.95;
  const moonBodyRadius = 0.16;
  const haloRadius = moonBodyRadius * 1.85;

  return (
    <group>
      {/* Outer orbital guide ring */}
      <group rotation={[trackTilt, 0, 0]}>
        <mesh>
          <ringGeometry args={[trackRadius - 0.005, trackRadius + 0.005, 128]} />
          <meshBasicMaterial
            color={planetColor}
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>

      {layout.map((it, i) => (
        <group
          key={it.moon.id}
          ref={(g) => {
            orbitRefs.current[i] = g;
          }}
        >
          {/* Soft outer moonlight halo — pulses on unread, additive blending
              so the existing Bloom pass bleeds the edge for a real-moon feel. */}
          <mesh
            ref={(m) => {
              glowRefs.current[i] = m;
            }}
            onClick={(e) => {
              e.stopPropagation();
              openThread(it.moon.threadId);
            }}
          >
            <sphereGeometry args={[haloRadius, 16, 16]} />
            <meshBasicMaterial
              color={it.color}
              transparent
              opacity={0.4}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>

          {/* Tidally-locked moon body. Faces the planet via lookAt(origin). */}
          <group
            ref={(g) => {
              bodyRefs.current[i] = g;
            }}
          >
            {/* Outer tidal-lock ring — faint torus floating around each moon
                so the operator can see that the moon is actually tidal-locked
                (the ring's plane rotates with the body). Restores PR #5. */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[moonBodyRadius * 1.4, 0.02, 8, 48]} />
              <meshBasicMaterial
                color="#aaaaaa"
                transparent
                opacity={0.25}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                openThread(it.moon.threadId);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor =
                  "url('/cursor-arrow-pointer.svg') 1 1, pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "";
              }}
            >
              <sphereGeometry args={[moonBodyRadius, 32, 32]} />
              {/* Procedural cratered surface — CanvasTexture as bumpMap +
                  roughnessMap on a MeshStandardMaterial. PR #5 → restored. */}
              <meshStandardMaterial
                color="#c8c4be"
                roughness={0.95}
                metalness={0.0}
                bumpMap={MOON_CRATER_TEXTURE}
                bumpScale={0.06}
                roughnessMap={MOON_CRATER_TEXTURE}
              />
            </mesh>
            {/* A tiny "near-side" indicator mark — a faint highlight on the
                planet-facing hemisphere that helps the tidal-lock read. */}
            <mesh position={[0, 0, -moonBodyRadius * 0.95]}>
              <circleGeometry args={[moonBodyRadius * 0.18, 16]} />
              <meshBasicMaterial
                color={it.color}
                transparent
                opacity={0.18}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/**
 * Renders attachments as small luminous dots in a tilted orbit around
 * the planet. Multiple orbital rings if there are many — keeps density
 * legible. Each dot pulses slightly and follows a slow orbital rotation.
 */
function SatelliteOrbit({
  satellites,
  planetColor,
}: {
  satellites: Satellite[];
  planetColor: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // Distribute satellites across up to 3 rings so 30+ attachments stay readable.
  const layout = useMemo(() => {
    const PER_RING = 12;
    const ringCount = Math.min(3, Math.max(1, Math.ceil(satellites.length / PER_RING)));
    const radii = [0.95, 1.25, 1.55];
    const tilts = [0.42, -0.28, 0.62]; // radians; varied so rings don't overlap
    const items = satellites.map((s, i) => {
      const ring = i % ringCount;
      const inRing = Math.floor(i / ringCount);
      const ringSize = Math.max(
        1,
        Math.ceil(satellites.length / ringCount) +
          (ring < satellites.length % ringCount ? 1 : 0),
      );
      const angle = (inRing / ringSize) * Math.PI * 2;
      const cat = s.category ?? "other";
      return {
        id: s.id,
        radius: radii[ring],
        tilt: tilts[ring],
        baseAngle: angle,
        speed: 0.18 + ring * 0.05, // slower for outer rings
        color: SATELLITE_COLORS[cat] ?? DEFAULT_SAT_COLOR,
        ring,
        phase: i * 0.31,
      };
    });
    return { items, ringCount };
  }, [satellites]);

  // Refs for each satellite mesh so we can animate position per-frame.
  const meshRefs = useRef<(THREE.Group | null)[]>([]);
  const glowRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    layout.items.forEach((it, idx) => {
      const m = meshRefs.current[idx];
      if (!m) return;
      const a = it.baseAngle + t * it.speed;
      // Orbit on a tilted ring — same math as a tilted unit circle.
      const x = Math.cos(a) * it.radius;
      const yFlat = Math.sin(a) * it.radius;
      // Tilt around X-axis by `it.tilt`.
      const y = yFlat * Math.cos(it.tilt);
      const z = yFlat * Math.sin(it.tilt);
      m.position.set(x, y, z);
      // Subtle pulse on the glow halo.
      const g = glowRefs.current[idx];
      if (g) {
        const mat = g.material as THREE.MeshBasicMaterial;
        const tgt = 0.7 + Math.sin(t * 2 + it.phase) * 0.15;
        mat.opacity += (tgt - mat.opacity) * 0.1;
      }
    });
  });

  // Faint orbital track lines — luminous rings hinting at the orbit paths.
  const trackRings = useMemo(() => {
    const radii = [0.95, 1.25, 1.55];
    const tilts = [0.42, -0.28, 0.62];
    return Array.from({ length: layout.ringCount }, (_, i) => ({
      radius: radii[i],
      tilt: tilts[i],
      opacity: 0.12,
    }));
  }, [layout.ringCount]);

  return (
    <group ref={groupRef}>
      {/* Orbit track rings — dim guide rings showing the satellite paths */}
      {trackRings.map((r, i) => (
        <group key={`track-${i}`} rotation={[r.tilt, 0, 0]}>
          <mesh>
            <ringGeometry args={[r.radius - 0.005, r.radius + 0.005, 96]} />
            <meshBasicMaterial
              color={planetColor}
              transparent
              opacity={r.opacity}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      {/* Satellite mesh — proper bus + solar panels + dish, replaces the
          old single-sphere dot. Keeps the inner orbit ring intact. */}
      {layout.items.map((it, i) => (
        <group
          key={it.id}
          ref={(g) => {
            meshRefs.current[i] = g;
          }}
        >
          {/* Soft halo around the whole craft for additive bloom bleed. */}
          <mesh
            ref={(m) => {
              glowRefs.current[i] = m;
            }}
          >
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshBasicMaterial
              color={it.color}
              transparent
              opacity={0.55}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <SatelliteMesh color={it.color} />
        </group>
      ))}
    </group>
  );
}

/**
 * SatelliteMesh — minimal but unambiguous satellite silhouette:
 *
 *   ▢━━[ █ ]━━▢         body (box) flanked by two flat solar panels;
 *        |               dish/antenna cone points forward (-Z) so it reads
 *        ▽               as an actual probe rather than a featureless dot.
 *
 * Kept entirely in primitive geometries (BoxGeometry / PlaneGeometry / ConeGeometry)
 * so no model loaders or asset packs are required. The reusable component
 * sits inside the SatelliteOrbit children so each orbiting slot gets one.
 */
function SatelliteMesh({ color }: { color: string }) {
  // Soft cool body color — keeps the visual weight off the orbit color so
  // the category accent (solar panels + dish glow) carries the meaning.
  const BUS = "#cdd6e0";
  const PANEL = "#1a2a44";
  const PANEL_EDGE = "#2f4773";
  return (
    <group>
      {/* Body / bus — small box, the satellite's main module. */}
      <mesh>
        <boxGeometry args={[0.08, 0.06, 0.10]} />
        <meshStandardMaterial
          color={BUS}
          metalness={0.65}
          roughness={0.4}
          emissive={color}
          emissiveIntensity={0.18}
        />
      </mesh>

      {/* Left solar panel */}
      <group position={[-0.12, 0, 0]}>
        {/* Yoke / arm connecting panel to bus */}
        <mesh position={[0.05, 0, 0]}>
          <boxGeometry args={[0.04, 0.012, 0.012]} />
          <meshStandardMaterial color={BUS} metalness={0.6} roughness={0.45} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.14, 0.005, 0.07]} />
          <meshStandardMaterial
            color={PANEL}
            metalness={0.85}
            roughness={0.25}
            emissive={PANEL_EDGE}
            emissiveIntensity={0.35}
          />
        </mesh>
      </group>

      {/* Right solar panel */}
      <group position={[0.12, 0, 0]}>
        <mesh position={[-0.05, 0, 0]}>
          <boxGeometry args={[0.04, 0.012, 0.012]} />
          <meshStandardMaterial color={BUS} metalness={0.6} roughness={0.45} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.14, 0.005, 0.07]} />
          <meshStandardMaterial
            color={PANEL}
            metalness={0.85}
            roughness={0.25}
            emissive={PANEL_EDGE}
            emissiveIntensity={0.35}
          />
        </mesh>
      </group>

      {/* Dish / antenna — small cone pointing forward (toward -Z). The
          dish glows in the satellite's category color so each category
          still reads at a glance even with the new geometry. */}
      <group position={[0, 0, -0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <coneGeometry args={[0.035, 0.05, 12, 1, true]} />
          <meshStandardMaterial
            color={color}
            metalness={0.7}
            roughness={0.35}
            emissive={color}
            emissiveIntensity={0.65}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Antenna feed — thin cylinder centered in dish */}
        <mesh position={[0, -0.03, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.035, 8]} />
          <meshStandardMaterial color={BUS} metalness={0.9} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Neon ID tag — pill-shaped chip with dark backing, luminous border,
 * and bright neon text. Sized to fit the label content.
 */
function NeonTag({
  label,
  color,
  selected,
}: {
  label: string;
  color: string;
  selected: boolean;
}) {
  // Approximate width based on label length — fontSize 0.16, ~0.11 per char + padding
  const charW = 0.11;
  const padX = 0.18;
  const padY = 0.11;
  const width = Math.max(label.length * charW + padX * 2, 0.7);
  const height = 0.32;

  const textColor = selected ? "#ffffff" : color;
  const borderColor = color;

  return (
    <group>
      {/* Dark pill backing — luxurious near-black, slight tint */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#04060a" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {/* Luminous border — thin glowing outline frame */}
      <BorderFrame width={width} height={height} color={borderColor} />
      {/* Neon text */}
      <Text
        fontSize={0.16}
        color={textColor}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.05}
        outlineWidth={0.004}
        outlineColor={borderColor}
        outlineOpacity={0.6}
        position={[0, 0, 0.001]}
      >
        {label}
      </Text>
    </group>
  );
}

/**
 * Thin luminous frame around the tag — built from 4 additive bars
 * so it reads as a bright neon border with bloom bleed.
 */
function BorderFrame({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  const t = 0.018; // border thickness
  const z = 0.0005; // tiny z-offset above pill
  const matProps = {
    color,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  } as const;
  return (
    <group position={[0, 0, z]}>
      {/* top */}
      <mesh position={[0, height / 2 - t / 2, 0]}>
        <planeGeometry args={[width, t]} />
        <meshBasicMaterial {...matProps} />
      </mesh>
      {/* bottom */}
      <mesh position={[0, -height / 2 + t / 2, 0]}>
        <planeGeometry args={[width, t]} />
        <meshBasicMaterial {...matProps} />
      </mesh>
      {/* left */}
      <mesh position={[-width / 2 + t / 2, 0, 0]}>
        <planeGeometry args={[t, height]} />
        <meshBasicMaterial {...matProps} />
      </mesh>
      {/* right */}
      <mesh position={[width / 2 - t / 2, 0, 0]}>
        <planeGeometry args={[t, height]} />
        <meshBasicMaterial {...matProps} />
      </mesh>
    </group>
  );
}
