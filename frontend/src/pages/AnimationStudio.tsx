import { useEffect, useState, useCallback } from "react";
import {
  Film,
  Plus,
  Trash2,
  Copy,
  Play,
  Pause,
  Square as StopIcon,
  Clock,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react";
import { useAnimationStore } from "../stores/animationStore";
import { useEditorStore } from "../stores/editorStore";
import { useProjectStore } from "../stores/projectStore";
import { OledPreview } from "../components/editor/OledPreview";
import { ANIMATION_PRESETS } from "../data/presets";
import { pixelsToDataURL } from "../utils/imageProcessor";
import { OLED_WIDTH, OLED_HEIGHT, type AnimationFrame } from "../types";

export function AnimationStudio() {
  const anim = useAnimationStore();
  const editor = useEditorStore();
  const project = useProjectStore();
  const [newName, setNewName] = useState("");

  const selected = anim.animations.find((a) => a.id === anim.selectedAnimationId) ?? null;
  const currentFrame = selected?.frames[anim.selectedFrameIndex] ?? null;
  const playbackFrameData = selected?.frames[anim.playbackFrame]?.pixels ?? null;

  // Animation loop for playback
  useEffect(() => {
    if (!anim.isPlaying) return;
    let raf = 0;
    const loop = () => {
      anim.tick(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [anim.isPlaying]);

  // Sync editor pixels with selected frame
  useEffect(() => {
    if (currentFrame && !anim.isPlaying) {
      editor.setPixels(currentFrame.pixels);
    }
  }, [anim.selectedAnimationId, anim.selectedFrameIndex, anim.isPlaying]);

  // Save animation data to project
  const saveToProject = useCallback(() => {
    const active = project.getActiveProject();
    if (!active) return;
    project.updateActiveProject((p) => ({
      ...p,
      animations: anim.animations.map((a) => ({
        ...a,
        frames: a.frames.map((f) => ({ ...f, pixels: new Uint8Array(f.pixels) })),
      })),
      animationConfig: { ...anim.config },
    }));
  }, [anim.animations, anim.config, project]);

  // Auto-save with debounce
  useEffect(() => {
    const timer = setTimeout(saveToProject, 1500);
    return () => clearTimeout(timer);
  }, [anim.animations, anim.config]);

  const handleCreate = () => {
    const name = newName.trim() || "New Animation";
    anim.createAnimation(name);
    setNewName("");
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = ANIMATION_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      anim.loadPreset(preset);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-3 border-b border-[#1e2129] flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Film size={18} className="text-[#c084fc]" />
          <h1 className="text-sm font-semibold text-[#e2e8f0]">Animation Studio</h1>
        </div>
        <span className="terminal-label text-[#475569]">animation.log</span>

        <div className="ml-auto flex items-center gap-2">
          {selected && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selected.loop}
                onChange={(e) => anim.setLoop(selected.id, e.target.checked)} className="accent-[#c084fc]" />
              <span className="terminal-text text-[#94a3b8]">loop</span>
            </label>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Animation list + presets */}
        <div className="w-64 flex-shrink-0 border-r border-[#1e2129] bg-[#0a0b0f] overflow-y-auto">
          {/* Create new */}
          <div className="p-3 border-b border-[#1e2129]">
            <div className="flex gap-1">
              <input className="input-field" placeholder="Animation name…"
                value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }} />
              <button className="btn btn-primary px-2" onClick={handleCreate} title="Create">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Animation list */}
          <div className="p-2 border-b border-[#1e2129]">
            <div className="terminal-label text-[#475569] px-1 mb-2">my.animations</div>
            {anim.animations.length === 0 ? (
              <div className="terminal-text text-[#475569] text-center py-4 text-xs">No animations yet</div>
            ) : (
              <div className="space-y-0.5">
                {anim.animations.map((a) => (
                  <button key={a.id} onClick={() => anim.selectAnimation(a.id)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded text-left transition-all ${
                      anim.selectedAnimationId === a.id
                        ? "bg-[#1c1f2b] text-[#e2e8f0] border border-[#c084fc]/30"
                        : "hover:bg-[#101218] text-[#475569]"
                    }`}>
                    <Film size={12} className={anim.selectedAnimationId === a.id ? "text-[#c084fc]" : ""} />
                    <span className="text-xs flex-1 truncate">{a.name}</span>
                    <span className="terminal-label">{a.frames.length}f</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Presets */}
          <div className="p-2">
            <div className="terminal-label text-[#475569] px-1 mb-2 flex items-center gap-1">
              <Sparkles size={11} /> animation.presets
            </div>
            <div className="space-y-0.5">
              {ANIMATION_PRESETS.map((p) => (
                <button key={p.id} onClick={() => handleLoadPreset(p.id)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded text-left hover:bg-[#101218] text-[#475569] hover:text-[#94a3b8] transition-all">
                  <span className="w-2 h-2 rounded-full" style={{ background: p.category === "expression" ? "#c084fc" : "#22d3ee" }} />
                  <span className="text-xs flex-1 truncate">{p.name}</span>
                  <span className="terminal-label">{p.frames.length}f</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Preview + Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#06070a]">
          {/* Preview */}
          <div className="flex items-center justify-center py-6 border-b border-[#1e2129]">
            {selected && playbackFrameData ? (
              <OledPreview pixels={playbackFrameData} scale={4} showInfo />
            ) : selected && currentFrame ? (
              <OledPreview pixels={currentFrame.pixels} scale={4} showInfo />
            ) : (
              <div className="flex flex-col items-center text-[#475569]">
                <Film size={32} className="mb-2" />
                <span className="terminal-label">Select or create an animation</span>
              </div>
            )}
          </div>

          {/* Playback controls */}
          {selected && (
            <div className="flex items-center justify-center gap-2 py-2 border-b border-[#1e2129]">
              <button className="btn btn-ghost" onClick={() => anim.isPlaying ? anim.pause() : anim.play()} title={anim.isPlaying ? "Pause" : "Play"}>
                {anim.isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button className="btn btn-ghost" onClick={() => anim.stop()} title="Stop">
                <StopIcon size={16} />
              </button>
              <button className="btn btn-ghost" onClick={() => { if (anim.selectedFrameIndex > 0) anim.selectFrame(anim.selectedFrameIndex - 1); }}
                disabled={anim.selectedFrameIndex === 0} title="Previous frame">
                <ChevronLeft size={16} />
              </button>
              <span className="terminal-text text-[#94a3b8] px-2">
                Frame {anim.selectedFrameIndex + 1} / {selected.frames.length}
              </span>
              <button className="btn btn-ghost" onClick={() => { if (anim.selectedFrameIndex < selected.frames.length - 1) anim.selectFrame(anim.selectedFrameIndex + 1); }}
                disabled={anim.selectedFrameIndex === selected.frames.length - 1} title="Next frame">
                <ChevronRight size={16} />
              </button>
              <div className="w-px h-5 bg-[#1e2129] mx-1" />
              <button className="btn btn-ghost" onClick={() => anim.addFrame(selected.id)} title="Add frame">
                <Plus size={16} />
              </button>
              <button className="btn btn-ghost" onClick={() => anim.duplicateFrame(selected.id, anim.selectedFrameIndex)} title="Duplicate frame">
                <Copy size={16} />
              </button>
              <button className="btn btn-ghost text-[#f87171]"
                onClick={() => { if (selected.frames.length > 1) anim.deleteFrame(selected.id, anim.selectedFrameIndex); }}
                disabled={selected.frames.length <= 1} title="Delete frame">
                <Trash2 size={16} />
              </button>
            </div>
          )}

          {/* Timeline */}
          {selected && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="terminal-label text-[#475569] px-4 py-2 border-b border-[#1e2129] flex items-center gap-2">
                <Layers size={11} /> timeline · {selected.frames.length} frames
              </div>
              <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
                <div className="flex gap-2 h-full items-center min-w-min">
                  {selected.frames.map((frame, idx) => (
                    <FrameThumb
                      key={frame.id}
                      frame={frame}
                      index={idx}
                      isSelected={idx === anim.selectedFrameIndex}
                      onClick={() => anim.selectFrame(idx)}
                      onDurationChange={(d) => anim.setFrameDuration(selected.id, idx, d)}
                    />
                  ))}
                </div>
              </div>

              {/* Behavior config */}
              <div className="border-t border-[#1e2129] p-4 space-y-3 bg-[#0a0b0f]">
                <div className="terminal-label text-[#475569] flex items-center gap-2">
                  <Clock size={11} /> animation.behavior
                </div>
                <label className="flex flex-col gap-1">
                  <span className="terminal-label text-[#475569]">idle.animation (plays when nothing else is active)</span>
                  <select className="input-field" value={anim.config.idleAnimationId ?? ""}
                    onChange={(e) => anim.setConfig({ idleAnimationId: e.target.value || null })}>
                    <option value="">— first animation —</option>
                    {anim.animations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <div>
                  <div className="terminal-label text-[#475569] mb-1">
                    button.sequence (BOOT button cycles these in order)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {anim.animations.map((a) => {
                      const pos = anim.config.buttonExpressions.indexOf(a.id);
                      const on = pos >= 0;
                      return (
                        <button key={a.id}
                          className={`px-2 py-1 rounded border text-xs transition-all ${
                            on ? "border-[#c084fc] text-[#e2e8f0] bg-[#c084fc]/10" : "border-[#1e2129] text-[#475569] hover:text-[#94a3b8]"
                          }`}
                          onClick={() => anim.setConfig({
                            buttonExpressions: on
                              ? anim.config.buttonExpressions.filter((id) => id !== a.id)
                              : [...anim.config.buttonExpressions, a.id],
                          })}>
                          {on ? `${pos + 1}. ` : ""}{a.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="terminal-label text-[#475569]">blink.interval (ms)</span>
                    <input type="number" className="input-field" value={anim.config.blinkInterval}
                      onChange={(e) => anim.setConfig({ blinkInterval: parseInt(e.target.value) || 3000 })} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="terminal-label text-[#475569]">idle.timeout (ms)</span>
                    <input type="number" className="input-field" value={anim.config.idleTimeout}
                      onChange={(e) => anim.setConfig({ idleTimeout: parseInt(e.target.value) || 5000 })} />
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={anim.config.autoReturnToIdle}
                      onChange={(e) => anim.setConfig({ autoReturnToIdle: e.target.checked })} className="accent-[#c084fc]" />
                    <span className="terminal-text text-[#94a3b8]">auto.return.to.idle</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={anim.config.sleepEnabled}
                      onChange={(e) => anim.setConfig({ sleepEnabled: e.target.checked })} className="accent-[#c084fc]" />
                    <span className="terminal-text text-[#94a3b8]">sleep.enabled</span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="terminal-label text-[#475569]">global.speed</span>
                    <div className="flex items-center gap-2">
                      <input type="range" min={0.5} max={2} step={0.1} value={anim.config.globalSpeed}
                        onChange={(e) => anim.setConfig({ globalSpeed: parseFloat(e.target.value) })} className="accent-[#c084fc] flex-1" />
                      <span className="terminal-text text-[#c084fc] text-xs">{anim.config.globalSpeed}x</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Frame info */}
        {selected && currentFrame && (
          <div className="w-56 flex-shrink-0 border-l border-[#1e2129] bg-[#0a0b0f] overflow-y-auto p-3">
            <div className="terminal-label text-[#475569] mb-2">frame.properties</div>
            <div className="space-y-3">
              <div>
                <div className="terminal-label text-[#475569] mb-1">label</div>
                <input className="input-field" value={currentFrame.label}
                  onChange={(e) => anim.setFrameLabel(selected.id, anim.selectedFrameIndex, e.target.value)} />
              </div>
              <div>
                <div className="flex justify-between terminal-label mb-1">
                  <span className="text-[#475569]">duration</span>
                  <span className="text-[#c084fc]">{currentFrame.duration}ms</span>
                </div>
                <input type="range" min={50} max={2000} step={50} value={currentFrame.duration}
                  onChange={(e) => anim.setFrameDuration(selected.id, anim.selectedFrameIndex, parseInt(e.target.value))}
                  className="w-full accent-[#c084fc]" />
              </div>
              <div className="pt-2 border-t border-[#1e2129] space-y-2">
                <button className="btn w-full text-xs" onClick={() => {
                  editor.setPixels(currentFrame.pixels);
                  window.location.hash = "/editor";
                }}>
                  <Upload size={12} /> Edit in Pixel Editor
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FrameThumb({
  frame, index, isSelected, onClick, onDurationChange,
}: {
  frame: AnimationFrame; index: number; isSelected: boolean; onClick: () => void; onDurationChange: (ms: number) => void;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 flex-shrink-0 transition-all ${
      isSelected ? "scale-100" : "opacity-60 hover:opacity-100"
    }`}>
      <button onClick={onClick}
        className={`relative overflow-hidden rounded border-2 transition-all ${
          isSelected ? "border-[#c084fc]" : "border-[#1e2129] hover:border-[#3a3f50]"
        }`}
        style={isSelected ? { boxShadow: "0 0 8px rgba(192,132,252,0.3)" } : {}}>
        <img src={pixelsToDataURL(frame.pixels, OLED_WIDTH, OLED_HEIGHT, 2)}
          alt={frame.label} className="block bg-black" style={{ imageRendering: "pixelated" }} />
        <div className="absolute top-0.5 left-0.5 bg-[#06070a]/80 px-1 rounded text-[10px] font-mono text-[#94a3b8]">
          {index + 1}
        </div>
      </button>
      <input type="number" value={frame.duration} min={50} max={2000} step={50}
        onChange={(e) => onDurationChange(parseInt(e.target.value) || 200)}
        className="w-16 text-center bg-[#06070a] border border-[#1e2129] rounded px-1 py-0.5 text-[10px] font-mono text-[#94a3b8]" />
      <span className="text-[9px] font-mono text-[#475569] truncate max-w-[100px]">{frame.label}</span>
    </div>
  );
}

export default AnimationStudio;
