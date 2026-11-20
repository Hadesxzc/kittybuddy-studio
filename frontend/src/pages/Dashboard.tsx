import { useNavigate } from "react-router-dom";
import {
  Wifi,
  Palette,
  Film,
  Cpu,
  FolderKanban,
  Plus,
  Play,
  Activity,
  Monitor,
} from "lucide-react";
import { useDeviceStore } from "../stores/deviceStore";
import { useProjectStore } from "../stores/projectStore";
import { OledPreview } from "../components/editor/OledPreview";
import { createEmptyPixels } from "../types";
import type { DeviceConnectionState } from "../types";

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
  connecting: "CONNECTING",
  disconnected: "OFFLINE",
  uploading: "UPLOADING",
  synchronizing: "SYNCING",
  error: "ERROR",
};

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0h 0m 0s";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${m}m ${s}s`;
}

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface QuickAction {
  label: string;
  desc: string;
  icon: typeof Palette;
  to: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Character Editor", desc: "pixel.editor", icon: Palette, to: "/editor" },
  { label: "Animation Studio", desc: "animation.log", icon: Film, to: "/animation" },
  { label: "Device Manager", desc: "device.mgmt", icon: Cpu, to: "/device" },
  { label: "Project Library", desc: "projects.db", icon: FolderKanban, to: "/projects" },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { status, connect, disconnect } = useDeviceStore();
  const { projects, activeProjectId, createProject, setActiveProject } =
    useProjectStore();

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const previewPixels = activeProject?.currentFramePixels ?? createEmptyPixels();
  const info = status.info;

  const isConnected = status.state === "connected";
  const isBusy =
    status.state === "connecting" ||
    status.state === "uploading" ||
    status.state === "synchronizing";

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  const handleNewProject = async () => {
    const name = window.prompt("Project name:", "Untitled Project");
    const finalName = (name ?? "").trim() || "Untitled Project";
    const id = await createProject(finalName);
    await setActiveProject(id);
    navigate("/editor");
  };

  const handleOpenProject = async (id: string) => {
    await setActiveProject(id);
    navigate("/editor");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Welcome header */}
      <header className="fade-in">
        <div className="flex items-center gap-2 mb-1">
          <span className="terminal-label text-[#c084fc]">dashboard.sys</span>
          <span className="terminal-label text-[#475569]">// kittybuddy studio</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#e2e8f0] tracking-tight">
          Welcome back<span className="blink-cursor"></span>
        </h1>
        <p className="terminal-text text-[#94a3b8] mt-1">
          Control center for your KittyBuddy device, projects, and content.
        </p>
      </header>

      {/* Top row: device + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Device connection overview */}
        <section className="window fade-in lg:col-span-2">
          <div className="window-titlebar">
            <Monitor size={14} className="text-[#c084fc]" />
            <span className="text-xs font-medium text-[#e2e8f0]">Device Connection</span>
            <span className="terminal-label text-[#475569] ml-auto">device.status</span>
          </div>
          <div className="p-4">
            {/* Status row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className={`status-dot ${STATE_DOT[status.state]}`} />
                <span className="terminal-text text-[#e2e8f0] font-medium">
                  {STATE_LABEL[status.state]}
                </span>
                {status.isSimulation && (
                  <span className="terminal-label px-1.5 py-0.5 rounded border border-[#fbbf24]/40 text-[#fbbf24] bg-[#fbbf24]/5">
                    [SIM]
                  </span>
                )}
              </div>
              <button
                type="button"
                className={`btn ${isConnected ? "btn-danger" : "btn-primary"}`}
                onClick={handleConnect}
                disabled={isBusy}
              >
                <Wifi size={14} />
                {isBusy
                  ? "Working…"
                  : isConnected
                    ? "Disconnect"
                    : "Connect"}
              </button>
            </div>

            {status.state === "error" && status.error && (
              <div className="mb-4 px-3 py-2 rounded border border-[#f87171]/30 bg-[#f87171]/5">
                <span className="terminal-text text-[#f87171]">
                  err: {status.error}
                </span>
              </div>
            )}

            {/* Device info grid */}
            {info ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <InfoRow label="device.name" value={info.deviceName} />
                <InfoRow label="esp.model" value={info.espModel} />
                <InfoRow label="display.type" value={info.displayType} />
                <InfoRow label="firmware" value={`v${info.firmwareVersion}`} />
                <InfoRow label="uptime" value={formatUptime(info.uptime)} />
                <InfoRow
                  label="storage"
                  value={`${formatMB(info.availableStorage)} / ${formatMB(info.totalStorage)}`}
                />
                <InfoRow label="i2c.addr" value={info.i2cAddress} />
                <InfoRow
                  label="last.sync"
                  value={info.lastSync ? formatRelativeTime(new Date(info.lastSync).getTime()) : "—"}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity size={28} className="text-[#475569] mb-2" />
                <p className="terminal-text text-[#475569]">
                  No device connected. Press{" "}
                  <span className="text-[#c084fc]">Connect</span> to link your KittyBuddy.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Current character preview */}
        <section className="window fade-in">
          <div className="window-titlebar">
            <Play size={14} className="text-[#c084fc]" />
            <span className="text-xs font-medium text-[#e2e8f0]">Current Character</span>
            <span className="terminal-label text-[#475569] ml-auto">character.preview</span>
          </div>
          <div className="p-4 flex flex-col items-center justify-center">
            <OledPreview pixels={previewPixels} scale={3} showInfo />
            <div className="terminal-label text-[#475569] mt-3">
              128 x 64 SH1106
            </div>
            <div className="terminal-text text-[#94a3b8] mt-2 text-center">
              {activeProject ? activeProject.name : "— no active project —"}
            </div>
            <button
              type="button"
              className="btn btn-ghost mt-3"
              onClick={() => navigate("/editor")}
            >
              <Palette size={14} />
              Open Editor
            </button>
          </div>
        </section>
      </div>

      {/* Bottom row: recent projects + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent projects */}
        <section className="window fade-in lg:col-span-2">
          <div className="window-titlebar">
            <FolderKanban size={14} className="text-[#c084fc]" />
            <span className="text-xs font-medium text-[#e2e8f0]">Recent Projects</span>
            <span className="terminal-label text-[#475569] ml-auto">projects.recent</span>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-end mb-3">
              <button type="button" className="btn btn-primary" onClick={handleNewProject}>
                <Plus size={14} />
                New Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FolderKanban size={28} className="text-[#475569] mb-2" />
                <p className="terminal-text text-[#475569] mb-3">
                  No projects yet. Create your first character.
                </p>
                <button type="button" className="btn btn-primary" onClick={handleNewProject}>
                  <Plus size={14} />
                  New Project
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {[...projects]
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleOpenProject(p.id)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md border border-[#1e2129] bg-[#0a0b0f] hover:bg-[#1c1f2b] hover:border-[#3a3f50] transition-all group"
                    >
                      <div className="w-9 h-9 flex-shrink-0 rounded bg-[#06070a] border border-[#1e2129] flex items-center justify-center overflow-hidden">
                        {p.thumbnail ? (
                          <img
                            src={p.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                            style={{ imageRendering: "pixelated" }}
                          />
                        ) : (
                          <Palette size={15} className="text-[#475569]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#e2e8f0] truncate">
                            {p.name}
                          </span>
                          {p.id === activeProjectId && (
                            <span className="terminal-label px-1.5 py-0.5 rounded border border-[#c084fc]/40 text-[#c084fc] bg-[#c084fc]/5">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="terminal-text text-[#475569] truncate">
                          {p.description || "— no description —"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="terminal-label text-[#475569]">
                          {formatRelativeTime(p.updatedAt)}
                        </span>
                        <Play
                          size={13}
                          className="text-[#475569] group-hover:text-[#c084fc] transition-colors"
                        />
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </section>

        {/* Quick actions */}
        <section className="window fade-in">
          <div className="window-titlebar">
            <Activity size={14} className="text-[#c084fc]" />
            <span className="text-xs font-medium text-[#e2e8f0]">Quick Actions</span>
            <span className="terminal-label text-[#475569] ml-auto">nav.shortcuts</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.to}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className="flex flex-col items-start gap-2 p-3 rounded-md border border-[#1e2129] bg-[#0a0b0f] hover:bg-[#1c1f2b] hover:border-[#c084fc]/40 transition-all text-left group"
                >
                  <Icon
                    size={20}
                    className="text-[#94a3b8] group-hover:text-[#c084fc] transition-colors"
                  />
                  <div>
                    <div className="text-sm font-medium text-[#e2e8f0]">
                      {action.label}
                    </div>
                    <div className="terminal-label text-[#475569]">
                      {action.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
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

export default Dashboard;
