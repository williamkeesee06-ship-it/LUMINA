import { Float, Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';

interface LuminaAISurfaceProps {
  onClick: () => void;
  onDoubleClick: () => void;
  isConnected: boolean;
  isThinking: boolean;
  voiceEnabled: boolean;
  isNavigating: boolean;
}

export function LuminaAISurface({
  onClick, onDoubleClick, isConnected, isThinking, voiceEnabled, isNavigating
}: LuminaAISurfaceProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const ring1Ref = useRef<THREE.Mesh>(null!);
  const ring2Ref = useRef<THREE.Mesh>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'default';
    return () => { document.body.style.cursor = 'default'; };
  }, [hovered]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    
    // Floating motion
    groupRef.current.position.y = Math.sin(t * 0.4) * 8;
    
    // Ring rotations
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.5;
      ring1Ref.current.rotation.x = Math.sin(t * 0.3) * 0.2;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.8;
      ring2Ref.current.rotation.y = Math.cos(t * 0.4) * 0.3;
    }
    
    // Core pulse
    if (coreRef.current) {
      const pulseScale = 1 + Math.sin(t * (isThinking ? 8 : 2)) * (isThinking ? 0.2 : 0.05);
      coreRef.current.scale.set(pulseScale, pulseScale, pulseScale);
      
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      let color = new THREE.Color("#00f2ff");
      let intensity = 5.0;

      if (isThinking) {
        color.lerp(new THREE.Color("#aa00ff"), (Math.sin(t * 6) + 1) / 2);
        intensity = 15.0;
      } else if (voiceEnabled) {
        color = new THREE.Color("#00ffcc");
        intensity = 10.0 + Math.sin(t * 15) * 5.0;
      } else if (isNavigating) {
        intensity = 8.0;
      }

      mat.emissive = color;
      mat.emissiveIntensity = intensity;
    }
  });

  return (
    <group ref={groupRef} position={[0, 40, 0]}>
      {/* Interaction Hitbox */}
      <mesh
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <sphereGeometry args={[50, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        {/* Core Intelligence Hub */}
        <mesh ref={coreRef}>
          <icosahedronGeometry args={[12, 1]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#00f2ff"
            emissiveIntensity={5}
            toneMapped={false}
            wireframe={isThinking}
          />
        </mesh>

        {/* Tactical Ring System */}
        <mesh ref={ring1Ref} rotation={[Math.PI / 3, 0, 0]}>
          <ringGeometry args={[28, 30, 64]} />
          <meshBasicMaterial color="#00f2ff" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
        
        <mesh ref={ring2Ref} rotation={[-Math.PI / 4, Math.PI / 4, 0]}>
          <ringGeometry args={[34, 35, 64]} />
          <meshBasicMaterial color="#ff00ea" transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>

        {/* Data Accents */}
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <ringGeometry args={[42, 42.5, 4, 1, 0, Math.PI * 0.5]} />
            <meshBasicMaterial color="#00f2ff" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* Identity Label */}
        <Billboard position={[0, -50, 0]}>
          <Text
            fontSize={3.5}
            color="#00f2ff"
            anchorX="center"
            letterSpacing={0.5}
          >
            {isThinking ? 'SYSTEM ANALYZING' : (voiceEnabled ? 'VOICE UPLINK ACTIVE' : 'LUMINA CORE')}
          </Text>
          <Text
            position={[0, -6, 0]}
            fontSize={1.5}
            color="#ffffff"
            anchorX="center"
            fillOpacity={0.4}
            letterSpacing={0.8}
          >
            {isConnected ? 'ENCRYPTED CONNECTION STABLE' : 'OFFLINE MODE'}
          </Text>
        </Billboard>
      </Float>
    </group>
  );
}
