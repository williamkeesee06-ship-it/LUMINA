import { OrbitControls, Float, Text, Points, PointMaterial, Billboard } from '@react-three/drei';
import { useFrame, useThree, extend } from '@react-three/fiber';
import { useRef, useEffect, useState, useMemo } from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

import type { ConstructionJob } from '../types/lumina';
import { STATUS_COLORS } from '../types/lumina';
import { LuminaStardust } from './LuminaStardust';
import { NeonGlowShader } from './shaders/NeonGlowShader';

const NeonMaterial = shaderMaterial(
  NeonGlowShader.uniforms,
  NeonGlowShader.vertexShader,
  NeonGlowShader.fragmentShader
);

extend({ NeonMaterial });

interface ExperienceProps {
  jobs: ConstructionJob[];
  onSelectJob: (job: ConstructionJob | null) => void;
  selectedJob: ConstructionJob | null;
  onOpenAI: () => void;
  onGoogleLogin: () => void;
  isGoogleConnected: boolean;
}


// ─────────────────────────────────────────────────────────────────────────────


export function Experience(props: ExperienceProps) {
  return <ExperienceContext {...props} />;
}

function ExperienceContext({ jobs, onSelectJob, selectedJob, onOpenAI, onGoogleLogin, isGoogleConnected }: ExperienceProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [zoomTarget, setZoomTarget] = useState<{ center: THREE.Vector3, cameraPos: THREE.Vector3 } | null>(null);

  // Pre-compute clusters: every unique status = its own group, auto-positioned on a circle
  const clusteredJobs = useMemo(() => {
    const groups: Record<string, ConstructionJob[]> = {};
    jobs.forEach(job => {
      const key = (job.status || 'Unknown').trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(job);
    });

    const statusKeys = Object.keys(groups).sort();
    const result: Array<{ job: ConstructionJob; position: [number, number, number]; clusterColor: string }> = [];
    const clusterLabels: Array<{ text: string; position: [number, number, number]; color: string }> = [];

    statusKeys.forEach((status, clusterIdx) => {
      const groupJobs = groups[status];
      
      // Distribute clusters spherically around the core
      const phi = Math.acos(-1 + (2 * clusterIdx) / statusKeys.length); // Angle around vertical axis
      const theta = Math.sqrt(statusKeys.length * Math.PI) * phi;   // Spiral angle
      
      const cx = 180 * Math.cos(theta) * Math.sin(phi);
      const cy = 100 * Math.cos(phi); // Tighter vertical dispersion
      const cz = 180 * Math.sin(theta) * Math.sin(phi);
      
      const color = STATUS_COLORS[clusterIdx % STATUS_COLORS.length];

      // Add a label for this cluster
      clusterLabels.push({
        text: status.toUpperCase(),
        position: [cx, cy + 25, cz], // Floating above the 3D cluster center
        color: color
      });

      groupJobs.forEach((job, i) => {
        const RING_SIZE = 8;
        const ring = Math.floor(i / RING_SIZE);
        const slot = i % RING_SIZE;
        const localRadius = 6 + ring * 5;
        const localAngle = (slot / RING_SIZE) * Math.PI * 2 + ring * 0.4;
        
        // Local cluster offset in 3D
        const lx = Math.cos(localAngle) * localRadius;
        const ly = Math.sin(i * 1.5) * 3;
        const lz = Math.sin(localAngle) * localRadius;

        result.push({ 
          job, 
          position: [cx + lx, cy + ly, cz + lz], 
          clusterColor: color 
        });
      });
    });

    return { result, clusterLabels };
  }, [jobs]);

  // Camera: zoom to selected planet
  useEffect(() => {
    if (selectedJob) {
      const entry = clusteredJobs.result.find(e => e.job.id === selectedJob.id);
      if (entry) {
        const [px, py, pz] = entry.position;
        setZoomTarget({
          center: new THREE.Vector3(px, py, pz),
          cameraPos: new THREE.Vector3(px + 12, py + 8, pz + 12)
        });
      }
    }
  }, [selectedJob, clusteredJobs]);

  // Handle status-based zoom signature
  useEffect(() => {
    const handleZoom = (e: any) => {
      const { status } = e.detail;
      onSelectJob(null); // Deselect current job if any

      if (status === 'Total') {
        setZoomTarget({
          center: new THREE.Vector3(0, 0, 0),
          cameraPos: new THREE.Vector3(0, 50, 600)
        });
        return;
      }

      const label = clusteredJobs.clusterLabels.find(l => 
        l.text.toLowerCase().includes(status.toLowerCase())
      );

      if (label) {
        const [cx, cy, cz] = label.position;
        setZoomTarget({
          center: new THREE.Vector3(cx, cy - 25, cz),
          cameraPos: new THREE.Vector3(cx + 80, cy + 50, cz + 80)
        });
      }
    };
    window.addEventListener('lumina-zoom-to-status', handleZoom);
    return () => window.removeEventListener('lumina-zoom-to-status', handleZoom);
  }, [clusteredJobs, onSelectJob]);

  // Handle manual reset signal
  useEffect(() => {
    const handleReset = () => {
      onSelectJob(null);
      setZoomTarget({
        center: new THREE.Vector3(0, 0, 0),
        cameraPos: new THREE.Vector3(0, 50, 600)
      });
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
        minDistance={3}
        zoomSpeed={2.5}
        rotateSpeed={0.8}
        enableDamping={true}
        dampingFactor={0.05}
      />

      <CameraLerp zoomTarget={zoomTarget} onComplete={() => setZoomTarget(null)} />

      {/* Atmospheric neon point lights — no center pink orb light */}
      <ambientLight intensity={0.05} />
      <pointLight position={[50, 30, -50]}  intensity={3}   color="#00f2ff" distance={200} decay={2} />
      <pointLight position={[-50,-20, 50]}  intensity={2}   color="#ffcc00" distance={150} decay={2} />
      <pointLight position={[0, -30, 0]}   intensity={1.5} color="#aa00ff" distance={120} decay={2} />
      <pointLight position={[0,  40, 0]}   intensity={1.5} color="#ffffff" distance={180} decay={2} />

      {/* Bloom post-processing */}
      <EffectComposer enableNormalPass={false}>
        <Bloom
          luminanceThreshold={0.4}
          mipmapBlur
          intensity={1.2}
          radius={0.7}
          levels={6}
        />
      </EffectComposer>

      <MouseTrail />
      <LuminaOrb 
        onClick={onOpenAI} 
        onDoubleClick={onGoogleLogin} 
        isConnected={isGoogleConnected} 
      />

      <LuminaStardust count={2500} radius={800} />

      {/* ── Construction Job Universe — One cluster per unique Secondary Job Status ── */}
      {clusteredJobs.result.map(({ job, position, clusterColor }) => (
        <Planet
          key={job.id}
          job={job}
          position={position}
          clusterColor={clusterColor}
          onSelect={() => onSelectJob(job)}
        />
      ))}

      {/* ── Cluster Status Labels ── */}
      {clusteredJobs.clusterLabels.map((label, i) => (
        <Billboard
          key={i}
          position={label.position}
          follow={true}
          lockX={false}
          lockY={false}
          lockZ={false}
          onClick={(e) => {
            e.stopPropagation();
            const [cx, cy, cz] = label.position;
            camera.position.set(cx + 60, cy + 40, cz + 60);
            if (controlsRef.current) {
              controlsRef.current.target.set(cx, cy - 25, cz); // Center on the cluster (label is 25 units up)
              controlsRef.current.update();
            }
          }}
        >
          <Text
            fontSize={4}
            color={label.color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.5}
            outlineColor="#000000"
          >
            {label.text}
          </Text>
        </Billboard>
      ))}
    </>
  );
}

// ─── Mouse Trail ─────────────────────────────────────────────────────────────
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



// ─── Lumina AI Orb ────────────────────────────────────────────────────────────
function LuminaOrb({ onClick, onDoubleClick, isConnected }: { 
  onClick: () => void; 
  onDoubleClick: () => void;
  isConnected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef  = useRef<THREE.Mesh>(null!);
  const ringRef  = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'default';
    return () => { document.body.style.cursor = 'default'; };
  }, [hovered]);

  useFrame((state) => {
    const t = state.get().performance.now() * 0.001; // Safer non-deprecated time source
    const orbitT = t * 0.1;
    groupRef.current.position.x = Math.cos(orbitT) * 25;
    groupRef.current.position.z = Math.sin(orbitT) * 25;
    groupRef.current.position.y = Math.sin(orbitT * 2) * 2;
    const pulse = 1 + Math.sin(t * 2) * 0.07;
    meshRef.current.scale.set(pulse, pulse, pulse);
    if (ringRef.current) ringRef.current.rotation.z += 0.008;
  });

  return (
    <group ref={groupRef}>
      <Float speed={3} rotationIntensity={0.4} floatIntensity={0.8}>
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
          <sphereGeometry args={[2.0, 64, 64]} />
          <meshStandardMaterial
            color={isConnected ? "#00ff88" : "#00f2ff"} 
            emissive={isConnected ? "#00ff88" : "#00f2ff"}
            emissiveIntensity={isConnected ? (hovered ? 60 : 40) : (hovered ? 30 : 20)}
            metalness={0.3} roughness={0.1}
          />
        </mesh>

        {/* Outer halo */}
        <mesh scale={[2.8, 2.8, 2.8]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="#00f2ff" transparent opacity={0.06} side={THREE.BackSide} depthWrite={false} />
        </mesh>

        {/* Rotating gold equatorial ring */}
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.6, 3.0, 128]} />
          <meshStandardMaterial
            color="#ffcc00" emissive="#ffaa00" emissiveIntensity={12}
            transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false}
          />
        </mesh>

        {/* Second tilted ring for depth */}
        <mesh rotation={[-Math.PI / 3.5, Math.PI / 6, 0]}>
          <ringGeometry args={[2.9, 3.1, 128]} />
          <meshStandardMaterial
            color="#ffcc00" emissive="#ffaa00" emissiveIntensity={6}
            transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false}
          />
        </mesh>

        <Stars radius={3} depth={1} count={60} factor={1} saturation={0} fade speed={4} />
        <Text 
          position={[0, -2.8, 0]} 
          fontSize={0.7} 
          color={isConnected ? '#00ff88' : (hovered ? '#ffffff' : '#00f2ff')} 
          anchorX="center" 
          anchorY="middle"
          outlineWidth={0.04} 
          outlineColor="#003344"
        >
          {isConnected ? 'LUMINA HUB' : 'LUMINA AI'}
        </Text>
      </Float>
    </group>
  );
}


