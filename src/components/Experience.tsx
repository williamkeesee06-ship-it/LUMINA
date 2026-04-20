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
      
      const cx = 280 * Math.cos(theta) * Math.sin(phi);
      const cy = 140 * Math.cos(phi);
      const cz = 280 * Math.sin(theta) * Math.sin(phi);
      
      const color = STATUS_COLORS[clusterIdx % STATUS_COLORS.length];

      // Add a label for this cluster
      clusterLabels.push({
        text: status.toUpperCase(),
        position: [cx, cy + 25, cz], // Floating above the 3D cluster center
        color: color
      });

      groupJobs.forEach((job, i) => {
        const total = groupJobs.length;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const yFrac = total > 1 ? 1 - (2 * i) / (total - 1) : 0; // -1 to 1
        const sinTheta = Math.sqrt(Math.max(0, 1 - yFrac * yFrac));
        const phi3D = goldenAngle * i;
        const spread = 45;

        const lx = Math.cos(phi3D) * sinTheta * spread;
        const ly = yFrac * spread;
        const lz = Math.sin(phi3D) * sinTheta * spread;

        const statusIndex = statusKeys.indexOf(status);
        const clusterColor = STATUS_COLORS[statusIndex % STATUS_COLORS.length];

        result.push({
          job,
          position: [cx + lx, cy + ly, cz + lz],
          clusterColor,
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
        minDistance={0.5}
        zoomSpeed={3.5}
        rotateSpeed={0.8}
        enableDamping={true}
        dampingFactor={0.05}
      />

      <CameraLerp zoomTarget={zoomTarget} onComplete={() => setZoomTarget(null)} />

      {/* Atmospheric neon point lights — no center pink orb light */}
      <ambientLight intensity={1.5} />
      <pointLight position={[100, 100, 100]} intensity={10000} color="#00f2ff" />
      <pointLight position={[-100, -100, -100]} intensity={8000} color="#ff00ea" />
      <spotLight position={[0, 200, 0]} angle={0.3} penumbra={1} intensity={10000} color="#ffffff" castShadow />
      <pointLight position={[0, -30, 0]}   intensity={500}   color="#aa00ff" distance={300} decay={2} />
      <pointLight position={[0,  40, 0]}   intensity={500}   color="#ffffff" distance={400} decay={2} />

      {/* Bloom post-processing restored */}
      <EffectComposer enableNormalPass={false}>
        <Bloom
          luminanceThreshold={0.0}
          intensity={2.0}
          radius={0.4}
        />
      </EffectComposer>

      <LuminaStardust count={8000} radius={1200} />
      <MouseTrail />
      <LuminaOrb 
        onClick={onOpenAI} 
        onDoubleClick={onGoogleLogin} 
        isConnected={isGoogleConnected} 
      />



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

  useFrame(() => {
    if (!groupRef.current || !meshRef.current) return;
    const t = performance.now() * 0.001; 
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
          <sphereGeometry args={[5.0, 64, 64]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Outer halo */}
        <mesh scale={[2.8, 2.8, 2.8]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="#00f2ff" transparent opacity={0.06} side={THREE.BackSide} depthWrite={false} />
        </mesh>

        {/* Rotating gold equatorial ring */}
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[6.5, 7.5, 128]} />
          <meshStandardMaterial
            color="#ffcc00" emissive="#ffaa00" emissiveIntensity={12}
            transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false}
          />
        </mesh>

        {/* Second tilted ring for depth */}
        <mesh rotation={[-Math.PI / 3.5, Math.PI / 6, 0]}>
          <ringGeometry args={[7.0, 7.6, 128]} />
          <meshStandardMaterial
            color="#ffcc00" emissive="#ffaa00" emissiveIntensity={6}
            transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false}
          />
        </mesh>

        <Text 
          position={[0, -7.0, 0]} 
          fontSize={1.8} 
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

  useFrame(() => {
    if (glowRef.current) {
      glowRef.current.uTime = performance.now() * 0.001;
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

        {/* Atmospheric glow haze — colored rim around dark planet */}
        <mesh scale={[1.45, 1.45, 1.45]}>
          <sphereGeometry args={[4.0, 32, 32]} />
          <meshStandardMaterial color={clusterColor} emissive={clusterColor} emissiveIntensity={2} transparent opacity={0.12} side={THREE.BackSide} depthWrite={false} />
        </mesh>

        {/* Core planet — near-black body, rim lit by the shell above */}
        <mesh
          ref={planetRef}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[4.0, 32, 32]} />
          <meshStandardMaterial color="#0a0a18" roughness={0.7} metalness={0.3} />
        </mesh>

        {/* Neon status ring */}
        <mesh rotation={[-Math.PI / 2.5, 0, 0]}>
          <ringGeometry args={[5.5, 6.5, 64]} />
          <meshStandardMaterial
            color={clusterColor} 
            emissive={clusterColor} 
            emissiveIntensity={20}
            transparent opacity={0.7}
            side={THREE.DoubleSide} depthWrite={false}
          />
        </mesh>
      </Float>

      {/* Job Number label */}
      <Billboard position={[0, 8.0, 0]} follow={true}>
        <Text
          fontSize={2.8}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.2}
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
