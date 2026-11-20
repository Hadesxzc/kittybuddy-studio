import type { AnimationConfig, CustomAnimation } from "../types";
import { OLED_WIDTH, OLED_HEIGHT } from "../types";

/** Device limits. Keep in sync with firmware/src/main.cpp */
export const MAX_TOTAL_FRAMES = 80;
export const MAX_FRAMES_PER_ANIM = 32;
export const MAX_ANIMATIONS = 24;
export const MAX_SYNC_BYTES = 128 * 1024;

export interface DevicePayload {
  v: 1;
  config: {
    idle: number; // index into animations, -1 = none
    buttons: number[]; // animation indices cycled by BOOT button
    autoReturn: boolean;
    idleTimeout: number;
    sleepEnabled: boolean;
    sleepTimeout: number;
    speed: number;
  };
  animations: {
    name: string;
    loop: boolean;
    frames: { d: number; b: string }[]; // d = duration ms, b = base64 page-format bitmap
  }[];
}

/**
 * Pack a 128x64 one-byte-per-pixel frame into the SH1106/SSD1306 page format
 * (1024 bytes, byte = 8 vertical pixels, LSB on top) and base64 encode it.
 */
export function packFrame(pixels: Uint8Array): string {
  const buf = new Uint8Array((OLED_WIDTH * OLED_HEIGHT) / 8);
  for (let y = 0; y < OLED_HEIGHT; y++) {
    for (let x = 0; x < OLED_WIDTH; x++) {
      if (pixels[y * OLED_WIDTH + x]) buf[(y >> 3) * OLED_WIDTH + x] |= 1 << (y & 7);
    }
  }
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

/** Inverse of packFrame: base64 page-format bitmap -> one byte per pixel. */
export function unpackFrame(b64: string): Uint8Array {
  const bin = atob(b64);
  const px = new Uint8Array(OLED_WIDTH * OLED_HEIGHT);
  for (let y = 0; y < OLED_HEIGHT; y++) {
    for (let x = 0; x < OLED_WIDTH; x++) {
      if (bin.charCodeAt((y >> 3) * OLED_WIDTH + x) & (1 << (y & 7))) px[y * OLED_WIDTH + x] = 1;
    }
  }
  return px;
}

export function buildDevicePayload(
  animations: CustomAnimation[],
  config: AnimationConfig,
): DevicePayload {
  const indexOf = (id: string | null) => animations.findIndex((a) => a.id === id);
  return {
    v: 1,
    config: {
      idle: indexOf(config.idleAnimationId),
      buttons: config.buttonExpressions.map(indexOf).filter((i) => i >= 0),
      autoReturn: config.autoReturnToIdle,
      idleTimeout: config.idleTimeout,
      sleepEnabled: config.sleepEnabled,
      sleepTimeout: config.sleepTimeout,
      speed: config.globalSpeed,
    },
    animations: animations.map((a) => ({
      name: a.name.slice(0, 23),
      loop: a.loop,
      frames: a.frames.map((f) => ({ d: Math.round(f.duration), b: packFrame(f.pixels) })),
    })),
  };
}

/** Returns an error message if the payload would be rejected by the device, else null. */
export function validatePayload(p: DevicePayload): string | null {
  if (p.animations.length === 0) return "Create at least one animation first.";
  if (p.animations.length > MAX_ANIMATIONS) return `Too many animations (max ${MAX_ANIMATIONS}).`;
  let total = 0;
  for (const a of p.animations) {
    if (a.frames.length > MAX_FRAMES_PER_ANIM)
      return `"${a.name}" has more than ${MAX_FRAMES_PER_ANIM} frames.`;
    total += a.frames.length;
  }
  if (total > MAX_TOTAL_FRAMES)
    return `${total} frames in total. The device holds at most ${MAX_TOTAL_FRAMES}.`;
  const size = new Blob([JSON.stringify(p)]).size;
  if (size > MAX_SYNC_BYTES) return `Payload is ${Math.round(size / 1024)} KB (max ${MAX_SYNC_BYTES / 1024} KB).`;
  return null;
}

/** Matches OTA_PASSWORD in firmware/platformio.ini. Change both together. */
export const DEFAULT_DEVICE_TOKEN = "kittybuddy-ota";

export function getDeviceToken(): string {
  try {
    return localStorage.getItem("otaPassword") || DEFAULT_DEVICE_TOKEN;
  } catch {
    return DEFAULT_DEVICE_TOKEN;
  }
}

export function setDeviceToken(token: string) {
  try {
    if (token && token !== DEFAULT_DEVICE_TOKEN) localStorage.setItem("otaPassword", token);
    else localStorage.removeItem("otaPassword");
  } catch { /* storage unavailable */ }
}

/** Token that the firmware compares against its OTA/admin password. */
export function authHeaders(): Record<string, string> {
  return { "X-KB-Token": getDeviceToken() };
}
