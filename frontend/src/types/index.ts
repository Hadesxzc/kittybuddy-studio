// ============================================================
// KittyBuddy Studio - Core Type Definitions
// ============================================================

// --- Device Types ---
export type DeviceConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "uploading"
  | "synchronizing"
  | "error";

export interface DeviceInfo {
  deviceName: string;
  espModel: string;
  displayType: string;
  firmwareVersion: string;
  displayResolution: string;
  i2cAddress: string;
  availableStorage: number;
  totalStorage: number;
  uptime: number;
  wifiSSID: string;
  wifiSignal: number;
  lastSync: string | null;
  freeHeap: number;
}

export interface DeviceStatus {
  state: DeviceConnectionState;
  info: DeviceInfo | null;
  error: string | null;
  baseUrl: string;
  isSimulation: boolean;
}

// --- Editor Types ---
export type ToolType =
  | "pencil"
  | "eraser"
  | "fill"
  | "line"
  | "rectangle"
  | "circle"
  | "move"
  | "select";

export type EditorMode = "visual" | "code";

export interface PixelData {
  width: number;
  height: number;
  pixels: Uint8Array; // 0 = OFF, 1 = ON
}

export interface ImageAdjustments {
  brightness: number;   // -100 to 100
  contrast: number;     // -100 to 100
  threshold: number;     // 0 to 255
  dithering: "none" | "floyd-steinberg" | "ordered";
  invert: boolean;
  scale: number;         // percentage
  offsetX: number;
  offsetY: number;
}

// --- Animation Types ---
export interface AnimationFrame {
  id: string;
  pixels: Uint8Array; // 128*64 = 8192 bytes
  duration: number;   // milliseconds
  label: string;
}

export type AnimationTrigger =
  | "idle"
  | "boot"
  | "button_press"
  | "timer"
  | "sleep"
  | "random";

export interface AnimationPreset {
  id: string;
  name: string;
  description: string;
  category: "expression" | "action" | "system";
  frames: AnimationFrame[];
  loop: boolean;
  defaultDuration: number;
}

export interface AnimationConfig {
  idleAnimationId: string | null;
  blinkInterval: number;      // ms between blinks
  blinkRandomness: number;     // 0-100 percent variance
  buttonExpressions: string[]; // animation preset IDs cycled on button press
  autoReturnToIdle: boolean;
  idleTimeout: number;          // ms before returning to idle
  sleepEnabled: boolean;
  sleepTimeout: number;         // ms before sleep mode
  globalSpeed: number;          // 0.5x to 2x multiplier
}

export interface CustomAnimation {
  id: string;
  name: string;
  description: string;
  frames: AnimationFrame[];
  loop: boolean;
  trigger: AnimationTrigger;
  createdAt: number;
  updatedAt: number;
}

// --- Project Types ---
export interface KittyProject {
  id: string;
  name: string;
  description: string;
  characterDesign: CharacterDesign;
  animations: CustomAnimation[];
  animationConfig: AnimationConfig;
  currentFramePixels: Uint8Array;
  createdAt: number;
  updatedAt: number;
  thumbnail: string | null; // base64 data URL
}

export interface CharacterDesign {
  id: string;
  name: string;
  pixels: Uint8Array; // full 128x64 character
  elements: CharacterElement[];
}

export interface CharacterElement {
  id: string;
  type: "eyes" | "mouth" | "whiskers" | "bow" | "accessory" | "custom";
  name: string;
  pixels: Uint8Array;  // element-only bitmap (128x64, mostly transparent)
  x: number;
  y: number;
  visible: boolean;
}

// --- API Types ---
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SyncPayload {
  projects: KittyProject[];
  activeProjectId: string;
  animationConfig: AnimationConfig;
  displaySettings: DisplaySettings;
}

export interface DisplaySettings {
  i2cAddress: string;
  flipHorizontal: boolean;
  flipVertical: boolean;
  contrast: number;
  brightness: number;
  invertDisplay: boolean;
}

export interface FirmwareUploadProgress {
  phase: "uploading" | "writing" | "verifying" | "done" | "error";
  progress: number; // 0-100
  message: string;
}

// --- Settings ---
export interface AppSettings {
  baseUrl: string;
  simulationMode: boolean;
  autoConnect: boolean;
  theme: "dark";
  editorMode: EditorMode;
  gridSize: number;
  showGrid: boolean;
  pixelSize: number;
  displaySettings: DisplaySettings;
  wifiSSID: string;
  wifiPassword: string;
  otaPassword: string;
}

// --- Constants ---
export const OLED_WIDTH = 128;
export const OLED_HEIGHT = 64;
export const OLED_PIXELS = OLED_WIDTH * OLED_HEIGHT;

export function createEmptyPixels(): Uint8Array {
  return new Uint8Array(OLED_PIXELS);
}

export function createEmptyFrame(label = "Frame"): AnimationFrame {
  return {
    id: nanoid(),
    pixels: createEmptyPixels(),
    duration: 200,
    label,
  };
}

export function clonePixels(src: Uint8Array): Uint8Array {
  return new Uint8Array(src);
}

export function getPixel(pixels: Uint8Array, x: number, y: number): number {
  if (x < 0 || x >= OLED_WIDTH || y < 0 || y >= OLED_HEIGHT) return 0;
  return pixels[y * OLED_WIDTH + x];
}

export function setPixel(
  pixels: Uint8Array,
  x: number,
  y: number,
  value: number,
): void {
  if (x < 0 || x >= OLED_WIDTH || y < 0 || y >= OLED_HEIGHT) return;
  pixels[y * OLED_WIDTH + x] = value;
}

// nanoid needs to be imported - re-export for convenience
import { nanoid } from "nanoid";
export { nanoid };
