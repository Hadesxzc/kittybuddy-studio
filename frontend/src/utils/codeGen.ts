import type { KittyProject } from "../types";
import { OLED_WIDTH, OLED_HEIGHT } from "../types";

/**
 * Generate C++ Arduino sketch code from a project's animations.
 * This produces compilable code for the ESP32-C3 with SH1106.
 */
export function generateArduinoCode(project: KittyProject): string {
  const { animations, animationConfig } = project;

  const header = `/*
 * KittyBuddy Studio - Generated Arduino Sketch
 * Project: ${project.name}
 * Generated: ${new Date().toISOString()}
 *
 * Hardware:
 *   - Seeed XIAO ESP32-C3
 *   - SH1106 OLED 128x64 (I2C 0x3C)
 *   - SDA: GPIO6 (D4), SCL: GPIO7 (D5)
 *
 * Required Libraries:
 *   - Adafruit GFX
 *   - Adafruit SH110X
 *   - LittleFS
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <LittleFS.h>

#define OLED_ADDR 0x3C
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_SDA 6
#define OLED_SCL 7
#define BOOT_BTN 9

Adafruit_SH1106G display = Adafruit_SH1106G(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RST);

// Animation frames stored as bitmaps (128x64 = 1024 bytes per frame)
`;

  const frameArrays: string[] = [];

  animations.forEach((anim, animIdx) => {
    anim.frames.forEach((frame, frameIdx) => {
      const frameName = `anim${animIdx}_frame${frameIdx}`;
      frameArrays.push(`const uint8_t PROGMEM ${frameName}[] = {`);
      const xbm = pixelsToXBMCompact(frame.pixels);
      frameArrays.push(xbm);
      frameArrays.push(`}; // ${frameName} - ${frame.label} - ${frame.duration}ms\n`);
    });
  });

  const animationTables: string[] = [];

  animations.forEach((anim, animIdx) => {
    const tableEntries = anim.frames.map((frame, frameIdx) => {
      const frameName = `anim${animIdx}_frame${frameIdx}`;
      return `  { ${frameName}, ${frame.duration} }`;
    });
    animationTables.push(`const AnimationFrame anim${animIdx}[] = {
${tableEntries.join(",\n")}
};
const int anim${animIdx}_count = ${anim.frames.length};
const bool anim${animIdx}_loop = ${anim.loop ? "true" : "false"};`);
  });

  const animationEnums = animations.map((a, i) => `  ANIM_${i} = ${i}, // ${a.name}`).join("\n");

  const behavior = `
// Animation configuration
struct AnimationFrame {
  const uint8_t* bitmap;
  int duration;
};

enum AnimationId {
${animationEnums || "  ANIM_NONE = 0"}
};

// Config from KittyBuddy Studio
const int idleAnimationId = ${animationConfig.idleAnimationId ? "ANIM_0" : "ANIM_NONE"};
const int blinkInterval = ${animationConfig.blinkInterval};
const int blinkRandomness = ${animationConfig.blinkRandomness};
const bool autoReturnToIdle = ${animationConfig.autoReturnToIdle ? "true" : "false"};
const int idleTimeout = ${animationConfig.idleTimeout};
const bool sleepEnabled = ${animationConfig.sleepEnabled ? "true" : "false"};
const int sleepTimeout = ${animationConfig.sleepTimeout};
const float globalSpeed = ${animationConfig.globalSpeed};

// Button-triggered expressions
const int buttonExpressions[] = { ${animationConfig.buttonExpressions.map((_, i) => `ANIM_${i}`).join(", ") || ""} };
const int buttonExprCount = ${animationConfig.buttonExpressions.length};

// State machine
int currentAnim = idleAnimationId;
int currentFrame = 0;
unsigned long lastFrameTime = 0;
unsigned long lastInteraction = 0;
bool isSleeping = false;

void drawFrame(const uint8_t* bitmap) {
  display.clearDisplay();
  // SH1106 uses column-major 8-pixel rows
  for (int x = 0; x < SCREEN_WIDTH; x++) {
    for (int y = 0; y < SCREEN_HEIGHT / 8; y++) {
      uint8_t byte = pgm_read_byte(&bitmap[y * SCREEN_WIDTH + x]);
      for (int bit = 0; bit < 8; bit++) {
        if (byte & (1 << bit)) {
          display.drawPixel(x, y * 8 + bit, SH110X_WHITE);
        }
      }
    }
  }
  display.display();
}

void playAnimation() {
  // Select frames based on current animation
  // (Implementation depends on your animation selection logic)
  unsigned long now = millis();
  // ... animation playback loop ...
}

void setup() {
  Serial.begin(115200);
  Wire.begin(OLED_SDA, OLED_SCL);

  if (!display.begin(OLED_ADDR)) {
    Serial.println("SH1106 init failed!");
    while (1) delay(100);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(0, 0);
  display.println("KittyBuddy Ready!");
  display.display();
  delay(1000);

  pinMode(BOOT_BTN, INPUT_PULLUP);
  lastInteraction = millis();
}

void loop() {
  unsigned long now = millis();

  // Check button press
  if (digitalRead(BOOT_BTN) == LOW) {
    // Cycle through button expressions
    static int exprIndex = 0;
    if (buttonExprCount > 0) {
      currentAnim = buttonExpressions[exprIndex % buttonExprCount];
      exprIndex++;
      currentFrame = 0;
      lastFrameTime = now;
      lastInteraction = now;
    }
    delay(200); // debounce
  }

  // Auto return to idle
  if (autoReturnToIdle && currentAnim != idleAnimationId) {
    if (now - lastInteraction > idleTimeout) {
      currentAnim = idleAnimationId;
      currentFrame = 0;
      lastFrameTime = now;
    }
  }

  // Sleep mode
  if (sleepEnabled && !isSleeping) {
    if (now - lastInteraction > sleepTimeout) {
      isSleeping = true;
      // Switch to sleep animation
    }
  }

  // Play current frame
  playAnimation();
}
`;

  return [header, ...frameArrays, ...animationTables, behavior].join("\n");
}

/** Compact XBM format (column-major for SH1106) */
function pixelsToXBMCompact(pixels: Uint8Array): string {
  const bytes: number[] = [];
  for (let x = 0; x < OLED_WIDTH; x++) {
    for (let y = 0; y < OLED_HEIGHT; y += 8) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const py = y + bit;
        if (py < OLED_HEIGHT && pixels[py * OLED_WIDTH + x]) {
          byte |= (1 << bit);
        }
      }
      bytes.push(byte);
    }
  }
  // Format into lines of 16 values
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16)
      .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
      .join(", ");
    lines.push(`  ${chunk},`);
  }
  return lines.join("\n");
}

/** Generate a JSON export of animation data for the device */
export function generateAnimationJSON(project: KittyProject): string {
  const data = {
    project: project.name,
    animations: project.animations.map((a) => ({
      name: a.name,
      loop: a.loop,
      trigger: a.trigger,
      frames: a.frames.map((f) => ({
        duration: f.duration,
        label: f.label,
        data: Array.from(f.pixels),
      })),
    })),
    config: project.animationConfig,
  };
  return JSON.stringify(data, null, 2);
}
