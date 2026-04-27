import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useUI } from "@/store/uiStore";
import { GALAXY_POSITIONS } from "./galaxyLayout";

/**
 * Cinematic + free-fly camera.
 *
 * Behavior:
 *  - Scripted shots when viewMode changes (universe / galaxy / planet),
 *    OR when the user clicks on something (selecting a galaxy / job).
 *  - The moment the user grabs the canvas (mouse drag, wheel, WASD, touch),
 *    the rig switches to FREE-FLY and stops auto-lerping. They can explore.
 *  - Any new viewMode change (entering a galaxy, selecting a planet) cancels
 *    free-fly and resumes scripted framing — feels intentional.
 *
 * Controls:
 *  - Left-drag (or touch-drag): rotate view (yaw/pitch)
 *  - WASD: strafe / forward+back
 *  - Q / E: down / up
 *  - Shift: 3x speed boost
 *  - Mouse wheel / pinch: dolly forward along view direction
 */
export function CameraRig() {
  const { camera, gl } = useThree();
  const viewMode = useUI((s) => s.viewMode);
  const focusedGalaxy = useUI((s) => s.focusedGalaxy);
  const selectedJobId = useUI((s) => s.selectedJobId);
  const mapTransition = useUI((s) => s.mapTransition);

  // Hyperspace warp — we snapshot the camera at dive-start, push it forward at
  // hyper speed and widen FOV through the dive, then on rise-start snap back
  // to the snapshot so the universe feels like it surges back into view.
  const warpStart = useRef<number>(0);
  const warpFromPos = useRef(new THREE.Vector3());
  const warpFromQuat = useRef(new THREE.Quaternion());
  const warpFromFov = useRef(52);

  // Scripted target (used until the user takes control)
  const targetPos = useRef(new THREE.Vector3(0, 22, 60));
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));
  const currentLook = useRef(new THREE.Vector3(0, 0, 0));

  // Free-fly state
  const freeFly = useRef(false);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const isDragging = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const wheelImpulse = useRef(0);

  // ---- Hyperspace warp triggers ----
  useEffect(() => {
    if (mapTransition === "diving") {
      // Snapshot the rig so we can restore on rise. Disable free-fly and
      // scripted-shot lerp during the warp — the per-frame block below owns
      // the camera while diving/rising.
      warpFromPos.current.copy(camera.position);
      warpFromQuat.current.copy(camera.quaternion);
      const persp = camera as THREE.PerspectiveCamera;
      warpFromFov.current = persp.fov ?? 52;
      warpStart.current = performance.now();
      freeFly.current = false;
    } else if (mapTransition === "rising") {
      // Snapshot "to" target = the position from before we dove. Mark a fresh
      // warp start so the per-frame curve resets cleanly.
      warpStart.current = performance.now();
    }
  }, [mapTransition, camera]);

  // ---- Scripted shot updates ----
  useEffect(() => {
    // A new viewMode means: cancel free-fly, snap back to a scripted shot.
    freeFly.current = false;
    if (viewMode === "universe") {
      targetPos.current.set(0, 22, 60);
      targetLook.current.set(0, 0, 0);
    } else if (viewMode === "galaxy" && focusedGalaxy) {
      const p = GALAXY_POSITIONS[focusedGalaxy];
      targetPos.current.set(p[0] + 0, p[1] + 4, p[2] + 14);
      targetLook.current.set(p[0], p[1], p[2]);
    } else if (viewMode === "planet" && selectedJobId && focusedGalaxy) {
      const p = GALAXY_POSITIONS[focusedGalaxy];
      targetPos.current.set(p[0] + 7, p[1] + 3, p[2] + 9);
      targetLook.current.set(p[0], p[1], p[2]);
    }
  }, [viewMode, focusedGalaxy, selectedJobId]);

  // ---- Input handlers ----
  useEffect(() => {
    const dom = gl.domElement;
    dom.style.touchAction = "none";
    dom.style.cursor = "grab";

    const enterFreeFly = () => {
      if (!freeFly.current) {
        // Seed yaw/pitch from current camera orientation so there's no jump.
        const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
        yaw.current = e.y;
        pitch.current = e.x;
        freeFly.current = true;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      // Don't hijack right-click or middle-click outside drags
      if (e.button !== 0) return;
      // Ignore if the pointerdown is on a UI overlay (HUD, panel) — those
      // stop propagation, but as a guard:
      const target = e.target as HTMLElement | null;
      if (target && target !== dom && !dom.contains(target)) return;

      isDragging.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      // Capture and grabbing-cursor only after we confirm it's a drag —
      // otherwise raycast clicks on galaxies/planets won't fire.
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current || !lastPointer.current) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      // Only enter free-fly once movement actually happens (preserves clicks)
      if (Math.abs(dx) + Math.abs(dy) < 2.5 && !freeFly.current) return;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      enterFreeFly();
      dom.style.cursor = "grabbing";
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {
        /* no-op */
      }
      const sens = 0.0035;
      // Inverted (push) drag: drag right -> camera pans LEFT (world appears
      // to swipe right), drag down -> camera pans UP. Feels like pushing the
      // scene rather than grabbing it.
      yaw.current += dx * sens;
      pitch.current += dy * sens;
      const lim = Math.PI / 2 - 0.05;
      pitch.current = Math.max(-lim, Math.min(lim, pitch.current));
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging.current = false;
      lastPointer.current = null;
      dom.style.cursor = "grab";
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {
        /* no-op */
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      enterFreeFly();
      // Zoom = forward dolly. Positive deltaY scrolls down → move backward.
      wheelImpulse.current += -e.deltaY * 0.06;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys while typing in inputs
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if ("wasdqe".includes(k) || k === "shift" || k === " " || k === "arrowup" || k === "arrowdown" || k === "arrowleft" || k === "arrowright") {
        keys.current[k] = true;
        enterFreeFly();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [camera, gl]);

  // ---- Per-frame update ----
  useFrame((_, delta) => {
    // Hyperspace warp owns the camera entirely while diving / rising.
    if (mapTransition === "diving" || mapTransition === "rising") {
      const persp = camera as THREE.PerspectiveCamera;
      const elapsed = performance.now() - warpStart.current;
      const TOTAL = mapTransition === "diving" ? 1600 : 1400;
      const tRaw = Math.min(1, Math.max(0, elapsed / TOTAL));
      // Ease: cubic in for dive (slow start, hyper accel), cubic out for rise.
      const e =
        mapTransition === "diving"
          ? tRaw * tRaw * tRaw
          : 1 - Math.pow(1 - tRaw, 3);

      // Forward direction at the snapshot orientation (we keep looking the
      // same way — the streaks are the spectacle, not a re-orient).
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        warpFromQuat.current,
      );

      if (mapTransition === "diving") {
        // Push forward up to ~140 units along view dir at peak.
        const offset = forward.clone().multiplyScalar(e * 140);
        camera.position.copy(warpFromPos.current).add(offset);
        camera.quaternion.copy(warpFromQuat.current);
        // FOV widens 52 -> ~110 to sell the warp; bell-curved so it crests at peak.
        const bell = Math.sin(Math.PI * tRaw); // 0 -> 1 -> 0
        persp.fov = warpFromFov.current + bell * 58;
        persp.updateProjectionMatrix();
      } else {
        // Rising: start at the dove-forward position and ease back to snapshot.
        // We cached snapshot in warpFromPos at the original dive (it persisted),
        // so position lerps from forward-shoved -> warpFromPos.
        const offset = forward.clone().multiplyScalar((1 - e) * 140);
        camera.position.copy(warpFromPos.current).add(offset);
        camera.quaternion.copy(warpFromQuat.current);
        const bell = Math.sin(Math.PI * tRaw);
        persp.fov = warpFromFov.current + bell * 58;
        persp.updateProjectionMatrix();
      }
      return;
    }

    if (freeFly.current) {
      // Apply yaw/pitch to the camera quaternion
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(pitch.current, yaw.current, 0, "YXZ"),
      );
      camera.quaternion.slerp(q, 1 - Math.exp(-18 * delta));

      // Movement vectors in camera space
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const up = new THREE.Vector3(0, 1, 0);

      const boost = keys.current["shift"] ? 3 : 1;
      const baseSpeed = 30 * boost; // units / sec
      const move = new THREE.Vector3();
      if (keys.current["w"] || keys.current["arrowup"]) move.add(forward);
      if (keys.current["s"] || keys.current["arrowdown"]) move.sub(forward);
      if (keys.current["a"] || keys.current["arrowleft"]) move.sub(right);
      if (keys.current["d"] || keys.current["arrowright"]) move.add(right);
      if (keys.current["e"] || keys.current[" "]) move.add(up);
      if (keys.current["q"]) move.sub(up);
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(baseSpeed * delta);
        camera.position.add(move);
      }

      // Wheel impulse — exponential decay
      if (Math.abs(wheelImpulse.current) > 0.001) {
        const step = wheelImpulse.current * delta * 6;
        camera.position.add(forward.clone().multiplyScalar(step));
        wheelImpulse.current *= Math.exp(-6 * delta);
      }

      // Soft world bounds so we can't fly into oblivion
      const R = 360;
      const dist = camera.position.length();
      if (dist > R) camera.position.multiplyScalar(R / dist);
      return;
    }

    // Scripted shot: critical damping toward target.
    // In universe view, slowly orbit the targetPos around Y for a subtle
    // "living" drift (~0.5° per second → a full revolution every ~12 minutes
    // is far too slow; we use ~0.0017 rad/sec ≈ 0.1°/sec which is the right
    // amount of motion to feel cinematic without being noticeable).
    if (viewMode === "universe") {
      const driftRate = 0.0017; // rad/sec
      const angle = driftRate * delta;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const x = targetPos.current.x;
      const z = targetPos.current.z;
      targetPos.current.x = x * cosA - z * sinA;
      targetPos.current.z = x * sinA + z * cosA;
    }
    const lambda = 2.4;
    const k = 1 - Math.exp(-lambda * delta);
    camera.position.lerp(targetPos.current, k);
    currentLook.current.lerp(targetLook.current, k);
    camera.lookAt(currentLook.current);
  });

  return null;
}
