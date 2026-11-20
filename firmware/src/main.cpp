/*
 * KittyBuddy Studio firmware
 * Seeed XIAO ESP32-C3 + SH1106 128x64 OLED (I2C, SDA=GPIO6, SCL=GPIO7)
 *
 * - Wi-Fi access point, serves the web app from LittleFS (works offline)
 * - REST API + WebSocket status
 * - Animation content stored in /anim.json (previous copy kept as /anim.bak)
 * - OTA firmware upload, protected by the X-KB-Token header
 *
 * Wire format of /api/sync is documented in frontend/src/utils/deviceProtocol.ts
 */

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <LittleFS.h>
#include <Update.h>
#include <ESPAsyncWebServer.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <ArduinoJson.h>
#include "mbedtls/base64.h"

#define FW_VERSION "1.1.0"

#define SCREEN_W 128
#define SCREEN_H 64
#define FRAME_BYTES (SCREEN_W * SCREEN_H / 8)
#define OLED_SDA 6
#define OLED_SCL 7
#define BOOT_BTN 9

#define MAX_ANIMS 24
#define MAX_FRAMES 32
#define MAX_TOTAL_FRAMES 80
#define MAX_SYNC_BYTES (128 * 1024)

#ifndef WIFI_AP_SSID
#define WIFI_AP_SSID "KittyBuddy-Studio"
#endif
#ifndef WIFI_AP_PASS
#define WIFI_AP_PASS "kittybuddy"
#endif
#ifndef OTA_PASSWORD
#define OTA_PASSWORD "kittybuddy-ota"
#endif

// ---------------------------------------------------------------- types
struct Frame { uint8_t* bmp; uint16_t dur; };
struct Anim { char name[24]; bool loop; uint8_t n; Frame* frames; };

struct Behavior {
  int idle = -1;
  uint8_t buttons[16];
  uint8_t nButtons = 0;
  bool autoReturn = true;
  uint32_t idleTimeout = 5000;
  bool sleepEnabled = false;
  uint32_t sleepTimeout = 30000;
  float speed = 1.0f;
};

struct DisplayCfg { uint8_t contrast = 128; bool flipH = false; bool flipV = false; bool invert = false; uint8_t addr = 0x3C; };

// ---------------------------------------------------------------- state
Adafruit_SH1106G display(SCREEN_W, SCREEN_H, &Wire, -1);
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
SemaphoreHandle_t animMutex;

Anim* anims = nullptr;
int animCount = 0;
Behavior beh;
DisplayCfg dcfg;

int curAnim = 0, curFrame = 0;
bool needDraw = true, sleeping = false, dispDirty = false, emptyDrawn = false;
uint32_t frameStart = 0, lastInteraction = 0, restartAt = 0;
uint8_t btnIdx = 0;

char apSsid[33] = WIFI_AP_SSID;
char apPass[64] = WIFI_AP_PASS;
String token = OTA_PASSWORD;

// sync upload state
File syncFile;
bool syncBusy = false;
String syncErr;

// OTA upload state
bool otaBegun = false, otaOk = false;
String otaErr;

// ---------------------------------------------------------------- helpers
static void reply(AsyncWebServerRequest* r, int code, const char* msg, bool ok = false) {
  JsonDocument d;
  d["success"] = ok;
  d[ok ? "message" : "error"] = msg;
  String s;
  serializeJson(d, s);
  r->send(code, "application/json", s);
}

static bool authed(AsyncWebServerRequest* r) {
  const AsyncWebHeader* h = r->getHeader("X-KB-Token");
  return h && token.length() > 0 && h->value() == token;
}

static bool readJsonFile(const char* path, JsonDocument& doc) {
  File f = LittleFS.open(path, "r");
  if (!f) return false;
  DeserializationError e = deserializeJson(doc, f);
  f.close();
  return !e;
}

static void writeJsonFile(const char* path, JsonDocument& doc) {
  File f = LittleFS.open(path, "w");
  if (!f) return;
  serializeJson(doc, f);
  f.close();
}

