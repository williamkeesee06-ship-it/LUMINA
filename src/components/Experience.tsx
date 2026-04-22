import { OrbitControls, Float, Text, Points, PointMaterial, Billboard, Line } from '@react-three/drei';
import { useFrame, useThree, extend } from '@react-three/fiber';
import { useRef, useEffect, useState, useMemo } from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

import type { JobOrbit, GalaxyType } from '../types/lumina';
import { STATUS_COLORS, GALAXY_CATEGORIES, resolveGalaxy } from '../types/lumina';
import { LuminaStardust } from './LuminaStardust';
import { NeonGlowShader } from './shaders/NeonGlowShader';
import { useLumina } from '../store/LuminaContext';

const NeonMaterial = shaderMaterial(
  NeonGlowShader.uniforms,
  NeonGlowShader.vertexShader,
  NeonGlowShader.fragmentShader
);

extend({ NeonMaterial });

// ────────────────────────────────────────────────────────────────────────
// CANONICAL GALAXY CENTERS
// ────────────────────────────────────────────────────────────────────────
export const GALAXY_CENTERS: Record<string, [number, number, number]> = {
  'Complete': [0, 0, 0],
  'Fielded-RTS': [0, 0, 0],
  'Needs Fielding': [0, 0, 0],
  'On Hold': [0, 0, 0],
  'Pending': [0, 0, 0],
  'Routed to Sub': [0, 0, 0],
  'Scheduled': [0, 0, 0]
};

GALAXY_CATEGORIES.forEach((galaxy, idx) => {
  const phi = Math.acos(-1 + (2 * idx) / GALAXY_CATEGORIES.length);
  const theta = Math.sqrt(GALAXY_CATEGORIES.length * Math.PI) * phi;
  const dist = 600;
  GALAXY_CENTERS[galaxy] = [
    dist * Math.cos(theta) * Math.sin(phi),
    (dist * 0.5) * Math.cos(phi),
    dist * Math.sin(theta) * Math.sin(phi)
  ];
});

export function normalizeStatusKey(status: string): GalaxyType | null {
  const s = status.toLowerCase();
  if (s.includes('complete')) return 'Complete';
  if (s.includes('fielded-rts') || s === 'fielding') return 'Fielded-RTS';
  if (s.includes('needs fielding')) return 'Needs Fielding';
  if (s.includes('hold')) return 'On Hold';
  if (s.includes('pending')) return 'Pending';
  if (s.includes('routed')) return 'Routed to Sub';
  if (s.includes('scheduled')) return 'Scheduled';
  return null;
}

// State managed via useLumina hook now.


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


export function Experience() {
  return <UniverseScene />;
}

