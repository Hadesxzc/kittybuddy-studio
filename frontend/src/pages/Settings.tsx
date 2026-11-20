import { useRef, useState } from "react";
import {
  Settings as SettingsIcon,
  Monitor,
  Film,
  Edit3,
  Database,
  Cpu,
  Download,
  Upload,
  Trash2,
} from "lucide-react";
import { useDeviceStore } from "../stores/deviceStore";
import { useProjectStore } from "../stores/projectStore";
import { useEditorStore } from "../stores/editorStore";
import { useAnimationStore } from "../stores/animationStore";

export function Settings() {
  const device = useDeviceStore();
  const project = useProjectStore();
  const editor = useEditorStore();
  const anim = useAnimationStore();
  const importRef = useRef<HTMLInputElement>(null);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleExportAll = () => {
    const data = project.projects.map((p) => project.exportProject(p.id)).filter(Boolean);
    if (data.length === 0) { setExportResult("No projects to export"); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kittybuddy-projects.json";
    a.click();
    URL.revokeObjectURL(url);
    setExportResult(`Exported ${data.length} project(s) ✓`);
    setTimeout(() => setExportResult(null), 3000);
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    // Try array first, then single
    let ok = false;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (await project.importProject(JSON.stringify(item))) ok = true;
        }
      } else {
        ok = await project.importProject(text);
      }
    } catch { ok = false; }
    setImportResult(ok ? "Import successful ✓" : "Import failed ✗");
    setTimeout(() => setImportResult(null), 3000);
  };

  return (
    <div className="p-6 space-y-6">
      <header className="fade-in">
        <div className="flex items-center gap-2 mb-1">
          <span className="terminal-label text-[#c084fc]">config.sys</span>
          <span className="terminal-label text-[#475569]">// preferences</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#e2e8f0] tracking-tight">Settings</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Device Settings */}
        <Section icon={Cpu} title="Device" tech="device.settings">
          <div className="space-y-2">
            <Field label="base.url">
              <input className="input-field" value={device.status.baseUrl}
                onChange={(e) => device.setBaseUrl(e.target.value)} placeholder="http://192.168.4.1" />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={device.status.isSimulation}
                onChange={(e) => device.setSimulationMode(e.target.checked)} className="accent-[#c084fc]" />
              <span className="terminal-text text-[#94a3b8]">simulation.mode</span>
            </label>
          </div>
        </Section>

        {/* Display Preferences */}
        <Section icon={Monitor} title="Display" tech="display.prefs">
          <div className="space-y-3">
            <Field label="i2c.address">
              <select className="input-field" value={project.displaySettings.i2cAddress}
                onChange={(e) => project.setDisplaySettings({ i2cAddress: e.target.value })}>
                <option value="0x3C">0x3C</option>
                <option value="0x3D">0x3D</option>
              </select>
            </Field>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={project.displaySettings.flipHorizontal}
                  onChange={(e) => project.setDisplaySettings({ flipHorizontal: e.target.checked })} className="accent-[#c084fc]" />
                <span className="terminal-text text-[#94a3b8]">flip.horizontal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={project.displaySettings.flipVertical}
                  onChange={(e) => project.setDisplaySettings({ flipVertical: e.target.checked })} className="accent-[#c084fc]" />
                <span className="terminal-text text-[#94a3b8]">flip.vertical</span>
              </label>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={project.displaySettings.invertDisplay}
                onChange={(e) => project.setDisplaySettings({ invertDisplay: e.target.checked })} className="accent-[#c084fc]" />
              <span className="terminal-text text-[#94a3b8]">invert.display</span>
            </label>
            <RangeRow label="contrast" value={project.displaySettings.contrast} min={0} max={255}
              onChange={(v) => project.setDisplaySettings({ contrast: v })} />
            <RangeRow label="brightness" value={project.displaySettings.brightness} min={0} max={255}
              onChange={(v) => project.setDisplaySettings({ brightness: v })} />
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Animation Preferences */}
        <Section icon={Film} title="Animation" tech="animation.prefs">
          <div className="space-y-3">
            <Field label="blink.interval (ms)">
              <input type="number" className="input-field" value={anim.config.blinkInterval}
                onChange={(e) => anim.setConfig({ blinkInterval: parseInt(e.target.value) || 3000 })} />
            </Field>
            <RangeRow label="blink.randomness" value={anim.config.blinkRandomness} min={0} max={100} suffix="%"
              onChange={(v) => anim.setConfig({ blinkRandomness: v })} />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={anim.config.autoReturnToIdle}
                onChange={(e) => anim.setConfig({ autoReturnToIdle: e.target.checked })} className="accent-[#c084fc]" />
              <span className="terminal-text text-[#94a3b8]">auto.return.to.idle</span>
            </label>
            <Field label="idle.timeout (ms)">
              <input type="number" className="input-field" value={anim.config.idleTimeout}
                onChange={(e) => anim.setConfig({ idleTimeout: parseInt(e.target.value) || 5000 })} />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={anim.config.sleepEnabled}
                onChange={(e) => anim.setConfig({ sleepEnabled: e.target.checked })} className="accent-[#c084fc]" />
              <span className="terminal-text text-[#94a3b8]">sleep.enabled</span>
            </label>
            <Field label="sleep.timeout (ms)">
              <input type="number" className="input-field" value={anim.config.sleepTimeout}
                onChange={(e) => anim.setConfig({ sleepTimeout: parseInt(e.target.value) || 30000 })} />
            </Field>
            <RangeRow label="global.speed" value={anim.config.globalSpeed} min={0.5} max={2} step={0.1} suffix="x"
              onChange={(v) => anim.setConfig({ globalSpeed: v })} />
          </div>
        </Section>

        {/* Editor Preferences */}
        <Section icon={Edit3} title="Editor" tech="editor.prefs">
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editor.showGrid}
                onChange={() => editor.toggleGrid()} className="accent-[#c084fc]" />
              <span className="terminal-text text-[#94a3b8]">show.grid</span>
            </label>
            <Field label="default.zoom">
              <select className="input-field" value={String(editor.zoom)}
                onChange={(e) => editor.setZoom(parseFloat(e.target.value))}>
                <option value="0.5">0.5x</option>
                <option value="1">1x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
                <option value="3">3x</option>
              </select>
            </Field>
            <Field label="editor.mode">
              <select className="input-field" value={editor.editorMode}
                onChange={(e) => editor.setEditorMode(e.target.value as "visual" | "code")}>
                <option value="visual">Visual Mode</option>
                <option value="code">Code Mode</option>
              </select>
            </Field>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* App Preferences */}
        <Section icon={SettingsIcon} title="Application" tech="app.prefs">
          <div className="space-y-2">
            <Field label="ota.password">
              <input className="input-field" type="password" placeholder="Secure OTA uploads"
                value={localStorage.getItem("otaPassword") ?? ""}
                onChange={(e) => localStorage.setItem("otaPassword", e.target.value)} />
            </Field>
            <Field label="wifi.ssid">
              <input className="input-field" defaultValue="KittyBuddy-Studio" />
            </Field>
            <Field label="wifi.password">
              <input className="input-field" type="password" placeholder="••••••••" />
            </Field>
          </div>
        </Section>

        {/* Data Management */}
        <Section icon={Database} title="Data Management" tech="data.mgmt">
          <div className="space-y-2">
            <button className="btn w-full" onClick={handleExportAll}>
              <Download size={14} /> Export All Projects
            </button>
            {exportResult && <div className="terminal-text text-center text-[#94a3b8]">{exportResult}</div>}
            <input ref={importRef} type="file" accept=".json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
            <button className="btn w-full" onClick={() => importRef.current?.click()}>
              <Upload size={14} /> Import Project(s)
            </button>
            {importResult && <div className="terminal-text text-center text-[#94a3b8]">{importResult}</div>}
            <button className="btn btn-danger w-full" onClick={() => {
              if (confirm("Delete ALL projects? This cannot be undone.")) {
                project.projects.forEach((p) => project.deleteProject(p.id));
              }
            }}>
              <Trash2 size={14} /> Clear All Data
            </button>
          </div>
        </Section>
      </div>
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

function RangeRow({ label, value, min, max, step = 1, suffix = "", onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between terminal-label mb-1">
        <span className="text-[#475569]">{label}</span>
        <span className="text-[#c084fc]">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-[#c084fc]" />
    </div>
  );
}

export default Settings;
