import { useState, useRef } from "react";
import {
  Cpu,
  Wifi,
  Upload,
  RefreshCw,
  Monitor,
  Zap,
  AlertTriangle,
  Download,
  Loader2,
} from "lucide-react";
import { useDeviceStore } from "../stores/deviceStore";
import { useAnimationStore } from "../stores/animationStore";
import { type DeviceConnectionState } from "../types";
import { buildDevicePayload, validatePayload } from "../utils/deviceProtocol";

const STATE_DOT: Record<DeviceConnectionState, string> = {
  connected: "status-dot-connected",
  connecting: "status-dot-connecting",
  disconnected: "status-dot-disconnected",
  uploading: "status-dot-uploading",
  synchronizing: "status-dot-connecting",
  error: "status-dot-error",
};

const STATE_LABEL: Record<DeviceConnectionState, string> = {
  connected: "ONLINE",
  connecting: "CONNECTING…",
  disconnected: "OFFLINE",
  uploading: "UPLOADING…",
  synchronizing: "SYNCING…",
  error: "ERROR",
};

function fmtUptime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0h 0m 0s";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${h}h ${m}m ${sec}s`;
}
function fmtMB(bytes: number) { return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function fmtRel(ts: string | null) {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function DeviceManager() {
  const { status, connect, disconnect, setBaseUrl, setSimulationMode,
    syncContent, uploadFirmware, setWifiConfig, setDisplayConfig, restart,
    firmwareProgress, syncProgress } = useDeviceStore();
  const animStore = useAnimationStore();

  const [url, setUrl] = useState(status.baseUrl);
  const [ssid, setSsid] = useState("KittyBuddy-Studio");
  const [wifiPass, setWifiPass] = useState("");
  const [i2cAddr, setI2cAddr] = useState("0x3C");
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [contrast, setContrast] = useState(128);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [wifiResult, setWifiResult] = useState<string | null>(null);
  const [displayResult, setDisplayResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const info = status.info;
  const isConnected = status.state === "connected";
  const isBusy = ["connecting", "uploading", "synchronizing"].includes(status.state);

  const handleConnect = () => {
    setBaseUrl(url);
    if (status.state === "connected") disconnect();
    else connect();
  };

  const handleSync = async () => {
    const payload = buildDevicePayload(animStore.animations, animStore.config);
    const problem = validatePayload(payload);
    if (problem) { setSyncResult(`✗ ${problem}`); return; }
    const ok = await syncContent(payload);
    setSyncResult(ok ? "✓ Device confirmed the new content" : `✗ ${useDeviceStore.getState().status.error ?? "Sync failed"}`);
    setTimeout(() => setSyncResult(null), 6000);
  };

  const handleWifi = async () => {
    const ok = await setWifiConfig(ssid, wifiPass);
    setWifiResult(ok ? "Wi-Fi config updated ✓" : "Update failed ✗");
    setTimeout(() => setWifiResult(null), 3000);
  };

  const handleDisplay = async () => {
    const ok = await setDisplayConfig({ i2cAddress: i2cAddr, flipHorizontal: flipH, flipVertical: flipV, contrast });
    setDisplayResult(ok ? "Display config applied ✓" : "Apply failed ✗");
    setTimeout(() => setDisplayResult(null), 3000);
  };

  const [fwFile, setFwFile] = useState<File | null>(null);
  const [fwError, setFwError] = useState<string | null>(null);

  const pickFirmware = (f: File | null) => {
    setFwError(null);
    setFwFile(null);
    if (!f) return;
    if (!f.name.endsWith(".bin")) { setFwError("Select a compiled .bin file."); return; }
    if (f.size > 1_500_000) { setFwError("File is larger than the 1.5 MB app partition."); return; }
    setFwFile(f);
  };

  const handleFirmware = async () => {
    if (!fwFile) return;
    if (!confirm(`Flash ${fwFile.name} (${Math.round(fwFile.size / 1024)} KB)? The device will restart.`)) return;
    await uploadFirmware(fwFile);
  };

  return (
    <div className="p-6 space-y-6">
      <header className="fade-in">
        <div className="flex items-center gap-2 mb-1">
          <span className="terminal-label text-[#c084fc]">device.mgmt</span>
          <span className="terminal-label text-[#475569]">// connection & firmware</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#e2e8f0] tracking-tight">Device Manager</h1>
        <p className="terminal-text text-[#94a3b8] mt-1">Manage your KittyBuddy's Wi-Fi, display, and firmware.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Connection */}
        <Section icon={Cpu} title="Connection" tech="connection.panel">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`status-dot ${STATE_DOT[status.state]}`} />
              <span className="terminal-text text-[#e2e8f0]">{STATE_LABEL[status.state]}</span>
              {status.isSimulation && <span className="terminal-label text-[#fbbf24]">[SIM]</span>}
            </div>
          </div>

          <div className="space-y-2">
            <Field label="device.address">
              <input className="input-field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://192.168.4.1" />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={status.isSimulation} onChange={(e) => setSimulationMode(e.target.checked)} className="accent-[#c084fc]" />
              <span className="terminal-text text-[#94a3b8]">simulation.mode</span>
            </label>
            <button className="btn btn-primary w-full" onClick={handleConnect} disabled={isBusy}>
              {isBusy ? <><Loader2 size={14} className="animate-spin" /> Working…</> : isConnected ? "Disconnect" : "Connect"}
            </button>
            {status.state === "error" && status.error && (
              <div className="px-3 py-2 rounded border border-[#f87171]/30 bg-[#f87171]/5 terminal-text text-[#f87171]">err: {status.error}</div>
            )}
          </div>
        </Section>

        {/* Device Info */}
        <Section icon={Monitor} title="Device Info" tech="device.info">
          {info ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <InfoRow label="device.name" value={info.deviceName} />
              <InfoRow label="esp.model" value={info.espModel} />
              <InfoRow label="display.type" value={info.displayType} />
              <InfoRow label="firmware" value={`v${info.firmwareVersion}`} />
              <InfoRow label="resolution" value={info.displayResolution} />
              <InfoRow label="i2c.addr" value={info.i2cAddress} />
              <InfoRow label="storage" value={`${fmtMB(info.availableStorage)} / ${fmtMB(info.totalStorage)}`} />
              <InfoRow label="uptime" value={fmtUptime(info.uptime)} />
              <InfoRow label="wifi.ssid" value={info.wifiSSID} />
              <InfoRow label="wifi.signal" value={info.wifiSignal ? `${info.wifiSignal} dBm` : "n/a (AP mode)"} />
              <InfoRow label="free.heap" value={`${Math.round(info.freeHeap / 1024)} KB`} />
              <InfoRow label="last.sync" value={fmtRel(info.lastSync)} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Monitor size={28} className="text-[#475569] mb-2" />
              <p className="terminal-text text-[#475569]">Connect to device to see info.</p>
            </div>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Wi-Fi Config */}
        <Section icon={Wifi} title="Wi-Fi Configuration" tech="wifi.config">
          <div className="space-y-2">
            <Field label="wifi.ssid">
              <input className="input-field" value={ssid} onChange={(e) => setSsid(e.target.value)} />
            </Field>
            <Field label="wifi.password">
              <input className="input-field" type="password" value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} placeholder="••••••••" />
            </Field>
            <button className="btn w-full" onClick={handleWifi} disabled={!isConnected}>
              <Wifi size={14} /> Update Wi-Fi Config
            </button>
            {wifiResult && <div className="terminal-text text-center text-[#94a3b8]">{wifiResult}</div>}
          </div>
        </Section>

        {/* Display Config */}
        <Section icon={Monitor} title="Display Configuration" tech="display.config">
          <div className="space-y-3">
            <Field label="i2c.address">
              <select className="input-field" value={i2cAddr} onChange={(e) => setI2cAddr(e.target.value)}>
                <option value="0x3C">0x3C</option>
                <option value="0x3D">0x3D</option>
              </select>
            </Field>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={flipH} onChange={(e) => setFlipH(e.target.checked)} className="accent-[#c084fc]" />
                <span className="terminal-text text-[#94a3b8]">flip.horizontal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={flipV} onChange={(e) => setFlipV(e.target.checked)} className="accent-[#c084fc]" />
                <span className="terminal-text text-[#94a3b8]">flip.vertical</span>
              </label>
            </div>
            <div>
              <div className="flex justify-between terminal-label mb-1">
                <span className="text-[#475569]">contrast</span>
                <span className="text-[#c084fc]">{contrast}</span>
              </div>
              <input type="range" min={0} max={255} value={contrast} onChange={(e) => setContrast(parseInt(e.target.value))} className="w-full accent-[#c084fc]" />
            </div>
            <button className="btn w-full" onClick={handleDisplay} disabled={!isConnected}>
              <Monitor size={14} /> Apply Display Settings
            </button>
            {displayResult && <div className="terminal-text text-center text-[#94a3b8]">{displayResult}</div>}
          </div>
        </Section>
      </div>

      {/* Content Sync */}
      <Section icon={Download} title="Content Synchronization" tech="content.sync">
        <div className="space-y-3">
          <p className="terminal-text text-[#94a3b8]">
            Sync character data, animations, and display settings to your KittyBuddy over Wi-Fi.
            No USB cable or Arduino IDE required.
          </p>
          {syncProgress?.active && (
            <div className="space-y-1">
              <div className="flex justify-between terminal-label">
                <span className="text-[#475569]">{syncProgress.message}</span>
                <span className="text-[#c084fc]">{syncProgress.progress}%</span>
              </div>
              <div className="h-1 bg-[#1e2129] rounded-full overflow-hidden">
                <div className="h-full bg-[#c084fc] rounded-full transition-all" style={{ width: `${syncProgress.progress}%`, boxShadow: "0 0 6px rgba(192,132,252,0.5)" }} />
              </div>
            </div>
          )}
          {syncResult && <div className="terminal-text text-center text-[#94a3b8]">{syncResult}</div>}
          <button className="btn btn-primary w-full" onClick={handleSync} disabled={!isConnected || syncProgress?.active}>
            <Download size={14} /> Sync to Device
          </button>
        </div>
      </Section>

      {/* Firmware Update */}
      <Section icon={Zap} title="Firmware Update (OTA)" tech="firmware.bin">
        <div className="space-y-3">
          <input ref={fileRef} type="file" accept=".bin" className="hidden" onChange={(e) => pickFirmware(e.target.files?.[0] ?? null)} />
          <div className="border-2 border-dashed border-[#2a2e3a] rounded-lg p-5 text-center cursor-pointer hover:border-[#c084fc] transition-colors"
            onClick={() => fileRef.current?.click()}>
            <Upload size={24} className="mx-auto mb-2 text-[#475569]" />
            <div className="text-xs text-[#94a3b8]">{fwFile ? `${fwFile.name} · ${Math.round(fwFile.size / 1024)} KB` : "Click to select .bin firmware file"}</div>
            <div className="terminal-label text-[#475569] mt-1">compiled firmware only</div>
          </div>
          {fwError && <div className="terminal-text text-[#f87171]">{fwError}</div>}

          {firmwareProgress && (
            <div className="space-y-2">
              <div className="flex justify-between terminal-label">
                <span className={`${
                  firmwareProgress.phase === "error" ? "text-[#f87171]" :
                  firmwareProgress.phase === "done" ? "text-[#4ade80]" : "text-[#c084fc]"
                }`}>{firmwareProgress.message}</span>
                <span className="text-[#c084fc]">{firmwareProgress.progress}%</span>
              </div>
              <div className="h-1 bg-[#1e2129] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  firmwareProgress.phase === "error" ? "bg-[#f87171]" :
                  firmwareProgress.phase === "done" ? "bg-[#4ade80]" : "bg-[#c084fc]"
                }`} style={{ width: `${firmwareProgress.progress}%` }} />
              </div>
            </div>
          )}

          <div className="px-3 py-2 rounded border border-[#fbbf24]/30 bg-[#fbbf24]/5 flex gap-2">
            <AlertTriangle size={14} className="text-[#fbbf24] flex-shrink-0 mt-0.5" />
            <p className="terminal-text text-[#fbbf24]">
              Firmware updates will restart the device. Ensure stable power. Do not disconnect during update.
            </p>
          </div>

          <button className="btn w-full" onClick={handleFirmware} disabled={!isConnected || !fwFile || (firmwareProgress !== null && firmwareProgress.phase !== "error")}>
            <Upload size={14} /> Upload Firmware
          </button>
          <button className="btn btn-danger w-full" onClick={() => { if (confirm("Restart device?")) restart(); }} disabled={!isConnected}>
            <RefreshCw size={14} /> Restart Device
          </button>
        </div>
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, tech, children }: { icon: typeof Cpu; title: string; tech: string; children: React.ReactNode }) {
  return (
    <section className="window fade-in">
      <div className="window-titlebar">
        <Icon size={14} className="text-[#c084fc]" />
        <span className="text-xs font-medium text-[#e2e8f0]">{title}</span>
        <span className="terminal-label text-[#475569] ml-auto">{tech}</span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="terminal-label text-[#475569] mb-1">{label}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="terminal-label text-[#475569]">{label}</span>
      <span className="terminal-text text-[#e2e8f0] truncate">{value}</span>
    </div>
  );
}

export default DeviceManager;
