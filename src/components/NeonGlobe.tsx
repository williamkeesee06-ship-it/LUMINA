import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface NeonGlobeProps {
  onClick: () => void;
  isActive: boolean;
}

function GlobeCore({ isActive }: { isActive: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  useFrame(() => {
    meshRef.current.rotation.y += 0.015;
    meshRef.current.rotation.x += 0.005;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial 
        color={isActive ? "#00ff88" : "#004422"} 
        emissive={isActive ? "#00ff88" : "#004422"}
        emissiveIntensity={isActive ? 2 : 0.5}
        wireframe
      />
      <pointLight intensity={2} color="#00ff88" />
    </mesh>
  );
}

export function NeonGlobe({ onClick, isActive }: NeonGlobeProps) {
  return (
    <div 
      onClick={onClick}
      className={`relative w-24 h-24 cursor-pointer transition-all duration-500 hover:scale-110 active:scale-95 ${isActive ? 'drop-shadow-[0_0_20px_rgba(0,255,136,0.4)]' : ''}`}
      title="Toggle Planetary View"
    >
      <Canvas camera={{ position: [0, 0, 3] }}>
        <ambientLight intensity={0.5} />
        <GlobeCore isActive={isActive} />
      </Canvas>
      <div className="absolute inset-0 rounded-full border border-[#00ff8820] animate-pulse pointer-events-none" />
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="text-[10px] tracking-[0.3em] uppercase text-[#00ff88] font-bold opacity-70">
          {isActive ? 'Earth Active' : 'Planet Mode'}
        </span>
      </div>
    </div>
  );
}
