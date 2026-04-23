import * as THREE from 'three';

export const NeonGlowShader = {
  uniforms: {
    uColor: { value: new THREE.Color("#00f2ff") },
    uTime: { value: 0 },
    uGlowIntensity: { value: 1.0 },
    uRimPower: { value: 3.0 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vViewPosition = normalize(cameraPosition - worldPosition.xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uGlowIntensity;
    uniform float uRimPower;
    
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
      float rim = 1.0 - max(dot(vNormal, vViewPosition), 0.0);
      rim = pow(rim, uRimPower);
      
      float pulse = 0.8 + 0.2 * sin(uTime * 2.0);
      vec3 finalColor = uColor * rim * uGlowIntensity * pulse;
      
      gl_FragColor = vec4(finalColor, rim * pulse);
    }
  `
};
