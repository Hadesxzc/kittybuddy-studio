import { useEffect } from "react";
import { Cat, Pencil, Film, Cpu } from "lucide-react";
import { DrawTab } from "./pages/simple/DrawTab";
import { AnimsTab } from "./pages/simple/AnimsTab";
import { DeviceTab } from "./pages/simple/DeviceTab";
import { useUiStore, type Tab } from "./stores/uiStore";
import { useProjectStore } from "./stores/projectStore";
import { useAnimationStore } from "./stores/animationStore";
import { useDeviceStore, servedFromDevice } from "./stores/deviceStore";

const TABS: { id: Tab; label: string; icon: typeof Cat }[] = [
  { id: "draw", label: "Draw", icon: Pencil },
  { id: "anims", label: "Animations", icon: Film },
  { id: "device", label: "Device", icon: Cpu },
];

function App() {
  const tab = useUiStore((s) => s.tab);
  const setTab = useUiStore((s) => s.setTab);
  const toast = useUiStore((s) => s.toast);
  const isLoading = useProjectStore((s) => s.isLoading);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const animations = useAnimationStore((s) => s.animations);
  const animConfig = useAnimationStore((s) => s.config);
  const device = useDeviceStore((s) => s.status);

  useEffect(() => {
    useProjectStore.getState().loadProjects();
    if (servedFromDevice()) useDeviceStore.getState().connect();
  }, []);

  // Load saved work once the project database is ready
  useEffect(() => {
    if (isLoading || !activeProjectId) return;
    const p = useProjectStore.getState().getActiveProject();
    if (p) useAnimationStore.getState().loadFromProject(p.animations, p.animationConfig);
    useUiStore.getState().edit({ kind: "drawing" });
    useUiStore.setState({ hydrated: true });
  }, [isLoading, activeProjectId]);

  // Autosave animations
  useEffect(() => {
    if (!useUiStore.getState().hydrated) return;
    const t = setTimeout(() => {
      useProjectStore.getState().updateActiveProject((p) => ({
        ...p,
        animations: animations.map((a) => ({ ...a, frames: a.frames.map((f) => ({ ...f, pixels: new Uint8Array(f.pixels) })) })),
        animationConfig: { ...animConfig },
      }));
    }, 800);
    return () => clearTimeout(t);
  }, [animations, animConfig]);

  const online = device.state === "connected" && !device.isSimulation;

  return (
    <div className="h-full flex flex-col bg-[#0a0b0f]">
      <header className="shrink-0 h-14 px-4 flex items-center gap-2.5 border-b border-[#1e2129] bg-[#06070a]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#c084fc] flex items-center justify-center">
          <Cat size={18} className="text-white" />
        </div>
        <span className="font-semibold text-[#e2e8f0]">KittyBuddy</span>
        <button
          onClick={() => setTab("device")}
          className="ml-auto flex items-center gap-1.5 rounded-full border border-[#2a2e3a] px-3 py-1 text-xs text-[#94a3b8]"
        >
          <span className={`w-2 h-2 rounded-full ${online ? "bg-[#4ade80]" : device.isSimulation ? "bg-[#fbbf24]" : "bg-[#475569]"}`} />
          {online ? "Connected" : device.isSimulation ? "Simulation" : "Offline"}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-4">
          {tab === "draw" && <DrawTab />}
          {tab === "anims" && <AnimsTab />}
          {tab === "device" && <DeviceTab />}
        </div>
      </main>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 flex justify-center px-4 z-50">
          <div
            className={`max-w-md rounded-xl px-4 py-3 text-sm shadow-lg border ${
              toast.ok ? "bg-[#14231a] border-[#4ade80]/40 text-[#bbf7d0]" : "bg-[#2a1416] border-[#f87171]/40 text-[#fecaca]"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}

      <nav
        className="shrink-0 grid grid-cols-3 border-t border-[#1e2129] bg-[#06070a]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-col items-center justify-center gap-1 h-16 text-xs ${tab === id ? "text-[#c084fc]" : "text-[#64748b]"}`}
          >
            <Icon size={22} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