function UniverseScene() {
  const { 
    jobs,
    selectedJobId,
    viewLevel,
    setViewLevel,
    viewMode,
    setViewMode,
    focusedGalaxy,
    setFocusedGalaxy,
    activeStatus,
    setActiveStatus,
    toggleChat,
    googleToken,
    voiceEnabled,
    orbMode,
    selectJob,
    clearSelectedJob
  } = useLumina();

  const selectedJob = jobs.find((j: JobOrbit) => j.rowId === selectedJobId) || null;
  const isGoogleConnected = !!googleToken;
  const isThinking = orbMode === 'thinking';

  const onSelectJob = (job: JobOrbit | null) => {
    if (job) selectJob(job.rowId, job.jobNumber);
    else clearSelectedJob();
  };
  const onOpenAI = toggleChat;
  const onGoogleLogin = () => {}; 
  const controlsRef = useRef<any>(null);
  const [zoomTarget, setZoomTarget] = useState<{ center: THREE.Vector3, cameraPos: THREE.Vector3 } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    console.log('[Experience] Mounted | Camera View:', viewLevel, '| Jobs:', jobs.length);
  }, []);

  // Pre-compute clusters: mapped to 7 distinct galaxies
  const clusteredJobs = useMemo(() => {
    const galaxyGroups: Record<GalaxyType, JobOrbit[]> = {
      'Complete': [],
      'Fielded-RTS': [],
      'Needs Fielding': [],
      'On Hold': [],
      'Pending': [],
      'Routed to Sub': [],
      'Scheduled': []
    } as any;

    jobs.forEach((job: JobOrbit) => {
      const g = resolveGalaxy(job.status);
      galaxyGroups[g].push(job);
    });

    const result: Array<{ job: JobOrbit; position: [number, number, number]; clusterColor: string; galaxy: GalaxyType }> = [];
    const galaxyLabels: Array<{ text: string; position: [number, number, number]; color: string }> = [];

    GALAXY_CATEGORIES.forEach((galaxy, idx) => {
      const [gx, gy, gz] = GALAXY_CENTERS[galaxy];
      const color = STATUS_COLORS[idx % STATUS_COLORS.length];

      galaxyLabels.push({
        text: galaxy.toUpperCase(), // Display text
        position: [gx, gy + 80, gz], // Visual offset
        color: color
      });

      const jobsForGalaxy = galaxyGroups[galaxy] ?? [];

      if (jobsForGalaxy.length === 0) return;

      jobsForGalaxy.forEach((job, i) => {
        const total = jobsForGalaxy.length;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const yFrac = total > 1 ? 1 - (2 * i) / (total - 1) : 0;
        const sinTheta = Math.sqrt(Math.max(0, 1 - yFrac * yFrac));
        const phi3D = goldenAngle * i;
        const spread = 240; // Planet spread within galaxy — wider fan to eliminate clumping

        const lx = Math.cos(phi3D) * sinTheta * spread;
        const ly = yFrac * spread;
        const lz = Math.sin(phi3D) * sinTheta * spread;

        result.push({
          job,
          position: [gx + lx, gy + ly, gz + lz],
          clusterColor: color,
          galaxy: galaxy
        });
      });
    });

    return { result, galaxyLabels };
  }, [jobs]);

  // Camera: focus/defocus logic
  useEffect(() => {
    if (selectedJob) {
      // Planet Focus
      const entry = clusteredJobs.result.find(e => e.job.rowId === selectedJob.rowId);
      if (entry) {
        const [px, py, pz] = entry.position;
        setZoomTarget({
          center: new THREE.Vector3(px, py, pz),
          cameraPos: new THREE.Vector3(px + 12, py + 8, pz + 12)
        });
        setIsNavigating(true);
        setViewLevel('planet');
      }
    } else {
      // If we just deselected a job AND we are in planet view, go back to Category Galaxy View
      if (viewLevel === 'planet' && focusedGalaxy) {
        const label = clusteredJobs.galaxyLabels.find(l => l.text === focusedGalaxy);
        if (label) {
          const [cx, cy, cz] = label.position;
          setZoomTarget({
            center: new THREE.Vector3(cx, cy - 80, cz),
            cameraPos: new THREE.Vector3(cx + 120, cy + 80, cz + 120)
          });
          setIsNavigating(true);
          setViewLevel('galaxy');
          setViewMode('galaxy');
          setActiveStatus(label.text);
        }
      }
    }
  }, [selectedJob, clusteredJobs, focusedGalaxy, viewLevel]);

  // Camera: react to activeStatus / viewLevel changes (Replaces event bus)
  useEffect(() => {
    if (selectedJobId && selectedJob) {
      // Planet Focus logic is handled in the selectedJob effect below
      return;
    }

    if (viewLevel === 'universe') {
      console.log(`[Experience] Sync: Universal View`);
      setZoomTarget({
        center: new THREE.Vector3(0, 0, 0),
        cameraPos: new THREE.Vector3(0, 500, 1500)
      });
      setIsNavigating(true);
      return;
    }

    if (activeStatus) {
      const canonicalKey = normalizeStatusKey(activeStatus) || activeStatus;
      
      if (activeStatus === 'Total') {
        setViewLevel('universe');
        return;
      }

      const center = GALAXY_CENTERS[canonicalKey];
      if (center) {
        console.log(`[Experience] Sync: Jump to ${canonicalKey}`);
        setZoomTarget({
          center: new THREE.Vector3(center[0], center[1], center[2]),
          cameraPos: new THREE.Vector3(center[0], center[1] + 120, center[2] + 260)
        });
        setIsNavigating(true);
        setViewLevel('galaxy');
      }
    }
  }, [activeStatus, viewLevel]);

  // Handle Planet-level focus
  useEffect(() => {
    if (selectedJob) {
      const entry = clusteredJobs.result.find(e => e.job.rowId === selectedJob.rowId);
      if (entry) {
        const [px, py, pz] = entry.position;
        setZoomTarget({
          center: new THREE.Vector3(px, py, pz),
          cameraPos: new THREE.Vector3(px + 12, py + 8, pz + 12)
        });
        setIsNavigating(true);
        setViewLevel('planet');
      }
    } else if (viewLevel === 'planet') {
      // If deselected, go back to galaxy
      if (focusedGalaxy) {
        const center = GALAXY_CENTERS[focusedGalaxy];
        if (center) {
          setZoomTarget({
            center: new THREE.Vector3(center[0], center[1], center[2]),
            cameraPos: new THREE.Vector3(center[0], center[1] + 120, center[2] + 260)
          });
          setIsNavigating(true);
          setViewLevel('galaxy');
        }
      } else {
        setViewLevel('universe');
      }
    }
  }, [selectedJobId, clusteredJobs]);

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        maxDistance={3000}
        minDistance={0.5}
        zoomSpeed={3.5}
        rotateSpeed={0.8}
        enableDamping={true}
        dampingFactor={0.05}
      />

      <HardCameraSnap 
        zoomTarget={zoomTarget} 
        viewMode={viewMode}
        onComplete={() => {
          setZoomTarget(null);
          setIsNavigating(false);
        }} 
      />

      <ambientLight intensity={4.0} />
      <pointLight position={[100, 100, 100]} intensity={10000} color="#00f2ff" />
      <pointLight position={[-100, -100, -100]} intensity={8000} color="#ff00ea" />
      <spotLight position={[0, 200, 0]} angle={0.3} penumbra={1} intensity={10000} color="#ffffff" castShadow />

      <LuminaStardust count={40000} radius={6000} />
      <InterstellarDust />
      <MouseTrail />
      <LuminaOrb
        onClick={onOpenAI}
        onDoubleClick={onGoogleLogin}
        isConnected={isGoogleConnected}
        isThinking={isThinking}
        voiceEnabled={voiceEnabled}
        isLimited={orbMode === 'limited'}
        isNavigating={isNavigating}
      />




      {/* ─── Galaxy-Scale Swirls ─── */}
      {clusteredJobs.galaxyLabels.map((g, i) => {
        const isSelected = viewMode === 'galaxy' && activeStatus === g.text;
        const isHidden = viewMode === 'galaxy' && activeStatus !== g.text;

        if (isHidden) return null;

        const tiltX = Math.sin(i * 13.5) * 0.15;
        const tiltZ = Math.cos(i * 42.1) * 0.15;
        const baseScale = 0.85 + Math.sin(i * 21.0) * 0.25;
        const scale = isSelected ? baseScale * 1.25 : baseScale;

        const canonicalKey = normalizeStatusKey(g.text) as GalaxyType;
        const center = canonicalKey ? GALAXY_CENTERS[canonicalKey] : null;

        const diveIntoGalaxy = () => {
          if (!canonicalKey || !center) return;
          console.log(`[CLICK RECEIVED] Galaxy Mesh: ${g.text} | center: [${Math.round(center[0])}, ${Math.round(center[1])}, ${Math.round(center[2])}]`);
          setActiveStatus(canonicalKey);
          setViewMode('galaxy');
          setFocusedGalaxy(canonicalKey);
          setZoomTarget({
            center: new THREE.Vector3(center[0], center[1], center[2]),
            cameraPos: new THREE.Vector3(center[0], center[1] + 120, center[2] + 260)
          });
          setIsNavigating(true);
          setViewLevel('galaxy');
        };

        return (
          <group
            key={`galaxy-system-${i}`}
            position={[g.position[0], g.position[1] - 80, g.position[2]]}
          >
            {/* Hitbox for reliable clicking over particle meshes */}
            <mesh
              visible={false}
              scale={[150, 40, 150]}
              onClick={(e) => {
                if (viewLevel === 'universe') {
                  e.stopPropagation();
                  diveIntoGalaxy();
                }
              }}
              onPointerEnter={() => { if (viewLevel === 'universe') document.body.style.cursor = 'pointer'; }}
              onPointerLeave={() => { document.body.style.cursor = 'default'; }}
            >
              <sphereGeometry args={[1, 16, 16]} />
              <meshBasicMaterial transparent opacity={0.0} />
            </mesh>

            <GalaxySwirl color={g.color} tilt={[tiltX, 0, tiltZ]} scale={scale} rotationSpeed={0.7 + Math.abs(Math.sin(i * 7.3)) * 0.7} />
          </group>
        );
      })}

      {/* ─── Construction Job Universe ─── */}
      {viewMode === 'galaxy' && activeStatus && clusteredJobs.result
        .filter((item) => item.galaxy === activeStatus)
        .map((item) => {
          return (
            <Planet
              key={item.job.rowId}
              job={item.job}
              position={item.position}
              clusterColor={item.clusterColor}
              onSelect={() => {
                onSelectJob(item.job);
                setViewLevel('planet');
              }}
              isSelected={selectedJob?.rowId === item.job.rowId}
              isAnyFocused={!!selectedJob}
              viewLevel={viewLevel}
              lowDetail={false} // Since we only render when inside a specific galaxy
            />
          );
        })}

      {/* â”€â”€ Celestial Galaxy Labels â”€â”€ */}
      {clusteredJobs.galaxyLabels.map((label, i) => {
        const isHidden = viewMode === 'galaxy' && activeStatus !== label.text;
        if (isHidden) return null;

        return (
          <CelestialGalaxyLabel
            key={`label-${i}`}
            label={label}
            viewLevel={viewLevel}
            onClick={() => {
              if (viewLevel === 'universe') {
                const canonicalKey = normalizeStatusKey(label.text) as GalaxyType;
                const center = canonicalKey ? GALAXY_CENTERS[canonicalKey] : null;
                if (!canonicalKey || !center) return;

                console.log(`[CLICK RECEIVED] Celestial Label: ${label.text} | center: [${Math.round(center[0])}, ${Math.round(center[1])}, ${Math.round(center[2])}]`);
                setActiveStatus(canonicalKey);
                setViewMode('galaxy');
                setFocusedGalaxy(canonicalKey);
                setZoomTarget({
                  center: new THREE.Vector3(center[0], center[1], center[2]),
                  cameraPos: new THREE.Vector3(center[0], center[1] + 120, center[2] + 260)
                });
                setIsNavigating(true);
                setViewLevel('galaxy');
              }
            }}
          />
        );
      })}

      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={1} mipmapBlur intensity={0.75} />
      </EffectComposer>
    </>
  );
}

