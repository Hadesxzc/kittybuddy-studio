import { type ReactNode, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Palette,
  Film,
  Cpu,
  FolderKanban,
  Settings,
  Cat,
} from "lucide-react";
import { StatusBar } from "../ui/StatusBar";
import { useDeviceStore } from "../../stores/deviceStore";
import { useProjectStore } from "../../stores/projectStore";
import { useAnimationStore } from "../../stores/animationStore";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, tech: "dashboard.sys" },
  { to: "/editor", label: "Character Editor", icon: Palette, tech: "editor.exe" },
  { to: "/animation", label: "Animation Studio", icon: Film, tech: "animation.log" },
  { to: "/device", label: "Device Manager", icon: Cpu, tech: "device.mgmt" },
  { to: "/projects", label: "Project Library", icon: FolderKanban, tech: "projects.db" },
  { to: "/settings", label: "Settings", icon: Settings, tech: "config.sys" },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const deviceState = useDeviceStore((s) => s.status.state);
  const { projects, activeProjectId, isLoading, loadProjects } = useProjectStore();
  const loadAnimations = useAnimationStore((s) => s.loadFromProject);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load the active project's animations into the animation store, so that
  // refreshing the page never lets an empty store overwrite saved work.
  useEffect(() => {
    if (isLoading) return;
    const p = useProjectStore.getState().projects.find((x) => x.id === activeProjectId);
    if (p) loadAnimations(p.animations, p.animationConfig);
  }, [activeProjectId, isLoading, loadAnimations]);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0b0f] noise-bg">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-[#1e2129] bg-[#06070a] flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[#1e2129]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#c084fc] flex items-center justify-center"
              style={{ boxShadow: "0 0 12px rgba(192, 132, 252, 0.3)" }}
            >
              <Cat size={20} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#e2e8f0] leading-tight">
                KittyBuddy
              </div>
              <div className="terminal-label text-[#475569]">STUDIO</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all group ${
                  active
                    ? "bg-[#1c1f2b] text-[#e2e8f0]"
                    : "text-[#475569] hover:text-[#94a3b8] hover:bg-[#101218]"
                }`}
              >
                <Icon size={16} className={active ? "text-[#c084fc]" : ""} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{item.label}</div>
                  <div className="terminal-label text-[#475569]">{item.tech}</div>
                </div>
                {active && (
                  <div className="w-0.5 h-6 bg-[#c084fc] rounded-full" style={{ boxShadow: "0 0 6px #c084fc" }} />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Active project indicator */}
        <div className="px-3 py-3 border-t border-[#1e2129]">
          <div className="terminal-label text-[#475569] mb-1">active.project</div>
          <div className="terminal-text text-[#94a3b8] truncate">
            {activeProject ? activeProject.name : "— none —"}
          </div>
        </div>

        {/* Device status mini */}
        <div className="px-3 py-3 border-t border-[#1e2129]">
          <div className="terminal-label text-[#475569] mb-1">device.status</div>
          <div className="flex items-center gap-2">
            <div
              className={`status-dot status-dot-${
                deviceState === "connected"
                  ? "connected"
                  : deviceState === "error"
                    ? "error"
                    : deviceState === "connecting"
                      ? "connecting"
                      : "disconnected"
              }`}
            />
            <span className="terminal-text text-[#94a3b8]">
              {deviceState === "connected"
                ? "ONLINE"
                : deviceState === "disconnected"
                  ? "OFFLINE"
                  : deviceState.toUpperCase()}
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <StatusBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