// ---------------------------------------------------------------- display
static void drawBmp(const uint8_t* b) {
  // display() only pushes the library's dirty window, and writing the buffer
  // directly doesn't mark it. clearDisplay() marks the whole screen dirty.
  display.clearDisplay();
  uint8_t* buf = display.getBuffer();
  if (!dcfg.flipH && !dcfg.flipV) {
    memcpy(buf, b, FRAME_BYTES);
  } else {
    for (int y = 0; y < SCREEN_H; y++) {
      for (int x = 0; x < SCREEN_W; x++) {
        if (b[(y >> 3) * SCREEN_W + x] & (1 << (y & 7))) {
          int dx = dcfg.flipH ? SCREEN_W - 1 - x : x;
          int dy = dcfg.flipV ? SCREEN_H - 1 - y : y;
          buf[(dy >> 3) * SCREEN_W + dx] |= 1 << (dy & 7);
        }
      }
    }
  }
  display.display();
}

static void drawNoContent() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(0, 0);
  display.println("KittyBuddy Studio");
  display.println();
  display.println("No animations yet.");
  display.println();
  display.println(apSsid);
  display.println(WiFi.softAPIP());
  display.display();
}

// ---------------------------------------------------------------- content
static void freeSet(Anim* a, int n) {
  if (!a) return;
  for (int i = 0; i < n; i++) {
    if (a[i].frames) {
      for (int j = 0; j < a[i].n; j++) free(a[i].frames[j].bmp);
      free(a[i].frames);
    }
  }
  free(a);
}

/* Parses the file into a fresh set. The running set is only replaced if every
 * check passes, so a bad upload can never break what is already on the device. */
static bool loadFromFile(const char* path, String& err) {
  JsonDocument doc;
  File f = LittleFS.open(path, "r");
  if (!f) { err = "file missing"; return false; }
  DeserializationError e = deserializeJson(doc, f);
  f.close();
  if (e) { err = String("JSON: ") + e.c_str(); return false; }

  JsonArray arr = doc["animations"].as<JsonArray>();
  if (arr.isNull()) { err = "no animations array"; return false; }
  int n = arr.size();
  if (n < 1 || n > MAX_ANIMS) { err = "animation count out of range"; return false; }

  Anim* na = (Anim*)calloc(n, sizeof(Anim));
  if (!na) { err = "out of memory"; return false; }

  int total = 0;
  bool ok = true;
  for (int i = 0; i < n && ok; i++) {
    JsonObject a = arr[i];
    strlcpy(na[i].name, a["name"] | "anim", sizeof(na[i].name));
    na[i].loop = a["loop"] | true;
    JsonArray fr = a["frames"].as<JsonArray>();
    int fn = fr.isNull() ? 0 : fr.size();
    total += fn;
    if (fn < 1 || fn > MAX_FRAMES || total > MAX_TOTAL_FRAMES) { err = "frame count out of range"; ok = false; break; }
    na[i].frames = (Frame*)calloc(fn, sizeof(Frame));
    if (!na[i].frames) { err = "out of memory"; ok = false; break; }
    na[i].n = fn;
    for (int j = 0; j < fn; j++) {
      JsonObject fo = fr[j];
      const char* b64 = fo["b"] | "";
      uint8_t* bmp = (uint8_t*)malloc(FRAME_BYTES);
      if (!bmp) { err = "out of memory"; ok = false; break; }
      na[i].frames[j].bmp = bmp;
      size_t olen = 0;
      int rc = mbedtls_base64_decode(bmp, FRAME_BYTES, &olen, (const unsigned char*)b64, strlen(b64));
      if (rc != 0 || olen != FRAME_BYTES) { err = "bad frame data"; ok = false; break; }
      na[i].frames[j].dur = constrain((int)(fo["d"] | 200), 20, 10000);
    }
  }
  if (!ok) { Serial.printf("[load] failed: %s\n", err.c_str()); freeSet(na, n); return false; }

  Behavior nb;
  JsonObject c = doc["config"];
  int idle = c["idle"] | -1;
  nb.idle = (idle >= 0 && idle < n) ? idle : -1;
  for (JsonVariant v : c["buttons"].as<JsonArray>()) {
    int idx = v.as<int>();
    if (idx >= 0 && idx < n && nb.nButtons < 16) nb.buttons[nb.nButtons++] = idx;
  }
  nb.autoReturn = c["autoReturn"] | true;
  nb.idleTimeout = constrain((int)(c["idleTimeout"] | 5000), 500, 600000);
  nb.sleepEnabled = c["sleepEnabled"] | false;
  nb.sleepTimeout = constrain((int)(c["sleepTimeout"] | 30000), 1000, 3600000);
  nb.speed = constrain((float)(c["speed"] | 1.0f), 0.25f, 4.0f);

  xSemaphoreTake(animMutex, portMAX_DELAY);
  Anim* old = anims;
  int oldN = animCount;
  anims = na;
  animCount = n;
  beh = nb;
  curAnim = beh.idle >= 0 ? beh.idle : 0;
  curFrame = 0;
  btnIdx = 0;
  needDraw = true;
  sleeping = false;
  emptyDrawn = false;
  lastInteraction = millis();
  xSemaphoreGive(animMutex);
  freeSet(old, oldN);
  Serial.printf("[load] %d animations, %d frames, idle=%d, buttons=%d, heap=%u\n", n, total, beh.idle, beh.nButtons, ESP.getFreeHeap());
  return true;
}

