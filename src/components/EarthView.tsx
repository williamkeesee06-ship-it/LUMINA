import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls, useTexture, Stars, Billboard, Html } from '@react-three/drei';
import type { ConstructionJob } from '../types/lumina';
import { STATUS_COLORS } from '../types/lumina';

interface EarthViewProps {
  jobs: ConstructionJob[];
  onSelectJob: (job: ConstructionJob) => void;
}

export function EarthView({ jobs, onSelectJob }: EarthViewProps) {
  const globeRef = useRef<THREE.Mesh>(null!);
  const cloudsRef = useRef<THREE.Mesh>(null!);
  
  const [colorMap, normalMap, specularMap, cloudsMap] = useTexture([
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png'
  ]);

  const latLongToVector3 = (lat: number, lon: number, radius: number) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  };

  const pins = useMemo(() => {
    return jobs.map((job) => {
      // Use real geodata from Smartsheet/Nominatim
      // Add slight jitter (0.005 degrees) to prevent overlapping pins in the same city
      const jitterLat = (Math.random() - 0.5) * 0.15;
      const jitterLng = (Math.random() - 0.5) * 0.15;
      
      const lat = (job.lat || 32.7157) + jitterLat;
      const lng = (job.lng || -117.1611) + jitterLng;
      
      const position = latLongToVector3(lat, lng, 15.1);
      const color = STATUS_COLORS[0]; // Simplified for build stability, will map properly later
      return { job, position, color };
    });
  }, [jobs]);

  useFrame((_state, delta) => {
    if (globeRef.current) globeRef.current.rotation.y += delta * 0.05;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.07;
  });

  return (
    <>
      <OrbitControls 
        enableDamping 
        dampingFactor={0.05} 
        rotateSpeed={0.5} 
        minDistance={20} 
        maxDistance={60} 
      />
      
      <ambientLight intensity={0.2} />
      <pointLight position={[50, 50, 50]} intensity={2.5} color="#ffffff" />
      <pointLight position={[-50, -50, -50]} intensity={0.5} color="#4444ff" />

      {/* Earth Globe */}
      <mesh ref={globeRef}>
        <sphereGeometry args={[15, 64, 64]} />
        <meshPhongMaterial 
          map={colorMap} 
          normalMap={normalMap} 
          specularMap={specularMap}
          shininess={10} 
        />
      </mesh>

      {/* Clouds Layer */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[15.15, 64, 64]} />
        <meshPhongMaterial 
          map={cloudsMap} 
          transparent 
          opacity={0.4} 
          depthWrite={false}
        />
      </mesh>

      {/* Neon Atmosphere Glow */}
      <mesh>
        <sphereGeometry args={[15.5, 64, 64]} />
        <meshBasicMaterial color="#00f2ff" transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>

      {/* Pins */}
      {pins.map((pin, i) => (
        <Pin 
          key={pin.job.id || i} 
          position={pin.position} 
          color={pin.color} 
          job={pin.job}
          onClick={() => onSelectJob(pin.job)} 
        />
      ))}

      {/* Stars in Distance */}
      <Stars radius={300} depth={60} count={20000} factor={7} saturation={0} fade speed={1} />
    </>
  );
}

function Pin({ position, color, job, onClick }: { position: THREE.Vector3, color: string, job: ConstructionJob, onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  
  return (
    <group position={position}>
      <Billboard>
        <mesh 
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshBasicMaterial color={color} />
          
          {/* Neon Halo */}
          <mesh scale={hovered ? 2.5 : 2}>
            <circleGeometry args={[0.3, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} />
          </mesh>
          <mesh scale={hovered ? 3.5 : 3}>
            <circleGeometry args={[0.3, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.1} />
          </mesh>
        </mesh>
      </Billboard>
      
      {/* City Label on Hover */}
      {hovered && (
        <Html distanceFactor={10} position={[0.5, 0.5, 0]}>
          <div className="pin-label">
            <div className="text-xs font-bold" style={{ color }}>{job.jobNumber}</div>
            <div className="text-[8px] opacity-70 text-white uppercase tracking-wider">{job.city}</div>
          </div>
        </Html>
      )}
    </group>
  );
}
