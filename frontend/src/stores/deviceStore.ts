import { create } from "zustand";
import type {
  DeviceInfo,
  DeviceStatus,
  FirmwareUploadProgress,
} from "../types";
import { authHeaders, type DevicePayload } from "../utils/deviceProtocol";

interface DeviceStore {
  status: DeviceStatus;
  firmwareProgress: FirmwareUploadProgress | null;
  syncProgress: { active: boolean; message: string; progress: number } | null;
  ws: WebSocket | null;

  setBaseUrl: (url: string) => void;
  setSimulationMode: (enabled: boolean) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  fetchDeviceInfo: () => Promise<void>;
  syncContent: (payload: DevicePayload) => Promise<boolean>;
  uploadFirmware: (file: File) => Promise<boolean>;
  setWifiConfig: (ssid: string, password: string) => Promise<boolean>;
  setDisplayConfig: (settings: {
    i2cAddress: string;
    flipHorizontal: boolean;
    flipVertical: boolean;
    contrast: number;
  }) => Promise<boolean>;
  restart: () => Promise<void>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
}

// Simulation device info used when no hardware is present
const SIMULATION_DEVICE_INFO: DeviceInfo = {
  deviceName: "KittyBuddy-Sim",
  espModel: "ESP32-C3 (Simulation)",
  displayType: "SH1106 OLED 1.3\" (Simulated)",
  firmwareVersion: "1.0.0-sim",
  displayResolution: "128 x 64",
  i2cAddress: "0x3C",
  availableStorage: 1500000,
  totalStorage: 2097152,
  uptime: 142,
  wifiSSID: "KittyBuddy-Studio",
  wifiSignal: -42,
  lastSync: new Date(Date.now() - 300000).toISOString(),
  freeHeap: 310000,
};

/** True when the page itself was served by the KittyBuddy (e.g. http://192.168.4.1). */
export function servedFromDevice(): boolean {
  if (typeof location === "undefined" || !location.protocol.startsWith("http")) return false;
  const h = location.hostname;
  return !(h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".localhost"));
}

