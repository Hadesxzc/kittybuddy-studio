import type { AnimationPreset, AnimationFrame } from "../types";
import { createEmptyPixels, nanoid, OLED_WIDTH, OLED_HEIGHT } from "../types";

// Helper to build frames from simple pixel patterns
function makeFrame(label: string, duration: number, drawFn: (p: Uint8Array) => void): AnimationFrame {
  const pixels = createEmptyPixels();
  drawFn(pixels);
  return { id: nanoid(), pixels, duration, label };
}

// Draw helper functions for character faces
function setPx(p: Uint8Array, x: number, y: number, v = 1) {
  if (x >= 0 && x < OLED_WIDTH && y >= 0 && y < OLED_HEIGHT) p[y * OLED_WIDTH + x] = v;
}

function drawRect(p: Uint8Array, x: number, y: number, w: number, h: number) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPx(p, x + dx, y + dy);
}

function drawCircleOutline(p: Uint8Array, cx: number, cy: number, r: number) {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    setPx(p, Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)));
  }
}

function drawCircleFilled(p: Uint8Array, cx: number, cy: number, r: number) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) setPx(p, cx + x, cy + y);
}

// Character face base - cat-like face (inspired by Hello Kitty style)
function drawCatFace(p: Uint8Array) {
  // Head outline (rounded rectangle approx)
  drawCircleOutline(p, 64, 38, 24);

  // Ears (triangles)
  drawRect(p, 48, 12, 4, 4);
  drawRect(p, 49, 11, 2, 1);
  drawRect(p, 76, 12, 4, 4);
  drawRect(p, 77, 11, 2, 1);

  // Whiskers
  for (let i = 0; i < 3; i++) {
    // Left whiskers
    setPx(p, 40 - 8, 40 + i * 2);
    setPx(p, 40 - 9, 40 + i * 2);
    // Right whiskers
    setPx(p, 88 + 8, 40 + i * 2);
    setPx(p, 88 + 9, 40 + i * 2);
  }

  // Bow on left ear
  drawRect(p, 44, 14, 3, 3);
  drawRect(p, 43, 13, 1, 1);
  drawRect(p, 47, 13, 1, 1);
  drawRect(p, 44, 17, 3, 1);
}

// Draw eyes (open)
function drawEyesOpen(p: Uint8Array) {
  drawCircleFilled(p, 56, 36, 3);
  drawCircleFilled(p, 72, 36, 3);
}

// Draw eyes (closed/blink)
function drawEyesClosed(p: Uint8Array) {
  drawRect(p, 53, 36, 6, 1);
  drawRect(p, 69, 36, 6, 1);
}

// Draw eyes (happy ^_^)
function drawEyesHappy(p: Uint8Array) {
  // ^ shape eyes
  setPx(p, 54, 37); setPx(p, 55, 36); setPx(p, 56, 35); setPx(p, 57, 36); setPx(p, 58, 37);
  setPx(p, 70, 37); setPx(p, 71, 36); setPx(p, 72, 35); setPx(p, 73, 36); setPx(p, 74, 37);
}

// Draw eyes (surprised O_O)
function drawEyesSurprised(p: Uint8Array) {
  drawCircleOutline(p, 56, 36, 3);
  drawCircleOutline(p, 72, 36, 3);
  drawCircleFilled(p, 56, 36, 1);
  drawCircleFilled(p, 72, 36, 1);
}

// Draw eyes (sleeping - - -)
function drawEyesSleeping(p: Uint8Array) {
  drawRect(p, 53, 35, 7, 1);
  drawRect(p, 68, 35, 7, 1);
}

// Mouth: smile
function drawMouthSmile(p: Uint8Array) {
  setPx(p, 60, 46); setPx(p, 61, 47); setPx(p, 62, 48);
  setPx(p, 63, 48); setPx(p, 64, 47); setPx(p, 65, 46);
}

// Mouth: neutral
function drawMouthNeutral(p: Uint8Array) {
  drawRect(p, 61, 46, 6, 1);
}

