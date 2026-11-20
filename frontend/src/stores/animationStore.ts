import { create } from "zustand";
import type {
  AnimationFrame,
  AnimationConfig,
  CustomAnimation,
  AnimationPreset,
} from "../types";
import { createEmptyPixels, clonePixels, nanoid } from "../types";

interface AnimationStore {
  animations: CustomAnimation[];
  selectedAnimationId: string | null;
  selectedFrameIndex: number;
  config: AnimationConfig;
  isPlaying: boolean;
  playbackFrame: number;
  lastFrameTime: number;
  presets: AnimationPreset[];

  createAnimation: (name: string, description?: string) => string;
  deleteAnimation: (id: string) => void;
  selectAnimation: (id: string | null) => void;
  renameAnimation: (id: string, name: string) => void;

  addFrame: (animationId: string) => void;
  deleteFrame: (animationId: string, frameIndex: number) => void;
  duplicateFrame: (animationId: string, frameIndex: number) => void;
  reorderFrames: (animationId: string, fromIdx: number, toIdx: number) => void;
  setFrameDuration: (animationId: string, frameIndex: number, duration: number) => void;
  setFrameLabel: (animationId: string, frameIndex: number, label: string) => void;
  setFramePixels: (animationId: string, frameIndex: number, pixels: Uint8Array) => void;
  copyFrameTo: (animationId: string, fromIdx: number, toIdx: number) => void;
  selectFrame: (index: number) => void;

  setConfig: (config: Partial<AnimationConfig>) => void;
  setLoop: (animationId: string, loop: boolean) => void;

  play: () => void;
  pause: () => void;
  stop: () => void;
  tick: (now: number) => void;

  loadPreset: (preset: AnimationPreset) => string;
  loadFromProject: (animations: CustomAnimation[], config: AnimationConfig) => void;
}

function createFrame(label = "Frame", pixels?: Uint8Array): AnimationFrame {
  return {
    id: nanoid(),
    pixels: pixels ? clonePixels(pixels) : createEmptyPixels(),
    duration: 200,
    label,
  };
}

