import { useAnimationStore } from "../stores/animationStore";
import { useDeviceStore } from "../stores/deviceStore";
import { drawingPixels } from "../stores/uiStore";
import type { CustomAnimation } from "../types";
import { buildDevicePayload, validatePayload } from "./deviceProtocol";

export const DRAWING_ID = "__drawing__";

/**
 * Sends everything (the drawing + all animations) to the KittyBuddy and makes
 * `show` the one on screen. The BOOT button cycles through the others; one-shot
 * animations return to `show` when they finish.
 */
export async function sendToDevice(show: string): Promise<{ ok: boolean; message: string }> {
  const device = useDeviceStore.getState();
  const { animations, config } = useAnimationStore.getState();

  const pixels = drawingPixels();
  const hasDrawing = pixels.some((p) => p);
  const list: CustomAnimation[] = [];
  if (hasDrawing || show === DRAWING_ID) {
    list.push({
      id: DRAWING_ID,
      name: "Drawing",
      description: "",
      frames: [{ id: "f", pixels, duration: 1000, label: "Drawing" }],
      loop: true,
      trigger: "idle",
      createdAt: 0,
      updatedAt: 0,
    });
  }
  list.push(...animations);

  const payload = buildDevicePayload(list, {
    ...config,
    idleAnimationId: show,
    // BOOT cycles through everything except what is already on screen
    buttonExpressions: list.map((a) => a.id).filter((id) => id !== show),
  });
  const problem = validatePayload(payload);
  if (problem) return { ok: false, message: problem };

  if (device.status.state !== "connected") {
    await device.connect();
    if (useDeviceStore.getState().status.state !== "connected") {
      return {
        ok: false,
        message: "Can't reach your KittyBuddy. Join its Wi-Fi (KittyBuddy-Studio) and try again.",
      };
    }
  }

  const ok = await useDeviceStore.getState().syncContent(payload);
  const sim = useDeviceStore.getState().status.isSimulation;
  if (ok) return { ok, message: sim ? "Simulation only. Turn off simulation in Device to use the real OLED." : "Sent! Check your OLED." };
  return { ok, message: useDeviceStore.getState().status.error ?? "Sync failed" };
}