function createInitialStatus(): DeviceStatus {
  const onDevice = servedFromDevice();
  return {
    state: "disconnected",
    info: null,
    error: null,
    baseUrl: onDevice ? location.origin : "http://192.168.4.1",
    isSimulation: !onDevice,
  };
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  status: createInitialStatus(),
  firmwareProgress: null,
  syncProgress: null,
  ws: null,

  setBaseUrl: (url) =>
    set((s) => ({
      status: { ...s.status, baseUrl: url.replace(/\/$/, "") },
    })),

  setSimulationMode: (enabled) =>
    set((s) => ({
      status: { ...s.status, isSimulation: enabled },
    })),

  connect: async () => {
    const state = get();
    set((s) => ({
      status: { ...s.status, state: "connecting", error: null },
    }));

    if (state.status.isSimulation) {
      await new Promise((r) => setTimeout(r, 800));
      set((s) => ({
        status: {
          ...s.status,
          state: "connected",
          info: { ...SIMULATION_DEVICE_INFO, uptime: Date.now() / 1000 },
        },
      }));
      return;
    }

    try {
      const baseUrl = state.status.baseUrl;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${baseUrl}/api/info`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      set((s) => ({
        status: {
          ...s.status,
          state: "connected",
          info: data.info ?? data,
          error: null,
        },
      }));

      get().connectWebSocket();
    } catch (err) {
      set((s) => ({
        status: {
          ...s.status,
          state: "error",
          error: err instanceof Error ? err.message : "Connection failed",
        },
      }));
    }
  },

  disconnect: () => {
    get().disconnectWebSocket();
    set((s) => ({
      status: { ...s.status, state: "disconnected", info: null },
    }));
  },

  fetchDeviceInfo: async () => {
    const state = get();
    if (state.status.isSimulation || state.status.state !== "connected") return;
    try {
      const resp = await fetch(`${state.status.baseUrl}/api/info`);
      if (resp.ok) {
        const data = await resp.json();
        set((s) => ({
          status: { ...s.status, info: data.info ?? data },
        }));
      }
    } catch { /* ignore on reconnect issues */ }
  },

  syncContent: async (payload) => {
    const state = get();
    if (state.status.isSimulation) {
      set({ syncProgress: { active: true, message: "Simulating sync…", progress: 0 } });
      for (let p = 0; p <= 100; p += 10) {
        await new Promise((r) => setTimeout(r, 100));
        set({ syncProgress: { active: true, message: `Syncing ${p}%`, progress: p } });
      }
      set((s) => ({
        syncProgress: null,
        status: {
          ...s.status,
          info: s.status.info
            ? { ...s.status.info, lastSync: new Date().toISOString() }
            : s.status.info,
        },
      }));
      return true;
    }

    if (state.status.state !== "connected") return false;

    set((s) => ({
      status: { ...s.status, state: "synchronizing" },
      syncProgress: { active: true, message: "Uploading content…", progress: 0 },
    }));

    try {
      const resp = await fetch(`${state.status.baseUrl}/api/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      let data: { success?: boolean; error?: string } = {};
      try { data = await resp.json(); } catch { /* non-JSON error body */ }
      if (!resp.ok || !data.success) {
        throw new Error(data.error || `Device rejected sync (HTTP ${resp.status})`);
      }

      set((s) => ({
        status: {
          ...s.status,
          state: "connected",
          info: s.status.info
            ? { ...s.status.info, lastSync: new Date().toISOString() }
            : s.status.info,
        },
        syncProgress: null,
      }));
      return true;
    } catch (err) {
      // A rejected upload leaves the device connected; a network failure does not.
      const network = err instanceof TypeError;
      set((s) => ({
        status: {
          ...s.status,
          state: network ? "error" : "connected",
          error: network ? "Lost connection to device during sync" : err instanceof Error ? err.message : "Sync failed",
        },
        syncProgress: null,
      }));
      return false;
    }
  },

  uploadFirmware: async (file) => {
    const state = get();
    if (state.status.isSimulation) {
      set({
        firmwareProgress: { phase: "uploading", progress: 0, message: "Simulating upload…" },
      });
      for (let p = 0; p <= 100; p += 10) {
        await new Promise((r) => setTimeout(r, 150));
        set({
          firmwareProgress: {
            phase: p < 50 ? "uploading" : p < 80 ? "writing" : p < 100 ? "verifying" : "done",
            progress: p,
            message: `Phase: ${p < 50 ? "Uploading" : p < 80 ? "Writing flash" : p < 100 ? "Verifying" : "Complete"}`,
          },
        });
      }
      set({ firmwareProgress: null });
      return true;
    }

    if (state.status.state !== "connected") return false;

    set({
      firmwareProgress: { phase: "uploading", progress: 0, message: "Uploading firmware…" },
      status: { ...get().status, state: "uploading" },
    });

    try {
      // XHR (not fetch) so we get real upload progress events
      const data = await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${state.status.baseUrl}/api/ota/update`);
        for (const [k, v] of Object.entries(authHeaders())) xhr.setRequestHeader(k, v);
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          set({
            firmwareProgress: {
              phase: "uploading",
              progress: Math.round((e.loaded / e.total) * 90),
              message: `Uploading ${Math.round(e.loaded / 1024)} / ${Math.round(e.total / 1024)} KB`,
            },
          });
        };
        xhr.upload.onload = () =>
          set({ firmwareProgress: { phase: "verifying", progress: 95, message: "Device is validating the image…" } });
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onload = () => {
          let body: { success: boolean; error?: string } | null = null;
          try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
          if (xhr.status >= 200 && xhr.status < 300 && body?.success) resolve(body);
          else reject(new Error(body?.error || `Device rejected firmware (HTTP ${xhr.status})`));
        };
        const form = new FormData();
        form.append("firmware", file, file.name);
        xhr.send(form);
      });
      if (!data.success) throw new Error(data.error || "OTA rejected");

      set({
        firmwareProgress: { phase: "done", progress: 100, message: "Firmware updated. Restarting…" },
      });
      await new Promise((r) => setTimeout(r, 2000));
      set({ firmwareProgress: null });
      get().connect();
      return true;
    } catch (err) {
      set((s) => ({
        status: { ...s.status, state: "error", error: err instanceof Error ? err.message : "OTA failed" },
        firmwareProgress: { phase: "error", progress: 0, message: err instanceof Error ? err.message : "OTA failed" },
      }));
      return false;
    }
  },

  setWifiConfig: async (ssid, password) => {
    const state = get();
    if (state.status.isSimulation) {
      await new Promise((r) => setTimeout(r, 500));
      return true;
    }
    if (state.status.state !== "connected") return false;
    try {
      const resp = await fetch(`${state.status.baseUrl}/api/wifi/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ssid, password }),
      });
      return resp.ok;
    } catch {
      return false;
    }
  },

  setDisplayConfig: async (settings) => {
    const state = get();
    if (state.status.isSimulation) {
      await new Promise((r) => setTimeout(r, 500));
      return true;
    }
    if (state.status.state !== "connected") return false;
    try {
      const resp = await fetch(`${state.status.baseUrl}/api/display/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(settings),
      });
      return resp.ok;
    } catch {
      return false;
    }
  },

  restart: async () => {
    const state = get();
    if (state.status.isSimulation) return;
    try {
      await fetch(`${state.status.baseUrl}/api/restart`, { method: "POST", headers: authHeaders() });
    } catch { /* device restarting will drop connection anyway */ }
    set((s) => ({ status: { ...s.status, state: "disconnected", info: null } }));
  },

  connectWebSocket: () => {
    const state = get();
    if (state.status.isSimulation) return;
    const wsUrl = state.status.baseUrl.replace("http", "ws") + "/ws";
    try {
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "status" && data.info) {
            set((s) => ({
              status: { ...s.status, info: { ...s.status.info, ...data.info } },
            }));
          }
        } catch { /* ignore malformed messages */ }
      };
      ws.onclose = () => {
        set((s) => ({ status: { ...s.status, state: "disconnected" }, ws: null }));
      };
      set({ ws });
    } catch { /* WebSocket not available */ }
  },

  disconnectWebSocket: () => {
    const ws = get().ws;
    if (ws) {
      ws.close();
      set({ ws: null });
    }
  },
}));
