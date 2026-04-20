import { OrbitControls, Float, Text, Points, PointMaterial, Billboard, Line } from '@react-three/drei';
import { useFrame, useThree, extend } from '@react-three/fiber';
import { useRef, useEffect, useState, useMemo } from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

import type { JobOrbit, GalaxyType } from '../types/lumina';
import { STATUS_COLORS, GALAXY_CATEGORIES, PENDING_SUBTYPES, resolveGalaxy } from '../types/lumina';
import { LuminaStardust } from './LuminaStardust';
import { NeonGlowShader } from './shaders/NeonGlowShader';

const NeonMaterial = shaderMaterial(
  NeonGlowShader.uniforms,
  NeonGlowShader.vertexShader,
  NeonGlowShader.fragmentShader
);

extend({ NeonMaterial });

interface ExperienceProps {
  jobs: JobOrbit[];
  onSelectJob: (job: JobOrbit | null) => void;
  selectedJob: JobOrbit | null;
  onOpenAI: () => void;
  onGoogleLogin: () => void;
  isGoogleConnected: boolean;
  voiceEnabled: boolean;
  isThinking: boolean;
  isLimited: boolean;
  viewLevel: 'universe' | 'galaxy' | 'planet';
  setViewLevel: (l: 'universe' | 'galaxy' | 'planet') => void;
  focusedGalaxy: string | null;
  setFocusedGalaxy: (g: string | null) => void;
}


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


export function Experience(props: ExperienceProps) {
  return <ExperienceContext {...props} />;
}

function ExperienceContext({ 
  jobs, onSelectJob, selectedJob, onOpenAI, onGoogleLogin, 
  isGoogleConnected, voiceEnabled, isThinking, isLimited,
  viewLevel, setViewLevel, focusedGalaxy, setFocusedGalaxy
}: ExperienceProps) {
  const { camera } = useThree();
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

    jobs.forEach(job => {
      const g = resolveGalaxy(job.status);
      galaxyGroups[g].push(job);
    });

    const result: Array<{ job: JobOrbit; position: [number, number, number]; clusterColor: string }> = [];
    const galaxyLabels: Array<{ text: string; position: [number, number, number]; color: string }> = [];

    GALAXY_CATEGORIES.forEach((galaxy, idx) => {
      const groupJobs = galaxyGroups[galaxy];
      
      // Position galaxies on a wide sphere in deep space
      const phi = Math.acos(-1 + (2 * idx) / GALAXY_CATEGORIES.length);
      const theta = Math.sqrt(GALAXY_CATEGORIES.length * Math.PI) * phi;
      
      const dist = 600; // Galaxy distance from center
      const gx = dist * Math.cos(theta) * Math.sin(phi);
      const gy = (dist * 0.5) * Math.cos(phi); // Flatten the universe slightly
      const gz = dist * Math.sin(theta) * Math.sin(phi);
      
      const color = STATUS_COLORS[idx % STATUS_COLORS.length];

      galaxyLabels.push({
        text: galaxy.toUpperCase(),
        position: [gx, gy + 80, gz], 
        color: color
      });

      if (groupJobs.length === 0) return;

      groupJobs.forEach((job, i) => {
        const total = groupJobs.length;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const yFrac = total > 1 ? 1 - (2 * i) / (total - 1) : 0;
        const sinTheta = Math.sqrt(Math.max(0, 1 - yFrac * yFrac));
        const phi3D = goldenAngle * i;
        const spread = 150; // Inner galaxy planet spread (increased to reduce bunching)

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

  // Planet visibility filter
  const getPlanetDetails = (jobGalaxy: string) => {
    if (viewLevel === 'universe') return { visible: true, lowDetail: true };
    if (viewLevel === 'galaxy' || viewLevel === 'planet') {
      if (jobGalaxy === focusedGalaxy) return { visible: true, lowDetail: false };
      return { visible: true, lowDetail: true }; // Other galaxies stay in low detail
    }
    return { visible: true, lowDetail: false };
  };

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
        }
      }
    }
  }, [selectedJob, clusteredJobs, focusedGalaxy, viewLevel]);

  // Handle status-based zoom signature
  useEffect(() => {
    const handleZoom = (e: any) => {
      const { status } = e.detail;
      onSelectJob(null); // Deselect current job if any

      if (status === 'Total') {
        setZoomTarget({
          center: new THREE.Vector3(0, 0, 0),
          cameraPos: new THREE.Vector3(0, 500, 1500)
        });
        setIsNavigating(true);
        setViewLevel('universe');
        return;
      }

      const label = clusteredJobs.galaxyLabels.find(l => 
        l.text.toLowerCase().includes(status.toLowerCase())
      );

      if (label) {
        const [cx, cy, cz] = label.position;
        setFocusedGalaxy(label.text);
        setZoomTarget({
          center: new THREE.Vector3(cx, cy - 80, cz),
          cameraPos: new THREE.Vector3(cx + 120, cy + 80, cz + 120)
        });
        setIsNavigating(true);
        setViewLevel('galaxy');
      }
    };
    window.addEventListener('lumina-zoom-to-status', handleZoom);
    return () => window.removeEventListener('lumina-zoom-to-status', handleZoom);
  }, [clusteredJobs, onSelectJob]);

  // Handle manual reset signal
  useEffect(() => {
    const handleReset = () => {
      onSelectJob(null);
      setFocusedGalaxy(null);
      setZoomTarget({
        center: new THREE.Vector3(0, 0, 0),
        cameraPos: new THREE.Vector3(0, 500, 1500)
      });
      setIsNavigating(true);
      setViewLevel('universe');
    };
    window.addEventListener('lumina-reset-camera', handleReset);
    return () => window.removeEventListener('lumina-reset-camera', handleReset);
  }, [onSelectJob]);

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

      <CameraLerp 
        zoomTarget={zoomTarget} 
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
        isLimited={isLimited}
        isNavigating={isNavigating}
      />




      {/* â”€â”€ Galaxy-Scale Swirls â”€â”€ */}
      {clusteredJobs.galaxyLabels.map((g, i) => (
        <group key={`galaxy-system-${i}`} position={[g.position[0], g.position[1]-80, g.position[2]]}>
          <GalaxySwirl color={g.color} />
        </group>
      ))}

      {/* â”€â”€ Construction Job Universe â”€â”€ */}
      {clusteredJobs.result.map((item) => {
        const { visible, lowDetail } = getPlanetDetails(item.galaxy);
        if (!visible) return null;

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
            lowDetail={lowDetail}
          />
        );
      })}

      {/* â”€â”€ Celestial Galaxy Labels â”€â”€ */}
      {clusteredJobs.galaxyLabels.map((label, i) => (
        <CelestialGalaxyLabel
          key={`label-${i}`}
          label={label}
          viewLevel={viewLevel}
          isNavigating={isNavigating}
          onClick={() => {
            const [cx, cy, cz] = label.position;
            setFocusedGalaxy(label.text);
            setZoomTarget({
              center: new THREE.Vector3(cx, cy - 80, cz),
              cameraPos: new THREE.Vector3(cx + 120, cy + 80, cz + 120)
            });
            setIsNavigating(true);
            setViewLevel('galaxy');
          }}
        />
      ))}
    </>
  );
}