// â”€â”€â”€ Celestial Galaxy Label â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CelestialGalaxyLabel({ label, viewLevel, onClick }: {
  label: any,
  viewLevel: string,
  onClick?: () => void
}) {
  const isUniverse = viewLevel === 'universe';
  const isGalaxy = viewLevel === 'galaxy';

  // Fade out logic: Labels are fully visible only in Universe view.
  // In Galaxy view, they fade significantly to prioritize planet focus.
  // In Planet view, they disappear.
  const opacity = isUniverse ? 0.9 : (isGalaxy ? 0.25 : 0);

  if (opacity === 0) return null;

  return (
    <group position={label.position}>
      <Billboard>
        {/* Clickable Hitbox for Label */}
        <mesh
          visible={false}
          position={[0, isUniverse ? 0 : -2, 0]}
          onClick={(e) => {
            if (isUniverse && onClick) {
              e.stopPropagation();
              onClick();
            }
          }}
          onPointerEnter={() => { if (isUniverse) document.body.style.cursor = 'pointer'; }}
          onPointerLeave={() => { document.body.style.cursor = 'default'; }}
        >
          <planeGeometry args={[60, 20]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        <Text
          fontSize={isUniverse ? 14 : 8}
          color="#ffffff"
          anchorX="center"
          anchorY="bottom"
          fillOpacity={opacity}
          letterSpacing={0.4}
        >
          {label.text.toUpperCase()}
        </Text>

        {/* Observatory Coordinate Line */}
        <Line
          points={[[0, -2, 0], [0, -15, 0]]}
          color="#ffffff"
          lineWidth={0.5}
          transparent
          opacity={opacity * 0.5}
        />

        {/* Small marker at text base */}
        <mesh position={[0, -2, 0]}>
          <planeGeometry args={[10, 0.1]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={opacity * 0.8} />
        </mesh>
      </Billboard>
    </group>
  );
}

// ─── Interstellar Dust ──────────────────────────────────────────────────────────
function InterstellarDust() {
  const count = 1000;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 3000;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1500;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3000;
    }
    return pos;
  }, []);

  return (
    <group>
      <Points positions={positions} stride={3}>
        <PointMaterial
          transparent
          color="#88ccff"
          size={3}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.12}
        />
      </Points>
      <Points positions={positions.map(v => v * 1.1)} stride={3}>
        <PointMaterial
          transparent
          color="#aa44ff"
          size={5}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.06}
        />
      </Points>
    </group>
  );
}