// ---------------------------------------------------------------- playback
static void gotoAnim(int idx) {
  curAnim = idx;
  curFrame = 0;
  needDraw = true;
}

static void tick(uint32_t now) {
  if (animCount == 0) {
    if (!emptyDrawn) { drawNoContent(); emptyDrawn = true; }
    return;
  }
  if (curAnim >= animCount) gotoAnim(0);
  Anim& a = anims[curAnim];
  if (curFrame >= a.n) curFrame = 0;

  // Behaviour: sleep and return-to-idle
  if (beh.sleepEnabled && now - lastInteraction > beh.sleepTimeout) {
    sleeping = true;
    display.oled_command(SH110X_DISPLAYOFF);
    return;
  }
  if (beh.autoReturn && beh.idle >= 0 && curAnim != beh.idle && now - lastInteraction > beh.idleTimeout) {
    gotoAnim(beh.idle);
  }

  if (needDraw) {
    drawBmp(anims[curAnim].frames[curFrame].bmp);
    frameStart = now;
    needDraw = false;
    return;
  }

  uint32_t d = (uint32_t)(a.frames[curFrame].dur / beh.speed);
  if (now - frameStart < d) return;

  if (curFrame + 1 < a.n) {
    curFrame++;
    needDraw = true;
  } else if (a.loop) {
    curFrame = 0;
    needDraw = true;
  } else if (beh.autoReturn && beh.idle >= 0 && curAnim != beh.idle) {
    gotoAnim(beh.idle);  // one-shot expression finished
  }
}

static void handleButton(uint32_t now) {
  static bool last = HIGH;
  static uint32_t lastChange = 0;
  bool b = digitalRead(BOOT_BTN);
  if (b != last && now - lastChange > 40) {
    lastChange = now;
    last = b;
    if (b == LOW) {
      Serial.printf("[btn] press, anims=%d buttons=%d\n", animCount, beh.nButtons);
      lastInteraction = now;
      if (sleeping) {
        sleeping = false;
        display.oled_command(SH110X_DISPLAYON);
        needDraw = true;
      } else if (beh.nButtons > 0 && animCount > 0) {
        gotoAnim(beh.buttons[btnIdx % beh.nButtons]);
        btnIdx++;
      }
    }
  }
}