// Mouth: open (laughing)
function drawMouthOpen(p: Uint8Array) {
  drawCircleFilled(p, 64, 47, 4);
  setPx(p, 60, 45, 0); setPx(p, 68, 45, 0);
}

// Mouth: sad
function drawMouthSad(p: Uint8Array) {
  setPx(p, 60, 48); setPx(p, 61, 47); setPx(p, 62, 46);
  setPx(p, 63, 46); setPx(p, 64, 47); setPx(p, 65, 48);
}

// Mouth: surprised (small o)
function drawMouthSurprised(p: Uint8Array) {
  drawCircleOutline(p, 64, 48, 2);
}

export const ANIMATION_PRESETS: AnimationPreset[] = [
  {
    id: "idle-blink",
    name: "Idle Blink",
    description: "Cat face with occasional blinking",
    category: "expression",
    loop: true,
    defaultDuration: 200,
    frames: [
      makeFrame("Eyes Open", 2000, (p) => { drawCatFace(p); drawEyesOpen(p); drawMouthNeutral(p); }),
      makeFrame("Blink", 150, (p) => { drawCatFace(p); drawEyesClosed(p); drawMouthNeutral(p); }),
      makeFrame("Eyes Open", 2000, (p) => { drawCatFace(p); drawEyesOpen(p); drawMouthNeutral(p); }),
    ],
  },
  {
    id: "smile",
    name: "Smile",
    description: "Happy smiling face",
    category: "expression",
    loop: false,
    defaultDuration: 300,
    frames: [
      makeFrame("Neutral", 200, (p) => { drawCatFace(p); drawEyesOpen(p); drawMouthNeutral(p); }),
      makeFrame("Smile", 1500, (p) => { drawCatFace(p); drawEyesOpen(p); drawMouthSmile(p); }),
      makeFrame("Fade", 300, (p) => { drawCatFace(p); drawEyesHappy(p); drawMouthSmile(p); }),
    ],
  },
  {
    id: "wink",
    name: "Wink",
    description: "One eye winks playfully",
    category: "expression",
    loop: false,
    defaultDuration: 400,
    frames: [
      makeFrame("Open", 300, (p) => { drawCatFace(p); drawEyesOpen(p); drawMouthNeutral(p); }),
      makeFrame("Wink", 800, (p) => {
        drawCatFace(p);
        drawCircleFilled(p, 56, 36, 3); // Left eye open
        drawRect(p, 69, 36, 6, 1); // Right eye closed
        drawMouthSmile(p);
      }),
      makeFrame("Open", 300, (p) => { drawCatFace(p); drawEyesOpen(p); drawMouthNeutral(p); }),
    ],
  },
  {
    id: "sleep",
    name: "Sleep",
    description: "Sleeping with Zzz",
    category: "expression",
    loop: true,
    defaultDuration: 1000,
    frames: [
      makeFrame("Sleep 1", 1500, (p) => {
        drawCatFace(p); drawEyesSleeping(p); drawMouthNeutral(p);
        setPx(p, 84, 18); setPx(p, 86, 16); setPx(p, 88, 14); setPx(p, 90, 12);
        setPx(p, 92, 10);
      }),
      makeFrame("Sleep 2", 1500, (p) => {
        drawCatFace(p); drawEyesSleeping(p); drawMouthNeutral(p);
        setPx(p, 88, 18); setPx(p, 90, 16); setPx(p, 92, 14);
      }),
    ],
  },
  {
    id: "surprised",
    name: "Surprised",
    description: "Wide eyes surprised expression",
    category: "expression",
    loop: false,
    defaultDuration: 500,
    frames: [
      makeFrame("Neutral", 200, (p) => { drawCatFace(p); drawEyesOpen(p); drawMouthNeutral(p); }),
      makeFrame("Surprised", 1200, (p) => { drawCatFace(p); drawEyesSurprised(p); drawMouthSurprised(p); }),
      makeFrame("Recover", 300, (p) => { drawCatFace(p); drawEyesOpen(p); drawMouthNeutral(p); }),
    ],
  },
  {
    id: "happy",
    name: "Happy",
    description: "Joyful happy face animation",
    category: "expression",
    loop: true,
    defaultDuration: 300,
    frames: [
      makeFrame("Happy 1", 400, (p) => { drawCatFace(p); drawEyesHappy(p); drawMouthSmile(p); }),
      makeFrame("Happy 2", 400, (p) => {
        drawCatFace(p); drawEyesOpen(p); drawMouthSmile(p);
        // Slight bounce on ears
        setPx(p, 48, 11); setPx(p, 76, 11);
      }),
    ],
  },
  {
    id: "curious",
    name: "Curious",
    description: "Tilting head curiously",
    category: "expression",
    loop: false,
    defaultDuration: 800,
    frames: [
      makeFrame("Normal", 300, (p) => { drawCatFace(p); drawEyesOpen(p); drawMouthNeutral(p); }),
      makeFrame("Tilt Right", 800, (p) => {
        // Shift face slightly right
        const tmp = createEmptyPixels();
        drawCatFace(tmp); drawEyesOpen(tmp); drawMouthNeutral(tmp);
        for (let y = 0; y < 64; y++)
          for (let x = 0; x < 128; x++)
            if (tmp[y * 128 + x] && x + 2 < 128) setPx(p, x + 2, y);
      }),
      makeFrame("Tilt Left", 800, (p) => {
        const tmp = createEmptyPixels();
        drawCatFace(tmp); drawEyesOpen(tmp); drawMouthNeutral(tmp);
        for (let y = 0; y < 64; y++)
          for (let x = 127; x >= 0; x--)
            if (tmp[y * 128 + x] && x - 2 >= 0) setPx(p, x - 2, y);
      }),
      makeFrame("Normal", 300, (p) => { drawCatFace(p); drawEyesOpen(p); drawMouthNeutral(p); }),
    ],
  },
  {
    id: "sad",
    name: "Sad",
    description: "Sad expression with frown",
    category: "expression",
    loop: false,
    defaultDuration: 1000,
    frames: [
      makeFrame("Sad", 2000, (p) => { drawCatFace(p); drawEyesOpen(p); drawMouthSad(p); }),
      makeFrame("Sadder", 1000, (p) => {
        drawCatFace(p); drawEyesClosed(p); drawMouthSad(p);
      }),
    ],
  },
  {
    id: "angry",
    name: "Angry",
    description: "Angry face with scowl",
    category: "expression",
    loop: false,
    defaultDuration: 500,
    frames: [
      makeFrame("Angry 1", 600, (p) => {
        drawCatFace(p);
        // Angry eyes (angled eyebrows)
        drawRect(p, 52, 31, 5, 1);
        drawRect(p, 71, 31, 5, 1);
        setPx(p, 52, 32); setPx(p, 71, 32);
        drawCircleFilled(p, 56, 36, 2);
        drawCircleFilled(p, 72, 36, 2);
        drawMouthSad(p);
      }),
      makeFrame("Angry 2", 600, (p) => {
        drawCatFace(p);
        drawRect(p, 52, 30, 5, 1);
        drawRect(p, 71, 30, 5, 1);
        drawCircleFilled(p, 56, 37, 2);
        drawCircleFilled(p, 72, 37, 2);
        drawMouthSad(p);
      }),
    ],
  },
  {
    id: "laughing",
    name: "Laughing",
    description: "Laughing with open mouth",
    category: "expression",
    loop: true,
    defaultDuration: 200,
    frames: [
      makeFrame("Laugh 1", 300, (p) => { drawCatFace(p); drawEyesHappy(p); drawMouthOpen(p); }),
      makeFrame("Laugh 2", 300, (p) => { drawCatFace(p); drawEyesClosed(p); drawMouthOpen(p); }),
      makeFrame("Laugh 3", 300, (p) => { drawCatFace(p); drawEyesHappy(p); drawMouthOpen(p); }),
      makeFrame("Laugh 4", 300, (p) => { drawCatFace(p); drawEyesClosed(p); drawMouthOpen(p); }),
    ],
  },
];