// â”€â”€â”€ Mouse Trail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MouseTrail() {
  const pointsRef = useRef<THREE.Points>(null!);
  const { mouse, viewport } = useThree();
  const count = 40;
  const positions = useMemo(() => new Float32Array(count * 3), []);

  useFrame(() => {
    if (!pointsRef.current) return;
    const attr = pointsRef.current.geometry.attributes.position;
    const x = (mouse.x * viewport.width) / 2;
    const y = (mouse.y * viewport.height) / 2;
    for (let i = count - 1; i > 0; i--) {
      positions[i * 3] = positions[(i - 1) * 3];
      positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
      positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];
    }
    positions[0] = x; positions[1] = y; positions[2] = 0;
    attr.needsUpdate = true;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3}>
      <PointMaterial
        transparent vertexColors={false} color="#00f2ff"
        size={0.15} sizeAttenuation depthWrite={false}
        blending={THREE.AdditiveBlending} opacity={0.4}
      />
    </Points>
  );
}



// â”€â”€â”€ Lumina AI Orb â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LuminaOrb({
  onClick, onDoubleClick, isConnected, isThinking, voiceEnabled, isLimited, isNavigating
}: {
  onClick: () => void;
  onDoubleClick: () => void;
  isConnected: boolean;
  isThinking: boolean;
  voiceEnabled: boolean;
  isLimited: boolean;
  isNavigating: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null!);
  const haloMatRef = useRef<THREE.MeshStandardMaterial>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'default';
    return () => { document.body.style.cursor = 'default'; };
  }, [hovered]);

  useFrame((state) => {
    if (!groupRef.current || !meshRef.current) return;
    const t = state.clock.getElapsedTime();
    const orbitT = t * 0.05;

    // Very subtle idle movement, kept close to center
    groupRef.current.position.x = Math.cos(orbitT) * 10;
    groupRef.current.position.z = Math.sin(orbitT) * 10;
    groupRef.current.position.y = Math.sin(orbitT * 2) * 1.5;

    const pulseScale = 1 + Math.sin(t * 2) * 0.07;
    meshRef.current.scale.set(pulseScale, pulseScale, pulseScale);
    if (ringRef.current) ringRef.current.rotation.z += 0.008;

    // Dynamic State Colors
    if (coreMatRef.current) {
      let emissive = new THREE.Color("#00f2ff");
      let intensity = 1.5;

      if (isThinking) {
        // slow cyan-to-violet shimmer
        const lerpVal = (Math.sin(t * 2) + 1) / 2;
        emissive.lerp(new THREE.Color("#aa00ff"), lerpVal);
        intensity = 2.5;
      } else if (voiceEnabled) {
        // vivid teal pulse
        emissive = new THREE.Color("#00ffcc");
        intensity = 3.5 + Math.sin(t * 8) * 1.5;
      } else if (isNavigating) {
        // brighter cyan pulse
        emissive = new THREE.Color("#88ffff");
        intensity = 4 + Math.sin(t * 10) * 1.5;
      } else if (isConnected) {
        intensity = 2;
      }

      coreMatRef.current.emissive = emissive;
      coreMatRef.current.emissiveIntensity = intensity;
    }

    if (haloMatRef.current) {
      if (isLimited) {
        haloMatRef.current.color.set("#ffcc00");
        haloMatRef.current.opacity = 0.08 + Math.sin(t * 2) * 0.03;
      } else {
        haloMatRef.current.color.set("#00f2ff");
        haloMatRef.current.opacity = 0.06;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.3}>
        {/* Invisible large hitbox — reliable click target regardless of Float transform */}
        <mesh
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          <sphereGeometry args={[4, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Core orb — toned down Dyson sphere core */}
        <mesh ref={meshRef}>
          <sphereGeometry args={[14.0, 64, 64]} />
          <meshStandardMaterial
            ref={coreMatRef}
            color="#cceeff"
            emissive="#00f2ff"
            emissiveIntensity={3}
            roughness={0.1}
            metalness={1}
            toneMapped={false}
          />
        </mesh>

        {/* Outer halo */}
        <mesh scale={[1.4, 1.4, 1.4]}>
          <sphereGeometry args={[22, 32, 32]} />
          <meshStandardMaterial
            ref={haloMatRef}
            color="#00f2ff"
            transparent
            opacity={0.05}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>

        {/* Rotating equatorial ring */}
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[18.0, 22.0, 128]} />
          <meshStandardMaterial
            color={isConnected ? "#ffcc00" : "#88ccff"}
            emissive={isConnected ? "#ffcc00" : "#00aaff"}
            emissiveIntensity={isConnected ? 4 : 1.5}
            transparent
            opacity={isConnected ? 0.5 : 0.25}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Second tilted ring for depth */}
        <mesh rotation={[-Math.PI / 3.5, Math.PI / 6, 0]}>
          <ringGeometry args={[16.5, 17.5, 128]} />
          <meshStandardMaterial
            color="#ffcc00"
            emissive="#ffaa00"
            emissiveIntensity={isConnected ? 2 : 0.8}
            transparent
            opacity={isConnected ? 0.2 : 0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Third Dyson segment ring — perpendicular axis */}
        <mesh rotation={[0, Math.PI / 4, -Math.PI / 3]}>
          <ringGeometry args={[20.0, 20.8, 96]} />
          <meshStandardMaterial
            color="#00f2ff"
            emissive="#00f2ff"
            emissiveIntensity={0.6}
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        <Text
          position={[0, -5.0, 0]}
          fontSize={1.2}
          color={isConnected ? '#00ff88' : (hovered ? '#ffffff' : '#00f2ff')}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.1}
          outlineColor="#003344"
        >
          {isConnected ? 'LUMINA HUB' : 'LUMINA AI'}
        </Text>
      </Float>
    </group>
  );
}


