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
      const angle = Math.random() * Math.PI * 2;
      const radius = 200 + Math.random() * 800;

      pos[i * 3 + 0] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = Math.sin(angle) * radius;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4000;

      sc[i] = 0.5 + Math.random() * 2.0;
    }

    return [pos, sc] as const;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpeed: { value: 0 },
      uColor: { value: new THREE.Color('#00f2ff') },
    }),
    []
  );

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    uniforms.uTime.value += delta;
    const targetSpeed = isNavigating ? 1.0 : 0.02;
    uniforms.uSpeed.value = THREE.MathUtils.lerp(
      uniforms.uSpeed.value,
      targetSpeed,
      delta * 3.0
    );

    meshRef.current.rotation.z += delta * 0.05;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[scales, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          attribute float size;
          uniform float uTime;
          uniform float uSpeed;
          varying float vOpacity;

          void main() {
            vec3 transformed = position;
            float zOffset = mod(uTime * 800.0 * uSpeed + position.z + 2000.0, 4000.0) - 2000.0;
            transformed.z = zOffset;

            vOpacity = smoothstep(1.0, 0.0, abs(transformed.z) / 2000.0);

            vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = size * (100.0 / -mvPosition.z);
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uColor;
          varying float vOpacity;

          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);

            if (d > 0.5) discard;

            float strength = 1.0 - (d * 2.5);
            strength = pow(strength, 2.0);

            gl_FragColor = vec4(uColor, strength * vOpacity);
          }
        `}
      />
    </points>
  );
}
