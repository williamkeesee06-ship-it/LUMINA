import { Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useUI, selectGalaxyCounts } from "@/store/uiStore";
import { GALAXIES } from "@/types";
import { CameraRig } from "./CameraRig";
import { Starfield } from "./Starfield";
import { CosmicDust } from "./CosmicDust";
import { GalaxyCluster } from "./GalaxyCluster";
import { GalaxyLabels } from "./GalaxyLabels";
import { PlanetField } from "./PlanetField";
import { NebulaClouds } from "./NebulaClouds";
import { Meteors } from "./Meteors";
import { GodViewDots } from "./GodViewDots";
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
      <sphereGeometry args={[600, 64, 32]} />
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
      camera={{ position: [0, 65, 205], fov: 52, near: 0.1, far: 1200 }}
      dpr={[1, 1.75]}
    >
      <color attach="background" args={["#02050a"]} />
      {/* Fog pushed FAR out (PR #8: 560 → 950) so the new 100u-footprint
          nebulae aren't fogged into the void at the back of the field.
          With galaxies at radius 120 and clouds extending ~100u beyond,
          the far edge can sit ~440 from a Z=205 camera, so fog far must
          clear that with margin. Near edge moved back to 280 so the
          atmospheric falloff still feels present in the near void. */}
      <fog attach="fog" args={["#02050a", 280, 950]} />
      <ambientLight intensity={0.25} />
      {/* Cool key + warm rim — luxurious dual lighting */}
      <pointLight position={[0, 30, 30]} intensity={0.7} color="#5BF3FF" />
      <pointLight position={[-40, -10, -20]} intensity={0.35} color="#FF3D9A" />

      <Suspense fallback={null}>
        <Skybox />
      </Suspense>

      <CameraRig />
      {/* Distant nebula clouds — static low-opacity color washes in deep space */}
      <Suspense fallback={null}>
        <NebulaClouds />
      </Suspense>
      {/* PR #9 — three hard-pinpoint starfield layers. Non-attenuated points
          so each star is a sharp pixel of light at any distance, never a soft
          glow that swells on close approach. Brightest ~5% per layer also get
          a cross-flare sprite for variety. Rendered BEFORE the nebula so the
          gas filaments layer over the starfield correctly. */}
      <Starfield
        count={6000}
        radius={240}
        size={0.06}
        baseOpacity={0.92}
        flatten={1}
        flareFraction={0.04}
        dim={isPlanetView}
      />
      <Starfield
        count={1800}
        radius={85}
        size={0.07}
        baseOpacity={0.96}
        flatten={0.7}
        flareFraction={0.06}
        dim={isPlanetView}
      />
      <Starfield
        count={400}
        radius={32}
        size={0.08}
        baseOpacity={1.0}
        flatten={0.5}
        flareFraction={0.1}
        dim={isPlanetView}
      />
      {/* Shooting stars — tapered streaks every ~10s, no squares */}
      <Meteors intervalSec={11} poolSize={5} radius={95} dim={isPlanetView} />
      {/* Cosmic dust / swirl — blends galaxies into surrounding space */}
      {/* PR #8: nebula footprint pushed to 100u (was 55u) and softened
          falloff (pow 1.15 vs 2.2) so each galaxy's haze fills nearly half
          the gap to its 120u-distant neighbor — adjacent clouds visibly
          OVERLAP in the middle of the field. Particle count per galaxy
          more than doubled (900 → 2200) so density reads all the way out
          to the outer reaches, not just at the core. */}
      <CosmicDust perGalaxy={2200} ambient={1400} dim={isPlanetView} />

      {/* Universe layer — always render, fade out when entering galaxy */}
      <Suspense fallback={null}>
        {GALAXIES.map((g) => {
          const isFocused = focusedGalaxy === g;
          const isDimmed = (focusedGalaxy !== null && !isFocused) || (isPlanetView && !isFocused);
          const insideThis = isFocused && viewMode !== "universe";
          // Galaxy nebula clicks only enter the galaxy from the universe
          // view. Once inside a galaxy (or with a planet selected), the
          // huge nebula billboards become no-op so accidental clicks
          // while panning the camera don't dump the user back to the
          // galaxy view and close their open job card.
          const canSelect = viewMode === "universe";
          return (
            <GalaxyCluster
              key={g}
              galaxy={g}
              position={GALAXY_POSITIONS[g]}
              count={counts[g]}
              highlighted={isFocused && viewMode === "universe"}
              dimmed={isDimmed}
              insideThis={insideThis}
              planetView={isPlanetView}
              onSelect={
                canSelect
                  ? () => {
                      sfx.select();
                      enterGalaxy(g);
                    }
                  : null
              }
            />
          );
        })}
      </Suspense>

      {/* Subtle galaxy name labels — sit inside each cluster, color-matched. */}
      <GalaxyLabels />

      {/* God-view planet dots — every planet renders as a small glowing dot
          at universe zoom. Unread mail = pulse + brighter; quiet = steady.
          Suppressed when inside a galaxy / planet view so close-up scenes
          stay uncluttered. */}
      <GodViewDots jobs={jobs} visible={viewMode === "universe"} />

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
