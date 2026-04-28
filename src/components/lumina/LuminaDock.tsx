/**
 * LuminaDock — Lumina's permanent bottom-left home.
 *
 * Replaces the old in-HUD Lumina hero. The dock is two pieces:
 *
 *   1. The orb       — always visible, anchored bottom-left at 16px from
 *                      both edges. Click to open/close the chat panel.
 *   2. The chat slab — slides out to the right of the orb when chat is
 *                      open. Sized 380×480 with a slight gap from the orb.
 *
 * The orb uses the existing <Orb> component. The chat content lives in
 * <LuminaPanel> which we render here positioned absolutely.
 *
 * Z-index sits above the HUD so the orb is never hidden behind anything.
 */
import { useUI } from "@/store/uiStore";
import { Orb } from "./Orb";
import { LuminaPanel } from "./LuminaPanel";

const ORB_SIZE = 80; // disc — outer halo box is +28 inside Orb
const ORB_FRAME = ORB_SIZE + 28; // matches Orb.tsx frame calc
const ORB_OFFSET = 16; // px from screen edges

export function LuminaDock() {
  const isChatOpen = useUI((s) => s.isChatOpen);
  const setChatOpen = useUI((s) => s.setChatOpen);

  return (
    <>
      {/* Chat panel lives above the orb in z-order. LuminaPanel reads
          isChatOpen and renders nothing when closed, so we can mount it
          unconditionally. */}
      <LuminaPanel
        anchorBottom={ORB_OFFSET}
        anchorLeft={ORB_OFFSET + ORB_FRAME + 12}
      />

      {/* Orb anchor — always visible. Bottom-left, fixed. */}
      <div
        className="pointer-events-none fixed z-[60] select-none"
        style={{ left: ORB_OFFSET, bottom: ORB_OFFSET }}
      >
        <div className="pointer-events-auto relative">
          {/* The orb itself. Click toggles the chat. */}
          <Orb size={ORB_SIZE} onActivate={() => setChatOpen(!isChatOpen)} />

          {/* LUMINA wordmark beneath the orb so she always reads as a
              labeled presence, not an unidentified glow. */}
          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
            style={{ top: ORB_FRAME - 10 }}
          >
            <div
              className="font-display"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.28em",
                color: "#ffffff",
                textShadow:
                  "0 0 3px #5BF3FF, 0 0 8px rgba(91,243,255,0.7)",
              }}
            >
              LUMINA
            </div>
            <div
              className="font-mono uppercase"
              style={{
                fontSize: 7,
                letterSpacing: "0.32em",
                color: "rgba(91,243,255,0.7)",
                marginTop: 1,
              }}
            >
              {isChatOpen ? "online · listening" : "tap to wake"}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