// ---------------------------------------------------------------- API
static void sendInfo(AsyncWebServerRequest* r) {
  JsonDocument d;
  d["deviceName"] = apSsid;
  d["espModel"] = "ESP32-C3 (Seeed XIAO)";
  d["displayType"] = "SH1106 OLED 1.3\"";
  d["firmwareVersion"] = FW_VERSION;
  d["displayResolution"] = "128 x 64";
  d["i2cAddress"] = dcfg.addr == 0x3D ? "0x3D" : "0x3C";
  d["availableStorage"] = LittleFS.totalBytes() - LittleFS.usedBytes();
  d["totalStorage"] = LittleFS.totalBytes();
  d["uptime"] = millis() / 1000;
  d["wifiSSID"] = apSsid;
  d["wifiSignal"] = 0;  // access-point mode has no RSSI
  d["lastSync"] = nullptr;
  d["freeHeap"] = ESP.getFreeHeap();
  d["animations"] = animCount;
  String s;
  serializeJson(d, s);
  r->send(200, "application/json", s);
}

// Collects a small JSON body into a malloc'd buffer (freed by the library)
static void collectBody(AsyncWebServerRequest* r, uint8_t* data, size_t len, size_t index, size_t total) {
  if (total > 2048) return;
  if (index == 0) {
    r->_tempObject = malloc(total + 1);
    if (!r->_tempObject) return;
  }
  if (!r->_tempObject) return;
  memcpy((uint8_t*)r->_tempObject + index, data, len);
  if (index + len == total) ((char*)r->_tempObject)[total] = 0;
}

static bool bodyJson(AsyncWebServerRequest* r, JsonDocument& doc) {
  if (!r->_tempObject) return false;
  return !deserializeJson(doc, (const char*)r->_tempObject);
}

