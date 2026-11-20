import type { ImageAdjustments } from "../types";
import { OLED_WIDTH, OLED_HEIGHT } from "../types";

/**
 * Process an image file and convert it to 128x64 monochrome pixels.
 * Supports brightness, contrast, threshold, dithering, invert, scale, offset.
 */
export async function processImage(
  file: File,
  adjustments: ImageAdjustments,
): Promise<Uint8Array> {
  const bitmap = await loadImageBitmap(file);
  return bitmapToPixels(bitmap, adjustments);
}

/** Process an image element (for drag-and-drop or pasted images) */
export async function processImageElement(
  img: HTMLImageElement,
  adjustments: ImageAdjustments,
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return imageDataToPixels(imageData, adjustments);
}

function loadImageBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

function bitmapToPixels(
  bitmap: ImageBitmap,
  adjustments: ImageAdjustments,
): Uint8Array {
  // Step 1: Scale and position the source image onto a 128x64 canvas
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = OLED_WIDTH;
  sourceCanvas.height = OLED_HEIGHT;
  const srcCtx = sourceCanvas.getContext("2d")!;
  srcCtx.fillStyle = "#000";
  srcCtx.fillRect(0, 0, OLED_WIDTH, OLED_HEIGHT);

  const scale = adjustments.scale / 100;
  const dw = bitmap.width * scale;
  const dh = bitmap.height * scale;
  const dx = (OLED_WIDTH - dw) / 2 + adjustments.offsetX;
  const dy = (OLED_HEIGHT - dh) / 2 + adjustments.offsetY;

  srcCtx.drawImage(bitmap, dx, dy, dw, dh);
  const imageData = srcCtx.getImageData(0, 0, OLED_WIDTH, OLED_HEIGHT);
  return imageDataToPixels(imageData, adjustments);
}

function imageDataToPixels(
  imageData: ImageData,
  adjustments: ImageAdjustments,
): Uint8Array {
  const { data, width, height } = imageData;
  const pixels = new Uint8Array(OLED_WIDTH * OLED_HEIGHT);

  // Step 2: Apply brightness and contrast adjustments
  const brightness = adjustments.brightness * 2.55;
  const contrastFactor = (259 * (adjustments.contrast + 255)) / (255 * (259 - adjustments.contrast));

  // Convert to grayscale values
  const gray: number[] = new Array(width * height);
  for (let i = 0; i < width * height; i++) {
    let r = data[i * 4];
    let g = data[i * 4 + 1];
    let b = data[i * 4 + 2];
    let a = data[i * 4 + 3];

    // Handle transparency - make transparent pixels black
    if (a < 128) {
      gray[i] = 0;
      continue;
    }

    // Grayscale (luminance)
    let val = 0.299 * r + 0.587 * g + 0.114 * b;

    // Brightness
    val += brightness;

    // Contrast
    val = contrastFactor * (val - 128) + 128;

    val = Math.max(0, Math.min(255, val));
    gray[i] = val;
  }

  // Step 3: Apply dithering or threshold
  if (adjustments.dithering === "floyd-steinberg") {
    floydSteinbergDither(gray, width, height, adjustments.threshold, adjustments.invert, pixels);
  } else if (adjustments.dithering === "ordered") {
    orderedDither(gray, width, height, adjustments.invert, pixels);
  } else {
    // Simple threshold
    for (let i = 0; i < width * height; i++) {
      const on = gray[i] > adjustments.threshold;
      pixels[i] = (adjustments.invert ? !on : on) ? 1 : 0;
    }
  }

  return pixels;
}

function floydSteinbergDither(
  gray: number[],
  width: number,
  height: number,
  threshold: number,
  invert: boolean,
  out: Uint8Array,
): void {
  // Work on a copy
  const g = gray.slice();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = g[idx];
      const on = oldVal > threshold;
      const newVal = on ? 255 : 0;
      g[idx] = newVal;

      out[idx] = (invert ? !on : on) ? 1 : 0;

      const error = oldVal - newVal;

      // Distribute error
      if (x + 1 < width) g[idx + 1] += (error * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) g[(y + 1) * width + x - 1] += (error * 3) / 16;
        g[(y + 1) * width + x] += (error * 5) / 16;
        if (x + 1 < width) g[(y + 1) * width + x + 1] += (error * 1) / 16;
      }
    }
  }
}

function orderedDither(
  gray: number[],
  width: number,
  height: number,
  invert: boolean,
  out: Uint8Array,
): void {
  // 4x4 Bayer matrix
  const bayer = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
  ];
  const bayerSize = 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const threshold = (bayer[(y % bayerSize) * bayerSize + (x % bayerSize)] / 16) * 255;
      const on = gray[idx] > threshold;
      out[idx] = (invert ? !on : on) ? 1 : 0;
    }
  }
}

/** Extract frames from a GIF */
export async function extractGifFrames(
  file: File,
  adjustments: ImageAdjustments,
): Promise<Uint8Array[]> {
  // Use the Image decoder API or fallback to canvas
  // For simplicity, decode as single image first
  // Full GIF frame extraction requires a library like gifuct-js
  const pixels = await processImage(file, adjustments);
  return [pixels];
}

/** Convert pixels to XBM format for C/C++ */
export function pixelsToXBM(pixels: Uint8Array, width = 128, height = 64): string {
  const bytes: number[] = [];
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const py = y + bit;
        if (py < height) {
          if (pixels[py * width + x]) byte |= (1 << bit);
        }
      }
      bytes.push(byte);
    }
  }
  return bytes.map((b) => `0x${b.toString(16).padStart(2, "0")}`).join(", ");
}

/** Convert pixels to a canvas data URL for preview/thumbnail */
export function pixelsToDataURL(
  pixels: Uint8Array,
  width = OLED_WIDTH,
  height = OLED_HEIGHT,
  scale = 1,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#e2e8f0";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[y * width + x]) {
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
  return canvas.toDataURL("image/png");
}
