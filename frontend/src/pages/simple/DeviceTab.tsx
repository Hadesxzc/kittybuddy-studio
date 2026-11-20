import { useRef, useState } from "react";
import { Wifi, WifiOff, RefreshCw, Upload, Sun, RotateCw } from "lucide-react";
import { useDeviceStore } from "../../stores/deviceStore";
import { useUiStore } from "../../stores/uiStore";
import { getDeviceToken, setDeviceToken } from "../../utils/deviceProtocol";
import type { DeviceInfo } from "../../types";

function fmtUptime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "-";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function DeviceTab() {
  const status = useDeviceStore((s) => s.status);
  const firmwareProgress = useDeviceStore((s) => s.firmwareProgress);
  const showToast = useUiStore((s) => s.showToast);
  const dev = useDeviceStore.getState();

  const [contrast, setContrast] = useState(128);
  const [flipped, setFlipped] = useState(false);
  const [url, setUrl] = useState(status.baseUrl);
  const [token, setToken] = useState(getDeviceToken());
  const [ssid, setSsid] = useState("");
  const [pass, setPass] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const connected = status.state === "connected";
  const busy = ["connecting", "uploading", "synchronizing"].includes(status.state);
  const info = status.info as (DeviceInfo & { animations?: number }) | null;

  const applyDisplay = async () => {
    const ok = await dev.setDisplayConfig({ i2cAddress: info?.i2cAddress ?? "0x3C", flipHorizontal: flipped, flipVertical: flipped, contrast });
    showToast(ok ? "Display updated" : "Couldn't update the display", ok);
  };

  const saveWifi = async () => {
    const ok = await dev.setWifiConfig(ssid, pass);
    showToast(ok ? "Saved. Restart the KittyBuddy, then join the new Wi-Fi." : "Name must be 1-32 characters, password 8-63.", ok);
  };

  const flash = async (f: File | null) => {
    if (!f) return;
    if (!f.name.endsWith(".bin")) return showToast("Choose a .bin firmware file.", false);
    if (!confirm(`Install ${f.name}? The KittyBuddy will restart.`)) return;
    const ok = await dev.uploadFirmware(f);
    showToast(ok ? "Firmware installed. Restarting…" : useDeviceStore.getState().status.error ?? "Update failed", ok);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-[#e2e8f0]">Device</h1>

      {/* Connection */}
      <div className="rounded-xl border border-[#2a2e3a] bg-[#101218] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-2 ${connected ? "bg-[#4ade80]/15 text-[#4ade80]" : "bg-[#475569]/20 text-[#94a3b8]"}`}>
            {connected ? <Wifi size={20} /> : <WifiOff size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[#e2e8f0]">
              {status.isSimulation ? "Simulation mode" : connected ? `Connected to ${info?.deviceName ?? "KittyBuddy"}` : busy ? "Connecting…" : "Not connected"}
            </div>
            <div className="text-xs text-[#94a3b8] truncate">
              {status.isSimulation ? "Nothing is sent to the real OLED." : status.baseUrl}
            </div>
          </div>
          <button className="btn" onClick={() => (connected ? dev.disconnect() : dev.connect())} disabled={busy}>
            {connected ? "Disconnect" : "Connect"}
          </button>
        </div>
        {status.error && status.state === "error" && <p className="text-sm text-[#f87171]">{status.error}</p>}
        {!connected && !status.isSimulation && (
          <ol className="text-sm text-[#94a3b8] list-decimal pl-5 space-y-1">
            <li>Join the Wi-Fi <b className="text-[#e2e8f0]">KittyBuddy-Studio</b> (password <b className="text-[#e2e8f0]">kittybuddy</b>).</li>
            <li>Open <b className="text-[#e2e8f0]">http://192.168.4.1</b> in your browser.</li>
          </ol>
        )}
        {connected && info && !status.isSimulation && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="On device" value={`${info.animations ?? "-"}`} />
            <Stat label="Free space" value={`${Math.round(info.availableStorage / 1024)} KB`} />
            <Stat label="Running" value={fmtUptime(info.uptime)} />
          </div>
        )}
      </div>

      {/* Display */}
      <div className="rounded-xl border border-[#2a2e3a] bg-[#101218] p-4 space-y-3">
        <div className="text-sm font-semibold text-[#e2e8f0]">Screen</div>
        <label className="block">
          <div className="flex items-center gap-2 text-xs text-[#94a3b8] mb-1"><Sun size={14} /> Brightness</div>
          <input type="range" min={0} max={255} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full accent-[#c084fc]" />
        </label>
        <button
          onClick={() => setFlipped((v) => !v)}
          className={`w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm border ${flipped ? "bg-[#7c3aed] border-[#7c3aed] text-white" : "border-[#2a2e3a] text-[#94a3b8] bg-[#161922]"}`}
        >
          <RotateCw size={16} /> Upside down: {flipped ? "On" : "Off"}
        </button>
        <button className="btn btn-primary w-full py-2.5" onClick={applyDisplay} disabled={!connected}>Apply</button>
      </div>

      {/* Advanced */}
      <details className="rounded-xl border border-[#2a2e3a] bg-[#101218] p-4 group">
        <summary className="text-sm font-semibold text-[#e2e8f0] cursor-pointer select-none">Advanced</summary>
        <div className="mt-4 space-y-5">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-[#94a3b8]">Simulation mode (no device)</span>
            <input type="checkbox" className="w-5 h-5 accent-[#c084fc]" checked={status.isSimulation}
              onChange={(e) => { dev.disconnect(); dev.setSimulationMode(e.target.checked); }} />
          </label>

          <Field label="Device address">
            <div className="flex gap-2">
              <input className="input-field text-base" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button className="btn" onClick={() => { dev.setBaseUrl(url); dev.connect(); }}>Use</button>
            </div>
          </Field>

          <Field label="Device password (OTA_PASSWORD in platformio.ini)">
            <div className="flex gap-2">
              <input className="input-field text-base" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
              <button className="btn" onClick={() => { setDeviceToken(token); showToast("Saved"); }}>Save</button>
            </div>
          </Field>

          <Field label="Change the KittyBuddy's Wi-Fi">
            <div className="space-y-2">
              <input className="input-field text-base" placeholder="New Wi-Fi name" value={ssid} onChange={(e) => setSsid(e.target.value)} />
              <input className="input-field text-base" type="password" placeholder="New password (8+ characters)" value={pass} onChange={(e) => setPass(e.target.value)} />
              <button className="btn w-full" onClick={saveWifi} disabled={!connected}>Save Wi-Fi</button>
            </div>
          </Field>

          <Field label="Firmware update">
            <input ref={fileRef} type="file" accept=".bin" className="hidden" onChange={(e) => flash(e.target.files?.[0] ?? null)} />
            <button className="btn w-full" onClick={() => fileRef.current?.click()} disabled={!connected || !!firmwareProgress}>
              <Upload size={14} /> {firmwareProgress ? `${firmwareProgress.message} ${firmwareProgress.progress}%` : "Install a .bin file"}
            </button>
          </Field>

          <button className="btn btn-danger w-full" disabled={!connected} onClick={() => confirm("Restart the KittyBuddy?") && dev.restart()}>
            <RefreshCw size={14} /> Restart device
          </button>
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#161922] py-2">
      <div className="text-sm font-semibold text-[#e2e8f0]">{value}</div>
      <div className="text-[11px] text-[#475569]">{label}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-[#94a3b8] mb-1.5">{label}</div>
      {children}
    </div>
  );
}