static void setupApi() {
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type, X-KB-Token");

  server.on("/api/info", HTTP_GET, [](AsyncWebServerRequest* r) { Serial.println("[http] GET /api/info"); sendInfo(r); });

  // ---- content sync: body is streamed to a temp file, validated, then promoted
  server.on(
      "/api/sync", HTTP_POST,
      [](AsyncWebServerRequest* r) {
        Serial.printf("[sync] request done, err='%s'\n", syncErr.c_str());
        if (!authed(r)) { Serial.println("[sync] 401 bad token"); if (syncFile) syncFile.close(); syncBusy = false; return reply(r, 401, "Unauthorized: check ota.password in Settings"); }
        if (syncErr.length()) { String e = syncErr; syncErr = ""; if (syncFile) syncFile.close(); syncBusy = false; return reply(r, 400, e.c_str()); }
        if (syncFile) syncFile.close();
        String err;
        if (!loadFromFile("/sync.tmp", err)) { Serial.printf("[sync] 422 %s\n", err.c_str()); syncBusy = false; LittleFS.remove("/sync.tmp"); return reply(r, 422, err.c_str()); }
        LittleFS.remove("/anim.bak");
        if (LittleFS.exists("/anim.json")) LittleFS.rename("/anim.json", "/anim.bak");
        bool saved = LittleFS.rename("/sync.tmp", "/anim.json");
        syncBusy = false;
        if (!saved) return reply(r, 500, "Loaded, but could not persist to flash");
        Serial.println("[sync] 200 OK");
        reply(r, 200, "Content synced", true);
      },
      nullptr,
      [](AsyncWebServerRequest* r, uint8_t* data, size_t len, size_t index, size_t total) {
        if (index == 0) {
          Serial.printf("[sync] body start, total=%u bytes, heap=%u\n", (unsigned)total, ESP.getFreeHeap());
          syncErr = "";
          if (!authed(r)) { syncErr = "unauthorized"; return; }
          if (syncFile) syncFile.close();
          if (total > MAX_SYNC_BYTES) { syncErr = "payload too large"; return; }
          if (LittleFS.totalBytes() - LittleFS.usedBytes() < total + 8192) { syncErr = "not enough storage"; return; }
          syncFile = LittleFS.open("/sync.tmp", "w");
          if (!syncFile) { syncErr = "cannot open temp file"; return; }
          syncBusy = true;
        }
        if (syncErr.length() || !syncFile) return;
        if (syncFile.write(data, len) != len) syncErr = "flash write failed";
      });

  // ---- Wi-Fi AP config (takes effect after restart)
  server.on(
      "/api/wifi/config", HTTP_POST,
      [](AsyncWebServerRequest* r) {
        if (!authed(r)) return reply(r, 401, "Unauthorized");
        JsonDocument d;
        if (!bodyJson(r, d)) return reply(r, 400, "Invalid JSON");
        String ssid = d["ssid"] | "";
        String pass = d["password"] | "";
        if (ssid.length() < 1 || ssid.length() > 32) return reply(r, 400, "SSID must be 1-32 characters");
        if (pass.length() < 8 || pass.length() > 63) return reply(r, 400, "Password must be 8-63 characters");
        JsonDocument out;
        out["ssid"] = ssid;
        out["password"] = pass;
        writeJsonFile("/wifi.json", out);
        reply(r, 200, "Saved. Restart the device to apply.", true);
      },
      nullptr, collectBody);

  // ---- display config
  server.on(
      "/api/display/config", HTTP_POST,
      [](AsyncWebServerRequest* r) {
        if (!authed(r)) return reply(r, 401, "Unauthorized");
        JsonDocument d;
        if (!bodyJson(r, d)) return reply(r, 400, "Invalid JSON");
        int contrast = d["contrast"] | 128;
        if (contrast < 0 || contrast > 255) return reply(r, 400, "contrast must be 0-255");
        String addr = d["i2cAddress"] | "0x3C";
        if (addr != "0x3C" && addr != "0x3D") return reply(r, 400, "i2cAddress must be 0x3C or 0x3D");
        uint8_t newAddr = addr == "0x3D" ? 0x3D : 0x3C;
        bool addrChanged = newAddr != dcfg.addr;
        dcfg.contrast = contrast;
        dcfg.flipH = d["flipHorizontal"] | false;
        dcfg.flipV = d["flipVertical"] | false;
        dcfg.invert = d["invertDisplay"] | false;
        dcfg.addr = newAddr;
        JsonDocument out;
        out["contrast"] = dcfg.contrast;
        out["flipH"] = dcfg.flipH;
        out["flipV"] = dcfg.flipV;
        out["invert"] = dcfg.invert;
        out["addr"] = dcfg.addr;
        writeJsonFile("/display.json", out);
        dispDirty = true;
        reply(r, 200, addrChanged ? "Saved. Restart to use the new I2C address." : "Applied", true);
      },
      nullptr, collectBody);

  server.on("/api/restart", HTTP_POST, [](AsyncWebServerRequest* r) {
    if (!authed(r)) return reply(r, 401, "Unauthorized");
    restartAt = millis() + 800;
    reply(r, 200, "Restarting", true);
  });

  // ---- OTA. Success is only reported after Update.end() validated the image.
  server.on(
      "/api/ota/update", HTTP_POST,
      [](AsyncWebServerRequest* r) {
        if (otaOk) {
          restartAt = millis() + 1500;
          return reply(r, 200, "Firmware written. Restarting.", true);
        }
        int code = otaErr == "unauthorized" ? 401 : 400;
        reply(r, code, otaErr.length() ? otaErr.c_str() : "No data received");
      },
      [](AsyncWebServerRequest* r, const String& filename, size_t index, uint8_t* data, size_t len, bool final) {
        if (index == 0) {
          otaOk = false;
          otaBegun = false;
          otaErr = "";
          if (!authed(r)) otaErr = "unauthorized";
          else if (!filename.endsWith(".bin")) otaErr = "File must be a .bin";
          else if (len < 1 || data[0] != 0xE9) otaErr = "Not an ESP32 firmware image";
          else if (!Update.begin(UPDATE_SIZE_UNKNOWN)) otaErr = Update.errorString();
          else otaBegun = true;
        }
        if (otaBegun && otaErr.isEmpty()) {
          if (Update.write(data, len) != len) {
            otaErr = Update.errorString();
            Update.abort();
            otaBegun = false;
          }
        }
        if (final && otaBegun && otaErr.isEmpty()) {
          if (Update.end(true)) otaOk = true;
          else otaErr = Update.errorString();
          otaBegun = false;
        }
      });

  ws.onEvent([](AsyncWebSocket*, AsyncWebSocketClient* c, AwsEventType t, void*, uint8_t*, size_t) {
    if (t == WS_EVT_CONNECT) c->text("{\"type\":\"hello\"}");
  });
  server.addHandler(&ws);

  server.onNotFound([](AsyncWebServerRequest* r) {
    if (r->method() == HTTP_OPTIONS) return r->send(204);
    r->send(404, "text/plain", "Not found");
  });

  // Static files last so /api/* wins. Pre-gzipped files (.gz) are served automatically.
  server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
  server.begin();
}