export const useAnimationStore = create<AnimationStore>((set, get) => ({
  animations: [],
  selectedAnimationId: null,
  selectedFrameIndex: 0,
  config: {
    idleAnimationId: null,
    blinkInterval: 3000,
    blinkRandomness: 30,
    buttonExpressions: [],
    autoReturnToIdle: true,
    idleTimeout: 5000,
    sleepEnabled: false,
    sleepTimeout: 30000,
    globalSpeed: 1,
  },
  isPlaying: false,
  playbackFrame: 0,
  lastFrameTime: 0,
  presets: [],

  createAnimation: (name, description = "") => {
    const id = nanoid();
    const anim: CustomAnimation = {
      id,
      name,
      description,
      frames: [createFrame("Frame 1")],
      loop: true,
      trigger: "idle",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({
      animations: [...s.animations, anim],
      selectedAnimationId: id,
      selectedFrameIndex: 0,
    }));
    return id;
  },

  deleteAnimation: (id) => set((s) => ({
    animations: s.animations.filter((a) => a.id !== id),
    selectedAnimationId: s.selectedAnimationId === id ? null : s.selectedAnimationId,
  })),

  selectAnimation: (id) => set({ selectedAnimationId: id, selectedFrameIndex: 0, isPlaying: false }),

  renameAnimation: (id, name) => set((s) => ({
    animations: s.animations.map((a) => a.id === id ? { ...a, name, updatedAt: Date.now() } : a),
  })),

  addFrame: (animationId) => set((s) => ({
    animations: s.animations.map((a) => {
      if (a.id !== animationId) return a;
      const newFrame = createFrame(`Frame ${a.frames.length + 1}`);
      return { ...a, frames: [...a.frames, newFrame], updatedAt: Date.now() };
    }),
    selectedFrameIndex: get().selectedAnimationId === animationId
      ? get().animations.find((a) => a.id === animationId)?.frames.length ?? 0
      : get().selectedFrameIndex,
  })),

  deleteFrame: (animationId, frameIndex) => set((s) => ({
    animations: s.animations.map((a) => {
      if (a.id !== animationId) return a;
      if (a.frames.length <= 1) return a;
      return { ...a, frames: a.frames.filter((_, i) => i !== frameIndex), updatedAt: Date.now() };
    }),
    selectedFrameIndex: Math.max(0, get().selectedFrameIndex - 1),
  })),

  duplicateFrame: (animationId, frameIndex) => set((s) => ({
    animations: s.animations.map((a) => {
      if (a.id !== animationId) return a;
      const frame = a.frames[frameIndex];
      if (!frame) return a;
      const dup: AnimationFrame = {
        id: nanoid(),
        pixels: clonePixels(frame.pixels),
        duration: frame.duration,
        label: `${frame.label} (copy)`,
      };
      const frames = [...a.frames];
      frames.splice(frameIndex + 1, 0, dup);
      return { ...a, frames, updatedAt: Date.now() };
    }),
  })),

  reorderFrames: (animationId, fromIdx, toIdx) => set((s) => ({
    animations: s.animations.map((a) => {
      if (a.id !== animationId) return a;
      const frames = [...a.frames];
      const [moved] = frames.splice(fromIdx, 1);
      frames.splice(toIdx, 0, moved);
      return { ...a, frames, updatedAt: Date.now() };
    }),
    selectedFrameIndex: toIdx,
  })),

  setFrameDuration: (animationId, frameIndex, duration) => set((s) => ({
    animations: s.animations.map((a) => {
      if (a.id !== animationId) return a;
      const frames = [...a.frames];
      if (frames[frameIndex]) frames[frameIndex] = { ...frames[frameIndex], duration };
      return { ...a, frames, updatedAt: Date.now() };
    }),
  })),

  setFrameLabel: (animationId, frameIndex, label) => set((s) => ({
    animations: s.animations.map((a) => {
      if (a.id !== animationId) return a;
      const frames = [...a.frames];
      if (frames[frameIndex]) frames[frameIndex] = { ...frames[frameIndex], label };
      return { ...a, frames, updatedAt: Date.now() };
    }),
  })),

  setFramePixels: (animationId, frameIndex, pixels) => set((s) => ({
    animations: s.animations.map((a) => {
      if (a.id !== animationId) return a;
      const frames = [...a.frames];
      if (frames[frameIndex]) frames[frameIndex] = { ...frames[frameIndex], pixels: clonePixels(pixels) };
      return { ...a, frames, updatedAt: Date.now() };
    }),
  })),

  copyFrameTo: (animationId, fromIdx, toIdx) => set((s) => ({
    animations: s.animations.map((a) => {
      if (a.id !== animationId) return a;
      const src = a.frames[fromIdx];
      if (!src) return a;
      const frames = [...a.frames];
      if (frames[toIdx]) frames[toIdx] = { ...frames[toIdx], pixels: clonePixels(src.pixels) };
      return { ...a, frames, updatedAt: Date.now() };
    }),
  })),

  selectFrame: (index) => set({ selectedFrameIndex: index, isPlaying: false }),

  setConfig: (config) => set((s) => ({ config: { ...s.config, ...config } })),

  setLoop: (animationId, loop) => set((s) => ({
    animations: s.animations.map((a) => a.id === animationId ? { ...a, loop, updatedAt: Date.now() } : a),
  })),

  play: () => set({ isPlaying: true, lastFrameTime: performance.now() }),
  pause: () => set({ isPlaying: false }),
  stop: () => set({ isPlaying: false, playbackFrame: 0 }),

  tick: (now) => {
    const s = get();
    if (!s.isPlaying || !s.selectedAnimationId) return;
    const anim = s.animations.find((a) => a.id === s.selectedAnimationId);
    if (!anim || anim.frames.length === 0) return;
    const frame = anim.frames[s.playbackFrame];
    if (!frame) return;
    const duration = frame.duration / s.config.globalSpeed;
    if (now - s.lastFrameTime >= duration) {
      let next = s.playbackFrame + 1;
      if (next >= anim.frames.length) {
        next = anim.loop ? 0 : s.playbackFrame;
        if (!anim.loop) {
          set({ isPlaying: false });
          return;
        }
      }
      set({ playbackFrame: next, lastFrameTime: now });
    }
  },

  loadFromProject: (animations, config) =>
    set({
      animations: animations.map((a) => ({
        ...a,
        frames: a.frames.map((f) => ({ ...f, pixels: clonePixels(f.pixels) })),
      })),
      config: { ...config },
      selectedAnimationId: animations[0]?.id ?? null,
      selectedFrameIndex: 0,
      isPlaying: false,
      playbackFrame: 0,
    }),

  loadPreset: (preset) => {
    const id = nanoid();
    const anim: CustomAnimation = {
      id,
      name: preset.name,
      description: preset.description,
      frames: preset.frames.map((f) => ({
        id: nanoid(),
        pixels: clonePixels(f.pixels),
        duration: f.duration,
        label: f.label,
      })),
      loop: preset.loop,
      trigger: "idle",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({
      animations: [...s.animations, anim],
      selectedAnimationId: id,
      selectedFrameIndex: 0,
    }));
    return id;
  },
}));
