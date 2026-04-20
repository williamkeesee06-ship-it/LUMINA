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
      className={`relative w-24 h-24 cursor-pointer transition-all duration-500 hover:scale-110 active:scale-95 flex items-center justify-center ${isActive ? 'drop-shadow-[0_0_20px_rgba(0,255,136,0.4)]' : ''}`}
      title="Toggle Planetary View"
    >
      <div className={`w-16 h-16 rounded-full border-2 border-dashed animate-[spin_10s_linear_infinite] ${isActive ? 'border-[#00ff88] scale-110' : 'border-[#00ff8840] scale-100 opacity-50'}`} />
      <div className={`absolute w-12 h-12 rounded-full border-2 ${isActive ? 'border-[#00ff88] animate-pulse' : 'border-[#00ff8820]'}`} />
      <div className="absolute inset-0 rounded-full border border-[#00ff8820] animate-pulse pointer-events-none" />
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="text-[10px] tracking-[0.3em] uppercase text-[#00ff88] font-bold opacity-70">
          {isActive ? 'Earth Active' : 'Planet Mode'}
        </span>
      </div>
    </div>
  );
}