// â”€â”€â”€ Celestial Galaxy Label â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CelestialGalaxyLabel({ label, viewLevel, isNavigating, onClick }: { 
  label: any, 
  viewLevel: string, 
  isNavigating: boolean, 
  onClick: () => void 
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
        <Text
          fontSize={isUniverse ? 14 : 8}
          color="#ffffff"
          anchorX="center"
          anchorY="bottom"
          material-transparent={true}
          material-opacity={opacity}
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
          size={15}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.15}
        />
      </Points>
      <Points positions={positions.map(v => v * 1.1)} stride={3}>
        <PointMaterial
          transparent
          color="#aa44ff"
          size={25}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.08}
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
      positions[i * 3]     = positions[(i - 1) * 3];
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
  const meshRef  = useRef<THREE.Mesh>(null!);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null!);
  const haloMatRef = useRef<THREE.MeshStandardMaterial>(null!);
  const ringRef  = useRef<THREE.Mesh>(null!);
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
        intensity = 4;
      } else if (voiceEnabled) {
        // vivid teal pulse
        emissive = new THREE.Color("#00ffcc");
        intensity = 6 + Math.sin(t * 8) * 3;
      } else if (isNavigating) {
        // brighter cyan pulse
        emissive = new THREE.Color("#88ffff");
        intensity = 8 + Math.sin(t * 10) * 4;
      } else if (isConnected) {
        intensity = 3;
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
        
        {/* Core orb — larger and brighter */}
        <mesh ref={meshRef}>
          <sphereGeometry args={[22.0, 64, 64]} />
          <meshStandardMaterial 
            ref={coreMatRef}
            color="#ffffff" 
            emissive="#00f2ff"
            emissiveIntensity={10}
            roughness={0}
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

        {/* Rotating equatorial ring - emphasize when connected */}
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[28.0, 32.0, 128]} />
          <meshStandardMaterial
            color={isConnected ? "#ffcc00" : "#ffffff"} 
            emissive="#ffcc00" 
            emissiveIntensity={isConnected ? 15 : 2}
            transparent 
            opacity={isConnected ? 0.6 : 0.2} 
            side={THREE.DoubleSide} 
            depthWrite={false}
          />
        </mesh>

        {/* Second tilted ring for depth */}
        <mesh rotation={[-Math.PI / 3.5, Math.PI / 6, 0]}>
          <ringGeometry args={[4.0, 4.2, 128]} />
          <meshStandardMaterial
            color="#ffcc00" 
            emissive="#ffaa00" 
            emissiveIntensity={isConnected ? 4 : 1}
            transparent 
            opacity={isConnected ? 0.2 : 0.05} 
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
function Moon({ state }: { state: 'needs_reply' | 'waiting' | 'inactive' }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const R_PLANET = 4.0;
  const R_MOON = R_PLANET * 2.8; // outer moon orbit (11.2)
  const speed = 0.22; // slow, supervisory feel

  const { color, emissive, emissiveIntensity } = useMemo(() => {
    switch (state) {
      case 'needs_reply': 
        return { 
          color: '#ffffff', 
          emissive: '#efd5ff', 
          emissiveIntensity: 18 // outshines satellites (10), but less than planet core (25)
        };
      case 'waiting': 
        return { 
          color: '#aa88ff', 
          emissive: '#aa88ff', 
          emissiveIntensity: 7 
        };
      case 'inactive':
      default: 
        return { 
          color: '#2a2a35', 
          emissive: '#2a2a35', 
          emissiveIntensity: 0.2 
        };
    }
  }, [state]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const orbitT = t * speed;
    
    // Position
    meshRef.current.position.set(
      Math.cos(orbitT) * R_MOON,
      Math.sin(orbitT * 0.4) * (R_MOON * 0.08), // calm supervisory float
      Math.sin(orbitT) * R_MOON
    );

    // Pulse animation logic
    if (state === 'needs_reply') {
      const pulse = 1.0 + Math.sin(t * 2.5) * 0.06; // subtle but noticeable pulse
      meshRef.current.scale.set(pulse, pulse, pulse);
    } else if (state === 'waiting') {
      const pulse = 1.0 + Math.sin(t * 0.6) * 0.02; // very slow, gentle pulse
      meshRef.current.scale.set(pulse, pulse, pulse);
    } else {
      meshRef.current.scale.set(1, 1, 1); // dormant
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.2, 24, 24]} />
      <meshStandardMaterial 
        color={color} 
        emissive={emissive} 
        emissiveIntensity={emissiveIntensity}
        metalness={0.9}
        roughness={0.1}
      />
      {state === 'needs_reply' && (
        <pointLight color={emissive} intensity={1.2} distance={12} decay={2} />
      )}
    </mesh>
  );
}

