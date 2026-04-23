import { useRef, useState, useEffect, useMemo } from 'react';
import { Float, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { JobOrbit } from '../../types/lumina';
import { Moon } from './Moon';
import { Satellite } from './Satellite';

import type { LuminaViewMode } from '../../types/store';

interface PlanetProps {
  job: JobOrbit;
  position: [number, number, number];
  clusterColor: string;
  onSelect: () => void;
  isSelected: boolean;
  isAnyFocused: boolean;
  viewMode: LuminaViewMode;
  lowDetail: boolean;
}

export function Planet({ job, position, clusterColor, onSelect, isSelected, isAnyFocused, viewMode, lowDetail }: PlanetProps) {
  const planetRef = useRef<THREE.Mesh>(null!);
  const label = job.jobNumber && job.jobNumber.trim() !== ''
    ? job.jobNumber
    : `…${String(job.rowId).slice(-6)}`;

  const showLabel = (viewMode === 'galaxy' && !lowDetail && !isAnyFocused);

  const bodyOpacity = lowDetail ? 0 : (isSelected ? 0.8 : (isAnyFocused ? 0.15 : 1.0));
  const glowIntensity = isSelected ? 3 : (lowDetail ? (viewMode === 'universe' ? 18 : 2) : (isAnyFocused ? 0.2 : 1.2));
  const glowOpacity = isSelected ? 0.2 : (lowDetail ? (viewMode === 'universe' ? 0.4 : 0.05) : (isAnyFocused ? 0.03 : 0.15));

  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'default';
    return () => { document.body.style.cursor = 'default'; };
  }, [hovered]);

  // Performance: Memoize geometries and materials to prevent memory leaks
  const geometries = useMemo(() => ({
    sphere: new THREE.SphereGeometry(4.0, 32, 32),
    ring: new THREE.RingGeometry(5.5, 6.5, 64),
    outerRing: new THREE.RingGeometry(7.0, 7.2, 64)
  }), []);

  // Dispose of geometries on unmount
  useEffect(() => () => {
    Object.values(geometries).forEach(g => g.dispose());
  }, [geometries]);

  return (
    <group position={position}>
      <Float speed={1.5} rotationIntensity={0.8} floatIntensity={0.8}>
        {/* 1. ATMOSPHERIC HALO (The Glow) */}
        <mesh scale={[1.6, 1.6, 1.6]} geometry={geometries.sphere}>
          <meshStandardMaterial
            color={clusterColor}
            emissive={clusterColor}
            emissiveIntensity={glowIntensity * 0.5}
            transparent
            opacity={glowOpacity * 0.4}
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* 2. INNER GLOW CORE */}
        <mesh scale={[1.2, 1.2, 1.2]} geometry={geometries.sphere}>
          <meshStandardMaterial
            color={clusterColor}
            emissive={clusterColor}
            emissiveIntensity={glowIntensity}
            transparent
            opacity={glowOpacity}
            side={THREE.FrontSide}
            depthWrite={false}
          />
        </mesh>

        {/* 3. MAIN PLANET BODY (Glassmorphism when selected) */}
        {!lowDetail && (
          <mesh
            ref={planetRef}
            geometry={geometries.sphere}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          >
            <meshStandardMaterial
              color={isAnyFocused && !isSelected ? "#050510" : (isSelected ? clusterColor : "#0a0a18")}
              roughness={isSelected ? 0.1 : 0.7}
              metalness={isSelected ? 0.9 : 0.3}
              transparent
              opacity={isSelected ? 0.3 : bodyOpacity}
              envMapIntensity={isSelected ? 2 : 1}
            />
          </mesh>
        )}

        {/* 4. SELECTION RING / HUD LABEL */}
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

        {/* 5. PLANETARY RINGS (Aesthetic) */}
        {!lowDetail && (
          <group rotation={[-Math.PI / 2.5, 0, 0]}>
            {/* Main Ring */}
            <mesh geometry={geometries.ring}>
              <meshStandardMaterial
                color={clusterColor}
                emissive={clusterColor}
                emissiveIntensity={isSelected ? 25 : (isAnyFocused ? 2 : 20)}
                transparent
                opacity={isSelected ? 0.8 : (isAnyFocused ? 0.1 : 0.6)}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            {/* Outer Faint Ring */}
            <mesh geometry={geometries.outerRing}>
              <meshStandardMaterial
                color={clusterColor}
                emissive={clusterColor}
                emissiveIntensity={isSelected ? 10 : 5}
                transparent
                opacity={isSelected ? 0.3 : 0.1}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          </group>
        )}

        {/* 6. ORBITING BODIES */}
        {isSelected && (job.moons || []).map((moon, i) => (
          <Moon
            key={moon.id}
            kind={moon.kind}
            orbitRadius={14.0 + (i * 2.5)}
            angleOffset={(i / Math.max(1, job.moons.length)) * Math.PI * 2}
            speed={0.25 + (i * 0.04)}
          />
        ))}

        {isSelected && (job.satellites || []).map((sat, i) => (
          <Satellite
            key={sat.id}
            state={sat.state}
            orbitRadius={22.0 + (i * 3.0)}
            angleOffset={(i / Math.max(1, job.satellites.length)) * Math.PI * 2 + Math.PI / 4}
            speed={0.8 + (i * 0.15)}
          />
        ))}
      </Float>

      {/* 7. FLOATING HUD LABEL (Galaxy View) */}
      {showLabel && (
        <Billboard position={[0, 8.0, 0]} follow={true}>
          <Text
            fontSize={hovered ? 3.5 : 2.5}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.2}
            outlineColor="#000000"
            fillOpacity={hovered ? 1.0 : 0.8}
          >
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}


