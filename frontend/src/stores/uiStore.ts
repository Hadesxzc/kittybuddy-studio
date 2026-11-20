import { create } from "zustand";
import { useEditorStore } from "./editorStore";
import { useAnimationStore } from "./animationStore";
import { useProjectStore } from "./projectStore";
import { createEmptyPixels } from "../types";

export type Tab = "draw" | "anims" | "device";

/** What the canvas on the Draw tab is currently editing. */
export type EditTarget =
  | { kind: "drawing" }
  | { kind: "frame"; animId: string; frameIndex: number };

interface UiStore {
  tab: Tab;
  target: EditTarget;
  toast: { text: string; ok: boolean } | null;
  /** True once saved work has been loaded, so autosave can't overwrite it with blanks. */
  hydrated: boolean;
  setTab: (tab: Tab) => void;
  /** Switch the canvas to a new target and load its pixels. */
  edit: (target: EditTarget) => void;
  showToast: (text: string, ok?: boolean) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function drawingPixels(): Uint8Array {
  const ui = useUiStore.getState();
  if (ui.target.kind === "drawing") return useEditorStore.getState().pixels;
  return useProjectStore.getState().getActiveProject()?.currentFramePixels ?? createEmptyPixels();
}

export const useUiStore = create<UiStore>((set) => ({
  tab: "draw",
  target: { kind: "drawing" },
  toast: null,
  hydrated: false,

  setTab: (tab) => set({ tab }),

  edit: (target) => {
    let pixels: Uint8Array | undefined;
    if (target.kind === "drawing") {
      pixels = useProjectStore.getState().getActiveProject()?.currentFramePixels;
    } else {
      const a = useAnimationStore.getState().animations.find((x) => x.id === target.animId);
      pixels = a?.frames[target.frameIndex]?.pixels;
      if (!pixels) return;
      useAnimationStore.setState({ selectedAnimationId: target.animId, selectedFrameIndex: target.frameIndex });
    }
    useEditorStore.getState().loadPixels(pixels && pixels.length ? pixels : createEmptyPixels());
    set({ target, tab: "draw" });
  },

  showToast: (text, ok = true) => {
    clearTimeout(toastTimer);
    set({ toast: { text, ok } });
    toastTimer = setTimeout(() => set({ toast: null }), 4000);
  },
}));
