import { Billboard, Text, Line } from '@react-three/drei';
import type { LuminaViewMode } from '../../types/store';

interface CelestialGalaxyLabelProps {
  label: { text: string; position: [number, number, number]; color: string };
  viewMode: LuminaViewMode;
  onClick?: () => void;
}

export function CelestialGalaxyLabel({ label, viewMode, onClick }: CelestialGalaxyLabelProps) {
  const isUniverse = viewMode === 'universe';
  const isGalaxy = viewMode === 'galaxy';

  // Fade out logic: Labels are fully visible only in Universe view.
  // In Galaxy view, they fade significantly to prioritize planet focus.
  // In Planet view, they disappear.
  const opacity = isUniverse ? 0.9 : (isGalaxy ? 0.25 : 0);

  if (opacity === 0) return null;

  return (
    <group position={label.position}>
      <Billboard>
        {/* Clickable Hitbox for Label */}
        <mesh
          visible={false}
          position={[0, isUniverse ? 0 : -2, 0]}
          onClick={(e) => {
            if (isUniverse && onClick) {
              e.stopPropagation();
              onClick();
            }
          }}
          onPointerEnter={() => { if (isUniverse) document.body.style.cursor = 'pointer'; }}
          onPointerLeave={() => { document.body.style.cursor = 'default'; }}
        >
          <planeGeometry args={[60, 20]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        <Text
          fontSize={isUniverse ? 14 : 8}
          color="#ffffff"
          anchorX="center"
          anchorY="bottom"
          fillOpacity={opacity}
          letterSpacing={0.4}
        >
          {label.text.toUpperCase()}
        </Text>

        {/* Observatory Coordinate Line */}
        <Line
          points={[[0, -2, 0], [0, -15, 0]]}
          color="#ffffff"
          lineWidth={0.5}
          transparent
          opacity={opacity * 0.5}
        />

        {/* Small marker at text base */}
        <mesh position={[0, -2, 0]}>
          <planeGeometry args={[10, 0.1]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={opacity * 0.8} />
        </mesh>
      </Billboard>
    </group>
  );
}
