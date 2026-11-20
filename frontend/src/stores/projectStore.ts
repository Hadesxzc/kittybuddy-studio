import { create } from "zustand";
import { openDB, type IDBPDatabase } from "idb";
import type { KittyProject, AnimationConfig, DisplaySettings } from "../types";
import { createEmptyPixels, clonePixels, nanoid } from "../types";

const DB_NAME = "kittybuddy-studio";
const DB_VERSION = 1;
const STORE_NAME = "projects";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

function defaultConfig(): AnimationConfig {
  return {
    idleAnimationId: null,
    blinkInterval: 3000,
    blinkRandomness: 30,
    buttonExpressions: [],
    autoReturnToIdle: true,
    idleTimeout: 5000,
    sleepEnabled: false,
    sleepTimeout: 30000,
    globalSpeed: 1,
  };
}

function defaultDisplaySettings(): DisplaySettings {
  return {
    i2cAddress: "0x3C",
    flipHorizontal: false,
    flipVertical: false,
    contrast: 128,
    brightness: 255,
    invertDisplay: false,
  };
}

export function createNewProject(name: string, description = ""): KittyProject {
  return {
    id: nanoid(),
    name,
    description,
    characterDesign: {
      id: nanoid(),
      name: name,
      pixels: createEmptyPixels(),
      elements: [],
    },
    animations: [],
    animationConfig: defaultConfig(),
    currentFramePixels: createEmptyPixels(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    thumbnail: null,
  };
}

interface ProjectStore {
  projects: KittyProject[];
  activeProjectId: string | null;
  isLoading: boolean;
  displaySettings: DisplaySettings;

  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<string>;
  renameProject: (id: string, name: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<string | null>;
  deleteProject: (id: string) => Promise<void>;
  saveProject: (project: KittyProject) => Promise<void>;
  getActiveProject: () => KittyProject | null;
  setActiveProject: (id: string) => Promise<void>;
  updateActiveProject: (updater: (p: KittyProject) => KittyProject) => Promise<void>;
  exportProject: (id: string) => string | null;
  importProject: (json: string) => Promise<boolean>;
  exportFrame: (pixels: Uint8Array, label?: string) => string;
  setDisplaySettings: (settings: Partial<DisplaySettings>) => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  isLoading: true,
  displaySettings: defaultDisplaySettings(),

  loadProjects: async () => {
    const db = await getDB();
    const all = await db.getAll(STORE_NAME);
    const projects = all as KittyProject[];
    set({
      projects,
      isLoading: false,
      activeProjectId: projects.length > 0 ? projects[0].id : null,
    });
    // First run: create a project so edits are always persisted
    if (projects.length === 0) await get().createProject("My KittyBuddy");
  },

  createProject: async (name, description = "") => {
    const project = createNewProject(name, description);
    const db = await getDB();
    await db.put(STORE_NAME, project);
    set((s) => ({
      projects: [...s.projects, project],
      activeProjectId: project.id,
    }));
    return project.id;
  },

  renameProject: async (id, name) => {
    const projects = get().projects.map((p) =>
      p.id === id ? { ...p, name, updatedAt: Date.now() } : p,
    );
    set({ projects });
    const db = await getDB();
    const existing = await db.get(STORE_NAME, id);
    if (existing) {
      await db.put(STORE_NAME, { ...existing, name, updatedAt: Date.now() });
    }
  },

  duplicateProject: async (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return null;
    const newId = nanoid();
    const copy: KittyProject = {
      ...project,
      id: newId,
      name: `${project.name} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      characterDesign: { ...project.characterDesign, id: nanoid() },
      animations: project.animations.map((a) => ({
        ...a,
        id: nanoid(),
        frames: a.frames.map((f) => ({ ...f, id: nanoid(), pixels: clonePixels(f.pixels) })),
      })),
    };
    const db = await getDB();
    await db.put(STORE_NAME, copy);
    set((s) => ({ projects: [...s.projects, copy] }));
    return newId;
  },

  deleteProject: async (id) => {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id
        ? (s.projects.find((p) => p.id !== id)?.id ?? null)
        : s.activeProjectId,
    }));
  },

  saveProject: async (project) => {
    const db = await getDB();
    const updated = { ...project, updatedAt: Date.now() };
    await db.put(STORE_NAME, updated);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === project.id ? updated : p)),
    }));
  },

  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find((p) => p.id === activeProjectId) ?? null;
  },

  setActiveProject: async (id) => {
    set({ activeProjectId: id });
  },

  updateActiveProject: async (updater) => {
    const { projects, activeProjectId } = get();
    if (!activeProjectId) return;
    const project = projects.find((p) => p.id === activeProjectId);
    if (!project) return;
    const updated = updater(project);
    const db = await getDB();
    await db.put(STORE_NAME, { ...updated, updatedAt: Date.now() });
    set((s) => ({
      projects: s.projects.map((p) => (p.id === activeProjectId ? { ...updated, updatedAt: Date.now() } : p)),
    }));
  },

  exportProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return null;
    const exportable = {
      ...project,
      _meta: {
        app: "KittyBuddy Studio",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
      },
      characterDesign: {
        ...project.characterDesign,
        pixels: Array.from(project.characterDesign.pixels),
      },
      animations: project.animations.map((a) => ({
        ...a,
        frames: a.frames.map((f) => ({ ...f, pixels: Array.from(f.pixels) })),
      })),
      currentFramePixels: Array.from(project.currentFramePixels),
    };
    return JSON.stringify(exportable, null, 2);
  },

  importProject: async (json) => {
    try {
      const data = JSON.parse(json);
      const id = nanoid();
      const project: KittyProject = {
        id,
        name: data.name ?? "Imported Project",
        description: data.description ?? "",
        characterDesign: {
          id: nanoid(),
          name: data.characterDesign?.name ?? "Imported",
          pixels: new Uint8Array(data.characterDesign?.pixels ?? data.characterDesign?.pixels?.length ? Array.from(data.characterDesign.pixels) : []),
          elements: data.characterDesign?.elements ?? [],
        },
        animations: (data.animations ?? []).map((a: { frames: { pixels: number[] }[] }) => ({
          ...a,
          id: nanoid(),
          frames: a.frames.map((f: { pixels: number[] }) => ({
            ...f,
            id: nanoid(),
            pixels: new Uint8Array(f.pixels),
          })),
        })),
        animationConfig: data.animationConfig ?? defaultConfig(),
        currentFramePixels: new Uint8Array(data.currentFramePixels ?? []),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        thumbnail: data.thumbnail ?? null,
      };
      const db = await getDB();
      await db.put(STORE_NAME, project);
      set((s) => ({ projects: [...s.projects, project] }));
      return true;
    } catch (err) {
      console.error("Import failed:", err);
      return false;
    }
  },

  exportFrame: (pixels, _label = "frame") => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = "#fff";
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) {
        if (pixels[y * 128 + x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas.toDataURL("image/png");
  },

  setDisplaySettings: (settings) => set((s) => ({ displaySettings: { ...s.displaySettings, ...settings } })),
}));