// ---------------------------------------------------------------- setup / loop
static void loadSettings() {
  JsonDocument d;
  if (readJsonFile("/wifi.json", d)) {
    strlcpy(apSsid, d["ssid"] | WIFI_AP_SSID, sizeof(apSsid));
    strlcpy(apPass, d["password"] | WIFI_AP_PASS, sizeof(apPass));
  }
  JsonDocument g;
  if (readJsonFile("/display.json", g)) {
    dcfg.contrast = g["contrast"] | 128;
    dcfg.flipH = g["flipH"] | false;
    dcfg.flipV = g["flipV"] | false;
    dcfg.invert = g["invert"] | false;
    dcfg.addr = (g["addr"] | 0x3C) == 0x3D ? 0x3D : 0x3C;
  }
}

void setup() {
  Serial.begin(115200);
  animMutex = xSemaphoreCreateMutex();
  pinMode(BOOT_BTN, INPUT_PULLUP);

  if (!LittleFS.begin(true)) Serial.println("LittleFS mount failed");
  loadSettings();

  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(dcfg.addr, true)) Serial.println("SH1106 not found. Check wiring and I2C address.");
  display.setContrast(dcfg.contrast);
  display.invertDisplay(dcfg.invert);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(apSsid, apPass);
  Serial.printf("AP \"%s\" at http://%s\n", apSsid, WiFi.softAPIP().toString().c_str());

  // Connection details on the OLED for a few seconds
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(0, 0);
  display.println("KittyBuddy Studio");
  display.println("Wi-Fi:");
  display.println(apSsid);
  display.println("Open:");
  display.println(WiFi.softAPIP());
  display.display();

  setupApi();

  String err;
  if (LittleFS.exists("/anim.json") && !loadFromFile("/anim.json", err)) {
    Serial.printf("anim.json invalid (%s), trying backup\n", err.c_str());
    if (LittleFS.exists("/anim.bak") && loadFromFile("/anim.bak", err)) {
      LittleFS.remove("/anim.json");
      LittleFS.rename("/anim.bak", "/anim.json");
    }
  }
  delay(3000);
  needDraw = true;
  emptyDrawn = false;
  lastInteraction = millis();
}

void loop() {
  uint32_t now = millis();

  if (restartAt && now > restartAt) ESP.restart();

  if (xSemaphoreTake(animMutex, 20) == pdTRUE) {
    handleButton(now);
    if (dispDirty) {
      dispDirty = false;
      display.setContrast(dcfg.contrast);
      display.invertDisplay(dcfg.invert);
      needDraw = true;
      emptyDrawn = false;
    }
    if (!sleeping) tick(now);
    xSemaphoreGive(animMutex);
  }

  static uint32_t lastStatus = 0;
  if (now - lastStatus > 3000) {
    lastStatus = now;
    if (ws.count() > 0) {
      JsonDocument d;
      d["type"] = "status";
      d["info"]["uptime"] = now / 1000;
      d["info"]["freeHeap"] = ESP.getFreeHeap();
      String s;
      serializeJson(d, s);
      ws.textAll(s);
    }
    ws.cleanupClients();
  }
  delay(5);
}
