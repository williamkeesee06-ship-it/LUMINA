import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface NavigationStreaksProps {
  isNavigating: boolean;
}

export function NavigationStreaks({ isNavigating }: NavigationStreaksProps) {
  const meshRef = useRef<THREE.Points>(null);
  const count = 1000;
  
  const [positions, scales] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sc = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Distributed in a large cylinder/tunnel along Z
      const angle = Math.random() * Math.PI * 2;
      const radius = 200 + Math.random() * 800;
      pos[i * 3 + 0] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = Math.sin(angle) * radius;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4000;
      sc[i] = 0.5 + Math.random() * 2.0;
    }
    return [pos, sc];
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSpeed: { value: 0 },
    uColor: { value: new THREE.Color('#00f2ff') }
  }), []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    uniforms.uTime.value += delta;
    // Smoothly transition speed uniform
    const targetSpeed = isNavigating ? 1.0 : 0.02;
    uniforms.uSpeed.value = THREE.MathUtils.lerp(uniforms.uSpeed.value, targetSpeed, delta * 3.0);
    
    // Rotate the whole system slightly for depth
    meshRef.current.rotation.z += delta * 0.05;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aScale"
          count={count}
          array={scales}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          uniform float uTime;
          uniform float uSpeed;
          attribute float aScale;
          varying float vOpacity;
          
          void main() {
            vec3 pos = position;
            
            // Movement logic: particles stream past the camera
            float zOffset = uTime * 800.0 * uSpeed;
            pos.z = mod(pos.z - zOffset + 2000.0, 4000.0) - 2000.0;
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            
            // Perspective size
            gl_PointSize = aScale * (120.0 / -mvPosition.z);
            
            // Stretch effect: if uSpeed is high, we simulate motion blur by scaling point size
            // or we could use a custom streak mesh. For now, we'll boost size and fade.
            gl_PointSize *= (1.0 + uSpeed * 8.0);
            
            gl_Position = projectionMatrix * mvPosition;
            
            // Fade in/out based on distance to prevent popping
            vOpacity = smoothstep(-2000.0, -1000.0, mvPosition.z) * smoothstep(0.0, -500.0, mvPosition.z);
            vOpacity *= (0.2 + uSpeed * 0.8); // Brighter when moving
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          varying float vOpacity;
          void main() {
            float d = distance(gl_PointCoord, vec2(0.5));
            if (d > 0.5) discard;
            
            // Create a sharp horizontal streak look by squishing the radial gradient
            float strength = 1.0 - (d * 2.5);
            strength = pow(strength, 2.0);
            
            gl_FragColor = vec4(uColor, strength * vOpacity);
          }
        `}
      />
    </points>
  );
}
