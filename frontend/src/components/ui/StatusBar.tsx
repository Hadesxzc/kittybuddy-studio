import { useDeviceStore } from "../../stores/deviceStore";
import type { DeviceConnectionState } from "../../types";

const STATE_LABELS: Record<DeviceConnectionState, string> = {
  connected: "CONNECTED",
  connecting: "CONNECTING…",
  disconnected: "DISCONNECTED",
  uploading: "UPLOADING…",
  synchronizing: "SYNCING…",
  error: "ERROR",
};

const STATE_COLORS: Record<DeviceConnectionState, string> = {
  connected: "status-dot-connected",
  connecting: "status-dot-connecting",
  disconnected: "status-dot-disconnected",
  uploading: "status-dot-uploading",
  synchronizing: "status-dot-connecting",
  error: "status-dot-error",
};

export function StatusBar() {
  const { status } = useDeviceStore();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1e2129] bg-[#0a0b0f]">
      <div className={`status-dot ${STATE_COLORS[status.state]}`} />
      <span className="terminal-text text-[#94a3b8]">device.status</span>
      <span className="terminal-text text-[#e2e8f0]">: {STATE_LABELS[status.state]}</span>
      {status.isSimulation && (
        <span className="terminal-text text-[#fbbf24] ml-2">[SIM]</span>
      )}
      <span className="terminal-text text-[#475569] ml-auto">
        KittyBuddy Studio v1.0.0
      </span>
    </div>
  );
}