// â”€â”€â”€ Satellite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Satellite({ kind, orbitRadius, angleOffset, speed }: { 
  kind: string, 
  orbitRadius: number, 
  angleOffset: number,
  speed: number
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ledRef = useRef<THREE.PointLight>(null!);
  const ledMeshRef = useRef<THREE.Mesh>(null!);
  
  const color = useMemo(() => {
    switch (kind) {
      case 'permit':   return '#ffcc00'; // Gold
      case 'prints':   return '#0088ff'; // Blue
      case 'redlines': return '#ff3333'; // Red
      case 'estimate':
      case 'bidmaster': return '#00ff88'; // Green
      default:         return '#ffffff'; // White
    }
  }, [kind]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const orbitT = (t * speed) + angleOffset;
    
    // Position the satellite on its orbit
    meshRef.current.position.set(
      Math.cos(orbitT) * orbitRadius,
      Math.sin(orbitT * 0.5) * (orbitRadius * 0.1), // subtle wobble
      Math.sin(orbitT) * orbitRadius
    );

    // LED Pulse: baseIntensity * (0.8 + 0.2 * sin(t * pulseSpeed))
    const pulseSpeed = 4.0;
    const pulse = 0.8 + 0.2 * Math.sin(t * pulseSpeed);
    
    if (ledRef.current) ledRef.current.intensity = 2.0 * pulse;
    if (ledMeshRef.current) {
      const mat = ledMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 20 * pulse;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color} 
        emissiveIntensity={2} 
        metalness={0.9}
        roughness={0.1}
      />
      
      {/* Attached LED (Child Mesh) */}
      <group position={[0, 0.6, 0]}>
        <mesh ref={ledMeshRef}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial 
            color={color} 
            emissive={color} 
            emissiveIntensity={10} 
          />
        </mesh>
        <pointLight ref={ledRef} color={color} distance={4} decay={2} />
      </group>
    </mesh>
  );
}

