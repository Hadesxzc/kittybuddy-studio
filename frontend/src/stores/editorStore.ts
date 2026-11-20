import { create } from "zustand";
import {
  OLED_WIDTH,
  OLED_HEIGHT,
  createEmptyPixels,
  clonePixels,
  type ToolType,
  type EditorMode,
  type ImageAdjustments,
} from "../types";

interface EditorStore {
  pixels: Uint8Array;
  undoStack: Uint8Array[];
  redoStack: Uint8Array[];
  tool: ToolType;
  editorMode: EditorMode;
  showGrid: boolean;
  pixelSize: number;
  zoom: number;
  cursorX: number;
  cursorY: number;
  isDrawing: boolean;
  lineStart: { x: number; y: number } | null;
  imageAdjustments: ImageAdjustments;
  generatedCode: string;

  setTool: (tool: ToolType) => void;
  setEditorMode: (mode: EditorMode) => void;
  toggleGrid: () => void;
  setZoom: (zoom: number) => void;
  setCursor: (x: number, y: number) => void;
  setDrawing: (drawing: boolean) => void;
  setLineStart: (start: { x: number; y: number } | null) => void;
  drawPixel: (x: number, y: number, value: number) => void;
  drawLine: (x0: number, y0: number, x1: number, y1: number, value: number) => void;
  drawRect: (x0: number, y0: number, x1: number, y1: number, filled: boolean, value: number) => void;
  drawCircle: (cx: number, cy: number, radius: number, value: number) => void;
  fillArea: (x: number, y: number, value: number) => void;
  clearCanvas: () => void;
  setPixels: (pixels: Uint8Array) => void;
  /** Replace the canvas without an undo step (switching what is being edited). */
  loadPixels: (pixels: Uint8Array) => void;
  undo: () => void;
  redo: () => void;
  pushUndo: () => void;
  setImageAdjustments: (adjustments: Partial<ImageAdjustments>) => void;
  setGeneratedCode: (code: string) => void;
}

function clone(p: Uint8Array): Uint8Array {
  return new Uint8Array(p);
}

export const useEditorStore = create<EditorStore>((set) => ({
  pixels: createEmptyPixels(),
  undoStack: [],
  redoStack: [],
  tool: "pencil",
  editorMode: "visual",
  showGrid: true,
  pixelSize: 6,
  zoom: 1,
  cursorX: 0,
  cursorY: 0,
  isDrawing: false,
  lineStart: null,
  imageAdjustments: {
    brightness: 0,
    contrast: 0,
    threshold: 128,
    dithering: "floyd-steinberg",
    invert: false,
    scale: 100,
    offsetX: 0,
    offsetY: 0,
  },
  generatedCode: "",

  setTool: (tool) => set({ tool }),
  setEditorMode: (editorMode) => set({ editorMode }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(4, zoom)) }),
  setCursor: (cursorX, cursorY) => set({ cursorX, cursorY }),
  setDrawing: (isDrawing) => set({ isDrawing }),
  setLineStart: (lineStart) => set({ lineStart }),

  pushUndo: () => set((s) => ({
    undoStack: [...s.undoStack.slice(-49), clone(s.pixels)],
    redoStack: [],
  })),

  drawPixel: (x, y, value) => {
    if (x < 0 || x >= OLED_WIDTH || y < 0 || y >= OLED_HEIGHT) return;
    set((s) => {
      const p = clone(s.pixels);
      p[y * OLED_WIDTH + x] = value;
      return { pixels: p };
    });
  },

  drawLine: (x0, y0, x1, y1, value) => {
    set((s) => {
      const p = clone(s.pixels);
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      let cx = x0, cy = y0;
      while (true) {
        if (cx >= 0 && cx < OLED_WIDTH && cy >= 0 && cy < OLED_HEIGHT) {
          p[cy * OLED_WIDTH + cx] = value;
        }
        if (cx === x1 && cy === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; cx += sx; }
        if (e2 < dx) { err += dx; cy += sy; }
      }
      return { pixels: p };
    });
  },

  drawRect: (x0, y0, x1, y1, filled, value) => {
    set((s) => {
      const p = clone(s.pixels);
      const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (filled || x === minX || x === maxX || y === minY || y === maxY) {
            if (x >= 0 && x < OLED_WIDTH && y >= 0 && y < OLED_HEIGHT) {
              p[y * OLED_WIDTH + x] = value;
            }
          }
        }
      }
      return { pixels: p };
    });
  },

  drawCircle: (cx, cy, radius, value) => {
    set((s) => {
      const p = clone(s.pixels);
      // Midpoint circle algorithm - outline only
      let x = radius, y = 0;
      let err = 0;
      const plot = (px: number, py: number) => {
        if (px >= 0 && px < OLED_WIDTH && py >= 0 && py < OLED_HEIGHT) {
          p[py * OLED_WIDTH + px] = value;
        }
      };
      while (x >= y) {
        plot(cx + x, cy + y); plot(cx + y, cy + x);
        plot(cx - y, cy + x); plot(cx - x, cy + y);
        plot(cx - x, cy - y); plot(cx - y, cy - x);
        plot(cx + y, cy - x); plot(cx + x, cy - y);
        if (err <= 0) { y += 1; err += 2 * y + 1; }
        if (err > 0) { x -= 1; err -= 2 * x + 1; }
      }
      return { pixels: p };
    });
  },

  fillArea: (x, y, value) => {
    if (x < 0 || x >= OLED_WIDTH || y < 0 || y >= OLED_HEIGHT) return;
    set((s) => {
      const p = clone(s.pixels);
      const target = p[y * OLED_WIDTH + x];
      if (target === value) return {};
      const stack: [number, number][] = [[x, y]];
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cx >= OLED_WIDTH || cy < 0 || cy >= OLED_HEIGHT) continue;
        const idx = cy * OLED_WIDTH + cx;
        if (p[idx] !== target) continue;
        p[idx] = value;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      return { pixels: p };
    });
  },

  clearCanvas: () => {
    set((s) => ({
      undoStack: [...s.undoStack.slice(-49), clone(s.pixels)],
      redoStack: [],
      pixels: createEmptyPixels(),
    }));
  },

  loadPixels: (pixels) => set({ pixels: clonePixels(pixels), undoStack: [], redoStack: [] }),

  setPixels: (pixels) => {
    set((s) => ({
      undoStack: [...s.undoStack.slice(-49), clone(s.pixels)],
      redoStack: [],
      pixels: clonePixels(pixels),
    }));
  },

  undo: () => {
    set((s) => {
      if (s.undoStack.length === 0) return {};
      const prev = s.undoStack[s.undoStack.length - 1];
      return {
        pixels: prev,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, clone(s.pixels)],
      };
    });
  },

  redo: () => {
    set((s) => {
      if (s.redoStack.length === 0) return {};
      const next = s.redoStack[s.redoStack.length - 1];
      return {
        pixels: next,
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, clone(s.pixels)],
      };
    });
  },

  setImageAdjustments: (adjustments) => set((s) => ({ imageAdjustments: { ...s.imageAdjustments, ...adjustments } })),
  setGeneratedCode: (generatedCode) => set({ generatedCode }),
}));
