import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useUI, selectGalaxyCounts } from "@/store/uiStore";
import { GALAXIES } from "@/types";
import { CameraRig } from "./CameraRig";
import { Stardust } from "./Stardust";
import { GalaxyCluster } from "./GalaxyCluster";
import { PlanetField } from "./PlanetField";
import { GALAXY_POSITIONS } from "./galaxyLayout";
import { sfx } from "@/lib/audio";

export function UniverseScene() {
  const viewMode = useUI((s) => s.viewMode);
  const focusedGalaxy = useUI((s) => s.focusedGalaxy);
  const enterGalaxy = useUI((s) => s.enterGalaxy);
  const jobs = useUI((s) => s.jobs);
  const selectedJobId = useUI((s) => s.selectedJobId);
  const selectJob = useUI((s) => s.selectJob);
  const counts = useUI(selectGalaxyCounts);

  const focusedJobs = focusedGalaxy ? jobs.filter((j) => j.status === focusedGalaxy) : [];

  return (
    <div className="absolute inset-0" style={{ zIndex: 0 }}>
    <Canvas
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 22, 60], fov: 52, near: 0.1, far: 500 }}
      dpr={[1, 1.75]}
    >
      <color attach="background" args={["#02050a"]} />
      <fog attach="fog" args={["#02050a", 80, 220]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 30, 30]} intensity={0.6} color="#5BF3FF" />

      <CameraRig />
      <Stardust />

      {/* Universe layer — always render, fade out when entering galaxy */}
      {GALAXIES.map((g) => {
        const isFocused = focusedGalaxy === g;
        const isDimmed = focusedGalaxy !== null && !isFocused;
        return (
          <GalaxyCluster
            key={g}
            galaxy={g}
            position={GALAXY_POSITIONS[g]}
            count={counts[g]}
            highlighted={isFocused}
            dimmed={isDimmed}
            onSelect={() => {
              sfx.select();
              enterGalaxy(g);
            }}
          />
        );
      })}

      {/* Planet field — only when inside a galaxy */}
      {viewMode !== "universe" && focusedGalaxy && (
        <group position={GALAXY_POSITIONS[focusedGalaxy]}>
          <PlanetField
            jobs={focusedJobs}
            selectedJobId={selectedJobId}
            onSelect={(id) => {
              sfx.select();
              selectJob(id);
            }}
          />
        </group>
      )}

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.85} luminanceThreshold={0.18} luminanceSmoothing={0.4} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.85} />
      </EffectComposer>
    </Canvas>
    </div>
  );
}