// â”€â”€â”€ Moon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Moon({ kind, orbitRadius, angleOffset, speed }: { 
  kind: string, 
  orbitRadius: number,
  angleOffset: number,
  speed: number
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  const { color, emissive, intensity, size, speedMult, pulseFreq } = useMemo(() => {
    switch (kind) {
      case 'permit': return { color: '#ffcc00', emissive: '#ffaa00', intensity: 2, size: 0.8, speedMult: 1.0, pulseFreq: 1.5 };
      case 'prints': return { color: '#0088ff', emissive: '#00ccff', intensity: 2, size: 1.2, speedMult: 0.8, pulseFreq: 1.0 }; // Larger, steady
      case 'redlines': return { color: '#ff3333', emissive: '#ff6666', intensity: 2, size: 0.9, speedMult: 1.2, pulseFreq: 2.5 }; // Urgent
      case 'bidmaster': return { color: '#00ff88', emissive: '#33ffaa', intensity: 2, size: 1.0, speedMult: 1.0, pulseFreq: 1.5 };
      case 'revisit': return { color: '#ff00ea', emissive: '#ff00ea', intensity: 3, size: 1.4, speedMult: 1.5, pulseFreq: 4.0 }; // Priority / Distinct
      default: return { color: '#88aaff', emissive: '#88aaff', intensity: 1, size: 0.7, speedMult: 1.0, pulseFreq: 1.5 };
    }
  }, [kind]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const orbitT = (t * speed * speedMult) + angleOffset;

    meshRef.current.position.set(
      Math.cos(orbitT) * orbitRadius,
      Math.sin(orbitT * 0.3) * (orbitRadius * 0.15), 
      Math.sin(orbitT) * orbitRadius
    );

    // Organic soft pulse - faster for priority moons
    const pulse = 1.0 + Math.sin(t * pulseFreq) * (kind === 'revisit' ? 0.15 : 0.05);
    meshRef.current.scale.set(pulse, pulse, pulse);
    meshRef.current.rotation.y += 0.01;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={intensity}
        roughness={0.8}
        metalness={0.2}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// â”€â”€â”€ Satellite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Satellite({ state, orbitRadius, angleOffset, speed }: {
  state: string,
  orbitRadius: number,
  angleOffset: number,
  speed: number
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ledMeshRef = useRef<THREE.Mesh>(null!);

  const color = useMemo(() => {
    if (state === 'alert' || state === 'needs_reply') return '#ff3333';
    if (state === 'warning' || state === 'waiting') return '#ffcc00';
    if (state === 'inactive') return '#444455';
    return '#00f2ff'; // 'ok'
  }, [state]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const orbitT = (t * speed) + angleOffset;

    meshRef.current.position.set(
      Math.cos(orbitT) * orbitRadius,
      Math.sin(orbitT * 0.8) * (orbitRadius * 0.05),
      Math.sin(orbitT) * orbitRadius
    );

    // Technical sharp pulse
    const pulse = 0.5 + 0.5 * Math.sin(t * 8.0);
    if (ledMeshRef.current) {
      const mat = ledMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 15 * pulse;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial
        color="#444455"
        metalness={1}
        roughness={0.1}
      />

      {/* Signal LED */}
      <mesh ref={ledMeshRef} position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={10}
        />
      </mesh>
    </mesh>
  );
}

// ─── Galaxy Swirl ──────────────────────────────────────────────────────────
function GalaxySwirl({ color, tilt = [0, 0, 0], scale = 1.0, rotationSpeed = 1.0 }: { color: string, tilt?: [number, number, number], scale?: number, rotationSpeed?: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const pointsRef = useRef<THREE.Points>(null!);
  const outerPointsRef = useRef<THREE.Points>(null!);
  const count = 5000;

  const { positions, colors, outerPositions, outerColors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    // An outer "gas" cloud with fewer particles but much larger sizes
    const outerCount = 1500;
    const outerPos = new Float32Array(outerCount * 3);
    const outerCol = new Float32Array(outerCount * 3);

    const baseColor = new THREE.Color(color);
    const coreColor = baseColor.clone().lerp(new THREE.Color('#ffffff'), 0.5);
    const edgeColor = baseColor.clone().multiplyScalar(0.3);

    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 2.0);
      const radius = 5 + r * 120;

      const armIndex = i % 2;
      const armOffset = Math.PI * armIndex;

      const wrap = radius * 0.05;
      const scatter = (1.0 - r) * (Math.random() - 0.5) * Math.PI * 0.8;

      const finalAngle = armOffset + wrap + scatter;

      pos[i * 3] = Math.cos(finalAngle) * radius;
      pos[i * 3 + 1] = (Math.random() - 0.5) * (15 * (1.0 - Math.min(1.0, r * 1.5)));
      pos[i * 3 + 2] = Math.sin(finalAngle) * radius;

      const mixed = new THREE.Color();
      if (r < 0.15) {
        mixed.lerpColors(coreColor, baseColor, r / 0.15);
      } else {
        mixed.lerpColors(baseColor, edgeColor, (r - 0.15) / 0.85);
      }

      col[i * 3] = mixed.r;
      col[i * 3 + 1] = mixed.g;
      col[i * 3 + 2] = mixed.b;
    }

    for (let i = 0; i < outerCount; i++) {
      const r = Math.pow(Math.random(), 1.5);
      const radius = 20 + r * 140;
      const angle = Math.random() * Math.PI * 2;

      outerPos[i * 3] = Math.cos(angle) * radius;
      outerPos[i * 3 + 1] = (Math.random() - 0.5) * 35 * (1.0 - r * 0.5);
      outerPos[i * 3 + 2] = Math.sin(angle) * radius;

      // Outer cloud uses desaturated base color
      const outerMixed = edgeColor.clone().multiplyScalar(0.7);
      outerCol[i * 3] = outerMixed.r;
      outerCol[i * 3 + 1] = outerMixed.g;
      outerCol[i * 3 + 2] = outerMixed.b;
    }

    return { positions: pos, colors: col, outerPositions: outerPos, outerColors: outerCol };
  }, [color]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Rotate the whole group (including tilt) so spin is visible from any angle
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0012 * rotationSpeed;
    }
    // Differential inner/outer counter-drift for arm shimmer
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0004 * rotationSpeed;
    }
    if (outerPointsRef.current) {
      outerPointsRef.current.rotation.y -= 0.0002 * rotationSpeed;
    }
    // Subtle galactic precession wobble
    if (groupRef.current) {
      groupRef.current.rotation.x = tilt[0] + Math.sin(t * 0.08 * rotationSpeed) * 0.015;
    }
  });

  return (
    <group ref={groupRef} rotation={tilt as any} scale={scale}>
      {/* Primary spiral structure */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} itemSize={3} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} itemSize={3} />
        </bufferGeometry>
        <PointMaterial
          transparent
          vertexColors
          size={11.0}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.20}
          toneMapped={false}
        />
      </points>

      {/* Outer gaseous cloud */}
      <points ref={outerPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[outerPositions, 3]} count={outerPositions.length / 3} itemSize={3} />
          <bufferAttribute attach="attributes-color" args={[outerColors, 3]} count={outerPositions.length / 3} itemSize={3} />
        </bufferGeometry>
        <PointMaterial
          transparent
          vertexColors
          size={45.0} // Huge, soft particles
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.08}
          toneMapped={false}
        />
      </points>

      {/* Intense colored core disk to anchor the glowing middle */}
      <mesh scale={[1.0, 0.15, 1.0]}>
        <sphereGeometry args={[20, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3.0}
          transparent
          opacity={0.25}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}


