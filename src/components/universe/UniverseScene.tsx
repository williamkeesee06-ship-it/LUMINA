import { Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useUI, selectGalaxyCounts } from "@/store/uiStore";
import { GALAXIES } from "@/types";
import { CameraRig } from "./CameraRig";
import { Stardust } from "./Stardust";
import { CosmicDust } from "./CosmicDust";
import { GalaxyCluster } from "./GalaxyCluster";
import { PlanetField } from "./PlanetField";
import { GALAXY_POSITIONS } from "./galaxyLayout";
import { sfx } from "@/lib/audio";

/**
 * Deep-space skybox: starfield panorama wrapped on inside of a giant sphere.
 * Adds depth and luxe atmosphere behind everything.
 */
function Skybox() {
  const tex = useLoader(THREE.TextureLoader, "/textures/starfield.png");
  return (
    <mesh>
      <sphereGeometry args={[400, 64, 32]} />
      <meshBasicMaterial
        map={tex}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
        color="#445566"
      />
    </mesh>
  );
}

export function UniverseScene() {
  const viewMode = useUI((s) => s.viewMode);
  const focusedGalaxy = useUI((s) => s.focusedGalaxy);
  const enterGalaxy = useUI((s) => s.enterGalaxy);
  const jobs = useUI((s) => s.jobs);
  const selectedJobId = useUI((s) => s.selectedJobId);
  const selectJob = useUI((s) => s.selectJob);
  const counts = useUI(selectGalaxyCounts);

  const focusedJobs = focusedGalaxy ? jobs.filter((j) => j.status === focusedGalaxy) : [];

  // When inspecting a planet (job card open), dim everything that isn't
  // the selected planet so the user's focus snaps to it + the intel panel.
  const isPlanetView = viewMode === "planet";

  return (
    <div className="absolute inset-0" style={{ zIndex: 0 }}>
    <Canvas
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 22, 60], fov: 52, near: 0.1, far: 500 }}
      dpr={[1, 1.75]}
    >
      <color attach="background" args={["#02050a"]} />
      <fog attach="fog" args={["#02050a", 90, 240]} />
      <ambientLight intensity={0.25} />
      {/* Cool key + warm rim — luxurious dual lighting */}
      <pointLight position={[0, 30, 30]} intensity={0.7} color="#5BF3FF" />
      <pointLight position={[-40, -10, -20]} intensity={0.35} color="#FF3D9A" />

      <Suspense fallback={null}>
        <Skybox />
      </Suspense>

      <CameraRig />
      {/* Far star field — dense pinpoint stars filling the sky */}
      <Stardust count={1100} radius={95} dim={isPlanetView} />
      {/* Near twinkle layer — closer, brighter motes that drift past camera */}
      <Stardust count={350} radius={45} dim={isPlanetView} />
      {/* Cosmic dust / swirl — blends galaxies into surrounding space */}
      <CosmicDust perGalaxy={260} ambient={900} dim={isPlanetView} />

      {/* Universe layer — always render, fade out when entering galaxy */}
      <Suspense fallback={null}>
        {GALAXIES.map((g) => {
          const isFocused = focusedGalaxy === g;
          const isDimmed = (focusedGalaxy !== null && !isFocused) || (isPlanetView && !isFocused);
          const insideThis = isFocused && viewMode !== "universe";
          return (
            <GalaxyCluster
              key={g}
              galaxy={g}
              position={GALAXY_POSITIONS[g]}
              count={counts[g]}
              highlighted={isFocused && viewMode === "universe"}
              dimmed={isDimmed}
              insideThis={insideThis}
              onSelect={() => {
                sfx.select();
                enterGalaxy(g);
              }}
            />
          );
        })}
      </Suspense>

      {/* Planet field — only when inside a galaxy */}
      {viewMode !== "universe" && focusedGalaxy && (
        <group position={GALAXY_POSITIONS[focusedGalaxy]}>
          <PlanetField
            jobs={focusedJobs}
            selectedJobId={selectedJobId}
            focusMode={isPlanetView}
            onSelect={(id) => {
              sfx.select();
              selectJob(id);
            }}
          />
        </group>
      )}

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.6}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.55}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.25} darkness={0.92} />
      </EffectComposer>
    </Canvas>
    </div>
  );
}
