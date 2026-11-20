# 🐱 KittyBuddy Studio

A phone-friendly web app for designing what shows on a 128×64 OLED keychain, served straight from the device over Wi-Fi.

Hardware: **Seeed XIAO ESP32-C3** + **1.3" SH1106 OLED** (I2C).

## Features

- **Draw**: touch-friendly pixel canvas with pen, eraser, fill, line, box, circle, undo/redo, and photo-to-pixels import.
- **Text**: any number of text boxes in Press Start 2P (or a thin classic font). Drag to move, and drag the corner dot or pinch to resize. Phone emoji are converted to pixels with the phone's own emoji font.
- **Animations**: frame-by-frame editor with speed presets, built-in faces, and two recorded sets (Robo Eyes moods and Kitty faces).
- **Show on KittyBuddy**: sends the drawing plus all animations to the device in one tap. The **BOOT** button cycles through them, and one-shot animations return to the one on screen.
- **Device**: brightness, upside-down mode, Wi-Fi name/password, OTA firmware update, restart.

## Wiring

| OLED | XIAO ESP32-C3 |
|------|---------------|
| VCC  | 3V3 |
| GND  | GND |
| SDA  | D4 (GPIO6) |
| SCL  | D5 (GPIO7) |

I2C address `0x3C` (`0x3D` selectable).

## Build and flash

Requirements: Node.js 18+, PlatformIO.

```powershell
# 1. Build the web app into firmware/data (gzipped for LittleFS)
.\build-frontend.ps1

# 2. Flash the firmware and the web app (USB, first time)
cd firmware
pio run -t upload
pio run -t uploadfs
```

If no COM port appears, hold **BOOT**, tap **RESET** (or plug in while holding BOOT), then retry.

Before flashing, change `WIFI_AP_PASS` and `OTA_PASSWORD` in `firmware/platformio.ini`. The web app sends the OTA password with each sync; it defaults to `kittybuddy-ota` and can be changed under Device → Advanced.

## Use

1. Join the Wi-Fi **KittyBuddy-Studio** (default password `kittybuddy`).
2. Open **http://192.168.4.1**. The app connects automatically.
3. Draw or pick an animation, then tap **Show on KittyBuddy** / **Play**.

Uploading the web app (`uploadfs`) clears content stored on the device. Designs are kept in the browser, so just send again.

## Develop

```powershell
cd frontend
npm install
npm run dev
```

On `localhost` the app starts in simulation mode (nothing is sent). Turn it off under Device → Advanced and set the device address to test against real hardware.

## Layout

```
frontend/                React + TypeScript + Vite + Tailwind
  src/App.tsx            Tabs: Draw, Animations, Device
  src/pages/simple/      The three tabs
  src/components/simple/ Touch canvas, text layer editor, OLED preview
  src/utils/pixelText.ts Text layers, pixel fonts, emoji rasterizing
  src/utils/send.ts      Builds and sends the device payload
  src/data/              Built-in and recorded animations
firmware/
  src/main.cpp           Wi-Fi AP, web server, /api/sync, playback, OTA
  platformio.ini
build-frontend.ps1       Builds the frontend into firmware/data
```

## Device API

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/info` | Device info |
| POST | `/api/sync` | Upload animations + behavior (needs `X-KB-Token`) |
| POST | `/api/display/config` | Contrast, flip, I2C address |
| POST | `/api/wifi/config` | Access point name/password (applies after restart) |
| POST | `/api/ota/update` | Firmware `.bin` upload |
| POST | `/api/restart` | Restart |

## Credits

- [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by CodeMan38, SIL Open Font License 1.1 (via `@fontsource/press-start-2p`).
- Robo Eyes frames recorded from a sketch using [FluxGarage RoboEyes](https://github.com/FluxGarage/RoboEyes).
- The Kitty frames are recorded from a personal sketch and are for personal use only.