// â”€â”€â”€ Planet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Planet({ job, position, clusterColor, onSelect, isSelected, isAnyFocused, viewLevel, lowDetail }: {
  job: JobOrbit;
  position: [number, number, number];
  clusterColor: string;
  onSelect: () => void;
  isSelected: boolean;
  isAnyFocused: boolean;
  viewLevel: 'universe' | 'galaxy' | 'planet';
  lowDetail: boolean;
}) {
  const planetRef = useRef<THREE.Mesh>(null!);
  const label = job.jobNumber && job.jobNumber.trim() !== ''
    ? job.jobNumber
    : `â€¦${String(job.rowId).slice(-6)}`;

  const showLabel = (viewLevel === 'galaxy' && !lowDetail && !isAnyFocused);

  // If lowDetail, we only show the atmospheric glow (star-like) and hide the body
  const bodyOpacity = lowDetail ? 0 : (isSelected ? 0.8 : (isAnyFocused ? 0.15 : 1.0));
  // Stars in distant galaxies look brighter
  const glowIntensity = isSelected ? 3 : (lowDetail ? (viewLevel === 'universe' ? 18 : 2) : (isAnyFocused ? 0.2 : 1.2));
  const glowOpacity = isSelected ? 0.2 : (lowDetail ? (viewLevel === 'universe' ? 0.4 : 0.05) : (isAnyFocused ? 0.03 : 0.15));

  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'default';
    return () => { document.body.style.cursor = 'default'; };
  }, [hovered]);

  return (
    <group position={position}>
      <Float speed={1.5} rotationIntensity={0.8} floatIntensity={0.8}>

        {/* Atmospheric glow haze */}
        <mesh scale={[1.45, 1.45, 1.45]}>
          <sphereGeometry args={[4.0, 32, 32]} />
          <meshStandardMaterial
            color={clusterColor}
            emissive={clusterColor}
            emissiveIntensity={glowIntensity}
            transparent
            opacity={glowOpacity}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>

        {/* Core planet — hide if lowDetail */}
        {!lowDetail && (
          <mesh
            ref={planetRef}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          >
            <sphereGeometry args={[4.0, 32, 32]} />
            <meshStandardMaterial
              color={isAnyFocused && !isSelected ? "#050510" : "#0a0a18"}
              roughness={0.7}
              metalness={0.3}
              transparent={isSelected}
              opacity={bodyOpacity}
            />
          </mesh>
        )}

        {/* Focused Internal Label - ONLY for selected planet */}
        {isSelected && (
          <Billboard position={[0, 0, 0]}>
            <Text
              fontSize={1.2}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              fillOpacity={0.9}
            >
              {label}
            </Text>
          </Billboard>
        )}

        {/* Neon status ring - hide if lowDetail */}
        {!lowDetail && (
          <mesh rotation={[-Math.PI / 2.5, 0, 0]}>
            <ringGeometry args={[5.5, 6.5, 64]} />
            <meshStandardMaterial
              color={clusterColor}
              emissive={clusterColor}
              emissiveIntensity={isSelected ? 25 : (isAnyFocused ? 2 : 20)}
              transparent
              opacity={isSelected ? 0.9 : (isAnyFocused ? 0.2 : 0.7)}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Moons - Subordinate Attributes (Drive Files / Permits / etc) */}
        {isSelected && (job.moons || []).slice(0, 8).map((moon, i) => (
          <Moon
            key={moon.id}
            kind={moon.kind}
            orbitRadius={12.0}
            angleOffset={(i / 8) * Math.PI * 2}
            speed={0.3 + (i * 0.05)}
          />
        ))}

        {/* Satellites - Operational Metadata (Gmail / System Notifications) */}
        {isSelected && (job.satellites || []).slice(0, 5).map((sat, i) => (
          <Satellite
            key={sat.id}
            state={sat.state}
            orbitRadius={16.0}
            angleOffset={(i / 5) * Math.PI * 2 + Math.PI / 4}
            speed={1.2 + (i * 0.2)}
          />
        ))}
      </Float>

      {/* Galaxy-View Job Number labels */}
      {showLabel && (
        <Billboard position={[0, 8.0, 0]} follow={true}>
          <Text
            fontSize={2.5}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.2}
            outlineColor="#000000"
            fillOpacity={0.8}
          >
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// ─── Camera Snap (Bypasses OrbitControls Drift) ──────────────────────────
function HardCameraSnap({ zoomTarget, viewMode, onComplete }: { zoomTarget: any, viewMode: string, onComplete: () => void }) {
  const { camera } = useThree();
  const controls = useThree(state => state.controls) as any;

  // 1) Explicit snap when zoomTarget changes
  useEffect(() => {
    if (!zoomTarget) return;

    if (controls) {
      controls.target.copy(zoomTarget.center);
      camera.position.copy(zoomTarget.cameraPos);
      controls.update(); // Let orbit controls recalculate its spherical boundaries
    } else {
      camera.position.copy(zoomTarget.cameraPos);
      camera.lookAt(zoomTarget.center);
    }

    // Immediately conclude the navigation state to enable UI 
    setTimeout(onComplete, 50);

  }, [zoomTarget, camera, controls, onComplete]);

  // 2) Per-frame lock to ensure no stray orbit drifting breaks the dive
  useFrame(() => {
    if (viewMode === 'galaxy' && zoomTarget && controls) {
      // If OrbitControls somehow drifts the target away from the strict center, force it back
      if (controls.target.distanceTo(zoomTarget.center) > 1.0) {
        controls.target.copy(zoomTarget.center);
        controls.update();
      }
    }
  });

  return null;
}