// ─── Planet ───────────────────────────────────────────────────────────────────
function Planet({ job, position, clusterColor, onSelect }: {
  job: ConstructionJob;
  position: [number, number, number];
  clusterColor: string;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const planetRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<any>(null!);

  const color = useMemo(() => new THREE.Color(clusterColor), [clusterColor]);

  useFrame((state) => {
    if (glowRef.current) {
      glowRef.current.uTime = state.get().performance.now() * 0.001;
      glowRef.current.uColor = color;
      glowRef.current.uGlowIntensity = hovered ? 2.5 : 1.2;
    }
  });

  const label = job.jobNumber && job.jobNumber.trim() !== ''
    ? job.jobNumber
    : `…${String(job.id).slice(-6)}`;

  return (
    <group position={position}>
      <Float speed={1.5} rotationIntensity={0.8} floatIntensity={0.8}>

        {/* Custom Neon Glow Shell using NeonGlowShader */}
        <mesh scale={[1.3, 1.3, 1.3]}>
          <sphereGeometry args={[0.8, 32, 32]} />
          {/* @ts-ignore */}
          <neonMaterial 
            ref={glowRef}
            transparent 
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Core planet — near-black body, rim lit by the shell above */}
        <mesh
          ref={planetRef}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[0.8, 32, 32]} />
          <meshStandardMaterial
            color={hovered ? '#0a0a14' : '#000000'}
            emissive={clusterColor}
            emissiveIntensity={hovered ? 4 : 0.1}
            metalness={1}
            roughness={0.02}
          />
        </mesh>

        {/* Neon status ring */}
        <mesh rotation={[-Math.PI / 2.5, 0, 0]}>
          <ringGeometry args={[1.1, 1.32, 64]} />
          <meshStandardMaterial
            color={clusterColor} 
            emissive={clusterColor} 
            emissiveIntensity={10}
            transparent opacity={0.6}
            side={THREE.DoubleSide} depthWrite={false}
          />
        </mesh>
      </Float>

      {/* Job Number label */}
      <Billboard position={[0, 1.6, 0]} follow={true}>
        <Text
          fontSize={0.45}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000000"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

// ─── Camera Smooth Interpolation ─────────────────────────────────────────────
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
