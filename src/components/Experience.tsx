import { OrbitControls } from '@react-three/drei';
import { useRef, useEffect, useState, useMemo } from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

import type { JobOrbit, GalaxyType } from '../types/lumina';
import { STATUS_COLORS, GALAXY_CATEGORIES, resolveGalaxy } from '../types/lumina';
import { LuminaStardust } from './LuminaStardust';
import { useLumina } from '../store/LuminaContext';

// Modular Components
import { GALAXY_CENTERS, normalizeStatusKey } from './experience/ExperienceConstants';
import { GalaxySwirl } from './experience/GalaxySwirl';
import { Planet } from './experience/Planet';
import { CelestialGalaxyLabel } from './experience/CelestialGalaxyLabel';
import { InterstellarDust } from './experience/InterstellarDust';
import { MouseTrail } from './experience/MouseTrail';
import { LuminaAISurface } from './experience/LuminaAISurface';
import { HardCameraSnap } from './experience/HardCameraSnap';
import { NavigationStreaks } from './experience/NavigationStreaks';

export function Experience() {
  return <UniverseScene />;
}

function UniverseScene() {
  const { 
    jobs,
    selectedJobId,
    viewMode,
    setViewMode,
    focusedGalaxy,
    setFocusedGalaxy,
    activeStatus,
    setActiveStatus,
    toggleChat,
    googleToken,
    voiceEnabled,
    isDictating,
    isFullVoice,
    orbMode,
    selectJob,
    clearSelectedJob
  } = useLumina();

  const selectedJob = jobs.find((j: JobOrbit) => j.rowId === selectedJobId) || null;
  const isGoogleConnected = !!googleToken;
  const isThinking = orbMode === 'thinking';

  const onSelectJob = (job: JobOrbit | null) => {
    if (job) {
      selectJob(job.rowId, job.jobNumber);
    } else {
      clearSelectedJob();
    }
  };
  const onOpenAI = toggleChat;
  const onGoogleLogin = () => {}; 
  const controlsRef = useRef<any>(null);
  const [zoomTarget, setZoomTarget] = useState<{ center: THREE.Vector3, cameraPos: THREE.Vector3 } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // 1. Static Galaxy Metadata (Constant positions/labels)
  const galaxyMetadata = useMemo(() => {
    return GALAXY_CATEGORIES.map((galaxy, idx) => {
      const [gx, gy, gz] = GALAXY_CENTERS[galaxy];
      const color = STATUS_COLORS[idx % STATUS_COLORS.length];
      return {
        name: galaxy,
        label: galaxy.toUpperCase(),
        position: [gx, gy, gz] as [number, number, number],
        labelPosition: [gx, gy + 80, gz] as [number, number, number],
        color: color
      };
    });
  }, []);

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

    galaxyMetadata.forEach((meta) => {
      const [gx, gy, gz] = meta.position;
      const jobsForGalaxy = galaxyGroups[meta.name] ?? [];
      if (jobsForGalaxy.length === 0) return;

      const total = jobsForGalaxy.length;
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const spread = 240;

      jobsForGalaxy.forEach((job, i) => {
        const yFrac = total > 1 ? 1 - (2 * i) / (total - 1) : 0;
        const sinTheta = Math.sqrt(Math.max(0, 1 - yFrac * yFrac));
        const phi3D = goldenAngle * i;

        const lx = Math.cos(phi3D) * sinTheta * spread;
        const ly = yFrac * spread;
        const lz = Math.sin(phi3D) * sinTheta * spread;

        result.push({
          job,
          position: [gx + lx, gy + ly, gz + lz],
          clusterColor: meta.color,
          galaxy: meta.name
        });
      });
    });

    return result;
  }, [galaxyMetadata, jobs]);


  // Camera Orchestrator: Unified effect to handle all navigation transitions
  useEffect(() => {
    // 1. Planet View
    if (viewMode === 'planet' && selectedJob) {
      const entry = clusteredJobs.find(e => e.job.rowId === selectedJob.rowId);
      if (entry) {
        const [px, py, pz] = entry.position;
        setZoomTarget({
          center: new THREE.Vector3(px, py, pz),
          cameraPos: new THREE.Vector3(px + 12, py + 8, pz + 12)
        });
        setIsNavigating(true);
      }
      return;
    }

    // 2. Galaxy View
    if (viewMode === 'galaxy' && activeStatus) {
      const center = GALAXY_CENTERS[activeStatus as GalaxyType];
      if (center) {
        setZoomTarget({
          center: new THREE.Vector3(center[0], center[1], center[2]),
          cameraPos: new THREE.Vector3(center[0], center[1] + 120, center[2] + 260)
        });
        setIsNavigating(true);
      }
      return;
    }

    // 3. Universe View
    if (viewMode === 'universe') {
      setZoomTarget({
        center: new THREE.Vector3(0, 0, 0),
        cameraPos: new THREE.Vector3(0, 500, 1500)
      });
      setIsNavigating(true);
      return;
    }

    // 4. Earth / Map transitions can be handled here or explicitly snapped
    if (viewMode === 'earth') {
      // Focus on the rotating earth component (assuming it's at origin or specific offset)
      setZoomTarget({
        center: new THREE.Vector3(0, 0, 0),
        cameraPos: new THREE.Vector3(0, 0, 40)
      });
      setIsNavigating(true);
    }
  }, [viewMode, selectedJobId, activeStatus, clusteredJobs]);

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

      <LuminaStardust count={20000} radius={6000} />
      <InterstellarDust />
      <MouseTrail />
      <NavigationStreaks isNavigating={isNavigating} />
      <LuminaAISurface 
        onClick={onOpenAI}
        onDoubleClick={onGoogleLogin}
        isConnected={isGoogleConnected}
        isThinking={isThinking}
        voiceEnabled={voiceEnabled || isDictating || isFullVoice}
        isNavigating={isNavigating}
      />

      {/* ─── Galaxy-Scale Swirls ─── */}
      {galaxyMetadata.map((g, i) => {
        const isSelected = viewMode === 'galaxy' && activeStatus === g.name;
        const isHidden = viewMode === 'galaxy' && activeStatus && activeStatus !== g.name;

        if (isHidden) return null;

        const tiltX = Math.sin(i * 13.5) * 0.15;
        const tiltZ = Math.cos(i * 42.1) * 0.15;
        const baseScale = 0.85 + Math.sin(i * 21.0) * 0.25;
        const scale = isSelected ? baseScale * 1.25 : baseScale;

        const canonicalKey = normalizeStatusKey(g.name) as GalaxyType;
        const center = canonicalKey ? GALAXY_CENTERS[canonicalKey] : null;

        const diveIntoGalaxy = () => {
          if (!canonicalKey || !center) return;
          setActiveStatus(canonicalKey);
          setViewMode('galaxy');
          setFocusedGalaxy(canonicalKey);
          setZoomTarget({
            center: new THREE.Vector3(center[0], center[1], center[2]),
            cameraPos: new THREE.Vector3(center[0], center[1] + 120, center[2] + 260)
          });
          setIsNavigating(true);
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
                if (viewMode === 'universe') {
                  e.stopPropagation();
                  diveIntoGalaxy();
                }
              }}
              onPointerEnter={() => { if (viewMode === 'universe') document.body.style.cursor = 'pointer'; }}
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
      {viewMode === 'galaxy' && activeStatus && clusteredJobs
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
              }}
              isSelected={selectedJob?.rowId === item.job.rowId}
              isAnyFocused={!!selectedJob}
              viewMode={viewMode}
              lowDetail={false} 
            />
          );
        })}

      {/* ─── Celestial Galaxy Labels ─── */}
      {galaxyMetadata.map((meta, i) => {
        const isHidden = viewMode === 'galaxy' && activeStatus && activeStatus !== meta.name;
        if (isHidden) return null;

        return (
          <CelestialGalaxyLabel
            key={`label-${i}`}
            label={{ text: meta.label, position: meta.labelPosition, color: meta.color }}
            viewMode={viewMode}
            onClick={() => {
              if (viewMode === 'universe') {
                const canonicalKey = normalizeStatusKey(meta.name) as GalaxyType;
                const center = canonicalKey ? GALAXY_CENTERS[canonicalKey] : null;
                if (!canonicalKey || !center) return;

                setActiveStatus(canonicalKey);
                setViewMode('galaxy');
                setFocusedGalaxy(canonicalKey);
                setZoomTarget({
                  center: new THREE.Vector3(center[0], center[1], center[2]),
                  cameraPos: new THREE.Vector3(center[0], center[1] + 120, center[2] + 260)
                });
                setIsNavigating(true);
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