// ─── Galaxy Swirl ──────────────────────────────────────────────────────────
function GalaxySwirl({ color }: { color: string }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const count = 4000; // Increased count for better spiral definition
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        // Logarithmic spiral distribution
        const r = Math.pow(Math.random(), 2.0); // Bias towards center
        const radius = 5 + r * 120; // 5 to 125 spread
        
        // Two main arms + random scatter
        const armIndex = i % 2;
        const armOffset = Math.PI * armIndex; // Alternate sides
        
        // The further out, the more it wraps around (spiral effect)
        const wrap = radius * 0.05;
        const scatter = (1.0 - r) * (Math.random() - 0.5) * Math.PI * 0.8; // More scattered outside
        
        const finalAngle = armOffset + wrap + scatter;
        
        pos[i * 3] = Math.cos(finalAngle) * radius;
        // Thicken the center, flatten the outer edges
        pos[i * 3 + 1] = (Math.random() - 0.5) * (15 * (1.0 - Math.min(1.0, r * 1.5)));
        pos[i * 3 + 2] = Math.sin(finalAngle) * radius;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0003;
    }
  });

  return (
    <group>
      {/* Primary colored gas/dust (larger, softer particles) */}
      <Points ref={pointsRef} positions={positions} stride={3}>
        <PointMaterial
          transparent
          color={color}
          size={25.0} // Smaller than before so it looks like matter, not blobs
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.35} // Reduced opacity so it doesn't wash out
        />
      </Points>
      
      {/* Core Star Cluster (tighter, brighter) */}
      <Points positions={positions.slice(0, 1500 * 3)} stride={3}>
        <PointMaterial
          transparent
          color="#ffffff"
          size={12.0}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.5}
        />
      </Points>
      
      {/* Intense colored core (no more white sphere) */}
      <mesh scale={[1.0, 0.15, 1.0]}>
        <sphereGeometry args={[25, 32, 32]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={8.0}
          transparent 
          opacity={0.25} 
          depthWrite={false} 
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function shouldRenderSatellites(job: JobOrbit): boolean {
  const s = job.status.toLowerCase();
  if (s.includes('complete') || s.includes('on hold')) return false;
  return true;
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
  const [hovered, setHovered] = useState(false);
  const planetRef = useRef<THREE.Mesh>(null!);
  const label = job.jobNumber && job.jobNumber.trim() !== ''
    ? job.jobNumber
    : `â€¦${String(job.rowId).slice(-6)}`;

  const showSatellites = isSelected;
  const showMoon = (viewLevel === 'galaxy' && !lowDetail) || isSelected;
  const showLabel = (viewLevel === 'galaxy' && !lowDetail && !isAnyFocused);

  // If lowDetail, we only show the atmospheric glow (star-like) and hide the body
  const bodyOpacity = lowDetail ? 0 : (isSelected ? 0.8 : (isAnyFocused ? 0.15 : 1.0));
  // Stars in distant galaxies look brighter
  const glowIntensity = isSelected ? 3 : (lowDetail ? (viewLevel === 'universe' ? 18 : 2) : (isAnyFocused ? 0.2 : 1.2));
  const glowOpacity = isSelected ? 0.2 : (lowDetail ? (viewLevel === 'universe' ? 0.4 : 0.05) : (isAnyFocused ? 0.03 : 0.15));

  const visibleSatellites = (job.satellites || []).slice(0, 15);

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

        {/* Core planet â€” hide if lowDetail */}
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
              material-transparent
              material-opacity={0.9}
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

        {/* Moon (Communication Status) */}
        {showMoon && job.moon && <Moon state={job.moon.state} />}

        {/* Satellites - Only in Focus Mode for selected */}
        {showSatellites && visibleSatellites.map((sat, i) => (
          <Satellite 
            key={sat.id}
            kind={sat.kind}
            orbitRadius={8.0} // R_PLANET * 2.0 (Inner Documents Orbit)
            angleOffset={(i / visibleSatellites.length) * Math.PI * 2}
            speed={0.8 + (i * 0.1)} 
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
            opacity={0.8}
            transparent
          >
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// â”€â”€â”€ Camera Smooth Interpolation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CameraLerp({ zoomTarget, onComplete }: { zoomTarget: any, onComplete: () => void }) {
  const { camera } = useThree();
  const controls = useThree(state => state.controls) as any;

  useFrame(() => {
    if (!zoomTarget) return;

    // Smoothly lerp camera position
    camera.position.lerp(zoomTarget.cameraPos, 0.05);

    // Smoothly lerp controls target
    if (controls) {
      controls.target.lerp(zoomTarget.center, 0.05);
      controls.update();
    }

    // Stop and finalize if very close to destination
    if (camera.position.distanceTo(zoomTarget.cameraPos) < 0.2) {
      onComplete();
    }
  });

  return null;
}

